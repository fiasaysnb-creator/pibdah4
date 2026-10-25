import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import { offlineStorage } from '../services/offlineStorage';

const CACHE_VERSION = 1;
const CACHE_TTL_MINUTES = 12 * 60;
const PERSISTED_QUERY_KEYS = new Set([
  'clients',
  'projects',
  'teamMembers',
  'transactions',
  'leads',
  'cards',
  'pockets',
  'packages',
  'addOns',
  'calendarEvents',
  'clientFeedback',
  'dashboardStats',
  'promoCodes',
  'profile',
  'teamProjectPayments',
  'teamPaymentRecords',
  'notifications',
]);

interface PersistedQueryCache {
  version: number;
  cache: ReturnType<typeof dehydrate>;
}

export function getCurrentCacheScope(): string | null {
  try {
    if (window.localStorage.getItem('weddfin-isAuthenticated') !== 'true') return null;
    const user = JSON.parse(window.localStorage.getItem('weddfin-currentUser') || 'null');
    return typeof user?.id === 'string' && user.id ? user.id : null;
  } catch {
    return null;
  }
}

function getCacheKey(userId: string): string {
  return `react-query-cache:${encodeURIComponent(userId)}`;
}

export async function restoreQueryCache(queryClient: QueryClient, userId: string): Promise<boolean> {
  const persisted = await offlineStorage.getCachedData<PersistedQueryCache>(getCacheKey(userId));
  if (!persisted || persisted.version !== CACHE_VERSION) return false;
  hydrate(queryClient, persisted.cache);
  return true;
}

export function persistQueryCache(queryClient: QueryClient, userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writeChain = Promise.resolve();

  const save = () => {
    const cache: PersistedQueryCache = {
      version: CACHE_VERSION,
      cache: dehydrate(queryClient, {
        shouldDehydrateQuery: query =>
          query.state.status === 'success' &&
          PERSISTED_QUERY_KEYS.has(String(query.queryKey[0])),
      }),
    };

    writeChain = writeChain
      .catch((error) => {
        console.warn('[QueryCache] Previous local cache write failed:', error);
      })
      .then(() => offlineStorage.cacheData(getCacheKey(userId), cache, CACHE_TTL_MINUTES))
      .catch((error) => {
        console.warn('[QueryCache] Failed to save local cache:', error);
      });
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    if (event.action.type !== 'success' && event.action.type !== 'setState') return;
    if (!PERSISTED_QUERY_KEYS.has(String(event.query.queryKey[0]))) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 500);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
