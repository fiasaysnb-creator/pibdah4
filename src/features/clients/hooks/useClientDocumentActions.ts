import React, { useState } from 'react';
import { Client, Package, Project, Transaction, Profile, TeamMember, TeamPaymentRecord, TeamProjectPayment } from '../../../types';
import {
    generateInvoiceWhatsAppMessage,
    generateReceiptWhatsAppMessage
} from '../utils/clientWhatsAppTemplates';
import { downloadInvoicePdf, getLatestInvoicePaymentDate } from '../../finance/utils/invoicePdf';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import { downloadPaymentSlipPdf } from '../../team/utils/paymentSlipPdf';

export type DocumentToView =
    | { type: 'invoice'; project: Project }
    | { type: 'receipt'; transaction: Transaction }
    | { type: 'slip-gaji'; teamPaymentRecord: TeamPaymentRecord };

/**
 * Menyusun data klien minimal dari proyek bila data klien detail tidak tersedia,
 * agar identitas penerima invoice pada PDF tetap lengkap.
 */
const buildFallbackClient = (project: Project): Client => ({
    id: project.clientId || '',
    name: project.clientName || 'Pengantin',
    phone: '',
    whatsapp: '',
    email: '',
    address: project.address || '',
} as Client);

interface UseClientDocumentActionsParams {
    documentToView: DocumentToView | null;
    clientForDetail: Client | null;
    userProfile: Profile;
    projects: Project[];
    transactions: Transaction[];
    packages?: Package[];
    teamMembers?: TeamMember[];
    teamProjectPayments?: TeamProjectPayment[];
    showNotification: (msg: string) => void;
    onSignInvoice: (projectId: string, signatureDataUrl: string) => void;
    onSignTransaction: (transactionId: string, signatureDataUrl: string) => void;
    onRemoveInvoiceSignature?: (projectId: string) => void;
    onRemoveTransactionSignature?: (transactionId: string) => void;
    setSharePreview: (val: { title: string; message: string; phone?: string } | null) => void;
}

export const useClientDocumentActions = ({
    documentToView,
    clientForDetail,
    userProfile,
    projects,
    transactions,
    packages = [],
    teamMembers = [],
    teamProjectPayments = [],
    showNotification,
    onSignInvoice,
    onSignTransaction,
    onRemoveInvoiceSignature,
    onRemoveTransactionSignature,
    setSharePreview,
}: UseClientDocumentActionsParams) => {
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const handleSaveSignature = (signatureDataUrl: string) => {
        if (documentToView?.type === 'invoice' && documentToView.project) {
            onSignInvoice(documentToView.project.id, signatureDataUrl);
        } else if (documentToView?.type === 'receipt' && documentToView.transaction) {
            onSignTransaction(documentToView.transaction.id, signatureDataUrl);
        }
        setIsSignatureModalOpen(false);
    };

    const handleRemoveSignature = () => {
        if (documentToView?.type === 'invoice' && documentToView.project) {
            onRemoveInvoiceSignature?.(documentToView.project.id);
        } else if (documentToView?.type === 'receipt' && documentToView.transaction) {
            onRemoveTransactionSignature?.(documentToView.transaction.id);
        }
    };

    const handleShareDocumentWA = async () => {
        if (!documentToView || !clientForDetail) return;

        const phone = clientForDetail.whatsapp || clientForDetail.phone;
        const companyName = userProfile?.companyName || 'Vena Pictures';

        if (documentToView.type === 'invoice') {
            const proj = documentToView.project;

            // 1. Auto-generate & download PDF (vector/text) in background
            try {
                await downloadInvoicePdf({
                    project: proj,
                    profile: userProfile,
                    packages,
                    client: clientForDetail,
                    issuedDate: getLatestInvoicePaymentDate(proj.id, transactions),
                });
            } catch (error) {
                console.error('[ClientDocumentActions] Invoice PDF export failed:', error);
                showNotification('Gagal membuat PDF invoice. Membuka dialog cetak sebagai alternatif.');
                window.print();
            }

            // 2. Build public invoice link
            const basePath = window.location.pathname.replace(/index\.html$/, '');
            const publicInvoiceUrl = `${window.location.origin}${basePath}#/portal/invoice/${proj.id}`;

            // 3. Build WhatsApp template with PDF link
            const text = generateInvoiceWhatsAppMessage(clientForDetail.name, companyName, proj, publicInvoiceUrl);

            setSharePreview({
                title: `Bagikan Invoice - ${proj.projectName}`,
                message: text,
                phone,
            });
        } else if (documentToView.type === 'receipt') {
            const tx = documentToView.transaction;

            // 1. Auto-generate & download PDF (vector/text) in background
            try {
                await downloadReceiptPdf({
                    transaction: tx,
                    project: tx.projectId ? projects.find(p => p.id === tx.projectId) || null : null,
                    profile: userProfile,
                    client: clientForDetail,
                });
            } catch (error) {
                console.error('[ClientDocumentActions] Receipt PDF export failed:', error);
                showNotification('Gagal membuat PDF tanda terima. Membuka dialog cetak sebagai alternatif.');
                window.print();
            }

            // 2. Build public receipt link
            const basePath = window.location.pathname.replace(/index\.html$/, '');
            const publicReceiptUrl = `${window.location.origin}${basePath}#/portal/receipt/${tx.id}`;

            const projName = tx.projectId ? projects.find(p => p.id === tx.projectId)?.projectName || '' : '';
            const text = generateReceiptWhatsAppMessage(clientForDetail.name, companyName, tx, projName, publicReceiptUrl);

            setSharePreview({
                title: `Bagikan Tanda Terima - ${tx.id.slice(0, 8).toUpperCase()}`,
                message: text,
                phone,
            });
        }
    };

    const handleDownloadPDF = async () => {
        if (!documentToView) return;

        try {
            // Seluruh dokumen diekspor melalui renderer PDF vector (teks tajam),
            // bukan screenshot DOM, agar hasil tidak blur saat diperbesar.
            if (documentToView.type === 'invoice') {
                await downloadInvoicePdf({
                    project: documentToView.project,
                    profile: userProfile,
                    packages,
                    client: clientForDetail ?? buildFallbackClient(documentToView.project),
                    issuedDate: getLatestInvoicePaymentDate(documentToView.project.id, transactions),
                });
            } else if (documentToView.type === 'receipt') {
                const tx = documentToView.transaction;
                await downloadReceiptPdf({
                    transaction: tx,
                    project: tx.projectId ? projects.find(p => p.id === tx.projectId) || null : null,
                    profile: userProfile,
                    client: clientForDetail,
                });
            } else {
                await downloadPaymentSlipPdf({
                    record: documentToView.teamPaymentRecord,
                    teamMembers,
                    teamProjectPayments,
                    projects,
                    profile: userProfile,
                });
            }
        } catch (error) {
            console.error('[ClientDocumentActions] PDF download failed:', error);
            showNotification('Gagal membuat PDF. Membuka dialog cetak sebagai alternatif.');
            window.print();
        }
    };

    return {
        isSignatureModalOpen,
        setIsSignatureModalOpen,
        handleSaveSignature,
        handleRemoveSignature,
        handleShareDocumentWA,
        handleDownloadPDF,
    };
};
