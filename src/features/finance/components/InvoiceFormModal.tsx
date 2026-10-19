import React, { useState } from 'react';
import { Project, Client, Package, PaymentStatus, Profile, Transaction } from '../../../types';
import Modal from '../../../shared/ui/Modal';
import RupiahInput from '../../../shared/form/RupiahInput';
import { useInvoiceFormModal } from '../hooks/useInvoiceFormModal';
import InvoiceLineItemsEditor from './InvoiceLineItemsEditor';
import InvoicePreviewModal from './InvoicePreviewModal';
import {
  FileText,
  User,
  Calendar,
  MapPin,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  Building,
  Eye,
  Lock,
  Info,
  Upload,
  Trash2,
} from 'lucide-react';
import { uploadDpProof } from '../../../services/storage';

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
  clients: Client[];
  packages: Package[];
  /** All transactions — used to derive amountPaid from actual payment records in edit mode */
  transactions?: Transaction[];
  userProfile?: Profile;
  showNotification: (msg: string) => void;
  onSuccess: (savedProject: Project, newTransaction?: any) => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);

const PROJECT_TYPES = [
  'Wedding',
  'Pre-Wedding',
  'Engagement',
  'Akad Saja',
  'Resepsi Saja',
  'Event & Party',
  'Birthday',
  'Wisuda',
  'Corporate',
  'Portrait & Studio',
  'Commercial / Brand',
  'Lainnya',
];

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
  clients,
  packages,
  transactions,
  userProfile,
  showNotification,
  onSuccess,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [uploadingProofKey, setUploadingProofKey] = useState<string | null>(null);

  const {
    formData,
    isSubmitting,
    errorMsg,
    handleFieldChange,
    handleClientSelect,
    handleAddLineItem,
    handleUpdateLineItem,
    handleRemoveLineItem,
    handleSubmit,
  } = useInvoiceFormModal({
    isOpen,
    projectToEdit,
    clients,
    packages,
    transactions,
    showNotification,
    onSuccess: (project, newTx) => {
      onSuccess(project, newTx);
      onClose();
    },
  });

  const isEditMode = Boolean(formData.id);
  const modalTitle = isEditMode
    ? `Edit Invoice: ${formData.invoiceNumber || formData.title || 'Invoice'}`
    : 'Buat Invoice Manual Baru';

  const balanceDue = Math.max(0, formData.grandTotal - formData.amountPaid);

  const handleReplaceProof = async (key: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Pilih file gambar untuk bukti transfer.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification('Ukuran bukti transfer maksimal 10 MB.');
      return;
    }

    setUploadingProofKey(key);
    try {
      const url = await uploadDpProof(file);
      if (key === 'dp') {
        handleFieldChange('dpProofUrl', url);
      } else {
        const index = Number(key.replace('payment-', ''));
        handleFieldChange('paymentProofs', formData.paymentProofs.map((proof, proofIndex) =>
          proofIndex === index ? { ...proof, url } : proof,
        ));
      }
      showNotification('Bukti transfer berhasil diunggah. Simpan perubahan invoice untuk menerapkannya.');
    } catch (error) {
      console.error('[InvoiceFormModal] Payment proof upload failed:', error);
      showNotification('Gagal mengunggah bukti transfer. Coba lagi.');
    } finally {
      setUploadingProofKey(null);
    }
  };

  const handleDeleteProof = (key: string) => {
    if (key === 'dp') {
      handleFieldChange('dpProofUrl', '');
      return;
    }
    const index = Number(key.replace('payment-', ''));
    handleFieldChange('paymentProofs', formData.paymentProofs.filter((_, proofIndex) => proofIndex !== index));
  };

  const handleOpenPreview = () => {
    const hasClient = formData.isNewClient
      ? Boolean(formData.clientName.trim())
      : Boolean(formData.clientId || formData.clientName.trim());

    if (!hasClient) {
      showNotification('Silakan pilih atau masukkan nama pengantin terlebih dahulu untuk melihat pratinjau.');
      return;
    }

    if (formData.lineItems.length === 0) {
      showNotification('Tambahkan minimal 1 item layanan untuk melihat pratinjau.');
      return;
    }

    setIsPreviewOpen(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-500 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Preview & Guidance Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-brand-surface rounded-xl border border-brand-border">
          <p className="hidden sm:block text-xs text-brand-text-secondary">
            Lengkapi rincian pembayaran di bawah, lalu klik <span className="font-bold text-brand-text-primary">Pratinjau Invoice</span> untuk melihat dokumen read-only sebelum difinalisasi.
          </p>
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-brand-accent/30 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent text-xs font-bold transition-all shrink-0 w-full sm:w-auto self-start sm:self-center"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pratinjau Invoice</span>
          </button>
        </div>

        {/* Section 1: Informasi Pengantin */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-brand-accent shrink-0" />
              <h4 className="text-sm font-bold text-brand-text-primary">
                Informasi Pengantin / Pembayar
              </h4>
            </div>

            {/* Toggle Existing vs New Client */}
            {!isEditMode && (
              <div className="inline-flex p-0.5 rounded-xl bg-brand-bg border border-brand-border self-start">
                <button
                  type="button"
                  onClick={() => handleFieldChange('isNewClient', false)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    !formData.isNewClient
                      ? 'bg-brand-surface text-brand-accent shadow-sm'
                      : 'text-brand-text-secondary hover:text-brand-text-primary'
                  }`}
                >
                  Pilih Pengantin Terdaftar
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('isNewClient', true)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    formData.isNewClient
                      ? 'bg-brand-surface text-brand-accent shadow-sm'
                      : 'text-brand-text-secondary hover:text-brand-text-primary'
                  }`}
                >
                  + Pengantin Baru
                </button>
              </div>
            )}
          </div>

          {!formData.isNewClient ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  Nama Pengantin Terdaftar <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                  required
                >
                  <option value="">-- Pilih Pengantin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.clientId && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-brand-text-secondary">No. Telepon / WhatsApp:</span>
                    <p className="text-xs font-bold text-brand-text-primary">{formData.clientPhone || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-brand-text-secondary">Email:</span>
                    <p className="text-xs font-bold text-brand-text-primary">{formData.clientEmail || '-'}</p>
                  </div>
                  {formData.clientAddress && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-brand-text-secondary">Alamat:</span>
                      <p className="text-xs font-medium text-brand-text-primary">{formData.clientAddress}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  Nama Lengkap Pengantin <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => handleFieldChange('clientName', e.target.value)}
                  placeholder="Contoh: Sarah & Dimas"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  No. WhatsApp / HP
                </label>
                <input
                  type="text"
                  value={formData.clientPhone}
                  onChange={(e) => handleFieldChange('clientPhone', e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => handleFieldChange('clientEmail', e.target.value)}
                  placeholder="pengantin@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  Alamat Pengantin
                </label>
                <input
                  type="text"
                  value={formData.clientAddress}
                  onChange={(e) => handleFieldChange('clientAddress', e.target.value)}
                  placeholder="Alamat domisili / pengiriman album"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Informasi Invoice & Acara */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 border-b border-brand-border pb-3">
            <FileText className="w-4 h-4 text-brand-accent shrink-0" />
            <h4 className="text-sm font-bold text-brand-text-primary">
              Informasi Acara & Tanggal
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Judul Invoice / Nama Acara <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Contoh: Wedding Sarah & Dimas (atau Liputan Dokumentasi)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Tipe Layanan
              </label>
              <select
                value={formData.projectType}
                onChange={(e) => handleFieldChange('projectType', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Nomor Invoice
              </label>
              <input
                type="text"
                value={formData.invoiceNumber || 'Otomatis di-generate sistem'}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text-secondary text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Tanggal Terbit Invoice <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                  disabled={!!formData.id}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium disabled:cursor-not-allowed disabled:bg-brand-bg disabled:text-brand-text-secondary"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Tanggal Acara / Jatuh Tempo
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => handleFieldChange('eventDate', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Lokasi / Venue Acara
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleFieldChange('location', e.target.value)}
                placeholder="Contoh: Hotel Mulia Senayan / Gedung Graha Sabha"
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Detail Alamat / Kota
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="Jl. Gatot Subroto No. 1, Jakarta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Rincian Item Layanan (Line Items Editor) */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border">
          <InvoiceLineItemsEditor
            items={formData.lineItems}
            onAddItem={handleAddLineItem}
            onUpdateItem={handleUpdateLineItem}
            onRemoveItem={handleRemoveLineItem}
            packages={packages}
          />
        </div>

        {/* Section 4: Biaya Tambahan & Diskon */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 border-b border-brand-border pb-3">
            <Tag className="w-4 h-4 text-brand-accent shrink-0" />
            <h4 className="text-sm font-bold text-brand-text-primary">
              Biaya Tambahan & Diskon
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Biaya Transport */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-text-secondary">
                Biaya Transportasi / Akomodasi (Rp)
              </label>
              <RupiahInput
                value={String(formData.transportCost || '')}
                onChange={(raw) => handleFieldChange('transportCost', Number(raw) || 0)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              <p className="text-[11px] text-brand-text-secondary">
                Biaya bensin, tol, atau perjalanan luar kota jika ada
              </p>
            </div>

            {/* Diskon */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-brand-text-secondary">
                  Potongan Harga / Diskon
                </label>
                <div className="inline-flex rounded-lg border border-brand-border bg-brand-bg p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('discountType', 'fixed')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      formData.discountType === 'fixed'
                        ? 'bg-brand-surface text-brand-accent shadow-sm'
                        : 'text-brand-text-secondary'
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('discountType', 'percentage')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      formData.discountType === 'percentage'
                        ? 'bg-brand-surface text-brand-accent shadow-sm'
                        : 'text-brand-text-secondary'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              {formData.discountType === 'percentage' ? (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discountValue || ''}
                    onChange={(e) => handleFieldChange('discountValue', Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-text-secondary">
                    % ({formatCurrency(formData.discountAmount)})
                  </div>
                </div>
              ) : (
                <RupiahInput
                  value={String(formData.discountValue || '')}
                  onChange={(raw) => handleFieldChange('discountValue', Number(raw) || 0)}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                />
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Ringkasan Total & Pembayaran */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 border-b border-brand-border pb-3">
            <DollarSign className="w-4 h-4 text-brand-accent shrink-0" />
            <h4 className="text-sm font-bold text-brand-text-primary">
              Ringkasan Pembayaran & Status
            </h4>
          </div>

          {/* In edit mode: show informational note about payment source of truth */}
          {isEditMode && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Pembayaran dikunci.</strong> Nilai &ldquo;Sudah Dibayar&rdquo; dihitung otomatis dari total transaksi pembayaran nyata untuk invoice ini.
                Ubah tanggal DP di bawah bila tanggal masuk berbeda. Untuk menambah pembayaran, gunakan fitur <strong>Tambah Transaksi</strong> di menu Keuangan.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Pembayaran Awal / DP */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-text-secondary flex items-center gap-1.5">
                  Sudah Dibayar / Uang Muka (DP) (Rp)
                  {isEditMode && <Lock className="w-3 h-3 text-blue-500" />}
                </label>
                {isEditMode ? (
                  // READ-ONLY in edit mode — value comes from actual transactions
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300/40 bg-blue-500/5 text-brand-text-primary text-xs font-bold flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-mono">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(formData.amountPaid)}
                    </span>
                    <span className="text-brand-text-secondary font-normal">(dari transaksi)</span>
                  </div>
                ) : (
                  <>
                    <RupiahInput
                      value={String(formData.amountPaid || '')}
                      onChange={(raw) => handleFieldChange('amountPaid', Number(raw) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                    />
                    <p className="text-[11px] text-brand-text-secondary">
                      Masukkan nominal jika pengantin telah menyetor DP saat invoice dibuat
                    </p>
                  </>
                )}
              </div>

              {isEditMode && (
                <div className="space-y-1.5">
                  <label htmlFor="invoice-payment-date" className="text-xs font-semibold text-brand-text-secondary">
                    Edit / Tanggal DP Masuk
                  </label>
                  <input
                    id="invoice-payment-date"
                    type="date"
                    value={formData.paymentDate || ''}
                    onChange={(e) => handleFieldChange('paymentDate', e.target.value)}
                    disabled={!formData.paymentDateTransactionId}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium disabled:cursor-not-allowed disabled:bg-brand-bg disabled:text-brand-text-secondary"
                  />
                  {!formData.paymentDateTransactionId && (
                    <p className="text-[11px] text-brand-text-secondary">Belum ada transaksi pembayaran yang dapat disesuaikan.</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-text-secondary flex items-center gap-1.5">
                  Status Pembayaran
                  {isEditMode && <Lock className="w-3 h-3 text-blue-500" />}
                </label>
                {isEditMode ? (
                  // READ-ONLY in edit mode — auto-computed from transactions vs total
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300/40 bg-blue-500/5 text-brand-text-primary text-xs font-bold flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{
                      formData.paymentStatus === PaymentStatus.LUNAS ? 'Lunas (Paid in Full)'
                      : formData.paymentStatus === PaymentStatus.DP_TERBAYAR ? 'DP Terbayar (Partial Paid)'
                      : 'Belum Bayar (Unpaid)'
                    }</span>
                    <span className="text-brand-text-secondary font-normal">(otomatis)</span>
                  </div>
                ) : (
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => handleFieldChange('paymentStatus', e.target.value as PaymentStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                  >
                    <option value={PaymentStatus.BELUM_BAYAR}>Belum Bayar (Unpaid)</option>
                    <option value={PaymentStatus.DP_TERBAYAR}>DP Terbayar (Partial Paid)</option>
                    <option value={PaymentStatus.LUNAS}>Lunas (Paid in Full)</option>
                  </select>
                )}
              </div>
            </div>

            {isEditMode && (
              <div className="space-y-3 border-t border-brand-border pt-4">
                <div>
                  <h5 className="text-xs font-bold text-brand-text-primary">Lampiran Bukti Transfer</h5>
                  <p className="mt-1 text-[11px] text-brand-text-secondary">Ganti atau hapus bukti satu per satu. Perubahan diterapkan setelah invoice disimpan.</p>
                </div>
                {formData.dpProofUrl || formData.paymentProofs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {formData.dpProofUrl && (
                      <div className="flex items-center gap-3 rounded-xl border border-brand-border p-3">
                        <a href={formData.dpProofUrl} target="_blank" rel="noopener noreferrer" title="Lihat bukti transfer DP">
                          <img src={formData.dpProofUrl} alt="Bukti transfer DP" className="h-16 w-20 rounded-lg border border-brand-border object-cover" />
                        </a>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-semibold text-brand-text-primary">Bukti Transfer DP</p>
                          <div className="mt-2 flex items-center gap-2">
                            <label htmlFor="replace-dp-proof" title="Unggah ulang bukti DP" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-brand-border text-brand-accent hover:bg-brand-bg">
                              <Upload className="h-4 w-4" />
                            </label>
                            <input id="replace-dp-proof" type="file" accept="image/*" disabled={uploadingProofKey === 'dp'} onChange={event => { void handleReplaceProof('dp', event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" />
                            <button type="button" onClick={() => handleDeleteProof('dp')} title="Hapus bukti DP" aria-label="Hapus bukti DP" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {uploadingProofKey === 'dp' && <span className="text-[10px] text-brand-text-secondary">Mengunggah...</span>}
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.paymentProofs.map((proof, index) => {
                      const key = `payment-${index}`;
                      return (
                        <div key={`${proof.url}-${index}`} className="flex items-center gap-3 rounded-xl border border-brand-border p-3">
                          <a href={proof.url} target="_blank" rel="noopener noreferrer" title="Lihat bukti pembayaran">
                            <img src={proof.url} alt={`Bukti pembayaran ${index + 1}`} className="h-16 w-20 rounded-lg border border-brand-border object-cover" />
                          </a>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-xs font-semibold text-brand-text-primary">Bukti Pembayaran {index + 1}</p>
                            <p className="break-words text-[10px] text-brand-text-secondary">{formatCurrency(proof.amount)} · {proof.date}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <label htmlFor={`replace-proof-${index}`} title="Unggah ulang bukti pembayaran" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-brand-border text-brand-accent hover:bg-brand-bg">
                                <Upload className="h-4 w-4" />
                              </label>
                              <input id={`replace-proof-${index}`} type="file" accept="image/*" disabled={uploadingProofKey === key} onChange={event => { void handleReplaceProof(key, event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" />
                              <button type="button" onClick={() => handleDeleteProof(key)} title="Hapus bukti pembayaran" aria-label={`Hapus bukti pembayaran ${index + 1}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                              {uploadingProofKey === key && <span className="text-[10px] text-brand-text-secondary">Mengunggah...</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-brand-border px-3 py-4 text-center text-xs text-brand-text-secondary">Belum ada bukti transfer pada invoice ini.</p>
                )}
              </div>
            )}

            {/* Financial Summary Card */}
            <div className="p-4 rounded-xl bg-brand-bg/60 border border-brand-border space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-brand-text-secondary">
                <span>Subtotal Item Layanan:</span>
                <span className="font-semibold text-brand-text-primary">
                  {formatCurrency(formData.subtotal - (formData.transportCost || 0))}
                </span>
              </div>

              {formData.transportCost > 0 && (
                <div className="flex justify-between items-center text-brand-text-secondary">
                  <span>Biaya Transportasi:</span>
                  <span className="font-semibold text-brand-text-primary">
                    +{formatCurrency(formData.transportCost)}
                  </span>
                </div>
              )}

              {formData.discountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-medium">
                  <span>Diskon Potongan:</span>
                  <span>-{formatCurrency(formData.discountAmount)}</span>
                </div>
              )}

              <div className="border-t border-brand-border/80 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-brand-text-primary">Grand Total Pembayaran:</span>
                <span className="text-base font-black text-brand-accent">
                  {formatCurrency(formData.grandTotal)}
                </span>
              </div>

              <div className="flex justify-between items-center text-brand-text-secondary">
                <span>Sudah Dibayar:</span>
                <span className="font-semibold text-[#166534]">
                  {formatCurrency(formData.amountPaid)}
                </span>
              </div>

              <div className="border-t border-brand-border/60 pt-2 flex justify-between items-center font-bold">
                <span className="text-slate-700">Sisa Pembayaran:</span>
                <span className={balanceDue > 0 ? 'text-[#DC2626] font-black' : 'text-[#166534]'}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Catatan / Syarat & Ketentuan */}
        <div className="bg-brand-surface rounded-2xl p-4 sm:p-5 border border-brand-border space-y-3">
          <label className="block text-xs font-bold text-brand-text-primary">
            Catatan Invoice / Ketentuan Pembayaran
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Ketentuan transfer, nomor rekening, atau catatan khusus untuk pengantin..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/40 font-medium leading-relaxed"
          />
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3 pt-4 border-t border-brand-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="button-secondary w-full sm:w-auto px-4 py-2 text-xs font-bold"
          >
            Batal
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenPreview}
              disabled={isSubmitting}
              className="button-secondary w-full sm:w-auto px-3.5 py-2 text-xs font-bold flex items-center justify-center gap-2 border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10 transition-colors"
              title="Lihat tampilan dokumen invoice sebelum finalisasi"
            >
              <Eye className="w-4 h-4" />
              <span>Pratinjau Invoice</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="button-primary w-full sm:w-auto px-5 py-2 text-xs font-bold shadow-lg flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Menyimpan Invoice...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  <span>{isEditMode ? 'Simpan Perubahan' : 'Buat Invoice Sekarang'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Read-Only Invoice Preview Modal ──────────────────────────── */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirmFinalize={() => {
          setIsPreviewOpen(false);
          handleSubmit();
        }}
        isSubmitting={isSubmitting}
        formData={formData}
        profile={userProfile}
        packages={packages}
        isEditMode={isEditMode}
      />
    </Modal>
  );
};

export default InvoiceFormModal;
