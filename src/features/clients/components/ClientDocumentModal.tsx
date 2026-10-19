import React from 'react';
import Modal from '../../../shared/ui/Modal';
import SignaturePad from '../../../shared/ui/SignaturePad';
import InvoiceDocument from '../../finance/components/InvoiceDocument';
import ClientReceiptDocument from './ClientReceiptDocument';
import { PencilIcon, DownloadIcon, WhatsappIcon } from '../../../constants';
import { Client, Project, Package, Profile, Transaction, TransactionType, TeamMember, TeamProjectPayment } from '../../../types';
import { DocumentToView } from '../hooks/useClientDocumentActions';
import { PaymentSlipDocument } from '../../team/components/PaymentSlipDocument';

interface ClientDocumentModalProps {
    documentToView: DocumentToView | null;
    onClose: () => void;
    clientForDetail: Client | null;
    userProfile: Profile;
    packages: Package[];
    projects: Project[];
    transactions?: Transaction[];
    isSignatureModalOpen: boolean;
    setIsSignatureModalOpen: (isOpen: boolean) => void;
    onSaveSignature: (sig: string) => void;
    onRemoveSignature?: () => void;
    onEditDocument: () => void;
    onDownloadPDF: () => void;
    onShareDocumentWA: () => void;
    teamMembers?: TeamMember[];
    teamProjectPayments?: TeamProjectPayment[];
}

export const ClientDocumentModal: React.FC<ClientDocumentModalProps> = ({
    documentToView,
    onClose,
    clientForDetail,
    userProfile,
    packages,
    projects,
    transactions = [],
    isSignatureModalOpen,
    setIsSignatureModalOpen,
    onSaveSignature,
    onRemoveSignature,
    onEditDocument,
    onDownloadPDF,
    onShareDocumentWA,
    teamMembers,
    teamProjectPayments,
}) => {

    const renderDocumentBody = () => {
        if (!documentToView) return null;

        if (documentToView.type === 'invoice') {
            // After narrowing: documentToView is { type: 'invoice'; project: Project }
            const project = documentToView.project;
            const effectiveClient = clientForDetail || {
                id: project.clientId || '',
                name: project.clientName || 'Pengantin',
                phone: '',
                whatsapp: '',
                email: '',
                address: project.address || '',
            } as Client;
            const latestPaymentDate = transactions
                .filter(transaction => transaction.projectId === project.id && transaction.type === TransactionType.INCOME)
                .sort((left, right) => right.date.localeCompare(left.date))[0]?.date;

            return (
                <InvoiceDocument
                    id="invoice-document"
                    project={project}
                    profile={userProfile}
                    packages={packages}
                    client={effectiveClient}
                    issuedDate={latestPaymentDate || new Date().toISOString().slice(0, 10)}
                />
            );
        } else if (documentToView.type === 'receipt') {
            // After narrowing: documentToView is { type: 'receipt'; transaction: Transaction }
            const transaction = documentToView.transaction;
            const relatedProject = transaction.projectId
                ? projects.find(p => p.id === transaction.projectId)
                : undefined;
            const effectiveClient = clientForDetail || {
                id: relatedProject?.clientId || '',
                name: relatedProject?.clientName || 'Pengantin',
                phone: '',
                whatsapp: '',
                email: '',
                address: relatedProject?.address || '',
            } as Client;

            return (
                <ClientReceiptDocument
                    transaction={transaction}
                    project={relatedProject}
                    profile={userProfile}
                    client={effectiveClient}
                />
            );
        } else if (documentToView.type === 'slip-gaji') {
            if (!teamMembers || !teamProjectPayments) return null;
            return (
                <PaymentSlipDocument
                    record={documentToView.teamPaymentRecord}
                    teamMembers={teamMembers}
                    teamProjectPayments={teamProjectPayments}
                    projects={projects}
                    userProfile={userProfile}
                />
            );
        }
        return null;
    };

    const hasSignature =
        documentToView &&
        (documentToView.type === 'invoice'
            ? !!documentToView.project?.invoiceSignature
            : documentToView.type === 'receipt'
            ? !!documentToView.transaction?.vendorSignature
            : !!documentToView.teamPaymentRecord?.vendorSignature);

    return (
        <>
            <Modal
                isOpen={!!documentToView}
                onClose={onClose}
                title={documentToView ? (documentToView.type === 'invoice' ? 'Invoice' : documentToView.type === 'receipt' ? 'Tanda Terima' : 'Pembayaran tim') : ''}
                size="4xl"
            >
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <div id="invoice" className="printable-area bg-white !p-0">
                        {renderDocumentBody()}
                    </div>
                </div>
                <div className="client-document-toolbar mt-3 sm:mt-6 flex flex-wrap justify-end items-center non-printable gap-2 sm:gap-3 border-t border-slate-200 pt-3 sm:pt-4 px-1 sm:px-2">
                    {documentToView && !hasSignature && (
                        <button
                            type="button"
                            onClick={() => {
                                if (userProfile?.signatureBase64) {
                                    onSaveSignature(userProfile.signatureBase64);
                                } else {
                                    setIsSignatureModalOpen(true);
                                }
                            }}
                            className="client-document-action button-secondary p-2.5"
                        >
                            Tanda Tangani
                        </button>
                    )}
                    {documentToView && hasSignature && onRemoveSignature && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Hapus tanda tangan dari dokumen ini?')) {
                                    onRemoveSignature();
                                }
                            }}
                            className="client-document-action button-secondary p-2.5 text-red-500 border-red-300 hover:bg-red-50"
                        >
                            Hapus TTD
                        </button>
                    )}
                    <button
                        onClick={onEditDocument}
                        className="client-document-action button-secondary inline-flex items-center gap-2 p-2.5"
                        title="Edit Dokumen"
                    >
                        <PencilIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                        onClick={onDownloadPDF}
                        className="client-document-action button-secondary inline-flex items-center gap-2 p-2.5"
                        title="Unduh sebagai PDF"
                    >
                        <DownloadIcon className="w-5 h-5 text-brand-accent" />
                        <span className="hidden sm:inline">Unduh PDF</span>
                    </button>
                    <button
                        onClick={onShareDocumentWA}
                        className="client-document-action btn-box-wa px-4 py-2 text-xs sm:text-sm"
                        title="Kirim via WhatsApp"
                    >
                        <WhatsappIcon className="w-4 h-4 flex-shrink-0 text-white" />
                        <span>Kirim ke WA</span>
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title="Bubuhkan Tanda Tangan Anda"
            >
                <SignaturePad onClose={() => setIsSignatureModalOpen(false)} onSave={onSaveSignature} />
            </Modal>
        </>
    );
};

export default ClientDocumentModal;
