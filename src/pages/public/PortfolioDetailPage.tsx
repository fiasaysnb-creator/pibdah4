import React, { useState, useEffect } from 'react';
import { ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { VendorPortfolio } from '../../types';
import { getVendorPortfolio } from '../../services/vendorPortfolios';
import { getVendorProfile } from '../../services/vendorProfile';
import { useSupabaseRealtimeRefresh } from '../../hooks/useSupabaseRealtimeRefresh';

const PORTFOLIO_IMAGE_FALLBACK = '/assets/images/backgrounds/portal-pengantin-3.jpg';

const handlePortfolioImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === 'true') {
        image.style.visibility = 'hidden';
        return;
    }
    image.dataset.fallbackApplied = 'true';
    image.src = PORTFOLIO_IMAGE_FALLBACK;
};

const PortfolioDetailPage: React.FC = () => {
    const [portfolio, setPortfolio] = useState<VendorPortfolio | null>(null);
    const [vendorName, setVendorName] = useState('');
    const [waNumber, setWaNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number>(0);
    const [refreshVersion, setRefreshVersion] = useState(0);

    useSupabaseRealtimeRefresh('public-portfolio-detail', ['vendor_profiles', 'vendor_portfolios'], () => {
        setRefreshVersion(version => version + 1);
    }, { realtime: false, refreshOnFocus: false });

    useEffect(() => {
        const hash = window.location.hash;
        const match = hash.match(/#\/portfolio\/(.+)/);
        const id = match ? match[1] : null;

        const loadData = async () => {
            try {
                const [profileData] = await Promise.all([getVendorProfile()]);
                if (profileData) {
                    setVendorName(profileData.hero_title || '');
                    setWaNumber(profileData.whatsapp_number || '');
                }
                if (id) {
                    const portfolioData = await getVendorPortfolio(id);
                    if (portfolioData) setPortfolio(portfolioData);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [refreshVersion]);

    const images = portfolio?.images || [];

    const openLightbox = (idx: number) => {
        setLightboxIndex(idx);
        setLightboxImg(images[idx].url);
    };

    const closeLightbox = () => setLightboxImg(null);

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newIdx = (lightboxIndex - 1 + images.length) % images.length;
        setLightboxIndex(newIdx);
        setLightboxImg(images[newIdx].url);
    };

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newIdx = (lightboxIndex + 1) % images.length;
        setLightboxIndex(newIdx);
        setLightboxImg(images[newIdx].url);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f4f0]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#c9a87c] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-light tracking-widest uppercase">Loading</p>
                </div>
            </div>
        );
    }

    if (!portfolio) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f4f0]">
                <div className="text-center">
                    <p className="text-gray-400 text-xl font-light mb-6">Portfolio tidak ditemukan</p>
                    <a href="#/profile" className="text-sm text-[#c9a87c] underline">← Kembali ke Profil</a>
                </div>
            </div>
        );
    }

    const formatWa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

    return (
        <div className="min-h-screen bg-[#f7f4f0] font-[Cormorant_Garamond,serif]" style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif" }}>
            {/* --- Google Fonts --- */}
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap" rel="stylesheet" />

            {/* --- Navbar --- */}
            <nav className="fixed top-0 left-0 right-0 z-40 bg-[#f7f4f0]/90 backdrop-blur-md border-b border-[#e5ddd4]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <a href="#/profile" className="text-[#8a7260] text-xs tracking-[0.2em] uppercase font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        ← Kembali
                    </a>
                    <a href="#/profile" className="text-[#3d2e22] text-xl font-light tracking-wider">
                        {vendorName || 'Photography'}
                    </a>
                    {waNumber && (
                        <a href={formatWa(waNumber)} target="_blank" rel="noopener noreferrer"
                            className="text-[#8a7260] text-xs tracking-[0.2em] uppercase font-medium hover:text-[#c9a87c] transition-colors"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Contact
                        </a>
                    )}
                </div>
            </nav>

            {/* --- Hero / Cover --- */}
            <div className="pt-20">
                {portfolio.cover_image_url && (
                    <div className="relative w-full h-[55vh] overflow-hidden">
                        <img
                            src={portfolio.cover_image_url}
                            alt={portfolio.title}
                            className="w-full h-full object-cover"
                         loading="eager" decoding="async"
                         onError={handlePortfolioImageError} />
                        <div className="absolute inset-0 bg-black/25" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
                            <span className="text-xs tracking-[0.3em] uppercase text-white/70 mb-3"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                {portfolio.category}
                            </span>
                            <h1 className="text-4xl md:text-6xl font-light tracking-wide">{portfolio.title}</h1>
                            <div className="w-12 h-px bg-white/50 mt-6 mx-auto"></div>
                            <p className="mt-4 text-white/70 text-sm tracking-widest"
                                style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                {images.length} Foto
                            </p>
                        </div>
                    </div>
                )}

                {/* No cover fallback header */}
                {!portfolio.cover_image_url && (
                    <div className="text-center pt-16 pb-10 px-4">
                        <span className="text-xs tracking-[0.3em] uppercase text-[#8a7260] block mb-3"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {portfolio.category}
                        </span>
                        <h1 className="text-4xl md:text-5xl font-light text-[#3d2e22] tracking-wide">{portfolio.title}</h1>
                        <div className="w-12 h-px bg-[#c9a87c] mt-6 mx-auto"></div>
                    </div>
                )}
            </div>

            {/* --- YouTube Video --- */}
            {portfolio.youtube_url && (
                <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 md:pt-16">
                    <div className="aspect-video w-full rounded-sm overflow-hidden shadow-lg border border-[#e5ddd4]">
                        <iframe
                            className="w-full h-full"
                            src={(() => {
                                const url = portfolio.youtube_url;
                                let videoId = '';
                                if (url.includes('youtube.com/watch?v=')) {
                                    videoId = url.split('v=')[1].split('&')[0];
                                } else if (url.includes('youtu.be/')) {
                                    videoId = url.split('youtu.be/')[1].split('?')[0];
                                } else if (url.includes('youtube.com/embed/')) {
                                    return url;
                                }
                                return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                            })()}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                </section>
            )}

            {/* --- Photo Grid --- */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
                {images.length > 0 ? (
                    <div className="flex flex-col gap-6 md:gap-12 max-w-4xl mx-auto">
                        {images.map((img, idx) => (
                            <div
                                key={img.id}
                                className="w-full overflow-hidden rounded-sm cursor-pointer group relative"
                                onClick={() => openLightbox(idx)}
                            >
                                <img
                                    src={img.url}
                                    alt={`${portfolio.title} - ${idx + 1}`}
                                    className="w-full h-auto object-contain group-hover:opacity-95 transition-opacity duration-500"
                                    loading="lazy"
                                 decoding="async"
                                 onError={handlePortfolioImageError} />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <div className="bg-white/90 backdrop-blur-sm w-10 h-10 rounded-full flex items-center justify-center shadow-lg">
                                        <ZoomIn className="w-5 h-5 text-[#3d2e22]" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 text-gray-400 font-light">
                        Belum ada foto dalam portofolio ini.
                    </div>
                )}
            </section>

            {/* --- CTA --- */}
            {waNumber && (
                <section className="py-16 text-center px-4">
                    <p className="text-sm tracking-[0.25em] uppercase text-[#8a7260] mb-4"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Suka dengan karya ini?
                    </p>
                    <h2 className="text-3xl md:text-4xl font-light text-[#3d2e22] mb-8">Hubungi Kami</h2>
                    <a
                        href={formatWa(waNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#3d2e22] text-white text-sm tracking-[0.15em] uppercase hover:bg-[#c9a87c] transition-colors duration-300 rounded-sm"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        Chat via WhatsApp
                    </a>
                </section>
            )}

            {/* --- Footer --- */}
            <footer className="border-t border-[#e5ddd4] py-8 text-center">
                <p className="text-xs text-[#8a7260] tracking-widest uppercase"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    © {new Date().getFullYear()} {vendorName || 'Photography'}
                </p>
            </footer>

            {/* --- Lightbox --- */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    <button
                        onClick={closeLightbox}
                        className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors text-2xl w-10 h-10 flex items-center justify-center"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {images.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-4 md:left-8 text-white/60 hover:text-white transition-colors p-2"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-4 md:right-8 text-white/60 hover:text-white transition-colors p-2"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>
                        </>
                    )}

                    <img
                        src={lightboxImg}
                        alt="Full view"
                        className="max-h-[90vh] max-w-[90vw] object-contain"
                        onClick={(e) => e.stopPropagation()}
                        onError={handlePortfolioImageError}
                    />

                    <p className="absolute bottom-5 left-0 right-0 text-center text-white/40 text-xs tracking-widest"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {lightboxIndex + 1} / {images.length}
                    </p>
                </div>
            )}
        </div>
    );
};

export default PortfolioDetailPage;
