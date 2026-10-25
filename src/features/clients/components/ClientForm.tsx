import React, { useMemo, useState } from 'react';
import { Package, AddOn, Profile, Card, PromoCode, ClientType } from '../../../types';
import RupiahInput from '../../../shared/form/RupiahInput';
import { formatCurrency, ClientFormData, CustomFormItem } from '../utils/clientHelpers';
import { ChevronDown, Package as PackageIcon, Plus, Trash2, Tag, Check, Upload } from 'lucide-react';
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

/** Gaya input mengikuti formulir booking publik. */
const inputClass = 'w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all';
const labelClass = 'block text-xs text-black';
const sectionHeadingClass = 'text-sm md:text-base font-semibold text-gradient border-b border-black pb-2';

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
    // Wilayah awal mengikuti wilayah package yang tersimpan agar data pada mode
    // edit tampil sesuai (bukan default "Semua Daerah").
    const [selectedRegion, setSelectedRegion] = useState<string | null>(
        () => packages.find(p => p.id === formData.packageId)?.region || null
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customItemName, setCustomItemName] = useState('');
    const [customItemPrice, setCustomItemPrice] = useState('0');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarUploadError, setAvatarUploadError] = useState('');
    const [isPackagePickerOpen, setIsPackagePickerOpen] = useState(false);

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

    // Memilih package lewat kartu tetap memakai logika handleFormChange milik induk.
    const handlePackageSelect = (packageId: string) => {
        handleFormChange({
            target: { name: 'packageId', value: packageId, type: 'radio' },
        } as unknown as React.ChangeEvent<HTMLSelectElement>);
        setIsPackagePickerOpen(false);
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

    // Kelompokkan package per kategori agar tampil seperti katalog booking publik.
    const packageGroups = useMemo(() => {
        const groups = new Map<string, Package[]>();
        visiblePackages.forEach(pkg => {
            const category = pkg.category?.trim() || 'Lainnya';
            groups.set(category, [...(groups.get(category) || []), pkg]);
        });
        return Array.from(groups.entries());
    }, [visiblePackages]);

    const selectedPackage = useMemo(
        () => packages.find(p => p.id === formData.packageId) || null,
        [packages, formData.packageId]
    );

    // Deskripsi/detail package yang dipilih. Bila package punya opsi Jam Kerja,
    // detail mengikuti opsi yang dipilih (atau opsi default) agar data yang
    // ditampilkan selalu sesuai dengan package yang tersimpan.
    const packageDetail = useMemo(() => {
        const pkg = selectedPackage;
        if (!pkg) return null;
        const durationOptions = pkg.durationOptions || [];
        const hasDurationOptions = durationOptions.length > 0;
        const selectedOpt = hasDurationOptions
            ? (durationOptions.find(o => o.label === formData.durationSelection)
                || durationOptions.find(o => o.default)
                || durationOptions[0])
            : null;
        const photographers = selectedOpt?.photographers || pkg.photographers;
        const videographers = selectedOpt?.videographers || pkg.videographers;
        const processingTime = selectedOpt?.processingTime || pkg.processingTime;
        const digitalItems = (selectedOpt?.digitalItems?.filter(Boolean).length
            ? selectedOpt.digitalItems
            : pkg.digitalItems)?.filter(Boolean) || [];
        const physicalItems = (selectedOpt?.physicalItems?.filter(item => item?.name).length
            ? selectedOpt.physicalItems
            : pkg.physicalItems)?.filter(item => item?.name) || [];
        const hasAnyDetail = !!(photographers || videographers || processingTime || digitalItems.length || physicalItems.length);
        return { pkg, selectedOpt, hasDurationOptions, photographers, videographers, processingTime, digitalItems, physicalItems, hasAnyDetail };
    }, [selectedPackage, formData.durationSelection]);

    // Filter add-ons by selected region, but always include currently selected addOns
    const visibleAddOns = useMemo(() => {
        if (!selectedRegion) return addOns;
        return addOns.filter(a => !a.region || a.region === selectedRegion || formData.selectedAddOnIds.includes(a.id));
    }, [addOns, selectedRegion, formData.selectedAddOnIds]);

    const priceCalculations = useMemo(() => {
        const pkg = packages.find(p => p.id === formData.packageId);
        // Prefer explicit unitPrice stored in form (selected duration), fallback to package.price
        const packagePrice = (formData.unitPrice !== undefined && Number(formData.unitPrice) >= 0)
            ? Number(formData.unitPrice)
            : (pkg?.price || 0);

        const standardAddOnsPrice = addOns
            .filter(addon => formData.selectedAddOnIds.includes(addon.id))
            .reduce((sum, addon) => sum + (formData.selectedAddOnPriceOverrides?.[addon.id] ?? addon.price), 0);

        const additionalPackagesPrice = packages
            .filter(pkg => formData.selectedAdditionalPackageIds?.includes(pkg.id))
            .reduce((sum, pkg) => sum + (formData.selectedAdditionalPackagePriceOverrides?.[pkg.id] ?? pkg.price), 0);

        const customItemsPrice = (formData.customItems || [])
            .reduce((sum, item) => sum + (Number(item.price) || 0), 0);

        const addOnsPrice = standardAddOnsPrice + additionalPackagesPrice + customItemsPrice + (Number(formData.preservedProjectExtras) || 0);

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
    }, [formData.packageId, formData.unitPrice, formData.selectedAddOnIds, formData.selectedAddOnPriceOverrides, formData.selectedAdditionalPackageIds, formData.selectedAdditionalPackagePriceOverrides, formData.customItems, formData.preservedProjectExtras, formData.dp, formData.promoCodeId, packages, addOns, promoCodes]);

    return (
        <form onSubmit={handleInternalSubmit} className="form-compact form-compact--ios-scale space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-2">
                {/* Left Column: Client & Project Info */}
                <div className="space-y-5">
                    <h4 className={sectionHeadingClass}>Informasi Pengantin & Acara Pernikahan</h4>

                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-public-border bg-neutral-100 flex items-center justify-center text-lg font-bold text-public-text-secondary">
                            {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Foto profil pengantin" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            ) : (
                                formData.clientName?.charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <div>
                            <label htmlFor="client-avatar" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-xs font-semibold shadow-sm transition-colors hover:bg-neutral-800 ${isUploadingAvatar ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                                <Upload className="w-3.5 h-3.5" />
                                {isUploadingAvatar ? 'Mengunggah...' : formData.avatarUrl ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
                            </label>
                            <input id="client-avatar" type="file" accept="image/*" onChange={handleAvatarChange} disabled={isUploadingAvatar} className="sr-only" />
                            <p className="text-[10px] text-public-text-secondary mt-1">JPG, PNG, atau WebP. Maksimal 5 MB.</p>
                            {avatarUploadError && <p role="alert" className="text-[10px] text-red-600 mt-1">{avatarUploadError}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="clientName" className={labelClass}>Nama Pengantin</label>
                        <input
                            type="text"
                            id="clientName"
                            name="clientName"
                            value={formData.clientName}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="Masukkan Nama Pengantin"
                            required={!!formData.date}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="clientType" className={labelClass}>Jenis Pengantin</label>
                        <select
                            id="clientType"
                            name="clientType"
                            value={formData.clientType}
                            onChange={handleFormChange}
                            className={inputClass}
                            required
                        >
                            {Object.values(ClientType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="phone" className={labelClass}>Nomor Telepon (WhatsApp)</label>
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
                            className={inputClass}
                            placeholder="08123456789"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="email" className={labelClass}>Email (Opsional)</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="email@example.com (opsional - bisa dikosongkan)"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="instagram" className={labelClass}>Instagram (Opsional)</label>
                        <input
                            type="text"
                            id="instagram"
                            name="instagram"
                            value={formData.instagram}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="@username (opsional - bisa dikosongkan)"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="projectName" className={labelClass}>Nama Acara Pernikahan</label>
                        <input
                            type="text"
                            id="projectName"
                            name="projectName"
                            value={formData.projectName}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="Masukkan nama Acara Pernikahan"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="projectType" className={labelClass}>Jenis Acara Pernikahan</label>
                            <select
                                id="projectType"
                                name="projectType"
                                value={formData.projectType}
                                onChange={handleFormChange}
                                className={inputClass}
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
                            <label htmlFor="date" className={labelClass}>Tanggal Acara (Opsional)</label>
                            <input
                                type="date"
                                id="date"
                                name="date"
                                value={formData.date}
                                onChange={handleFormChange}
                                className={inputClass}
                            />
                            <p className="text-[10px] text-public-text-secondary">
                                Kosongkan jika tanggal acara belum ditentukan.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="location" className={labelClass}>Lokasi (Kota)</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="Contoh: Jakarta"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="address" className={labelClass}>Alamat Lengkap / Gedung</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1"
                            rows={3}
                        ></textarea>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="homeAddress" className={labelClass}>
                            Alamat Rumah Pengantin
                            <span className="ml-1.5 text-[10px] text-public-accent font-semibold">(Untuk Pengiriman Cetakan)</span>
                        </label>
                        <textarea
                            id="homeAddress"
                            name="homeAddress"
                            value={formData.homeAddress || ''}
                            onChange={handleFormChange}
                            className={inputClass}
                            placeholder="Contoh: Jl. Mawar No. 5, RT 03/RW 02, Kel. Menteng, Kec. Menteng, Jakarta Pusat 10310"
                            rows={3}
                        ></textarea>
                    </div>
                </div>

                {/* Right Column: Package & Payment (kartu terpisah seperti booking publik) */}
                <div className="space-y-5 rounded-2xl border border-neutral-300 bg-white p-3 sm:p-4">
                    <h4 className={sectionHeadingClass}>Detail Package & Pembayaran</h4>

                    {/* Region Selector */}
                    {availableRegions.length > 0 && (
                        <div className="space-y-2">
                            <label htmlFor="regionSelector" className={labelClass}>Pilih Daerah</label>
                            <select
                                id="regionSelector"
                                value={selectedRegion || ''}
                                onChange={(e) => {
                                    setSelectedRegion(e.target.value || null);
                                    // Reset package and addons when region changes
                                    setFormData(prev => ({ ...prev, packageId: '', selectedAddOnIds: [] }));
                                }}
                                className={inputClass}
                            >
                                <option value="">Semua Daerah</option>
                                {availableRegions.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Pemilihan Package (kartu, seperti booking publik) */}
                    <fieldset className="min-w-0 space-y-3 border-0 bg-transparent p-0 shadow-none">
                        <legend className="sr-only">Pilih package layanan</legend>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <h5 className="text-sm font-extrabold leading-snug text-slate-900">Pilih Package</h5>
                            <span className="self-start rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-950 sm:shrink-0">
                                Wajib dipilih
                            </span>
                        </div>

                        {visiblePackages.length === 0 ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm font-medium text-amber-800">
                                Tidak ada package tersedia untuk wilayah ini.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <label htmlFor="packageId" className="block text-xs font-bold text-neutral-950">Package layanan</label>
                                <button
                                    id="packageId"
                                    type="button"
                                    aria-required="true"
                                    aria-expanded={isPackagePickerOpen}
                                    onClick={() => setIsPackagePickerOpen(open => !open)}
                                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-left outline-none transition hover:bg-neutral-100 focus:border-black focus:ring-2 focus:ring-neutral-300"
                                >
                                    {selectedPackage?.coverImage ? (
                                        <img src={selectedPackage.coverImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" decoding="async" />
                                    ) : (
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black">
                                            <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-slate-900">
                                            {selectedPackage?.name || 'Pilih package yang Anda inginkan'}
                                        </span>
                                        <span className="block truncate text-xs font-medium text-slate-500">
                                            {selectedPackage?.category || 'Lihat pilihan package tersedia'}
                                        </span>
                                    </span>
                                    {selectedPackage && (
                                        <span className="hidden shrink-0 text-right sm:block">
                                            <span className="block text-[10px] font-semibold text-slate-500">
                                                {selectedPackage.durationOptions?.length ? 'Mulai dari' : 'Harga'}
                                            </span>
                                            <span className="block text-xs font-extrabold text-neutral-950">
                                                {formatCurrency(selectedPackage.durationOptions?.length
                                                    ? Math.min(...selectedPackage.durationOptions.map(option => Number(option.price)))
                                                    : Number(selectedPackage.price))}
                                            </span>
                                        </span>
                                    )}
                                    <ChevronDown className={`h-5 w-5 shrink-0 text-black transition-transform ${isPackagePickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>

                                {isPackagePickerOpen && (
                                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/70 p-1.5 sm:p-2" role="group" aria-label="Pilihan package">
                                        {packageGroups.map(([category, categoryPackages], groupIndex) => (
                                            <div key={category}>
                                                {groupIndex > 0 && <div className="my-2.5 border-t border-neutral-300" aria-hidden="true" />}
                                                <p className="px-1 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-950">{category}</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {categoryPackages.map(pkg => {
                                                        const hasDurationOptions = !!pkg.durationOptions?.length;
                                                        const startingPrice = hasDurationOptions
                                                            ? Math.min(...pkg.durationOptions!.map(option => Number(option.price)))
                                                            : Number(pkg.price);
                                                        return (
                                                            <button
                                                                key={pkg.id}
                                                                type="button"
                                                                aria-pressed={formData.packageId === pkg.id}
                                                                onClick={() => handlePackageSelect(pkg.id)}
                                                                className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:flex sm:gap-3 sm:rounded-xl sm:p-2.5 ${
                                                                    formData.packageId === pkg.id ? 'border-neutral-900 ring-1 ring-neutral-300' : 'border-neutral-200'
                                                                }`}
                                                            >
                                                                {pkg.coverImage ? (
                                                                    <img src={pkg.coverImage} alt="" className="row-span-2 h-10 w-10 shrink-0 rounded-lg object-cover sm:row-span-1 sm:h-12 sm:w-12" loading="lazy" decoding="async" />
                                                                ) : (
                                                                    <span className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black sm:row-span-1 sm:h-12 sm:w-12">
                                                                        <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                                                    </span>
                                                                )}
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block text-sm font-bold text-slate-900">{pkg.name}</span>
                                                                    {pkg.region && <span className="block text-[11px] font-medium text-slate-500">{pkg.region}</span>}
                                                                </span>
                                                                <span className="col-start-2 flex w-full items-center justify-between gap-2 text-left sm:col-auto sm:block sm:w-auto sm:max-w-[7rem] sm:shrink-0 sm:whitespace-nowrap sm:text-right">
                                                                    {hasDurationOptions && <span className="block text-[10px] font-semibold text-slate-500">Mulai dari</span>}
                                                                    <span className="block text-[11px] font-extrabold text-neutral-950 sm:text-xs">{formatCurrency(startingPrice)}</span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </fieldset>

                    {/* Deskripsi / Detail Package yang dipilih */}
                    {packageDetail && (
                        <div className="space-y-2 rounded-xl border border-public-border bg-white p-3">
                            <p className="text-xs font-semibold text-black">
                                Detail Package: {packageDetail.pkg.name}
                                {packageDetail.selectedOpt && packageDetail.hasDurationOptions && (
                                    <span className="font-normal text-neutral-700"> — {packageDetail.selectedOpt.label}</span>
                                )}
                            </p>
                            {packageDetail.hasAnyDetail ? (
                                <ul className="space-y-1 text-xs text-public-text-secondary">
                                    {packageDetail.photographers && <li>• {packageDetail.photographers}</li>}
                                    {packageDetail.videographers && <li>• {packageDetail.videographers}</li>}
                                    {packageDetail.processingTime && <li>• Waktu pengerjaan: {packageDetail.processingTime}</li>}
                                    {packageDetail.digitalItems.map((item, i) => <li key={`digital-${i}`}>• {item}</li>)}
                                    {packageDetail.physicalItems.map((item, i) => <li key={`physical-${i}`}>• {item.name}</li>)}
                                </ul>
                            ) : (
                                <p className="text-xs italic text-public-text-secondary">Belum ada rincian untuk package ini.</p>
                            )}
                        </div>
                    )}

                    {/* Pilihan Jam Kerja (durasi) */}
                    {selectedPackage?.durationOptions && selectedPackage.durationOptions.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-black">Jam Kerja</label>
                            <p className="text-xs text-public-text-secondary">Pilih durasi jam kerja.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {selectedPackage.durationOptions.map(opt => (
                                    <label key={opt.label} className={`min-h-11 flex items-center justify-between border-b border-neutral-200 px-2 py-2.5 last:border-b-0 cursor-pointer transition-colors ${formData.durationSelection === opt.label
                                        ? 'border-l-2 border-l-black bg-neutral-200'
                                        : 'hover:bg-neutral-50'
                                        }`}>
                                        <span className="text-sm font-medium">{opt.label}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-black">{formatCurrency(opt.price)}</span>
                                            <input
                                                type="radio"
                                                name="durationSelection"
                                                value={opt.label}
                                                checked={formData.durationSelection === opt.label}
                                                onChange={handleFormChange}
                                                className="h-3.5 w-3.5 text-black focus:ring-neutral-900 flex-shrink-0"
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Package Tambahan (kartu) */}
                    {visiblePackages.length > 1 && formData.packageId && (
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-black">Package Tambahan (Opsional)</label>
                            <div className="space-y-2">
                                {visiblePackages.filter(p => p.id !== formData.packageId).map(pkg => (
                                    <label
                                        key={pkg.id}
                                        className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50 cursor-pointer sm:gap-3 sm:rounded-xl sm:p-2.5 ${formData.selectedAdditionalPackageIds?.includes(pkg.id) ? 'border-neutral-900 ring-1 ring-neutral-300' : 'border-neutral-200'
                                            }`}
                                    >
                                        {pkg.coverImage ? (
                                            <img src={pkg.coverImage} alt="" className="row-span-2 h-10 w-10 shrink-0 rounded-lg object-cover sm:row-span-1 sm:h-12 sm:w-12" loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black sm:row-span-1 sm:h-12 sm:w-12">
                                                <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-bold text-slate-900">{pkg.name}{pkg.region ? ` (${pkg.region})` : ''}</span>
                                            <span className="block text-[11px] font-extrabold text-neutral-950 sm:text-xs">{formatCurrency(formData.selectedAdditionalPackagePriceOverrides?.[pkg.id] ?? pkg.price)}</span>
                                        </span>
                                        <div className="col-start-3 row-span-2 flex items-center justify-end px-1">
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
                                                            : (prev.selectedAdditionalPackageIds || []).filter(id => id !== pkg.id),
                                                        selectedAdditionalPackagePriceOverrides: checked
                                                            ? prev.selectedAdditionalPackagePriceOverrides
                                                            : Object.fromEntries(Object.entries(prev.selectedAdditionalPackagePriceOverrides || {}).filter(([id]) => id !== pkg.id)),
                                                    }));
                                                }}
                                                className="h-4 w-4 text-black rounded focus:ring-neutral-900 flex-shrink-0 cursor-pointer"
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add-On Lainnya */}
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-black">Add-On Lainnya (Opsional)</label>
                        <div className="space-y-1">
                            {visibleAddOns.length > 0 ? visibleAddOns.map(addon => (
                                <label
                                    key={addon.id}
                                    className={`flex items-center justify-between border-b border-neutral-200 px-2 py-2 last:border-b-0 cursor-pointer transition-colors ${formData.selectedAddOnIds.includes(addon.id) ? 'bg-neutral-200' : 'hover:bg-neutral-50'
                                        }`}
                                >
                                    <span className="text-sm text-public-text-primary font-medium">
                                        {addon.name}{addon.region ? ` (${addon.region})` : ''}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-black">
                                            {(formData.selectedAddOnPriceOverrides?.[addon.id] ?? addon.price) === 0
                                                ? 'Gratis (Rp 0)'
                                                : formatCurrency(formData.selectedAddOnPriceOverrides?.[addon.id] ?? addon.price)}
                                        </span>
                                        <input
                                            type="checkbox"
                                            id={addon.id}
                                            name="addOns"
                                            checked={formData.selectedAddOnIds.includes(addon.id)}
                                            onChange={handleFormChange}
                                            className="h-4 w-4 text-black rounded focus:ring-neutral-900 flex-shrink-0 cursor-pointer"
                                        />
                                    </div>
                                </label>
                            )) : <p className="text-xs text-public-text-secondary">Tidak ada add-on untuk wilayah ini.</p>}
                        </div>
                    </div>

                    {/* Item Kustom */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-black uppercase tracking-wide">Item Tambahan Kustom</label>
                            <span className="text-[11px] text-public-text-secondary">Bonus / item bebas</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-6">
                                <input
                                    type="text"
                                    value={customItemName}
                                    onChange={(e) => setCustomItemName(e.target.value)}
                                    placeholder="Nama item / bonus..."
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all"
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
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all text-right"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <button
                                    type="button"
                                    onClick={handleAddCustomItem}
                                    disabled={!customItemName.trim()}
                                    className="w-full h-full min-h-[34px] px-3 py-1.5 text-xs font-semibold bg-black text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Tambah
                                </button>
                            </div>
                        </div>

                        {formData.customItems && formData.customItems.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-public-border">
                                <div className="text-[11px] font-semibold text-public-text-secondary">Item Kustom Tersimpan:</div>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {formData.customItems.map((item, idx) => (
                                        <div key={item.id || idx} className="flex items-center justify-between px-3 py-2 bg-white border border-public-border rounded-lg text-xs">
                                            <span className="font-medium text-black truncate pr-2">{item.name}</span>
                                            <div className="flex items-center gap-2.5 shrink-0">
                                                <span className={`font-semibold ${item.price === 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded' : 'text-black'}`}>
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

                    {/* Kode Promo */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor="promoCodeId" className="text-xs font-semibold text-black uppercase tracking-wide flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
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
                            className={`${inputClass} text-sm`}
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
                    <div className="space-y-2 md:space-y-3">
                        <div className="space-y-1.5 text-sm border-b border-public-border pb-2.5">
                            <div className="flex justify-between items-center">
                                <span className="text-public-text-secondary">Harga Package</span>
                                <span className="text-public-text-primary font-medium">{formatCurrency(priceCalculations.packagePrice)}</span>
                            </div>
                            {priceCalculations.addOnsPrice > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-public-text-secondary">Add-On & Item Tambahan</span>
                                    <span className="text-public-text-primary font-medium">{formatCurrency(priceCalculations.addOnsPrice)}</span>
                                </div>
                            )}
                            {priceCalculations.discountAmount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-public-text-secondary">Diskon ({priceCalculations.discountApplied})</span>
                                    <span className="text-green-500">-{formatCurrency(priceCalculations.discountAmount)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center font-bold text-lg">
                            <span className="text-public-text-secondary">Total Biaya</span>
                            <span className="text-public-text-primary">{formatCurrency(priceCalculations.totalProject)}</span>
                        </div>

                        <hr className="border-public-border" />

                        <div className="space-y-2">
                            <label htmlFor="dp" className={labelClass}>Uang DP</label>
                            <RupiahInput
                                id="dp"
                                name="dp"
                                value={String(formData.dp ?? '')}
                                onChange={(raw) => setFormData((prev) => ({ ...prev, dp: raw }))}
                                className={`${inputClass} text-right`}
                                placeholder="0"
                            />
                        </div>

                        {Number(formData.dp) > 0 && (
                            <div className="space-y-2">
                                <label htmlFor="dpDestinationCardId" className={labelClass}>Kartu Tujuan</label>
                                <select
                                    name="dpDestinationCardId"
                                    value={formData.dpDestinationCardId}
                                    onChange={handleFormChange}
                                    className={inputClass}
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

                        {Number(formData.dp) > 0 && (
                            <div className="space-y-2">
                                <span className={labelClass}>Bukti Transfer DP (Opsional)</span>
                                <div className="flex justify-center rounded-2xl border-2 border-dashed border-black bg-gradient-to-br from-neutral-50 to-white p-4 transition-colors hover:border-neutral-900">
                                    <div className="text-center">
                                        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-black">
                                            <Upload className="h-5 w-5" />
                                        </span>
                                        <p className="mt-2 text-sm font-bold text-public-text-primary">
                                            {formData.dpProofFile || formData.dpProofUrl ? 'Bukti transfer siap' : 'Unggah bukti transfer'}
                                        </p>
                                        {formData.dpProofFile && <p className="mt-1 break-all text-xs text-public-text-secondary">{formData.dpProofFile.name}</p>}
                                        {formData.dpProofUrl && !formData.dpProofFile && (
                                            <a href={formData.dpProofUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-2 text-[11px] font-semibold text-black underline underline-offset-2">
                                                <img src={formData.dpProofUrl} alt="Pratinjau bukti transfer DP" className="h-12 w-16 rounded-md border border-public-border object-cover" loading="lazy" decoding="async" />
                                                Lihat bukti transfer saat ini
                                            </a>
                                        )}
                                        <label htmlFor="dp-proof-upload" className="mt-2 inline-flex cursor-pointer items-center rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800">
                                            {formData.dpProofFile || formData.dpProofUrl ? 'Ganti file' : 'Pilih file'}
                                        </label>
                                        <input id="dp-proof-upload" type="file" accept="image/*" onChange={handleDpProofChange} className="sr-only" />
                                        <p className="mt-1 text-[11px] text-neutral-600">JPG, PNG, atau WebP · Maksimal 10 MB</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <hr className="border-public-border" />
                        <div className="flex justify-between items-center font-bold text-lg">
                            <span className="text-public-text-secondary">Sisa Pembayaran</span>
                            <span className="text-public-accent">{formatCurrency(priceCalculations.remainingPayment)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-6 border-t border-public-border">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-xl border border-public-border text-public-text-secondary hover:bg-neutral-50 transition-all font-medium"
                >
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-black text-white font-semibold hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 transition-all shadow-sm disabled:opacity-60"
                >
                    {isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Pengantin' : 'Update Pengantin')}
                </button>
            </div>
        </form>
    );
};

export default ClientForm;
