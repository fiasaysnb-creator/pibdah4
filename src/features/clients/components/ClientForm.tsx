import React, { useMemo, useState } from 'react';
import { Package, AddOn, Profile, Card, PromoCode, ClientType } from '../../../types';
import RupiahInput from '../../../shared/form/RupiahInput';
import { formatCurrency, ClientFormData, CustomFormItem } from '../utils/clientHelpers';
import { Plus, Trash2, Tag, Check, Upload } from 'lucide-react';
import { uploadClientAvatar } from '../../../services/clients';

interface ClientFormProps {
    formData: ClientFormData;
    setFormData: React.Dispatch<React.SetStateAction<ClientFormData>>;
    handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    handleFormSubmit: (e: React.FormEvent) => Promise<void> | void;
    handleCloseModal: () => void;
    packages: Package[];
    addOns: AddOn[];
    userProfile: Profile;
    modalMode: 'add' | 'edit';
    cards: Card[];
    promoCodes: PromoCode[];
}

const ClientForm: React.FC<ClientFormProps> = ({
    formData,
    setFormData,
    handleFormChange,
    handleFormSubmit,
    handleCloseModal,
    packages,
    addOns,
    userProfile,
    modalMode,
    cards,
    promoCodes
}) => {
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customItemName, setCustomItemName] = useState('');
    const [customItemPrice, setCustomItemPrice] = useState('0');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarUploadError, setAvatarUploadError] = useState('');

    const handleDpProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setFormData(prev => ({ ...prev, dpProofFile: null }));
            e.currentTarget.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setFormData(prev => ({ ...prev, dpProofFile: null }));
            e.currentTarget.value = '';
            return;
        }
        setFormData(prev => ({ ...prev, dpProofFile: file }));
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setAvatarUploadError('Pilih file gambar yang valid.');
            input.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setAvatarUploadError('Ukuran foto maksimal 5 MB.');
            input.value = '';
            return;
        }

        setAvatarUploadError('');
        setIsUploadingAvatar(true);
        try {
            const avatarUrl = await uploadClientAvatar(file);
            setFormData(prev => ({ ...prev, avatarUrl }));
        } catch (error) {
            console.error('[ClientForm] Avatar upload failed:', error);
            setAvatarUploadError('Foto gagal diunggah. Periksa koneksi lalu coba lagi.');
        } finally {
            setIsUploadingAvatar(false);
            input.value = '';
        }
    };

    const handleAddCustomItem = () => {
        const trimmed = customItemName.trim();
        if (!trimmed) return;
        const priceNum = Math.max(0, Number(customItemPrice) || 0);
        const newItem: CustomFormItem = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: trimmed,
            price: priceNum,
        };
        setFormData(prev => ({
            ...prev,
            customItems: [...(prev.customItems || []), newItem],
        }));
        setCustomItemName('');
        setCustomItemPrice('0');
    };

    const handleRemoveCustomItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            customItems: (prev.customItems || []).filter((_, i) => i !== index),
        }));
    };

    const handleInternalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (isUploadingAvatar) {
            setAvatarUploadError('Tunggu sampai foto selesai diunggah.');
            return;
        }
        setIsSubmitting(true);
        try {
            await handleFormSubmit(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get unique regions from packages
    const availableRegions = useMemo(() => {
        const regions = packages
            .map(p => p.region)
            .filter((r): r is string => !!r);
        return Array.from(new Set(regions));
    }, [packages]);

    // Filter packages by selected region, but always include currently selected packageId
    const visiblePackages = useMemo(() => {
        if (!selectedRegion) return packages;
        return packages.filter(p => p.region === selectedRegion || p.id === formData.packageId);
    }, [packages, selectedRegion, formData.packageId]);

    // Filter add-ons by selected region, but always include currently selected addOns
    const visibleAddOns = useMemo(() => {
        if (!selectedRegion) return addOns;
        return addOns.filter(a => !a.region || a.region === selectedRegion || formData.selectedAddOnIds.includes(a.id));
    }, [addOns, selectedRegion, formData.selectedAddOnIds]);

    const priceCalculations = useMemo(() => {
        const selectedPackage = packages.find(p => p.id === formData.packageId);
        // Prefer explicit unitPrice stored in form (selected duration), fallback to package.price
        const packagePrice = (formData.unitPrice !== undefined && Number(formData.unitPrice) >= 0)
            ? Number(formData.unitPrice)
            : (selectedPackage?.price || 0);

        const standardAddOnsPrice = addOns
            .filter(addon => formData.selectedAddOnIds.includes(addon.id))
            .reduce((sum, addon) => sum + addon.price, 0);

        const additionalPackagesPrice = packages
            .filter(pkg => formData.selectedAdditionalPackageIds?.includes(pkg.id))
            .reduce((sum, pkg) => sum + pkg.price, 0);

        const customItemsPrice = (formData.customItems || [])
            .reduce((sum, item) => sum + (Number(item.price) || 0), 0);

        const addOnsPrice = standardAddOnsPrice + additionalPackagesPrice + customItemsPrice;

        let totalProjectBeforeDiscount = packagePrice + addOnsPrice;
        let discountAmount = 0;
        let discountApplied = 'N/A';
        const promoCode = promoCodes.find(p => p.id === formData.promoCodeId);

        if (promoCode) {
            if (promoCode.discountType === 'percentage') {
                discountAmount = (totalProjectBeforeDiscount * promoCode.discountValue) / 100;
                discountApplied = `${promoCode.discountValue}%`;
            } else { // fixed
                discountAmount = promoCode.discountValue;
                discountApplied = formatCurrency(promoCode.discountValue);
            }
        }

        const totalProject = Math.max(0, totalProjectBeforeDiscount - discountAmount);
        const remainingPayment = totalProject - Number(formData.dp || 0);

        return {
            packagePrice,
            standardAddOnsPrice,
            customItemsPrice,
            addOnsPrice,
            additionalPackagesPrice,
            totalProject,
            remainingPayment,
            discountAmount,
            discountApplied
        };
    }, [formData.packageId, formData.unitPrice, formData.selectedAddOnIds, formData.selectedAdditionalPackageIds, formData.customItems, formData.dp, formData.promoCodeId, packages, addOns, promoCodes]);

    return (
        <form onSubmit={handleInternalSubmit} className="form-compact form-compact--ios-scale">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-2">
                {/* Left Column: Client & Project Info */}
                <div className="space-y-5">
                    <h4 className="text-sm md:text-base font-bold text-[#2A3547] border-b border-[#EAEFF4] pb-2">Informasi Pengantin</h4>
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-[#EAEFF4] bg-[#F4F6F9] flex items-center justify-center text-lg font-bold text-[#5A6A85]">
                            {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Foto profil pengantin" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
                            ) : (
                                formData.clientName?.charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <div>
                            <label htmlFor="client-avatar" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D5DCE6] text-xs font-semibold text-[#2A3547] ${isUploadingAvatar ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-[#F4F6F9]'}`}>
                                <Upload className="w-3.5 h-3.5" />
                                {isUploadingAvatar ? 'Mengunggah...' : formData.avatarUrl ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
                            </label>
                            <input id="client-avatar" type="file" accept="image/*" onChange={handleAvatarChange} disabled={isUploadingAvatar} className="sr-only" />
                            <p className="text-[10px] text-[#5A6A85] mt-1">JPG, PNG, atau WebP. Maksimal 5 MB.</p>
                            {avatarUploadError && <p role="alert" className="text-[10px] text-red-600 mt-1">{avatarUploadError}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="clientName" className="block text-xs text-[#5A6A85]">Nama Pengantin</label>
                        <input
                            type="text"
                            id="clientName"
                            name="clientName"
                            value={formData.clientName}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="Masukkan nama pengantin"
                            required={!!formData.date}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="clientType" className="block text-xs text-[#5A6A85]">Jenis Pengantin</label>
                        <select
                            id="clientType"
                            name="clientType"
                            value={formData.clientType}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            required
                        >
                            {Object.values(ClientType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="phone" className="block text-xs text-[#5A6A85]">Nomor Telepon / WhatsApp</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({
                                    ...prev,
                                    phone: val,
                                    whatsapp: val,
                                }));
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="08123456789"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="email" className="block text-xs text-[#5A6A85]">Email (Opsional)</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="email@example.com (opsional - bisa dikosongkan)"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="instagram" className="block text-xs text-[#5A6A85]">Instagram (Opsional)</label>
                        <input
                            type="text"
                            id="instagram"
                            name="instagram"
                            value={formData.instagram}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="@username (opsional - bisa dikosongkan)"
                        />
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-[#2A3547] border-b border-[#EAEFF4] pb-2 pt-4">Informasi Acara Pernikahan</h4>
                    <div className="space-y-2">
                        <label htmlFor="projectName" className="block text-xs text-[#5A6A85]">Nama Acara Pernikahan</label>
                        <input
                            type="text"
                            id="projectName"
                            name="projectName"
                            value={formData.projectName}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="Masukkan nama Acara Pernikahan"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="projectType" className="block text-xs text-[#5A6A85]">Jenis Acara Pernikahan</label>
                            <select
                                id="projectType"
                                name="projectType"
                                value={formData.projectType}
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                                required
                            >
                                <option value="" disabled>Pilih Jenis...</option>
                                {userProfile.projectTypes?.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                {formData.projectType && !userProfile.projectTypes?.includes(formData.projectType) && (
                                    <option value={formData.projectType}>{formData.projectType}</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="date" className="block text-xs text-[#5A6A85]">Tanggal Acara (Opsional)</label>
                            <input
                                type="date"
                                id="date"
                                name="date"
                                value={formData.date}
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            />
                            {!formData.date && (
                                <p className="text-[10px] text-[#5A6A85]">
                                    Jika belum tahu tanggalnya, acara tetap tersimpan dan tanggal bisa ditambahkan nanti.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="location" className="block text-xs text-[#5A6A85]">Lokasi (Kota)</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="Kota Contoh: Jakarta"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="address" className="block text-xs text-[#5A6A85]">Alamat Lengkap / Gedung</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1"
                            rows={3}
                        ></textarea>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="homeAddress" className="block text-xs text-[#5A6A85]">
                            Alamat Rumah Pengantin
                            <span className="ml-1.5 text-[10px] text-brand-accent font-semibold">(Untuk Pengiriman Cetakan)</span>
                        </label>
                        <textarea
                            id="homeAddress"
                            name="homeAddress"
                            value={formData.homeAddress || ''}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            placeholder="Contoh: Jl. Mawar No. 5, RT 03/RW 02, Kel. Menteng, Kec. Menteng, Jakarta Pusat 10310"
                            rows={3}
                        ></textarea>
                    </div>
                </div>

                {/* Right Column: Financial & Other Info */}
                <div className="space-y-4">
                    <h4 className="text-base font-bold text-[#2A3547] border-b border-[#EAEFF4] pb-2">Detail Package & Pembayaran</h4>

                    {/* Region Selector */}
                    {availableRegions.length > 0 && (
                        <div className="space-y-2">
                            <label htmlFor="regionSelector" className="text-xs text-[#5A6A85]">Pilih Daerah</label>
                            <select
                                id="regionSelector"
                                value={selectedRegion || ''}
                                onChange={(e) => {
                                    setSelectedRegion(e.target.value || null);
                                    // Reset package and addons when region changes
                                    setFormData(prev => ({ ...prev, packageId: '', selectedAddOnIds: [] }));
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            >
                                <option value="">Semua Daerah</option>
                                {availableRegions.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="packageId" className="text-xs text-[#5A6A85]">Package</label>
                        <select
                            id="packageId"
                            name="packageId"
                            value={formData.packageId}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                            required
                        >
                            <option value="">Pilih Package...</option>
                            {visiblePackages.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}{p.region ? ` (${p.region})` : ''}
                                </option>
                            ))}
                            {formData.packageId && !visiblePackages.some(p => p.id === formData.packageId) && (
                                <option value={formData.packageId}>
                                    {packages.find(p => p.id === formData.packageId)?.name || 'Package Terpilih'}
                                </option>
                            )}
                        </select>
                    </div>

                    {/* Additional Packages Checkboxes */}
                    {visiblePackages.length > 1 && formData.packageId && (
                        <div className="space-y-2">
                            <label className="text-xs text-[#5A6A85]">Package Tambahan (Opsional)</label>
                            <div className="p-3 border border-[#EAEFF4] bg-[#F4F6F9] rounded-xl max-h-36 overflow-y-auto space-y-2">
                                {visiblePackages.filter(p => p.id !== formData.packageId).map(pkg => (
                                    <label key={pkg.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                        <span className="text-sm font-medium text-[#2A3547]">
                                            {pkg.name}{pkg.region ? ` (${pkg.region})` : ''}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-[#5A6A85]">
                                                {formatCurrency(pkg.price)}
                                            </span>
                                            <input
                                                type="checkbox"
                                                id={`addpkg-${pkg.id}`}
                                                name="additionalPackages"
                                                checked={formData.selectedAdditionalPackageIds?.includes(pkg.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        selectedAdditionalPackageIds: checked
                                                            ? [...(prev.selectedAdditionalPackageIds || []), pkg.id]
                                                            : (prev.selectedAdditionalPackageIds || []).filter(id => id !== pkg.id)
                                                    }));
                                                }}
                                                className="h-4 w-4 rounded flex-shrink-0 text-brand-accent focus:ring-brand-accent transition-colors cursor-pointer"
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Item & Add-On Tambahan */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[#5A6A85] uppercase tracking-wider">Add-On & Item Tambahan</label>
                            <span className="text-[11px] text-[#5A6A85]">Pilih katalog atau buat item baru</span>
                        </div>

                        {/* Existing Add-On Checkboxes */}
                        {visibleAddOns.length > 0 && (
                            <div className="p-3 border border-[#EAEFF4] bg-[#F4F6F9] rounded-xl max-h-36 overflow-y-auto space-y-2">
                                {visibleAddOns.map(addon => (
                                    <label key={addon.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                        <span className="text-sm font-medium text-[#2A3547]">
                                            {addon.name}{addon.region ? ` (${addon.region})` : ''}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-[#5A6A85]">
                                                {addon.price === 0 ? 'Gratis (Rp 0)' : formatCurrency(addon.price)}
                                            </span>
                                            <input
                                                type="checkbox"
                                                id={addon.id}
                                                name="addOns"
                                                checked={formData.selectedAddOnIds.includes(addon.id)}
                                                onChange={handleFormChange}
                                                className="h-4 w-4 rounded flex-shrink-0 text-brand-accent focus:ring-brand-accent transition-colors cursor-pointer"
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Form Tambah Item Kustom (Bisa input 0) */}
                        <div className="p-3.5 border border-[#EAEFF4] bg-[#F8FAFC] rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#2A3547] flex items-center gap-1.5">
                                    <Plus className="w-3.5 h-3.5 text-brand-accent" />
                                    Tambah Item Kustom (Bisa Rp 0)
                                </span>
                                <span className="text-[11px] text-[#5A6A85]">Bonus / Item Bebas</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-6">
                                    <input
                                        type="text"
                                        value={customItemName}
                                        onChange={(e) => setCustomItemName(e.target.value)}
                                        placeholder="Nama item / bonus..."
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCustomItem();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="sm:col-span-4">
                                    <RupiahInput
                                        name="customItemPrice"
                                        value={customItemPrice}
                                        onChange={(val) => setCustomItemPrice(val)}
                                        placeholder="Harga (Rp 0 bisa)"
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent text-right"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <button
                                        type="button"
                                        onClick={handleAddCustomItem}
                                        disabled={!customItemName.trim()}
                                        className="w-full h-full min-h-[34px] px-3 py-1.5 text-xs font-semibold bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Tambah
                                    </button>
                                </div>
                            </div>

                            {/* Daftar Item Kustom yang Ditambahkan */}
                            {formData.customItems && formData.customItems.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-[#EAEFF4]">
                                    <div className="text-[11px] font-semibold text-[#5A6A85]">Item Kustom Tersimpan:</div>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                        {formData.customItems.map((item, idx) => (
                                            <div key={item.id || idx} className="flex items-center justify-between px-3 py-2 bg-white border border-[#EAEFF4] rounded-lg text-xs">
                                                <span className="font-medium text-[#2A3547] truncate pr-2">{item.name}</span>
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <span className={`font-semibold ${item.price === 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded' : 'text-[#2A3547]'}`}>
                                                        {item.price === 0 ? 'Gratis (Rp 0)' : formatCurrency(item.price)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomItem(idx)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                        title="Hapus item"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form Kode Promo */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor="promoCodeId" className="text-xs font-semibold text-[#5A6A85] uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-brand-accent" />
                                Kode Promo (Opsional)
                            </label>
                            {formData.promoCodeId && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, promoCodeId: '' }))}
                                    className="text-[11px] font-medium text-red-500 hover:underline"
                                >
                                    Hapus Promo
                                </button>
                            )}
                        </div>
                        <select
                            id="promoCodeId"
                            name="promoCodeId"
                            value={formData.promoCodeId || ''}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all text-sm"
                        >
                            <option value="">Pilih Kode Promo...</option>
                            {promoCodes.map(promo => {
                                const discountLabel = promo.discountType === 'percentage'
                                    ? `Diskon ${promo.discountValue}%`
                                    : `Potongan ${formatCurrency(promo.discountValue)}`;
                                return (
                                    <option key={promo.id} value={promo.id}>
                                        {promo.code} - {discountLabel} {promo.isActive ? '' : '(Non-aktif)'}
                                    </option>
                                );
                            })}
                        </select>
                        {priceCalculations.discountAmount > 0 && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span>Promo Berhasil Digunakan:</span>
                                </div>
                                <span className="font-bold">Hemat {formatCurrency(priceCalculations.discountAmount)} ({priceCalculations.discountApplied})</span>
                            </div>
                        )}
                    </div>

                    {/* Ringkasan Biaya */}
                    <div className="p-4 bg-[#F4F6F9] rounded-xl space-y-3">
                        <div className="space-y-1.5 text-xs text-[#5A6A85] border-b border-[#EAEFF4] pb-2.5">
                            <div className="flex justify-between">
                                <span>Harga Package</span>
                                <span className="font-semibold text-[#2A3547]">{formatCurrency(priceCalculations.packagePrice)}</span>
                            </div>
                            {priceCalculations.addOnsPrice > 0 && (
                                <div className="flex justify-between">
                                    <span>Add-On & Item Tambahan</span>
                                    <span className="font-semibold text-[#2A3547]">{formatCurrency(priceCalculations.addOnsPrice)}</span>
                                </div>
                            )}
                            {priceCalculations.discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Diskon Promo ({priceCalculations.discountApplied})</span>
                                    <span>-{formatCurrency(priceCalculations.discountAmount)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center font-bold text-lg">
                            <span className="text-[#5A6A85]">Total Acara Pernikahan</span>
                            <span className="text-[#2A3547]">{formatCurrency(priceCalculations.totalProject)}</span>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="dp" className="text-xs text-[#5A6A85]">Uang DP</label>
                            <RupiahInput
                                id="dp"
                                name="dp"
                                value={String(formData.dp ?? '')}
                                onChange={(raw) => setFormData((prev) => ({ ...prev, dp: raw }))}
                                className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all text-right"
                                placeholder=" "
                            />
                        </div>
                        {Number(formData.dp) > 0 && (
                            <div className="space-y-2">
                                <span className="block text-xs text-[#5A6A85]">Bukti Transfer DP (Opsional)</span>
                                <label htmlFor="dp-proof-upload" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#D5DCE6] bg-white px-4 py-2 text-xs font-semibold text-[#2A3547] transition-colors hover:bg-[#F4F6F9]">
                                    <Upload className="h-4 w-4" />
                                    {formData.dpProofFile || formData.dpProofUrl ? 'Ganti Bukti Transfer' : 'Upload Bukti Transfer'}
                                </label>
                                <input id="dp-proof-upload" type="file" accept="image/*" onChange={handleDpProofChange} className="sr-only" />
                                <p className="text-[10px] text-[#5A6A85]">JPG, PNG, atau WebP. Maksimal 10 MB.</p>
                                {formData.dpProofFile && <p className="break-all text-[11px] font-medium text-[#2A3547]">{formData.dpProofFile.name}</p>}
                                {formData.dpProofUrl && !formData.dpProofFile && (
                                    <a href={formData.dpProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[11px] font-semibold text-brand-accent underline underline-offset-2">
                                        <img src={formData.dpProofUrl} alt="Pratinjau bukti transfer DP" className="h-12 w-16 rounded-md border border-[#EAEFF4] object-cover"  loading="lazy" decoding="async" />
                                        Lihat bukti transfer saat ini
                                    </a>
                                )}
                            </div>
                        )}
                        {Number(formData.dp) > 0 && (
                            <div className="space-y-2">
                                <label htmlFor="dpDestinationCardId" className="text-xs text-[#5A6A85]">Kartu Tujuan</label>
                                <select
                                    name="dpDestinationCardId"
                                    value={formData.dpDestinationCardId}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-white text-[#2A3547] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all"
                                    required={modalMode === 'add'}
                                >
                                    <option value="">{modalMode === 'edit' ? 'Pilih Rekening / Kartu (Opsional jika sudah tercatat)' : 'Setor DP ke...'}</option>
                                    {cards.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.bankName} {c.lastFourDigits !== 'CASH' ? `**** ${c.lastFourDigits}` : '(Tunai)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <hr className="border-[#EAEFF4]" />
                        <div className="flex justify-between items-center font-bold text-lg">
                            <span className="text-[#5A6A85]">Sisa Pembayaran</span>
                            <span className="text-brand-accent">{formatCurrency(priceCalculations.remainingPayment)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-8 mt-8 border-t border-[#EAEFF4]">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-xl border border-[#EAEFF4] text-[#5A6A85] hover:bg-[#F4F6F9] transition-all font-medium"
                >
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-brand-accent text-white hover:bg-brand-accent/90 transition-all font-medium disabled:opacity-60"
                >
                    {isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Pengantin' : 'Update Pengantin')}
                </button>
            </div>
        </form>
    );
};

export default ClientForm;
