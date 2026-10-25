import React, { useState } from 'react';
import {
  Client,
  Project,
  Transaction,
  Profile,
  Package,
  NavigationAction,
  ViewType,
  TeamPaymentRecord,
  TeamMember,
  TeamProjectPayment,
  Card,
  FinancialPocket,
  PaymentStatus,
  TransactionType,
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
import { updateTeamPaymentRecord as updateTeamPaymentRecordInDb } from '../../services/teamPaymentRecords';
import { useFinance } from '../../features/finance/hooks/useFinance';

// ─── Props ────────────────────────────────────────────────────────────────

interface InvoicePageProps {
  clients: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  pockets: FinancialPocket[];
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
  packages: Package[];
  teamPaymentRecords: TeamPaymentRecord[];
  setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
  teamMembers: TeamMember[];
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  userProfile: Profile;
  showNotification: (msg: string) => void;
  handleNavigation: (view: ViewType, action?: NavigationAction) => void;
  initialAction?: NavigationAction | null;
  setInitialAction?: (action: NavigationAction | null) => void;
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
  cards,
  setCards,
  pockets,
  setPockets,
  packages,
  teamPaymentRecords,
  setTeamPaymentRecords,
  teamMembers,
  teamProjectPayments,
  setTeamProjectPayments,
  userProfile,
  showNotification,
  handleNavigation,
  initialAction,
  setInitialAction,
}) => {
  // Share WA preview state
  const [sharePreview, setSharePreview] = useState<{
    title: string;
    message: string;
    phone?: string;
  } | null>(null);

  // DocumentToView maps to ClientDocumentModal's expected format
  const [documentToView, setDocumentToView] = useState<DocumentToView | null>(null);

  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [receiptForm, setReceiptForm] = useState({
    date: '',
    description: '',
    amount: '',
    category: '',
    method: '',
  });
  const [paymentRecordToEdit, setPaymentRecordToEdit] = useState<TeamPaymentRecord | null>(null);
  const [paymentRecordForm, setPaymentRecordForm] = useState({ recordNumber: '', date: '' });

  const { handleUpdateTransaction: persistTransactionEdit } = useFinance(
    transactions,
    setTransactions,
    pockets,
    setPockets,
    cards,
    setCards,
    showNotification,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
  );

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

  const handleEditReceipt = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setReceiptForm({
      date: transaction.date.slice(0, 10),
      description: transaction.description || '',
      amount: String(transaction.amount),
      category: transaction.category || '',
      method: transaction.method || 'Transfer Bank',
    });
  };

  const handleSaveReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!transactionToEdit) return;

    try {
      const updated = await persistTransactionEdit(
        transactionToEdit.id,
        {
          date: receiptForm.date,
          description: receiptForm.description.trim(),
          amount: Number(receiptForm.amount),
          category: receiptForm.category.trim(),
          method: receiptForm.method,
        },
        transactionToEdit,
      );

      if (updated.projectId && updated.type === TransactionType.INCOME) {
        const project = projects.find((item) => item.id === updated.projectId);
        if (project) {
          const paidAmount = transactions
            .map((item) => item.id === updated.id ? updated : item)
            .filter((item) => item.projectId === updated.projectId && item.type === TransactionType.INCOME)
            .reduce((total, item) => total + (Number(item.amount) || 0), 0);
          const paymentStatus = paidAmount >= project.totalCost
            ? PaymentStatus.LUNAS
            : paidAmount > 0
              ? PaymentStatus.DP_TERBAYAR
              : PaymentStatus.BELUM_BAYAR;

          try {
            const savedProject = await updateProjectInDb(project.id, { amountPaid: paidAmount, paymentStatus });
            setProjects((prev) => prev.map((item) => item.id === savedProject.id ? savedProject : item));
          } catch (error) {
            console.error('[InvoicePage] Failed to sync edited receipt with project:', error);
            showNotification('Tanda terima tersimpan, tetapi total pembayaran invoice gagal disinkronkan.');
          }
        }
      }

      setTransactionToEdit(null);
    } catch {
      // The finance hook reports persistence failures.
    }
  };

  const handleEditTeamPayment = (record: TeamPaymentRecord) => {
    setPaymentRecordToEdit(record);
    setPaymentRecordForm({ recordNumber: record.recordNumber, date: record.date.slice(0, 10) });
  };

  const handleSaveTeamPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentRecordToEdit) return;

    try {
      const savedRecord = await updateTeamPaymentRecordInDb(paymentRecordToEdit.id, {
        recordNumber: paymentRecordForm.recordNumber.trim(),
        date: paymentRecordForm.date,
      });
      setTeamPaymentRecords((prev) => prev.map((record) => record.id === savedRecord.id ? savedRecord : record));
      setPaymentRecordToEdit(null);
      showNotification('Rincian slip pembayaran berhasil diperbarui.');
    } catch (error) {
      console.error('[InvoicePage] Failed to update team payment record:', error);
      showNotification('Gagal memperbarui slip pembayaran. Coba lagi.');
    }
  };

  React.useEffect(() => {
    if (initialAction?.type !== 'openInvoice' || !initialAction.id) return;
    const project = projects.find((item) => item.id === initialAction.id);
    if (project) handleEditInvoice(project);
    setInitialAction?.(null);
  }, [initialAction, projects, setInitialAction]);

  const handleInvoiceSaved = (savedProject: Project, newTransaction?: Transaction) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === savedProject.id);
      if (exists) {
        return prev.map((p) =>
          p.id === savedProject.id
            ? {
                ...p,
                ...savedProject,
                // Defensive safeguard: preserve existing team if not populated in savedProject
                team: (savedProject.team && savedProject.team.length > 0) ? savedProject.team : p.team,
              }
            : p,
        );
      }
      return [savedProject, ...prev];
    });

    if (newTransaction) {
      setTransactions((prev) => {
        const exists = prev.some((transaction) => transaction.id === newTransaction.id);
        return exists
          ? prev.map((transaction) => transaction.id === newTransaction.id ? newTransaction : transaction)
          : [newTransaction, ...prev];
      });
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
      handleEditReceipt(currentDoc.transaction);
    } else if (currentDoc.type === 'slip-gaji') {
      handleEditTeamPayment(currentDoc.teamPaymentRecord);
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
                handleEditReceipt(doc.transaction);
              } else if (doc.kind === 'slip-gaji' && doc.teamPaymentRecord) {
                handleEditTeamPayment(doc.teamPaymentRecord);
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

      <Modal
        isOpen={!!transactionToEdit}
        onClose={() => setTransactionToEdit(null)}
        title="Edit Tanda Terima"
        size="lg"
      >
        <form onSubmit={handleSaveReceipt} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="input-group">
              <span className="input-label">Tanggal</span>
              <input type="date" value={receiptForm.date} onChange={(event) => setReceiptForm((prev) => ({ ...prev, date: event.target.value }))} className="input-field" required />
            </label>
            <label className="input-group">
              <span className="input-label">Jumlah</span>
              <input type="number" min="0" step="1" value={receiptForm.amount} onChange={(event) => setReceiptForm((prev) => ({ ...prev, amount: event.target.value }))} className="input-field" required />
            </label>
          </div>
          <label className="input-group">
            <span className="input-label">Deskripsi</span>
            <input type="text" value={receiptForm.description} onChange={(event) => setReceiptForm((prev) => ({ ...prev, description: event.target.value }))} className="input-field" required />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="input-group">
              <span className="input-label">Kategori</span>
              <input type="text" value={receiptForm.category} onChange={(event) => setReceiptForm((prev) => ({ ...prev, category: event.target.value }))} className="input-field" required />
            </label>
            <label className="input-group">
              <span className="input-label">Metode pembayaran</span>
              <select value={receiptForm.method} onChange={(event) => setReceiptForm((prev) => ({ ...prev, method: event.target.value }))} className="input-field" required>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Tunai">Tunai</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Kartu Kredit">Kartu Kredit</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
            <button type="button" onClick={() => setTransactionToEdit(null)} className="button-secondary">Batal</button>
            <button type="submit" className="button-primary">Simpan Perubahan</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!paymentRecordToEdit}
        onClose={() => setPaymentRecordToEdit(null)}
        title="Edit Pembayaran Tim"
        size="sm"
      >
        <form onSubmit={handleSaveTeamPayment} className="space-y-4">
          <label className="input-group">
            <span className="input-label">Nomor slip</span>
            <input type="text" value={paymentRecordForm.recordNumber} onChange={(event) => setPaymentRecordForm((prev) => ({ ...prev, recordNumber: event.target.value }))} className="input-field" required />
          </label>
          <label className="input-group">
            <span className="input-label">Tanggal pembayaran</span>
            <input type="date" value={paymentRecordForm.date} onChange={(event) => setPaymentRecordForm((prev) => ({ ...prev, date: event.target.value }))} className="input-field" required />
          </label>
          <div className="flex justify-end gap-2 border-t border-brand-border pt-4">
            <button type="button" onClick={() => setPaymentRecordToEdit(null)} className="button-secondary">Batal</button>
            <button type="submit" className="button-primary">Simpan Perubahan</button>
          </div>
        </form>
      </Modal>

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
