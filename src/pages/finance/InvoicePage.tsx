import React, { useState } from 'react';
import {
  Client,
  Project,
  Transaction,
  Profile,
  Package,
  ViewType,
  NavigationAction,
  TeamPaymentRecord,
  TeamMember,
  TeamProjectPayment,
} from '../../types';
import { useInvoices, InvoiceDoc } from '../../features/finance/hooks/useInvoices';
import InvoiceStatsBar from '../../features/finance/components/InvoiceStatsBar';
import InvoiceFilterBar from '../../features/finance/components/InvoiceFilterBar';
import InvoiceListTable from '../../features/finance/components/InvoiceListTable';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import ClientDocumentModal from '../../features/clients/components/ClientDocumentModal';
import ShareMessageModal from '../../features/communication/components/ShareMessageModal';
import Modal from '../../shared/ui/Modal';
import InvoiceFormModal from '../../features/finance/components/InvoiceFormModal';
import {
  useClientDocumentActions,
  DocumentToView,
} from '../../features/clients/hooks/useClientDocumentActions';
import { updateProject as updateProjectInDb } from '../../services/projects';
import { updateTransaction as updateTransactionInDb } from '../../services/transactions';

// ─── Props ────────────────────────────────────────────────────────────────

interface InvoicePageProps {
  clients: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  packages: Package[];
  teamPaymentRecords: TeamPaymentRecord[];
  setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
  teamMembers: TeamMember[];
  teamProjectPayments: TeamProjectPayment[];
  userProfile: Profile;
  showNotification: (msg: string) => void;
  handleNavigation: (view: ViewType, action?: NavigationAction) => void;
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{
  doc: InvoiceDoc | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ doc, isDeleting, onConfirm, onCancel }) => (
  <Modal
    isOpen={!!doc}
    onClose={onCancel}
    title="Konfirmasi Hapus"
    size="sm"
  >
    <div className="space-y-4">
      <p className="text-sm text-brand-text-secondary">
        Yakin ingin menghapus{' '}
        <span className="font-bold text-brand-text-primary">
          {doc?.kind === 'invoice' ? 'invoice' : 'tanda terima'}
        </span>{' '}
        <span className="font-mono text-brand-accent">{doc?.number}</span> untuk pengantin{' '}
        <span className="font-bold text-brand-text-primary">{doc?.clientName}</span>?
      </p>
      {doc?.kind === 'invoice' && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          ⚠️ Menghapus invoice akan menghapus seluruh data acara terkait secara permanen.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="button-secondary px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Menghapus...' : 'Hapus'}
        </button>
      </div>
    </div>
  </Modal>
);

// ─── Page ─────────────────────────────────────────────────────────────────

const InvoicePage: React.FC<InvoicePageProps> = ({
  clients,
  projects,
  setProjects,
  transactions,
  setTransactions,
  packages,
  teamPaymentRecords,
  setTeamPaymentRecords,
  teamMembers,
  teamProjectPayments,
  userProfile,
  showNotification,
  handleNavigation,
}) => {
  // Share WA preview state
  const [sharePreview, setSharePreview] = useState<{
    title: string;
    message: string;
    phone?: string;
  } | null>(null);

  // DocumentToView maps to ClientDocumentModal's expected format
  const [documentToView, setDocumentToView] = useState<DocumentToView | null>(null);

  // Client for the currently viewed document
  const [clientForDetail, setClientForDetail] = useState<Client | null>(null);

  // Manual Invoice Modal state (Create & Edit)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Project | null>(null);

  const handleCreateInvoice = () => {
    setInvoiceToEdit(null);
    setIsInvoiceModalOpen(true);
  };

  const handleEditInvoice = (project: Project) => {
    setInvoiceToEdit(project);
    setIsInvoiceModalOpen(true);
  };

  const handleInvoiceSaved = (savedProject: Project, newTransaction?: Transaction) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === savedProject.id);
      if (exists) {
        return prev.map((p) =>
          p.id === savedProject.id
            ? {
                ...p,
                ...savedProject,
                // Defensive safeguard: preserve existing team and checklist if not populated in savedProject
                team: (savedProject.team && savedProject.team.length > 0) ? savedProject.team : p.team,
                weddingDayChecklist: savedProject.weddingDayChecklist || p.weddingDayChecklist,
              }
            : p,
        );
      }
      return [savedProject, ...prev];
    });

    if (newTransaction) {
      setTransactions((prev) => [newTransaction, ...prev]);
    }

    setIsInvoiceModalOpen(false);
    setInvoiceToEdit(null);
  };

  // ── Hook: invoice data ────────────────────────────────────────────────
  const {
    filteredDocs,
    stats,
    clientOptions,
    searchTerm,
    setSearchTerm,
    filterKind,
    setFilterKind,
    filterStatus,
    setFilterStatus,
    filterClientId,
    setFilterClientId,
    filterMonth,
    setFilterMonth,
    sortField,
    sortDir,
    handleSort,
    deleteConfirm,
    setDeleteConfirm,
    isDeleting,
    handleDeleteConfirm,
  } = useInvoices({
    projects,
    transactions,
    clients,
    teamPaymentRecords,
    showNotification,
    onDeleteProject: (projectId) =>
      setProjects((prev) => prev.filter((p) => p.id !== projectId)),
    onDeleteTransaction: (txId) =>
      setTransactions((prev) => prev.filter((t) => t.id !== txId)),
    onDeleteTeamPaymentRecord: (id) =>
      setTeamPaymentRecords((prev) => prev.filter((r) => r.id !== id)),
  });

  // ── Hook: document actions (PDF, WA, signature) ───────────────────────
  const {
    isSignatureModalOpen,
    setIsSignatureModalOpen,
    handleSaveSignature,
    handleRemoveSignature,
    handleShareDocumentWA,
    handleDownloadPDF,
  } = useClientDocumentActions({
    documentToView,
    clientForDetail,
    userProfile,
    projects,
    transactions,
    packages,
    teamMembers,
    teamProjectPayments,
    showNotification,
    onSignInvoice: async (projectId, signatureDataUrl) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, invoiceSignature: signatureDataUrl } : p)),
      );
      try {
        await updateProjectInDb(projectId, { invoiceSignature: signatureDataUrl } as any);
      } catch (e) {
        console.warn('[InvoicePage] Failed to persist invoice signature:', e);
      }
    },
    onSignTransaction: async (txId, signatureDataUrl) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, vendorSignature: signatureDataUrl } : t)),
      );
      try {
        await updateTransactionInDb(txId, { vendorSignature: signatureDataUrl } as any);
      } catch (e) {
        console.warn('[InvoicePage] Failed to persist transaction signature:', e);
      }
    },
    onRemoveInvoiceSignature: async (projectId) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, invoiceSignature: undefined } : p)),
      );
      try {
        await updateProjectInDb(projectId, { invoiceSignature: null } as any);
      } catch (e) {
        console.warn('[InvoicePage] Failed to remove invoice signature:', e);
      }
    },
    onRemoveTransactionSignature: async (txId) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, vendorSignature: undefined } : t)),
      );
      try {
        await updateTransactionInDb(txId, { vendorSignature: null } as any);
      } catch (e) {
        console.warn('[InvoicePage] Failed to remove transaction signature:', e);
      }
    },
    setSharePreview,
  });

  // ── Open document preview ─────────────────────────────────────────────
  const handleViewDoc = (doc: InvoiceDoc) => {
    const client = doc.client ?? null;
    setClientForDetail(client);

    if (doc.kind === 'invoice' && doc.project) {
      setDocumentToView({ type: 'invoice', project: doc.project });
    } else if (doc.kind === 'receipt' && doc.transaction) {
      setDocumentToView({ type: 'receipt', transaction: doc.transaction });
    } else if (doc.kind === 'slip-gaji' && doc.teamPaymentRecord) {
      setDocumentToView({ type: 'slip-gaji', teamPaymentRecord: doc.teamPaymentRecord });
    }
  };

  // ── Navigate to edit ──────────────────────────────────────────────────
  const handleEditDocument = () => {
    if (!documentToView) return;
    const currentDoc = documentToView;
    setDocumentToView(null);
    if (currentDoc.type === 'invoice') {
      handleEditInvoice(currentDoc.project);
    } else if (currentDoc.type === 'receipt') {
      handleNavigation(ViewType.FINANCE, { type: 'openTransaction', id: currentDoc.transaction.id });
    } else if (currentDoc.type === 'slip-gaji') {
      showNotification('Pembayaran tim tidak dapat diedit dari sini.');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-brand-bg/80 backdrop-blur-md border-b border-brand-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-brand-text-primary tracking-tight">
              Daftar Invoice
            </h1>
            <p className="text-xs text-brand-text-secondary mt-0.5">
              {filteredDocs.length} dokumen ditemukan
            </p>
          </div>
          <button
            onClick={handleCreateInvoice}
            className="btn-box-add flex items-center gap-2 px-4 py-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Invoice Baru</span>
          </button>
        </div>
      </div>

      {/* ── Page Body ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <InvoiceStatsBar stats={stats} />

        {/* Filters */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
          <InvoiceFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterKind={filterKind}
            onFilterKindChange={setFilterKind}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterClientId={filterClientId}
            onFilterClientChange={setFilterClientId}
            filterMonth={filterMonth}
            onFilterMonthChange={setFilterMonth}
            clientOptions={clientOptions}
          />
        </div>

        {/* Table */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
          <InvoiceListTable
            docs={filteredDocs}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onView={handleViewDoc}
            onEdit={(doc) => {
              if (doc.kind === 'invoice' && doc.project) {
                handleEditInvoice(doc.project);
              } else if (doc.kind === 'receipt' && doc.transaction) {
                handleNavigation(ViewType.FINANCE, { type: 'openTransaction', id: doc.transaction.id });
              } else if (doc.kind === 'slip-gaji') {
                showNotification('Pembayaran tim tidak dapat diedit dari sini.');
              }
            }}
            onDelete={setDeleteConfirm}
            onAdd={handleCreateInvoice}
          />
        </div>
      </div>

      {/* ── Document Preview Modal ──────────────────────────────────── */}
      <ClientDocumentModal
        documentToView={documentToView}
        onClose={() => setDocumentToView(null)}
        clientForDetail={clientForDetail}
        userProfile={userProfile}
        packages={packages}
        projects={projects}
        transactions={transactions}
        teamMembers={teamMembers}
        teamProjectPayments={teamProjectPayments}
        isSignatureModalOpen={isSignatureModalOpen}
        setIsSignatureModalOpen={setIsSignatureModalOpen}
        onSaveSignature={handleSaveSignature}
        onRemoveSignature={handleRemoveSignature}
        onEditDocument={handleEditDocument}
        onDownloadPDF={handleDownloadPDF}
        onShareDocumentWA={handleShareDocumentWA}
      />

      {/* ── Create / Edit Invoice Modal ─────────────────────────────── */}
      <InvoiceFormModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setInvoiceToEdit(null);
        }}
        projectToEdit={invoiceToEdit}
        clients={clients}
        packages={packages}
        transactions={transactions}
        userProfile={userProfile}
        showNotification={showNotification}
        onSuccess={handleInvoiceSaved}
      />

      {/* ── Share WA Modal ──────────────────────────────────────────── */}
      {sharePreview && (
        <ShareMessageModal
          isOpen={!!sharePreview}
          onClose={() => setSharePreview(null)}
          title={sharePreview.title}
          initialMessage={sharePreview.message}
          phone={sharePreview.phone}
          showNotification={showNotification}
        />
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────── */}
      <DeleteConfirmModal
        doc={deleteConfirm}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default InvoicePage;
