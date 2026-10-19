import React from 'react';
import Modal from '../../../shared/ui/Modal';
import InvoiceDocument from './InvoiceDocument';
import { Client, Package, Profile, Project } from '../../../types';
import { InvoiceFormData } from '../types/invoiceForm';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFinalize?: () => void;
  isSubmitting?: boolean;
  formData: InvoiceFormData;
  profile?: Profile;
  packages?: Package[];
  isEditMode?: boolean;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmFinalize,
  isSubmitting = false,
  formData,
  profile,
  packages = [],
  isEditMode = false,
}) => {
  const effectiveNumber =
    formData.invoiceNumber ||
    `DRAFT-${formData.invoiceDate ? formData.invoiceDate.replace(/-/g, '') : 'INV'}`;

  const effectiveTitle =
    formData.title ||
    `Dokumentasi ${formData.projectType || 'Wedding'} - ${formData.clientName || 'Pengantin'}`;

  const primaryItem = formData.lineItems[0];
  const additionalItems = formData.lineItems.slice(1);
  const additionalPackageItems = additionalItems.filter((item) => item.sourceType === 'package');
  const selectedPackage = packages.find((pkg) => pkg.id === formData.packageId)
    || packages.find((pkg) => pkg.name === primaryItem?.description);
  const previewPackage = !selectedPackage && primaryItem?.packageDetails?.length
    ? {
        id: 'invoice-preview-package',
        name: primaryItem.description,
        price: primaryItem.unitPrice,
        category: '',
        physicalItems: [],
        digitalItems: primaryItem.packageDetails,
        processingTime: '',
      } as Package
    : undefined;
  const previewPackages = previewPackage ? [...packages, previewPackage] : packages;
  const previewProject: Project = {
    id: formData.id || effectiveNumber,
    projectName: effectiveTitle,
    clientName: formData.clientName || 'Pengantin',
    clientId: formData.clientId || '',
    projectType: formData.projectType || 'Wedding',
    packageName: primaryItem?.description || effectiveTitle,
    packageId: selectedPackage?.id || previewPackage?.id || '',
    durationSelection: formData.durationSelection,
    addOns: additionalItems
      .filter((item) => item.sourceType === 'addon')
      .map((item) => ({ id: item.originalAddOnId || item.id, name: item.description, price: item.totalPrice })),
    additionalPackages: additionalPackageItems.map((item) => ({
      id: packages.find((pkg) => pkg.name === item.description)?.id || item.id,
      name: item.quantity > 1 ? `${item.description} (${item.quantity}x)` : item.description,
      price: item.totalPrice,
    })),
    customCosts: additionalItems
      .filter((item) => item.sourceType !== 'addon' && item.sourceType !== 'package')
      .map((item) => ({
        id: item.id,
        description: item.quantity > 1 ? `${item.description} (${item.quantity}x)` : item.description,
        amount: item.totalPrice,
      })),
    date: formData.eventDate || formData.invoiceDate || '',
    deadlineDate: formData.eventDate || undefined,
    location: formData.location || '',
    address: formData.address || '',
    progress: 0,
    status: '',
    totalCost: formData.grandTotal,
    amountPaid: formData.amountPaid,
    paymentStatus: formData.paymentStatus,
    dpProofUrl: formData.dpProofUrl || undefined,
    paymentProofs: formData.paymentProofs,
    team: [],
    discountAmount: formData.discountAmount,
    transportCost: formData.transportCost,
    invoiceSignature: formData.invoiceSignature,
  };
  const previewClient = {
    id: formData.clientId || '',
    name: formData.clientName || 'Pengantin',
    phone: formData.clientPhone || '',
    email: formData.clientEmail || '',
    address: formData.clientAddress || '',
  } as Client;

  const handlePrint = () => {
    const el = document.getElementById('invoice-printable-doc');
    if (!el) { window.print(); return; }
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { window.print(); return; }
    const invoiceTitle = el.querySelector('h1,h2,[class*="invoice"]')?.textContent || 'Invoice';
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${invoiceTitle}</title><style>* { box-sizing: border-box; } body { margin: 0; padding: 0; font-family: Inter, Arial, sans-serif; background: #fff; color: #000; } @media print { body { margin: 0; } @page { margin: 12mm; size: A4; } } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; vertical-align: top; word-break: break-word; } th { background: #f8fafc; font-weight: 700; } .text-right { text-align: right !important; } .text-center { text-align: center !important; } img { max-width: 100%; height: auto; }</style></head><body>${el.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pratinjau Dokumen Invoice (Read-Only)"
      size="4xl"
    >
      <div className="space-y-4">
        {/* Banner Notice */}
        <div className="flex items-center justify-between gap-3 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-600 dark:text-blue-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-500" />
            <span>
              <strong>Mode Pratinjau:</strong> Tampilan ini mengikuti dokumen invoice. Perubahan belum disimpan sampai Anda mengonfirmasi.
            </span>
          </div>
        </div>

        {/* Printable invoice uses the same renderer as saved invoices. */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <InvoiceDocument
            id="invoice-printable-doc"
            invoiceNumber={effectiveNumber}
            project={previewProject}
            profile={profile || ({} as Profile)}
            packages={previewPackages}
            client={previewClient}
            issuedDate={formData.invoiceDate}
          />
        </div>
        {/* Modal Action Controls */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3 pt-3 border-t border-brand-border">
          <button
            type="button"
            onClick={handlePrint}
            className="button-secondary w-full sm:w-auto px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Print</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary w-full sm:w-auto px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali & Edit Form</span>
            </button>

            {onConfirmFinalize && (
              <button
                type="button"
                onClick={onConfirmFinalize}
                disabled={isSubmitting}
                className="button-primary w-full sm:w-auto px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Menyimpan...'
                    : isEditMode
                    ? 'Konfirmasi & Simpan Perubahan'
                    : 'Finalisasi & Buat Invoice'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoicePreviewModal;
