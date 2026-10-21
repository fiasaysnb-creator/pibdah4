import React, { useState } from 'react';
import Modal from '../../../shared/ui/Modal';
import { Copy, Check, ExternalLink, Share2, MapPin, CalendarCheck, LayoutGrid } from 'lucide-react';
import { buildPublicShareUrl } from '../../../utils/publicRouting';

interface SharePackageModalProps {
    isOpen: boolean;
    onClose: () => void;
    unionRegions: { value: string; label: string }[];
}

interface ShareLink {
    id: 'booking' | 'catalog';
    label: string;
    url: string;
}

interface ShareScope {
    key: string;
    title: string;
    badge: string;
    isGlobal: boolean;
    links: ShareLink[];
}

export const SharePackageModal: React.FC<SharePackageModalProps> = ({
    isOpen,
    onClose,
    unionRegions,
}) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (url: string, key: string) => {
        void navigator.clipboard.writeText(url);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Satu pusat tautan: setiap cakupan (semua wilayah / wilayah tertentu) punya dua
    // tautan — formulir booking (form + paket tersaring) dan katalog paket (lihat harga).
    const scopes: ShareScope[] = [
        {
            key: 'all',
            title: 'Semua Wilayah',
            badge: 'Katalog Lengkap',
            isGlobal: true,
            links: [
                { id: 'booking', label: 'Formulir Booking', url: buildPublicShareUrl('booking') },
                { id: 'catalog', label: 'Katalog Paket', url: buildPublicShareUrl('packages') },
            ],
        },
        ...unionRegions.map((region) => ({
            key: region.value,
            title: `Khusus Wilayah: ${region.label}`,
            badge: `Wilayah ${region.label}`,
            isGlobal: false,
            links: [
                {
                    id: 'booking' as const,
                    label: 'Formulir Booking',
                    url: buildPublicShareUrl('booking', undefined, { query: { region: region.value } }),
                },
                {
                    id: 'catalog' as const,
                    label: 'Katalog Paket',
                    url: buildPublicShareUrl('packages', undefined, { query: { region: region.value } }),
                },
            ],
        })),
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tautan Booking & Paket per Wilayah"
            size="lg"
        >
            <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[#5A6A85]">
                    Bagikan tautan booking publik khusus ke calon pengantin. Setiap tautan akan menyaring paket & add-on sesuai dengan wilayah yang dipilih.
                </p>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {scopes.map((scope) => (
                        <div
                            key={scope.key}
                            className={`rounded-2xl p-4 border space-y-3 ${
                                scope.isGlobal ? 'bg-[#F4F6F9] border-[#EAEFF4]' : 'bg-white border-[#EAEFF4]'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-[#2A3547] flex items-center gap-1.5 min-w-0">
                                    {scope.isGlobal ? (
                                        <Share2 className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                                    ) : (
                                        <MapPin className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                                    )}
                                    <span className="truncate">{scope.title}</span>
                                </span>
                                <span className="text-[10px] font-semibold bg-brand-accent text-white px-2 py-0.5 rounded-md shrink-0">
                                    {scope.badge}
                                </span>
                            </div>

                            {scope.links.map((link) => {
                                const key = `${scope.key}:${link.id}`;
                                const isCopied = copiedKey === key;

                                return (
                                    <div key={key} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-semibold text-[#5A6A85] flex items-center gap-1.5">
                                                {link.id === 'booking' ? (
                                                    <CalendarCheck className="w-3.5 h-3.5 text-brand-accent" />
                                                ) : (
                                                    <LayoutGrid className="w-3.5 h-3.5 text-brand-accent" />
                                                )}
                                                {link.label}
                                            </span>
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[11px] font-semibold text-brand-accent hover:underline inline-flex items-center gap-1 shrink-0"
                                            >
                                                <span>Buka Halaman</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={link.url}
                                                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-[#EAEFF4] text-xs text-[#2A3547] outline-none select-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(link.url, key)}
                                                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0 ${
                                                    isCopied
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-brand-accent text-white hover:bg-brand-accent-hover'
                                                }`}
                                            >
                                                {isCopied ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Tersalin</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Salin</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="pt-3 border-t border-[#EAEFF4] flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 px-5 rounded-xl bg-[#F4F6F9] hover:bg-[#EAEFF4] text-xs font-semibold text-[#2A3547] transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </Modal>
    );
};
