import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';

const DP_PROOFS_BUCKET = 'dp-proofs';
const GALLERY_BUCKET = 'gallery-images';

/** Repoint legacy public Storage URLs to this project's bucket when the same
 * object path has been carried over. URLs from non-Supabase hosts are untouched. */
export function canonicalizeStorageAssetUrl(value: string): string {
  if (!isSupabaseConfigured || !value) return value;

  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/public\/(gallery-images|dp-proofs)\/(.+)$/);
    if (!match || !parsed.hostname.endsWith('.supabase.co')) return value;

    const bucket = match[1];
    const objectPath = decodeURIComponent(match[2]);
    const canonical = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
    const canonicalUrl = new URL(canonical);
    if (canonicalUrl.origin === parsed.origin) return value;

    canonicalUrl.search = parsed.search;
    canonicalUrl.hash = parsed.hash;
    return canonicalUrl.toString();
  } catch {
    return value;
  }
}

export function canonicalizeStorageAssetUrls<T>(value: T): T {
  if (typeof value === 'string') return canonicalizeStorageAssetUrl(value) as T;
  if (Array.isArray(value)) return value.map(item => canonicalizeStorageAssetUrls(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, canonicalizeStorageAssetUrls(item)]),
    ) as T;
  }
  return value;
}

export async function uploadImageAsset(file: File, folder = 'assets'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File must be an image');
  if (file.size > 10 * 1024 * 1024) throw new Error('File size must be less than 10MB');

  // Logo/TTD PNG must keep transparency. WebP supports alpha and is usually
  // much smaller than storing the original PNG; SVG remains vector as-is.
  const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  const processedFile = await compressImage(file, 1200, 0.82, 400 * 1024, outputType);
  if (processedFile.size > 10 * 1024 * 1024) throw new Error('File size must be less than 10MB after compression');

  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'assets';
  const extension = processedFile.type.split('/')[1]?.replace('svg+xml', 'svg') || 'bin';
  const now = new Date();
  const path = `${safeFolder}/${now.getFullYear()}/${now.getMonth() + 1}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage.from(GALLERY_BUCKET).upload(path, processedFile, {
    contentType: processedFile.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;

  const { data: publicUrl } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(data.path);
  return publicUrl.publicUrl;
}

export async function uploadImageDataUrl(dataUrl: string, folder: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return dataUrl;

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const extension = match[1].split('/')[1]?.replace('svg+xml', 'svg') || 'bin';
  const file = new File([bytes], `image.${extension}`, { type: match[1] });
  return uploadImageAsset(file, folder);
}

export async function uploadDpProof(file: File): Promise<string> {
  const processedFile = await compressImage(file, 1200, 0.8, 400 * 1024); // retain readability for proof images
  const ext = (processedFile.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${crypto.randomUUID()}.${ext}`;

  // Ensure bucket exists (best-effort; ignore failure if already exists)
  try {
    // Note: Supabase JS client does not manage buckets creation; this would be done via SQL or dashboard.
    // Keep this try/catch as documentation. If bucket missing, upload will throw and we surface a clear error.
  } catch {}

  const { data, error } = await supabase.storage.from(DP_PROOFS_BUCKET).upload(path, processedFile, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;

  const { data: publicUrl } = supabase.storage.from(DP_PROOFS_BUCKET).getPublicUrl(data.path);
  return publicUrl.publicUrl;
}

// Fungsi untuk mengompres gambar menggunakan Canvas API
export async function compressImage(
  file: File,
  maxWidthOrHeight: number = 1920,
  quality: number = 0.8,
  maxSizeBytes?: number,
  outputType: 'image/jpeg' | 'image/webp' = 'image/jpeg',
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file; // Jangan kompres non-gambar, gif, atau svg
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          } else {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser tidak mendukung kompresi gambar.'));
          return;
        }

        const qualities = maxSizeBytes
          ? [...new Set([quality, quality - 0.15, quality - 0.3, 0.35].map(value => Math.max(0.25, Math.min(1, value))))]
          : [quality];
        const encode = (qualityStep: number) => new Promise<Blob | null>((resolveBlob) => {
          canvas.toBlob(resolveBlob, outputType, qualityStep);
        });
        const makeCompressedFile = (blob: Blob) => {
          const contentType = blob.type || outputType;
          const extension = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';
          return new File([blob], file.name.replace(/\.[^/.]+$/, `.${extension}`), {
            type: contentType,
            lastModified: Date.now(),
          });
        };

        void (async () => {
          let bestBlob: Blob | null = null;
          let currentWidth = width;
          let currentHeight = height;

          for (let resizeAttempt = 0; resizeAttempt < 10; resizeAttempt++) {
            canvas.width = currentWidth;
            canvas.height = currentHeight;
            ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

            for (const qualityStep of qualities) {
              const blob = await encode(qualityStep);
              if (!blob) {
                reject(new Error('Gagal mengompres gambar bukti transfer.'));
                return;
              }

              if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
              if (!maxSizeBytes || blob.size <= maxSizeBytes) {
                resolve(makeCompressedFile(blob));
                return;
              }
            }

            const longestEdge = Math.max(currentWidth, currentHeight);
            if (!maxSizeBytes || longestEdge <= 480) break;
            const scale = Math.max(480 / longestEdge, 0.75);
            currentWidth = Math.max(1, Math.round(currentWidth * scale));
            currentHeight = Math.max(1, Math.round(currentHeight * scale));
          }

          resolve(bestBlob ? makeCompressedFile(bestBlob) : file);
        })().catch(reject);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export async function uploadGalleryImage(file: File, compress: boolean = true): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  
  // Kompres gambar jika compress true (default sekarang true agar jadi KB)
  const processedFile = compress ? await compressImage(file, 1920, 0.8, 200 * 1024) : file;
  
  // Final size check
  if (processedFile.size > 10 * 1024 * 1024) { // 10MB limit
    throw new Error('File size must be less than 10MB');
  }

  const ext = processedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${crypto.randomUUID()}.${ext}`;

  try {
    const { data, error } = await supabase.storage.from(GALLERY_BUCKET).upload(path, processedFile, {
      cacheControl: '31536000',
      upsert: false,
    });
    
    if (error) {
      console.error('Supabase storage error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrl } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(data.path);
    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Gallery image upload error:', error);
    throw error;
  }
}

export async function deleteGalleryImage(imageUrl: string): Promise<void> {
  try {
    // Extract path from URL
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/gallery-images\/(.+)/);
    
    if (pathMatch) {
      const filePath = pathMatch[1];
      const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([filePath]);
      if (error) {
        console.error('Error deleting gallery image:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error parsing gallery image URL for deletion:', error);
    throw error;
  }
}
