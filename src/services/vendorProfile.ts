import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { canonicalizeStorageAssetUrls, compressImage } from './storage';
import { VendorProfile } from '../types';
import { generateUUID } from '../utils/uuid';

const LOCAL_STORAGE_KEY = 'weddfin-vendor-profile';

const DEFAULT_PROFILE: Omit<VendorProfile, 'id' | 'created_at' | 'updated_at'> = {
    hero_title: '',
    hero_subtitle: '',
    page_banner_title: '',
    page_banner_subtitle: '',
    page_banner_image_url: '',
    whatsapp_number: '',
    info_images: [],
    hero_images: [],
    faqs: [],
    partners: [],
    videos: []
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export const getVendorProfile = async (): Promise<VendorProfile | null> => {
    const sanitizeProfile = (p: any): VendorProfile => {
        p = canonicalizeStorageAssetUrls(p);
        const heroImages = Array.isArray(p.hero_images)
            ? p.hero_images.filter(Boolean)
            : (p.hero_image_url ? [p.hero_image_url] : []);

        return {
            ...p,
            hero_title: p.hero_title ?? '',
            hero_subtitle: p.hero_subtitle ?? '',
            page_banner_title: p.page_banner_title ?? '',
            page_banner_subtitle: p.page_banner_subtitle ?? '',
            page_banner_image_url: p.page_banner_image_url ?? '',
            whatsapp_number: p.whatsapp_number ?? '',
            hero_images: heroImages,
            hero_image_url: p.hero_image_url || (heroImages && heroImages[0]) || '',
            info_images: Array.isArray(p.info_images) ? p.info_images.filter(Boolean) : [],
            faqs: Array.isArray(p.faqs) ? p.faqs.filter(Boolean) : [],
            partners: Array.isArray(p.partners) ? p.partners.filter(Boolean) : [],
            videos: Array.isArray(p.videos) ? p.videos.filter(Boolean) : [],
        };
    };

    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabase
                .from('vendor_profiles')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                const clean = sanitizeProfile(data);
                try {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
                } catch {}
                return clean;
            }
        } catch (err) {
            console.warn('[vendorProfile] Supabase query skipped/failed, checking local fallback:', err);
        }
    }

    // Fallback: check localStorage
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
            return sanitizeProfile(JSON.parse(cached));
        }
    } catch {}

    // Default template if nothing exists yet
    return sanitizeProfile({
        id: 'default-vendor-profile',
        ...DEFAULT_PROFILE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
};

export const createOrUpdateVendorProfile = async (updates: Partial<VendorProfile>): Promise<VendorProfile> => {
    const existing = await getVendorProfile();

    if (existing && existing.id && existing.id !== 'default-vendor-profile') {
        if (isSupabaseConfigured) {
            try {
                const { data, error } = await supabase
                    .from('vendor_profiles')
                    .update({ ...updates, updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .maybeSingle();

                if (!error && data) {
                    try {
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    } catch {}
                    return data;
                }
                if (error) {
                    console.warn('[vendorProfile] Supabase update failed, saving locally:', error);
                }
            } catch (err) {
                console.warn('[vendorProfile] Supabase update error, saving locally:', err);
            }
        }

        // Fallback: update local storage
        const merged: VendorProfile = {
            ...existing,
            ...updates,
            hero_title: updates.hero_title ?? existing.hero_title ?? '',
            hero_subtitle: updates.hero_subtitle ?? existing.hero_subtitle ?? '',
            page_banner_title: updates.page_banner_title ?? existing.page_banner_title ?? '',
            page_banner_subtitle: updates.page_banner_subtitle ?? existing.page_banner_subtitle ?? '',
            page_banner_image_url: updates.page_banner_image_url ?? existing.page_banner_image_url ?? '',
            whatsapp_number: updates.whatsapp_number ?? existing.whatsapp_number ?? '',
            hero_image_url: updates.hero_image_url ?? existing.hero_image_url ?? '',
            hero_images: updates.hero_images ?? existing.hero_images ?? [],
            info_images: updates.info_images ?? existing.info_images ?? [],
            faqs: updates.faqs ?? existing.faqs ?? [],
            partners: updates.partners ?? existing.partners ?? [],
            videos: updates.videos ?? existing.videos ?? [],
            updated_at: new Date().toISOString(),
        };
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        return merged;
    } else {
        // Create new
        if (isSupabaseConfigured) {
            try {
                const payload = { ...updates };
                if (payload.id === 'default-vendor-profile') {
                    delete payload.id;
                }
                const { data, error } = await supabase
                    .from('vendor_profiles')
                    .insert([payload])
                    .select()
                    .maybeSingle();

                if (!error && data) {
                    try {
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    } catch {}
                    return data;
                }
                if (error) {
                    console.warn('[vendorProfile] Supabase insert failed, saving locally:', error);
                }
            } catch (err) {
                console.warn('[vendorProfile] Supabase insert error, saving locally:', err);
            }
        }

        // Fallback: save to local storage
        const newProfile: VendorProfile = {
            id: generateUUID(),
            hero_title: updates.hero_title ?? '',
            hero_subtitle: updates.hero_subtitle ?? '',
            page_banner_title: updates.page_banner_title ?? '',
            page_banner_subtitle: updates.page_banner_subtitle ?? '',
            page_banner_image_url: updates.page_banner_image_url ?? '',
            hero_image_url: updates.hero_image_url || (updates.hero_images && updates.hero_images[0]) || '',
            hero_images: updates.hero_images ?? (updates.hero_image_url ? [updates.hero_image_url] : []),
            whatsapp_number: updates.whatsapp_number ?? '',
            info_images: updates.info_images ?? [],
            faqs: updates.faqs ?? [],
            partners: updates.partners ?? [],
            videos: updates.videos ?? [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
        } catch {}
        return newProfile;
    }
};

export const uploadVendorImage = async (file: File, path: string): Promise<string> => {
    let processedFile = file;
    try {
        processedFile = await compressImage(file, 1600, 0.72, 200 * 1024);
        const fileExt = processedFile.name.split('.').pop() || 'jpg';
        const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

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

                if (urlData?.publicUrl) {
                    return urlData.publicUrl;
                }
            } else if (uploadError) {
                throw uploadError;
            }
        }
    } catch (err) {
        console.error('[vendorProfile] Storage upload failed:', err);
        if (isSupabaseConfigured) throw err;
    }

    // Local-only fallback; never store image data in Supabase rows when Storage fails.
    return await fileToBase64(processedFile);
};

/** Persist hero slide URLs immediately without overwriting other unsaved profile fields. */
export const updateVendorHeroImages = async (heroImages: string[]): Promise<VendorProfile> => {
    const images = heroImages.filter(Boolean).slice(0, 3);
    const existing = await getVendorProfile();
    if (existing?.id && existing.id !== 'default-vendor-profile' && isSupabaseConfigured) {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .update({ hero_images: images, hero_image_url: images[0] || '', updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Profil vendor tidak ditemukan di database.');
        try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data)); } catch {}
        return data as VendorProfile;
    }
    return createOrUpdateVendorProfile({
        ...(existing || {}),
        hero_images: images,
        hero_image_url: images[0] || '',
    });
};

export const deleteVendorImage = async (imageUrl: string): Promise<void> => {
    if (!imageUrl) return;
    let url: URL;
    try {
        url = new URL(imageUrl);
    } catch {
        return;
    }
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/gallery-images\/(.+)/);
    if (!match || !isSupabaseConfigured) return;
    const objectPath = decodeURIComponent(match[1]);
    const { error } = await supabase.storage.from('gallery-images').remove([objectPath]);
    if (error) throw error;
};
