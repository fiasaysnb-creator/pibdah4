import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, Image as ImageIcon, X } from 'lucide-react';
import { Gallery, GalleryImage, Profile } from '../../../types';
import { getPublicGallery } from '../../../services/galleries';
import { getPublicContactProfile } from '../../../services/profile';
import { cleanPhoneNumber } from '../../../constants';
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh';

interface PublicGalleryProps {
    galleryId: string;
}

// Sanitize image URLs to prevent XSS attacks
const sanitizeImageUrl = (url: string): string => {
    try {
        const parsed = new URL(url);
        // Only allow HTTP(S) protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            console.warn('[Security] Blocked non-HTTP(S) image URL:', url);
            return '/placeholder-image.jpg';
        }
        return url;
    } catch (error) {
        console.warn('[Security] Invalid image URL:', url);
        return '/placeholder-image.jpg';
    }
};

const PublicGallery: React.FC<PublicGalleryProps> = ({ galleryId }) => {
    // Hooks
    const [gallery, setGallery] = useState<Gallery | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const urlLeadId = useMemo(() => {
        try {
            const hash = window.location.hash;
            const search = window.location.search;
            const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
            const params = new URLSearchParams(hashQuery || search);
            // lid = short ID (8 char), leadName = slug fallback, leadId = legacy full UUID
            return params.get('lid') || params.get('leadName') || params.get('leadId') || null;
        } catch {
            return null;
        }
    }, []);

    // Track whether the identifier is a short ID or a name slug
    const urlLeadParamKey = useMemo(() => {
        try {
            const hash = window.location.hash;
            const search = window.location.search;
            const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
            const params = new URLSearchParams(hashQuery || search);
            if (params.get('lid')) return 'lid';
            if (params.get('leadName')) return 'leadName';
            return 'leadId';
        } catch {
            return 'leadName';
        }
    }, []);

    const baseBookingHref = useMemo(() => {
        if (!gallery) return '';
        return gallery.booking_link?.trim()
            || `#/public-booking${gallery.region ? `?region=${encodeURIComponent(String(gallery.region).toLowerCase())}` : ''}`;
    }, [gallery]);

    const bookingHref = useMemo(() => {
        if (!baseBookingHref) return '';
        if (!urlLeadId) return baseBookingHref;
        const separator = baseBookingHref.includes('?') ? '&' : '?';
        return `${baseBookingHref}${separator}${urlLeadParamKey}=${encodeURIComponent(urlLeadId)}`;
    }, [baseBookingHref, urlLeadId, urlLeadParamKey]);

    const opensExternalBooking = useMemo(() => bookingHref.startsWith('http'), [bookingHref]);

    const loadGalleryData = useCallback(async () => {
        try {
            setError(null);
            const [galleryData, profileData] = await Promise.all([
                getPublicGallery(galleryId).catch((err): null => {
                    console.error('Error fetching gallery:', err);
                    return null;
                }),
                getPublicContactProfile().catch((): null => null)
            ]);

            if (!galleryData) {
                setError('Pricelist tidak ditemukan atau link sudah tidak aktif');
            } else {
                setGallery(galleryData);
            }
            setProfile(profileData);
        } catch (error) {
            console.error('Error loading gallery:', error);
            setError('Pricelist tidak dapat diakses saat ini');
        } finally {
            setIsLoading(false);
        }
    }, [galleryId]);

    const navigateImage = useCallback((direction: 'prev' | 'next') => {
        if (!gallery) return;

        setCurrentImageIndex(prevIndex => {
            let newIndex = prevIndex;
            if (direction === 'prev') {
                newIndex = prevIndex > 0 ? prevIndex - 1 : gallery.images.length - 1;
            } else {
                newIndex = prevIndex < gallery.images.length - 1 ? prevIndex + 1 : 0;
            }
            setSelectedImage(gallery.images[newIndex]);
            return newIndex;
        });
    }, [gallery]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setSelectedImage(null);
        }
        if (e.key === 'ArrowLeft') {
            navigateImage('prev');
        }
        if (e.key === 'ArrowRight') {
            navigateImage('next');
        }
    }, [navigateImage]);

    useEffect(() => {
        loadGalleryData();
    }, [loadGalleryData]);

    useSupabaseRealtimeRefresh('public-gallery', ['galleries', 'profiles'], loadGalleryData, { realtime: false, refreshOnFocus: false });

    useEffect(() => {
        if (selectedImage) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [selectedImage, handleKeyDown]);

    const openLightbox = (image: GalleryImage, index: number) => {
        setSelectedImage(image);
        setCurrentImageIndex(index);
    };

    const handleDownloadPdf = async () => {
        if (!gallery?.pdf_url || isDownloadingPdf) return;

        setIsDownloadingPdf(true);
        try {
            const response = await fetch(gallery.pdf_url);
            if (!response.ok) {
                throw new Error(`PDF download failed with status ${response.status}`);
            }

            const pdfBlob = await response.blob();
            const downloadUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            const fileName = gallery.pdf_name?.trim() || 'Pricelist';
            link.href = downloadUrl;
            link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        } catch (downloadError) {
            console.error('Error downloading gallery PDF:', downloadError);
            alert('Gagal mengunduh PDF. Silakan coba lagi.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const closeLightbox = () => {
        setSelectedImage(null);
    };


    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600">Memuat Pricelist...</p>
                </div>
            </div>
        );
    }

    if (error || !gallery) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                <div className="text-center p-8 max-w-lg mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-red-100 to-red-200 rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Pricelist Tidak Ditemukan</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => loadGalleryData()}
                            className="px-6 py-3 grad-brand text-white rounded-full transition-all duration-200 font-medium cursor-pointer hover:opacity-90"
                        >
                            Coba Lagi
                        </button>
                        <a
                            href="#/home"
                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full transition-all duration-200 font-medium"
                        >
                            Ke Beranda
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="public-gallery-page min-h-screen bg-black" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
            {/* Gallery Content */}
            <main className="max-w-7xl mx-auto px-0 py-0">
                {!gallery.images || gallery.images.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Pricelist Kosong</h3>
                        <p className="text-gray-600 text-lg">Belum ada foto yang diupload ke Pricelist ini</p>
                    </div>
                ) : (
                    <div className="pt-6 sm:pt-8">
                        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0">
                            {gallery.images.map((image, index) => {
                                const isPriorityImage = index === 0;
                                const imageSrc = sanitizeImageUrl(image.thumbnailUrl || image.url);

                                return (
                                    <div
                                        key={image.id}
                                        className="break-inside-avoid cursor-pointer group overflow-hidden relative bg-gray-100"
                                        onClick={() => openLightbox(image, index)}
                                    >
                                        <img
                                            src={imageSrc}
                                            alt={image.caption || `Foto ${index + 1}`}
                                            className="w-full h-auto object-cover transition-opacity duration-300"
                                            loading={isPriorityImage ? 'eager' : 'lazy'}
                                            ref={(node) => {
                                                if (node) {
                                                    node.setAttribute('fetchpriority', isPriorityImage ? 'high' : 'auto');
                                                }
                                            }}
                                            decoding="async"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                                            onLoad={(e) => {
                                                e.currentTarget.style.opacity = '1';
                                            }}
                                            onError={(e) => {
                                                const imageElement = e.currentTarget;
                                                if (imageElement.dataset.fallbackApplied === 'true') return;
                                                imageElement.dataset.fallbackApplied = 'true';
                                                imageElement.src = '/assets/images/backgrounds/detail-pengantin-4.jpg';
                                                imageElement.style.opacity = '1';
                                            }}
                                            style={{ opacity: 0 }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Booking CTA & Admin Help */}
                        <div className="px-4 py-10 bg-white">
                            <div className="max-w-3xl mx-auto text-center space-y-4">
                                <p className="text-gray-700">Tertarik dengan layanan kami?</p>
                                <div className="flex flex-wrap items-center justify-center gap-3">
                                    {gallery.pdf_url && (
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadPdf()}
                                            disabled={isDownloadingPdf}
                                            aria-busy={isDownloadingPdf}
                                            className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-70"
                                        >
                                            {isDownloadingPdf ? 'Mengunduh PDF...' : 'Download Pricelist PDF'}
                                        </button>
                                    )}
                                </div>

                                {profile?.phone && (
                                    <div className="pt-4">
                                        <h4 className="text-sm font-semibold text-gray-900">Butuh Bantuan?</h4>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Jika ada pertanyaan atau butuh bantuan dalam pengisian formulir, jangan ragu untuk menghubungi admin kami melalui WhatsApp.
                                        </p>
                                        <a
                                            href={`https://wa.me/${cleanPhoneNumber(profile.phone)}?text=${encodeURIComponent('Halo Admin, saya butuh bantuan pengisian formulir.')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center mt-2 px-3 py-1.5 rounded-md bg-black text-white text-xs font-medium shadow hover:bg-gray-900 transition-colors duration-200"
                                        >
                                            Hubungi Admin ({profile.phone})
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <a
                href={bookingHref}
                target={opensExternalBooking ? '_blank' : undefined}
                rel={opensExternalBooking ? 'noopener noreferrer' : undefined}
                className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/30 transition-colors hover:bg-gray-800 sm:bottom-6 sm:right-6"
                aria-label="Booking Sekarang"
            >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                Booking Sekarang
            </a>

            {/* Lightbox */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Tenor Sans', sans-serif" }}>
                    <div className="relative w-full h-full max-w-6xl max-h-full flex items-center justify-center">
                        <button
                            onClick={closeLightbox}
                            className="absolute top-6 right-6 z-20 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all duration-200"
                        >
                            <X className="w-6 h-6" />
                        </button>


                        <div className="relative flex items-center justify-center w-full h-full">
                            <img
                                src={sanitizeImageUrl(selectedImage.url)}
                                alt={selectedImage.caption || 'Foto'}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                             loading="lazy" decoding="async" />
                        </div>

                        {selectedImage.caption && (
                            <div className="absolute bottom-6 left-6 right-6 z-20">
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                                    <p className="text-white text-lg font-medium text-center">{selectedImage.caption}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default PublicGallery;
