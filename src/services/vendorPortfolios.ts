import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { canonicalizeStorageAssetUrls, compressImage } from './storage';
import { VendorPortfolio, PortfolioImage } from '../types';
import { generateUUID } from '../utils/uuid';

const YOUTUBE_URLS_CACHE_KEY = 'weddfin-portfolio-youtube-urls';
const LOCAL_STORAGE_PORTFOLIOS_KEY = 'weddfin-vendor-portfolios';

export const DEFAULT_PORTFOLIOS: VendorPortfolio[] = [
    {
        id: 'portfolio-sample-1',
        user_id: 'default-user',
        title: 'The Royal Wedding of Arya & Dinda',
        category: 'Wedding',
        cover_image_url: '/assets/images/backgrounds/detail-acara-pernikahan.jpg',
        images: [
            { id: 'img-1-1', url: '/assets/images/backgrounds/detail-acara-pernikahan.jpg', caption: 'Pemberkatan & Akad' },
            { id: 'img-1-2', url: '/assets/images/backgrounds/detail-pengantin-4.jpg', caption: 'Resepsi Elegan' },
            { id: 'img-1-3', url: '/assets/images/backgrounds/portal-pengantin-3.jpg', caption: 'Detail Busana & Cincin' },
        ],
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
        id: 'portfolio-sample-2',
        user_id: 'default-user',
        title: 'Intimate Sunset Vows: Rizky & Sarah',
        category: 'Prewedding',
        cover_image_url: '/assets/images/backgrounds/detail-pengantin-4.jpg',
        images: [
            { id: 'img-2-1', url: '/assets/images/backgrounds/detail-pengantin-4.jpg', caption: 'Golden Hour Session' },
            { id: 'img-2-2', url: '/assets/images/backgrounds/portal-pengantin-3.jpg', caption: 'Outdoor Romance' },
        ],
        created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
        id: 'portfolio-sample-3',
        user_id: 'default-user',
        title: 'Traditional Elegance: Farhan & Citra',
        category: 'Engagement',
        cover_image_url: '/assets/images/backgrounds/portal-pengantin-3.jpg',
        images: [
            { id: 'img-3-1', url: '/assets/images/backgrounds/portal-pengantin-3.jpg', caption: 'Momen Lamaran' },
            { id: 'img-3-2', url: '/assets/images/backgrounds/detail-acara-pernikahan.jpg', caption: 'Kebersamaan Keluarga' },
        ],
        created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
];

function getLocalYoutubeUrlsMap(): Record<string, string> {
    try {
        const stored = localStorage.getItem(YOUTUBE_URLS_CACHE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveLocalYoutubeUrl(id: string, url: string) {
    if (!id) return;
    try {
        const map = getLocalYoutubeUrlsMap();
        map[id] = url;
        localStorage.setItem(YOUTUBE_URLS_CACHE_KEY, JSON.stringify(map));
    } catch {}
}

function removeLocalYoutubeUrl(id: string) {
    if (!id) return;
    try {
        const map = getLocalYoutubeUrlsMap();
        delete map[id];
        localStorage.setItem(YOUTUBE_URLS_CACHE_KEY, JSON.stringify(map));
    } catch {}
}

function getStoredPortfolios(): VendorPortfolio[] {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_PORTFOLIOS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {}
    return DEFAULT_PORTFOLIOS;
}

function saveStoredPortfolios(portfolios: VendorPortfolio[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_PORTFOLIOS_KEY, JSON.stringify(portfolios));
    } catch {}
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export const createVendorPortfolio = async (portfolioData: Omit<VendorPortfolio, 'id' | 'created_at' | 'updated_at'>): Promise<VendorPortfolio> => {
    const newId = `portfolio-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const localPortfolio: VendorPortfolio = {
        ...portfolioData,
        id: newId,
        created_at: nowIso,
        updated_at: nowIso,
    };

    if (portfolioData.youtube_url) {
        saveLocalYoutubeUrl(newId, portfolioData.youtube_url);
    }

    if (!isSupabaseConfigured) {
        const currentList = getStoredPortfolios();
        const updatedList = [localPortfolio, ...currentList];
        saveStoredPortfolios(updatedList);
        return localPortfolio;
    }

    try {
        const payload = { ...portfolioData, user_id: null as string | null };
        let { data, error } = await supabase
            .from('vendor_portfolios')
            .insert([payload])
            .select()
            .single();

        if (error && error.code === 'PGRST204' && (error.message.includes('youtube_url') || error.message.includes('column'))) {
            const { youtube_url, ...withoutYoutube } = payload;
            const retry = await supabase
                .from('vendor_portfolios')
                .insert([withoutYoutube])
                .select()
                .single();

            if (!retry.error && retry.data) {
                data = retry.data;
                if (youtube_url) {
                    data.youtube_url = youtube_url;
                    saveLocalYoutubeUrl(data.id, youtube_url);
                }
            }
        }

        if (data) {
            const currentList = getStoredPortfolios();
            saveStoredPortfolios([data, ...currentList.filter(p => p.id !== data.id)]);
            return data;
        }
    } catch (err) {
        console.warn('[vendorPortfolios] Remote insert failed, storing locally:', err);
    }

    const currentList = getStoredPortfolios();
    saveStoredPortfolios([localPortfolio, ...currentList]);
    return localPortfolio;
};

export const listVendorPortfolios = async (): Promise<VendorPortfolio[]> => {
    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabase
                .from('vendor_portfolios')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const youtubeMap = getLocalYoutubeUrlsMap();
                const mapped = data.map(p => canonicalizeStorageAssetUrls({
                    ...p,
                    youtube_url: p.youtube_url || youtubeMap[p.id] || undefined
                }));
                saveStoredPortfolios(mapped);
                return mapped;
            }

            if (error) {
                console.warn('[vendorPortfolios] Database unavailable, falling back to local/demo portfolios:', error.message || error);
            }
        } catch (err) {
            console.warn('[vendorPortfolios] Error connecting to Supabase, falling back to local portfolios:', err);
        }
    }

    // Return stored or default portfolios
    const stored = getStoredPortfolios();
    const youtubeMap = getLocalYoutubeUrlsMap();
    return stored.map(p => canonicalizeStorageAssetUrls({
        ...p,
        youtube_url: p.youtube_url || youtubeMap[p.id] || undefined
    }));
};

export const getVendorPortfolio = async (id: string): Promise<VendorPortfolio | null> => {
    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabase
                .from('vendor_portfolios')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                const youtubeMap = getLocalYoutubeUrlsMap();
                return canonicalizeStorageAssetUrls({
                    ...data,
                    youtube_url: data.youtube_url || youtubeMap[id] || undefined
                });
            }
        } catch (err) {
            console.warn('[vendorPortfolios] Remote portfolio lookup failed:', err);
        }
    }

    const all = await listVendorPortfolios();
    return all.find(p => p.id === id) || null;
};

export const updateVendorPortfolio = async (id: string, updates: Partial<VendorPortfolio>): Promise<VendorPortfolio> => {
    if (updates.youtube_url !== undefined) {
        if (updates.youtube_url) {
            saveLocalYoutubeUrl(id, updates.youtube_url);
        } else {
            removeLocalYoutubeUrl(id);
        }
    }

    // Always update local cache
    const currentList = getStoredPortfolios();
    let updatedItem: VendorPortfolio | null = null;
    const nextList = currentList.map(p => {
        if (p.id === id) {
            updatedItem = { ...p, ...updates, updated_at: new Date().toISOString() };
            return updatedItem;
        }
        return p;
    });
    if (updatedItem) {
        saveStoredPortfolios(nextList);
    }

    if (isSupabaseConfigured) {
        try {
            let { data, error } = await supabase
                .from('vendor_portfolios')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error && error.code === 'PGRST204' && (error.message.includes('youtube_url') || error.message.includes('column'))) {
                const { youtube_url, ...withoutYoutube } = updates;
                const retry = await supabase
                    .from('vendor_portfolios')
                    .update(withoutYoutube)
                    .eq('id', id)
                    .select()
                    .single();

                if (!retry.error && retry.data) {
                    data = retry.data;
                    if (youtube_url !== undefined && data) {
                        data.youtube_url = youtube_url;
                    }
                }
            }

            if (data) {
                const youtubeMap = getLocalYoutubeUrlsMap();
                const finalized = {
                    ...data,
                    youtube_url: data.youtube_url || youtubeMap[id] || undefined
                };
                saveStoredPortfolios(nextList.map(p => p.id === id ? finalized : p));
                return finalized;
            }
        } catch (err) {
            console.warn('[vendorPortfolios] Remote update failed, preserved locally:', err);
        }
    }

    if (updatedItem) {
        return updatedItem;
    }

    throw new Error('Portofolio tidak ditemukan');
};

export const deleteVendorPortfolio = async (id: string): Promise<void> => {
    removeLocalYoutubeUrl(id);

    const currentList = getStoredPortfolios();
    saveStoredPortfolios(currentList.filter(p => p.id !== id));

    if (isSupabaseConfigured) {
        try {
            await supabase
                .from('vendor_portfolios')
                .delete()
                .eq('id', id);
        } catch (err) {
            console.warn('[vendorPortfolios] Remote delete failed:', err);
        }
    }
};

export const uploadPortfolioImages = async (
    portfolioId: string,
    files: File[],
    onProgress?: (progress: number) => void
): Promise<PortfolioImage[]> => {
    const uploadedImages: PortfolioImage[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let imageUrl = '';
        let processedFile = file;

        try {
            processedFile = await compressImage(file, 1600, 0.72, 200 * 1024);
            const fileExt = processedFile.name.split('.').pop() || 'jpg';
            const fileName = `${portfolioId}/img-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

            if (isSupabaseConfigured) {
                const { error: uploadError } = await supabase.storage
                    .from('gallery-images')
                    .upload(fileName, processedFile, {
                        contentType: processedFile.type,
                        cacheControl: '31536000',
                        upsert: false,
                    });

                if (!uploadError) {
                    const { data: urlData } = supabase.storage
                        .from('gallery-images')
                        .getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                }
            }

            if (!imageUrl && isSupabaseConfigured) {
                throw new Error('Storage URL is unavailable');
            }

            if (!imageUrl) {
                imageUrl = await fileToBase64(processedFile);
            }
        } catch (error) {
            if (isSupabaseConfigured) throw error;
            imageUrl = await fileToBase64(processedFile);
        }

        if (imageUrl) {
            uploadedImages.push({
                id: generateUUID(),
                url: imageUrl,
                uploadedAt: new Date().toISOString()
            });
        }

        if (onProgress) {
            onProgress(Math.round(((i + 1) / files.length) * 100));
        }
    }

    if (uploadedImages.length > 0) {
        const portfolio = await getVendorPortfolio(portfolioId);
        if (portfolio) {
            const updatedImages = [...(portfolio.images || []), ...uploadedImages];
            await updateVendorPortfolio(portfolioId, { images: updatedImages });
        }
    }

    return uploadedImages;
};

export const uploadPortfolioCover = async (
    portfolioId: string,
    file: File
): Promise<string> => {
    let coverUrl = '';
    let processedFile = file;

    try {
        processedFile = await compressImage(file, 1600, 0.72, 200 * 1024);
        const fileExt = processedFile.name.split('.').pop() || 'jpg';
        const fileName = `${portfolioId}/cover-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        if (isSupabaseConfigured) {
            const { error: uploadError } = await supabase.storage
                .from('gallery-images')
                .upload(fileName, processedFile, {
                    contentType: processedFile.type,
                    cacheControl: '31536000',
                    upsert: false,
                });

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('gallery-images')
                    .getPublicUrl(fileName);
                coverUrl = urlData.publicUrl;
            } else {
                throw uploadError;
            }
        }

        if (!coverUrl && isSupabaseConfigured) {
            throw new Error('Storage URL is unavailable');
        }

        if (!coverUrl) {
            coverUrl = await fileToBase64(processedFile);
        }
    } catch (error) {
        if (isSupabaseConfigured) throw error;
        coverUrl = await fileToBase64(processedFile);
    }

    await updateVendorPortfolio(portfolioId, { cover_image_url: coverUrl });
    return coverUrl;
};
