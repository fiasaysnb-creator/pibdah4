/**
 * Offline Storage Service
 * Menggunakan IndexedDB untuk penyimpanan lokal yang robust
 */

import { generateUUID } from '../utils/uuid';

const DB_NAME = 'weddfin_offline_db';
// Bump DB version so onupgradeneeded runs for existing installations that
// may be missing stores (e.g. failed_operations). Increment when adding
// or changing stores.
const DB_VERSION = 2;

// Store names
export const STORES = {
  PENDING_OPERATIONS: 'pending_operations',
  CACHED_DATA: 'cached_data',
  SYNC_STATUS: 'sync_status',
  FAILED_OPERATIONS: 'failed_operations',
} as const;

export interface PendingOperation {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
  error?: string;
}

export interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

export interface SyncStatus {
  lastSync: number;
  pendingCount: number;
  failedCount: number;
}

class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // Helper to check whether required stores exist in the opened DB.
  private storesExist(names: string[]) {
    if (!this.db) return false;
    return names.every(n => this.db!.objectStoreNames.contains(n));
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store untuk operasi yang pending
        if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
          const store = db.createObjectStore(STORES.PENDING_OPERATIONS, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('table', 'table', { unique: false });
        }

        // Store untuk data yang di-cache
        if (!db.objectStoreNames.contains(STORES.CACHED_DATA)) {
          const store = db.createObjectStore(STORES.CACHED_DATA, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store untuk status sinkronisasi
        if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
          db.createObjectStore(STORES.SYNC_STATUS, { keyPath: 'id' });
        }

        // Store untuk operasi yang gagal
        if (!db.objectStoreNames.contains(STORES.FAILED_OPERATIONS)) {
          const store = db.createObjectStore(STORES.FAILED_OPERATIONS, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('table', 'table', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // === PENDING OPERATIONS ===
  
  async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    await this.init();
    const id = generateUUID();
    const op: PendingOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const request = store.add(op);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_OPERATIONS], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingOperation(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updatePendingOperation(id: string, updates: Partial<PendingOperation>): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_OPERATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          const updated = { ...operation, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Operation not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // === CACHED DATA ===

  async cacheData(key: string, data: any, ttlMinutes?: number): Promise<void> {
    await this.init();
    const cached: CachedData = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: ttlMinutes ? Date.now() + (ttlMinutes * 60 * 1000) : undefined,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DATA);
      const request = store.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData<T = any>(key: string): Promise<T | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_DATA);
      const request = store.get(key);

      request.onsuccess = () => {
        const cached = request.result as CachedData | undefined;
        if (!cached) {
          resolve(null);
          return;
        }

        // Check expiration
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
          this.removeCachedData(key); // Clean up expired data
          resolve(null);
          return;
        }

        resolve(cached.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeCachedData(key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DATA);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpiredCache(): Promise<void> {
    await this.init();
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DATA);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cached = cursor.value as CachedData;
          if (cached.expiresAt && now > cached.expiresAt) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // === SYNC STATUS ===

  async updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SYNC_STATUS], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_STATUS);
      const getRequest = store.get('main');

      getRequest.onsuccess = () => {
        const current = getRequest.result || { id: 'main', lastSync: 0, pendingCount: 0, failedCount: 0 };
        const updated = { ...current, ...status };
        const putRequest = store.put(updated);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getSyncStatus(): Promise<SyncStatus> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SYNC_STATUS], 'readonly');
      const store = transaction.objectStore(STORES.SYNC_STATUS);
      const request = store.get('main');

      request.onsuccess = () => {
        resolve(request.result || { lastSync: 0, pendingCount: 0, failedCount: 0 });
      };
      request.onerror = () => reject(request.error);
    });
  }

  // === UTILITY ===

  async clearAll(): Promise<void> {
    await this.init();
    const storeNames = [STORES.PENDING_OPERATIONS, STORES.CACHED_DATA, STORES.SYNC_STATUS];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite');
      let completed = 0;

      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === storeNames.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // === FAILED OPERATIONS ===

  async getFailedOperations(): Promise<PendingOperation[]> {
    await this.init();
    // Defensive: if the failed operations store isn't present (older DB),
    // avoid throwing a NotFoundError and return an empty list.
    if (!this.storesExist([STORES.FAILED_OPERATIONS])) {
      console.warn('[OfflineStorage] failed_operations store missing; returning []');
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORES.FAILED_OPERATIONS], 'readonly');
        const store = transaction.objectStore(STORES.FAILED_OPERATIONS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        // Catch synchronous NotFoundError from transaction creation
        console.warn('[OfflineStorage] getFailedOperations error while creating transaction:', err);
        resolve([]);
      }
    });
  }

  async moveToFailedOperations(operation: PendingOperation): Promise<void> {
    await this.init();
    // If the store is missing, log and resolve so the app doesn't crash.
    if (!this.storesExist([STORES.FAILED_OPERATIONS])) {
      console.warn('[OfflineStorage] moveToFailedOperations: failed_operations store missing, skipping persisting failed op');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORES.FAILED_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.FAILED_OPERATIONS);
        const request = store.add({
          ...operation,
          failedAt: Date.now(),
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        console.warn('[OfflineStorage] moveToFailedOperations transaction error:', err);
        // Resolve to avoid bubbling up NotFoundError
        resolve();
      }
    });
  }

  async retryFailedOperation(id: string): Promise<void> {
    await this.init();
    if (!this.storesExist([STORES.FAILED_OPERATIONS, STORES.PENDING_OPERATIONS])) {
      console.warn('[OfflineStorage] retryFailedOperation: required stores missing, aborting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(
          [STORES.FAILED_OPERATIONS, STORES.PENDING_OPERATIONS],
          'readwrite'
        );
        
        const failedStore = transaction.objectStore(STORES.FAILED_OPERATIONS);
        const pendingStore = transaction.objectStore(STORES.PENDING_OPERATIONS);
        
        const getRequest = failedStore.get(id);
        
        getRequest.onsuccess = () => {
          const operation = getRequest.result;
          if (operation) {
            // Reset retry count and move back to pending
            const resetOp = {
              ...operation,
              retryCount: 0,
              error: undefined,
              timestamp: Date.now(),
            };
            delete (resetOp as any).failedAt;
            
            const addRequest = pendingStore.add(resetOp);
            addRequest.onsuccess = () => {
              const deleteRequest = failedStore.delete(id);
              deleteRequest.onsuccess = () => resolve();
              deleteRequest.onerror = () => reject(deleteRequest.error);
            };
            addRequest.onerror = () => reject(addRequest.error);
          } else {
            reject(new Error('Failed operation not found'));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      } catch (err) {
        console.warn('[OfflineStorage] retryFailedOperation transaction error:', err);
        resolve();
      }
    });
  }

  async clearFailedOperations(): Promise<void> {
    await this.init();
    if (!this.storesExist([STORES.FAILED_OPERATIONS])) {
      console.warn('[OfflineStorage] clearFailedOperations: failed_operations store missing, nothing to clear');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORES.FAILED_OPERATIONS], 'readwrite');
        const store = transaction.objectStore(STORES.FAILED_OPERATIONS);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        console.warn('[OfflineStorage] clearFailedOperations transaction error:', err);
        return resolve();
      }
    });
  }
}

export const offlineStorage = new OfflineStorageService();
