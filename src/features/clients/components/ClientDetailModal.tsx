import React, { lazy, Suspense, useState, useMemo, Fragment } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Client, Project, PaymentStatus, Package, AddOn, TransactionType, CardType,
  Transaction, Card, ViewType, NavigationAction, Profile, TeamMember,
  TeamProjectPayment, TeamPaymentRecord, FinancialPocket,
} from '../../../types';
import Modal from '../../../shared/ui/Modal';
import RupiahInput from '../../../shared/form/RupiahInput';
import {
  PencilIcon, Trash2Icon, FileTextIcon, CreditCardIcon, Share2Icon,
  HistoryIcon, DollarSignIcon, FolderKanbanIcon, TrendingUpIcon,
  TrendingDownIcon, CheckIcon, XIcon
} from '../../../constants';
import { Sparkles, Zap, Plus, Settings, Gift, ChevronDown } from 'lucide-react';
import { updateProject as updateProjectRow } from '../../../services/projects';
import { createTransaction as createTransactionRow } from '../../../services/transactions';
import { updatePocket as updatePocketRow } from '../../../services/pockets';
import { updateTeamProjectPayments as updateTeamProjectPaymentsRow } from '../../../services/teamProjectPayments';
import { createTeamPaymentRecord } from '../../../services/teamPaymentRecords';
import { uploadDpProof } from '../../../services/storage';
import { formatCurrency, normalizeTerminology } from '../utils/clientHelpers';
import { useExtraChargeTemplates } from '../../../hooks/useExtraChargeTemplates';
import { useExpenseTemplates } from '../../../hooks/useExpenseTemplates';
import ManageTemplatesModal from './ManageTemplatesModal';
import ManageExpenseTemplatesModal from './ManageExpenseTemplatesModal';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

const ProjectManagement = lazy(() =>
  import('../../../pages/projects/ProjectsPage').then(module => ({ default: module.Projects })),
);

interface ClientDetailModalProps {
  client: Client | null;
  profile: Profile;
  projects: Project[];
  transactions: Transaction[];
  packages: Package[];
  addOns?: AddOn[];
  onClose: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onViewReceipt: (transaction: Transaction) => void;
  onViewInvoice: (project: Project) => void;
  handleNavigation: (view: ViewType, action?: NavigationAction) => void;
  onRecordPayment: (projectId: string, amount: number, destinationCardId: string, proofUrl?: string) => void | Promise<void>;
  cards: Card[];
  onSharePortal: (client: Client) => void;
  onDeleteProject: (projectId: string) => void;
  showNotification: (message: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  teamMembers: TeamMember[];
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  teamPaymentRecords?: TeamPaymentRecord[];
  pockets: FinancialPocket[];
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
}

// ─── Extra Charge Templates ──────────────────────────────────────────────────

export interface ExtraChargeTemplate {
  name: string;
  category: string;
  defaultAmount: number;
  badge?: string;
}

export const DEFAULT_CHARGE_TEMPLATES: ExtraChargeTemplate[] = [
  // Overtime
  { name: 'Overtime Kru (1 Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 500000 },
  { name: 'Overtime Kru (2 Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 900000 },
  { name: 'Overtime Acara (Per Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 350000 },
  { name: 'Overtime Standby / Jeda Waktu', category: 'Overtime & Jam Tambahan', defaultAmount: 250000 },

  // Dokumentasi & Personil Ekstra
  { name: 'Drone Aerial 4K / Pilot Drone', category: 'Dokumentasi & Personil', defaultAmount: 1200000 },
  { name: 'Same Day Edit (SDE) Video Teaser', category: 'Dokumentasi & Personil', defaultAmount: 1500000 },
  { name: 'Fotografer Tambahan (1 Orang)', category: 'Dokumentasi & Personil', defaultAmount: 750000 },
  { name: 'Videografer Tambahan (1 Orang)', category: 'Dokumentasi & Personil', defaultAmount: 850000 },
  { name: 'Lighting Setup & Gear Tambahan', category: 'Dokumentasi & Personil', defaultAmount: 500000 },

  // Cetak & Merchandise
  { name: 'Upgrade Cetak Album 20x30 Exclusive & Box', category: 'Cetak & Album', defaultAmount: 600000 },
  { name: 'Cetak Kanvas 24R + Frame Minimalis', category: 'Cetak & Album', defaultAmount: 450000 },
  { name: 'USB Flashdisk Kayu Exclusive & Box', category: 'Cetak & Album', defaultAmount: 250000 },
  { name: 'Mini Album Parents (2 Buku)', category: 'Cetak & Album', defaultAmount: 500000 },
  { name: 'Cetak Pembesaran 16R + Bingkai', category: 'Cetak & Album', defaultAmount: 200000 },

  // Layanan & Operasional
  { name: 'Live Streaming Acara (IG / YouTube)', category: 'Layanan & Operasional', defaultAmount: 1500000 },
  { name: 'Transport & Akomodasi Luar Kota', category: 'Layanan & Operasional', defaultAmount: 500000 },
  { name: 'Biaya Izin Lokasi / Venue Charge', category: 'Layanan & Operasional', defaultAmount: 300000 },
  { name: 'Fast Editing / Express Delivery (3 Hari)', category: 'Layanan & Operasional', defaultAmount: 750000 },

  // Bonus / Complimentary (Rp 0)
  { name: 'Bonus Overtime 1 Jam (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Bonus Cetak Foto Mini Frame (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Bonus Flashdisk Tambahan (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Complimentary Raw Files Access (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
];

export const POPULAR_PRESET_CHIPS: { label: string; name: string; amount: number; isFree?: boolean }[] = [
  { label: 'Overtime 1 Jam', name: 'Overtime Kru (1 Jam)', amount: 500000 },
  { label: 'Drone 4K', name: 'Drone Aerial 4K / Pilot Drone', amount: 1200000 },
  { label: 'SDE Video', name: 'Same Day Edit (SDE) Video Teaser', amount: 1500000 },
  { label: 'Upgrade Album', name: 'Upgrade Cetak Album 20x30 Exclusive & Box', amount: 600000 },
  { label: 'Bonus Overtime (Rp 0)', name: 'Bonus Overtime 1 Jam (Free)', amount: 0, isFree: true },
  { label: 'Bonus Cetak (Rp 0)', name: 'Bonus Cetak Foto Mini Frame (Free)', amount: 0, isFree: true },
];

// ─── Tiny reusable sub-components ───────────────────────────────────────────

const FinancePill: React.FC<{
  label: string;
  value: string;
  color: 'neutral' | 'green' | 'red';
}> = ({ label, value, color }) => {
  const colorMap = {
    neutral: 'bg-[#F4F6F9] border-[#EAEFF4] text-[#5A6A85]',
    green: 'bg-green-600/10 border-green-600/20 text-green-600',
    red: 'bg-red-600/10 border-red-600/20 text-red-600',
  };
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5 ${colorMap[color]}`}>
      <span className="text-[7px] font-black uppercase tracking-[0.12em] opacity-80 sm:text-[8px]">{label}</span>
      <span className="mt-0.5 truncate text-[11px] font-black tracking-tight sm:text-sm">{value}</span>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="mb-3">
    <h4 className="text-sm font-bold text-[#2A3547]">{children}</h4>
    {sub && <p className="text-[11px] text-[#5A6A85] mt-0.5">{sub}</p>}
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client, profile, projects, transactions, packages, addOns,
  onClose, onEditClient, onDeleteClient,
  onViewReceipt, onViewInvoice, handleNavigation,
  onRecordPayment, cards, onSharePortal, onDeleteProject,
  showNotification, setProjects, setTransactions, setCards,
  teamMembers, teamProjectPayments, setTeamProjectPayments, teamPaymentRecords = [], pockets, setPockets,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'events' | 'payments'>('events');
  const [newPayments, setNewPayments] = useState<{ [key: string]: { amount: string; destinationCardId: string } }>({});
  const [paymentProofFiles, setPaymentProofFiles] = useState<Record<string, File | null>>({});
  const [savingPaymentProjectId, setSavingPaymentProjectId] = useState<string | null>(null);
  const [editingTeamPaymentId, setEditingTeamPaymentId] = useState<string | null>(null);
  const [teamPaymentEditDraft, setTeamPaymentEditDraft] = useState({ role: '', fee: '' });
  const [savingTeamPaymentId, setSavingTeamPaymentId] = useState<string | null>(null);
  const [teamPaymentToPay, setTeamPaymentToPay] = useState<TeamProjectPayment | null>(null);
  const [teamPaymentSourceId, setTeamPaymentSourceId] = useState('');
  const [isPayingTeamPayment, setIsPayingTeamPayment] = useState(false);
  const [openCostDetails, setOpenCostDetails] = useState<Record<string, boolean>>({});
  const [newCharge, setNewCharge] = useState<{ [key: string]: { name: string; amount: string } }>({});
  const [transactionFormOpen, setTransactionFormOpen] = useState<Record<string, 'payment' | 'expense' | 'charges' | null>>({});
  const [newExpense, setNewExpense] = useState<Record<string, {
    date: string;
    description: string;
    amount: string;
    category: string;
    sourceId: string;
  }>>({});
  const [savingExpenseProjectId, setSavingExpenseProjectId] = useState<string | null>(null);
  const [projectOverrides, setProjectOverrides] = useState<{ [projectId: string]: Partial<Project> }>({});
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeData, setEditChargeData] = useState({ name: '', amount: '' });
  const [selectedAddPkg, setSelectedAddPkg] = useState<{ [projectId: string]: string }>({});
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [showManageExpenseTemplates, setShowManageExpenseTemplates] = useState(false);
  const { templates } = useExtraChargeTemplates();
  const { templates: expenseTemplates } = useExpenseTemplates();

  // Group templates by category
  const templateCategories = useMemo(() => {
    const map = new Map<string, any[]>();
    templates.forEach(t => {
      const existing = map.get(t.category) || [];
      existing.push(t);
      map.set(t.category, existing);
    });
    return Array.from(map.entries());
  }, [templates]);

  // Group template pengeluaran by category
  const expenseTemplateCategories = useMemo(() => {
    const map = new Map<string, typeof expenseTemplates>();
    expenseTemplates.forEach(t => {
      const existing = map.get(t.category) || [];
      existing.push(t);
      map.set(t.category, existing);
    });
    return Array.from(map.entries());
  }, [expenseTemplates]);

  // Group packages by region
  const packagesByRegion = useMemo(() => {
    const map = new Map<string, Package[]>();
    packages.forEach(pkg => {
      const region = pkg.region || 'Lainnya';
      const existing = map.get(region) || [];
      existing.push(pkg);
      map.set(region, existing);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [packages]);

  if (!client) return null;

  // ── handlers ────────────────────────────────────────────────────────────

  const handleNewPaymentChange = (projectId: string, field: 'amount' | 'destinationCardId', value: string) => {
    const current = newPayments[projectId] || { amount: '', destinationCardId: '' };
    setNewPayments(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  };

  const handleNewPaymentSubmit = async (projectId: string) => {
    const paymentData = newPayments[projectId];
    const project = clientProjects.find(p => p.id === projectId);
    if (paymentData && Number(paymentData.amount) > 0 && paymentData.destinationCardId && project) {
      const amount = Number(paymentData.amount);
      if (amount > (project.totalCost - project.amountPaid)) {
        alert('Jumlah pembayaran melebihi sisa pembayaran.');
        return;
      }
      setSavingPaymentProjectId(projectId);
      try {
        const proofFile = paymentProofFiles[projectId];
        const proofUrl = proofFile ? await uploadDpProof(proofFile) : undefined;
        await onRecordPayment(projectId, amount, paymentData.destinationCardId, proofUrl);
        setNewPayments(prev => ({ ...prev, [projectId]: { amount: '', destinationCardId: '' } }));
        setPaymentProofFiles(prev => ({ ...prev, [projectId]: null }));
      } catch (error) {
        console.error('[ClientDetailModal] Failed to upload payment proof:', error);
        showNotification('Gagal mengunggah bukti pembayaran. Pembayaran belum dicatat.');
      } finally {
        setSavingPaymentProjectId(null);
      }
    } else {
      showNotification('Harap isi jumlah dan tujuan pembayaran dengan benar.');
    }
  };

  const handleUpdateTeamPayment = async (payment: TeamProjectPayment) => {
    const fee = Number(teamPaymentEditDraft.fee);
    if (!Number.isFinite(fee) || fee < 0) {
      showNotification('Nominal pembayaran harus berupa angka nol atau lebih.');
      return;
    }

    setSavingTeamPaymentId(payment.id);
    try {
      const [savedPayment] = await updateTeamProjectPaymentsRow([{
        ...payment,
        fee,
        role: teamPaymentEditDraft.role.trim() || undefined,
      }]);
      const updatedPayment = savedPayment || {
        ...payment,
        fee,
        role: teamPaymentEditDraft.role.trim() || undefined,
      };
      setTeamProjectPayments(prev => prev.map(item => item.id === payment.id ? updatedPayment : item));
      setEditingTeamPaymentId(null);
      showNotification(`Pembayaran ${payment.teamMemberName} berhasil diperbarui.`);
    } catch (error) {
      console.error('[ClientDetailModal] Failed to update team assignment fee:', error);
      showNotification('Pembayaran tim gagal diperbarui. Coba lagi.');
    } finally {
      setSavingTeamPaymentId(null);
    }
  };

  const handlePayTeamPayment = async () => {
    if (!teamPaymentToPay) return;
    const currentPayment = teamProjectPayments.find(item => item.id === teamPaymentToPay.id);
    const project = clientProjects.find(item => item.id === teamPaymentToPay.projectId);
    if (!currentPayment || currentPayment.status !== 'Unpaid' || !project) {
      showNotification('Pembayaran sudah berubah atau acara tidak ditemukan. Muat ulang detail acara.');
      setTeamPaymentToPay(null);
      return;
    }

    const pocket = teamPaymentSourceId.startsWith('pocket-')
      ? pockets.find(item => item.id === teamPaymentSourceId.slice('pocket-'.length))
      : undefined;
    const cardId = pocket?.sourceCardId || (teamPaymentSourceId.startsWith('card-')
      ? teamPaymentSourceId.slice('card-'.length)
      : undefined);
    const card = cards.find(item => item.id === cardId);
    if (!pocket && !teamPaymentSourceId.startsWith('card-')) {
      showNotification('Pilih sumber dana yang valid.');
      return;
    }
    if (teamPaymentSourceId.startsWith('pocket-') && (!pocket || pocket.amount < currentPayment.fee)) {
      showNotification('Saldo kantong tidak mencukupi untuk pembayaran ini.');
      return;
    }
    if (teamPaymentSourceId.startsWith('card-') && !card) {
      showNotification('Kartu sumber dana tidak ditemukan.');
      return;
    }
    if (pocket?.sourceCardId && !card) {
      showNotification('Kartu sumber untuk kantong ini tidak ditemukan.');
      return;
    }
    if (card && card.balance < currentPayment.fee) {
      showNotification(`Saldo kartu ${card.bankName} tidak mencukupi.`);
      return;
    }

    const paymentDate = new Date().toISOString().slice(0, 10);
    let pocketDeducted = false;
    let paymentMarkedPaid = false;
    setIsPayingTeamPayment(true);
    try {
      if (pocket) {
        await updatePocketRow(pocket.id, { amount: pocket.amount - currentPayment.fee });
        pocketDeducted = true;
      }

      const [savedPayment] = await updateTeamProjectPaymentsRow([{ ...currentPayment, status: 'Paid' }]);
      paymentMarkedPaid = true;
      const transaction = await createTransactionRow({
        date: paymentDate,
        description: `Gaji Freelance - ${currentPayment.teamMemberName} (${project.projectName})`,
        amount: currentPayment.fee,
        type: TransactionType.EXPENSE,
        projectId: project.id,
        category: 'Gaji Tim / Vendor',
        method: card?.cardType === CardType.TUNAI ? 'Tunai' : pocket ? 'Sistem' : 'Kartu',
        pocketId: pocket?.id,
        cardId,
      });

      setTeamProjectPayments(prev => prev.map(item => item.id === currentPayment.id
        ? (savedPayment || { ...currentPayment, status: 'Paid' })
        : item));
      setTransactions(prev => [transaction, ...prev.filter(item => item.id !== transaction.id)]
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
      if (card) {
        setCards(prev => prev.map(item => item.id === card.id
          ? { ...item, balance: item.balance - currentPayment.fee }
          : item));
      }
      if (pocket) {
        setPockets(prev => prev.map(item => item.id === pocket.id
          ? { ...item, amount: item.amount - currentPayment.fee }
          : item));
      }

      let slipSaved = true;
      try {
        await createTeamPaymentRecord({
          recordNumber: `PAY-FR-${currentPayment.teamMemberId.slice(-4)}-${Date.now()}`,
          teamMemberId: currentPayment.teamMemberId,
          date: paymentDate,
          projectPaymentIds: [currentPayment.id],
          totalAmount: currentPayment.fee,
        });
      } catch (error) {
        slipSaved = false;
        console.error('[ClientDetailModal] Failed to create team payment slip:', error);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teamProjectPayments'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['teamPaymentRecords'] }),
      ]);
      setTeamPaymentToPay(null);
      setTeamPaymentSourceId('');
      showNotification(slipSaved
        ? `Pembayaran ${currentPayment.teamMemberName} berhasil dicatat.`
        : 'Pembayaran berhasil dicatat, tetapi slip gagal dibuat. Jangan ulangi pembayaran ini.');
    } catch (error) {
      console.error('[ClientDetailModal] Failed to pay team assignment:', error);
      if (paymentMarkedPaid) {
        try {
          await updateTeamProjectPaymentsRow([currentPayment]);
        } catch (rollbackError) {
          console.error('[ClientDetailModal] Failed to restore unpaid team payment:', rollbackError);
        }
      }
      if (pocketDeducted && pocket) {
        try {
          await updatePocketRow(pocket.id, { amount: pocket.amount });
        } catch (rollbackError) {
          console.error('[ClientDetailModal] Failed to restore pocket balance:', rollbackError);
        }
      }
      showNotification('Pembayaran gagal dicatat. Periksa sumber dana lalu coba lagi.');
    } finally {
      setIsPayingTeamPayment(false);
    }
  };

  const handleNewExpenseChange = (
    projectId: string,
    field: 'date' | 'description' | 'amount' | 'category' | 'sourceId',
    value: string,
  ) => {
    const current = newExpense[projectId] || {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '',
      category: profile.expenseCategories[0] || 'Biaya Acara',
      sourceId: '',
    };
    setNewExpense(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  };

  /** Isi draft pengeluaran dari template: deskripsi, kategori, dan nominal default. */
  const handleApplyExpenseTemplate = (projectId: string, templateId: string) => {
    const template = expenseTemplates.find(item => item.id === templateId);
    if (!template) return;
    const current = newExpense[projectId] || {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '',
      category: profile.expenseCategories[0] || 'Biaya Acara',
      sourceId: '',
    };
    const category = profile.expenseCategories.includes(template.category)
      ? template.category
      : current.category;
    setNewExpense(prev => ({
      ...prev,
      [projectId]: {
        ...current,
        description: template.name,
        category,
        amount: template.defaultAmount > 0 ? String(template.defaultAmount) : '',
      },
    }));
  };

  const handleNewExpenseSubmit = async (projectId: string) => {
    const project = clientProjects.find(item => item.id === projectId);
    const draft = newExpense[projectId];
    const amount = Number(draft?.amount);
    const selectedPocket = draft?.sourceId.startsWith('pocket-')
      ? pockets.find(item => item.id === draft.sourceId.slice('pocket-'.length))
      : undefined;
    const selectedCard = draft?.sourceId.startsWith('card-')
      ? cards.find(item => item.id === draft.sourceId.slice('card-'.length))
      : selectedPocket?.sourceCardId
        ? cards.find(item => item.id === selectedPocket.sourceCardId)
        : undefined;

    if (!project || !draft || !draft.date || !draft.description.trim() || !draft.category || !Number.isFinite(amount) || amount <= 0) {
      showNotification('Lengkapi tanggal, deskripsi, kategori, dan jumlah pengeluaran.');
      return;
    }
    if (!selectedCard && !selectedPocket) {
      showNotification('Pilih sumber dana yang tersedia.');
      return;
    }
    if (selectedPocket && selectedPocket.amount < amount) {
      showNotification(`Saldo kantong ${selectedPocket.name} tidak mencukupi.`);
      return;
    }
    if (selectedPocket?.sourceCardId && !selectedCard) {
      showNotification('Kartu sumber untuk kantong ini tidak ditemukan.');
      return;
    }
    if (selectedCard && selectedCard.balance < amount) {
      showNotification(`Saldo ${selectedCard.bankName} tidak mencukupi.`);
      return;
    }

    setSavingExpenseProjectId(projectId);
    let pocketBalanceUpdated = false;
    try {
      if (selectedPocket) {
        await updatePocketRow(selectedPocket.id, { amount: selectedPocket.amount - amount });
        pocketBalanceUpdated = true;
      }

      const createdTransaction = await createTransactionRow({
        date: draft.date,
        description: draft.description.trim(),
        amount,
        type: TransactionType.EXPENSE,
        projectId: project.id,
        category: draft.category,
        method: selectedCard?.cardType === CardType.TUNAI ? 'Tunai' : selectedPocket ? 'Sistem' : 'Kartu',
        cardId: selectedCard?.id,
        pocketId: selectedPocket?.id,
      });

      setTransactions(prev => [createdTransaction, ...prev.filter(item => item.id !== createdTransaction.id)]
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
      if (selectedCard) {
        setCards(prev => prev.map(card => card.id === selectedCard.id
          ? { ...card, balance: card.balance - amount }
          : card));
      }
      if (selectedPocket) {
        setPockets(prev => prev.map(pocket => pocket.id === selectedPocket.id
          ? { ...pocket, amount: pocket.amount - amount }
          : pocket));
      }
      setNewExpense(prev => ({
        ...prev,
        [projectId]: {
          date: new Date().toISOString().slice(0, 10),
          description: '',
          amount: '',
          category: profile.expenseCategories[0] || 'Biaya Acara',
          sourceId: '',
        },
      }));
      setTransactionFormOpen(prev => ({ ...prev, [projectId]: null }));
      showNotification('Pengeluaran acara berhasil dicatat.');
    } catch (error) {
      console.error('[ClientDetailModal] Failed to record project expense:', error);
      if (pocketBalanceUpdated && selectedPocket) {
        try {
          await updatePocketRow(selectedPocket.id, { amount: selectedPocket.amount });
        } catch (rollbackError) {
          console.error('[ClientDetailModal] Failed to restore pocket balance:', rollbackError);
        }
      }
      showNotification('Pengeluaran gagal dicatat. Periksa sumber dana lalu coba lagi.');
    } finally {
      setSavingExpenseProjectId(null);
    }
  };

  const handleNewChargeChange = (projectId: string, field: 'name' | 'amount', value: string) => {
    const current = newCharge[projectId] || { name: '', amount: '' };
    setNewCharge(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  };

  const handleApplyTemplate = (projectId: string, template: { name: string; defaultAmount: number }) => {
    setNewCharge(prev => ({
      ...prev,
      [projectId]: {
        name: template.name,
        amount: String(template.defaultAmount),
      }
    }));
  };

  const handleSetZeroAmount = (projectId: string) => {
    const current = newCharge[projectId] || { name: '', amount: '' };
    setNewCharge(prev => ({
      ...prev,
      [projectId]: {
        ...current,
        amount: '0',
      }
    }));
  };

  const handleNewChargeSubmit = async (projectId: string) => {
    const chargeData = newCharge[projectId];
    const project = clientProjects.find(p => p.id === projectId);
    const rawAmount = chargeData?.amount !== undefined ? chargeData.amount.trim() : '';
    const amount = rawAmount === '' ? 0 : Number(rawAmount);

    if (chargeData && chargeData.name.trim() && !isNaN(amount) && amount >= 0 && project) {
      const newCustomCost = { id: `custom-${Date.now()}`, description: chargeData.name.trim(), amount };
      const updatedCustomCosts = [...(project.customCosts || []), newCustomCost];
      const newTotalCost = project.totalCost + amount;
      const remaining = newTotalCost - project.amountPaid;
      const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
      try {
        await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
        setNewCharge(prev => ({ ...prev, [projectId]: { name: '', amount: '' } }));
        showNotification(amount === 0
          ? 'Biaya tambahan (Rp 0 / Gratis) berhasil ditambahkan.'
          : 'Biaya tambahan berhasil ditambahkan.'
        );
      } catch (err) {
        console.error('Gagal menambahkan biaya tambahan:', err);
        showNotification('Gagal menambahkan biaya tambahan.');
      }
    } else {
      showNotification('Harap isi nama biaya dengan benar (jumlah biaya minimal Rp 0).');
    }
  };

  const handleAddAdditionalPackage = async (projectId: string, packageId: string) => {
    const project = clientProjects.find(p => p.id === projectId);
    const pkg = packages.find(p => p.id === packageId);
    if (!project || !pkg) return;

    const newAdditionalPackage = { id: pkg.id, name: pkg.name, price: pkg.price };
    const updatedAdditionalPackages = [...(project.additionalPackages || []), newAdditionalPackage];
    const newTotalCost = project.totalCost + pkg.price;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    
    try {
      await updateProjectRow(projectId, { additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Package Tambahan berhasil ditambahkan.');
    } catch (err) {
      console.error('Gagal menambahkan package tambahan:', err);
      showNotification('Gagal menambahkan package tambahan.');
    }
  };

  const handleDeleteAdditionalPackage = async (projectId: string, packageIndex: number) => {
    if (!window.confirm('Hapus package tambahan ini?')) return;
    const project = clientProjects.find(p => p.id === projectId);
    if (!project || !project.additionalPackages) return;

    const packageToDelete = project.additionalPackages[packageIndex];
    if (!packageToDelete) return;

    const updatedAdditionalPackages = [...project.additionalPackages];
    updatedAdditionalPackages.splice(packageIndex, 1);

    const newTotalCost = project.totalCost - (packageToDelete.price || 0);
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    
    try {
      await updateProjectRow(projectId, { additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Package Tambahan berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus package tambahan:', err);
      showNotification('Gagal menghapus package tambahan.');
    }
  };

  const handleDeleteCharge = async (projectId: string, chargeId: string) => {
    if (!window.confirm('Hapus biaya tambahan ini?')) return;
    const project = clientProjects.find(p => p.id === projectId);
    if (!project?.customCosts) return;
    const chargeToDelete = project.customCosts.find(c => c.id === chargeId);
    if (!chargeToDelete) return;
    const updatedCustomCosts = project.customCosts.filter(c => c.id !== chargeId);
    const newTotalCost = project.totalCost - chargeToDelete.amount;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    try {
      await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Biaya tambahan berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus biaya tambahan:', err);
      showNotification('Gagal menghapus biaya tambahan.');
    }
  };

  const handleStartEditCharge = (charge: { id: string; description: string; amount: number }) => {
    setEditingChargeId(charge.id);
    setEditChargeData({ name: charge.description, amount: String(charge.amount) });
  };

  const handleSaveEditCharge = async (projectId: string) => {
    const project = clientProjects.find(p => p.id === projectId);
    if (!project?.customCosts || !editingChargeId) return;
    const chargeToUpdate = project.customCosts.find(c => c.id === editingChargeId);
    if (!chargeToUpdate) return;
    const rawAmount = editChargeData.amount.trim();
    const newAmount = rawAmount === '' ? 0 : Number(rawAmount);
    const name = editChargeData.name.trim();
    if (!name || isNaN(newAmount) || newAmount < 0) {
      showNotification('Harap isi nama dan jumlah biaya dengan benar (minimal Rp 0).');
      return;
    }
    const diff = newAmount - chargeToUpdate.amount;
    const updatedCustomCosts = project.customCosts.map(c => c.id === editingChargeId ? { ...c, description: name, amount: newAmount } : c);
    const newTotalCost = project.totalCost + diff;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    try {
      await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      setEditingChargeId(null);
      showNotification('Biaya tambahan berhasil diperbarui.');
    } catch (err) {
      console.error('Gagal update biaya tambahan:', err);
      showNotification('Gagal memperbarui biaya tambahan.');
    }
  };

  // ── derived data ─────────────────────────────────────────────────────────

  const clientProjects = projects
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(p => projectOverrides[p.id] ? { ...p, ...projectOverrides[p.id] } : p);

  const clientTransactions = transactions
    .filter(t => clientProjects.some(p => p.id === t.projectId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalProjects = clientProjects.length;

  // ── avatar initials ───────────────────────────────────────────────────────

  const initials = client.name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  // ── tab config ────────────────────────────────────────────────────────────

  const tabs: { key: 'events' | 'payments'; label: string; icon: React.ReactNode }[] = [
    { key: 'events', label: `${customizeUiText('client.detail.tab.events', 'Acara Pernikahan', uiTextOverrides)} (${totalProjects})`, icon: <FolderKanbanIcon className="w-4 h-4" /> },
    { key: 'payments', label: customizeUiText('client.detail.tab.payments', 'Pembayaran & Transaksi', uiTextOverrides), icon: <HistoryIcon className="w-4 h-4" /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -mt-1">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mb-3 sm:mb-5 shadow-lg shadow-blue-500/20 bg-cover bg-center"
        style={{ backgroundImage: `url(${profile.publicPageConfig?.backgroundImages?.clientDetail || '/assets/images/backgrounds/detail-pengantin-4.jpg'})` }}
      >
        {/* Dark overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* decorative rings */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col items-center gap-2.5 p-2.5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-48 sm:h-48 rounded-xl sm:rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner border border-white/30">
            {client.avatarUrl ? (
              <img src={client.avatarUrl} alt={`${client.name} avatar`} className="w-full h-full object-cover"  loading="lazy" decoding="async" />
            ) : (
              <span className="text-white font-black text-base sm:text-2xl tracking-tight select-none">{initials}</span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-2 sm:gap-3 text-center sm:items-start sm:text-left">
            <div className="w-full">
              <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/80 mb-0.5">{customizeUiText('client.detail.title', 'Detail Pengantin', uiTextOverrides)}</p>
              <h2 className="text-sm sm:text-2xl font-black text-white leading-tight break-words">{client.name}</h2>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 sm:justify-start sm:gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/15 text-white text-[9px] sm:text-[10px] font-semibold border border-white/20">
                  Terdaftar {new Date(client.since).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {totalProjects > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/15 text-white text-[9px] sm:text-[10px] font-semibold border border-white/20">
                    {totalProjects} Acara
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => onEditClient(client)}
                className="h-7 sm:h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[9px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-90"
                title={customizeUiText('client.detail.action.edit', 'Edit Pengantin', uiTextOverrides)}
              >
                <PencilIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{customizeUiText('client.detail.action.edit', 'Edit Pengantin', uiTextOverrides)}</span>
              </button>
              <button
                onClick={() => onSharePortal(client)}
                className="h-7 sm:h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl solid-green border border-green-700 text-white text-[9px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-90"
                title={customizeUiText('client.detail.action.share', 'Bagikan Portal', uiTextOverrides)}
              >
                <Share2Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{customizeUiText('client.detail.action.share', 'Bagikan Portal', uiTextOverrides)}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 p-1 bg-brand-bg rounded-xl border border-brand-border mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 inline-flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === tab.key
                ? 'bg-brand-surface text-brand-accent shadow-sm border border-brand-border'
                : 'text-brand-text-secondary hover:text-brand-text-primary'
              }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────── */}
      <div className="pb-4">

        {activeTab === 'events' && (
          <Suspense fallback={<div className="py-8 text-center text-sm text-brand-text-secondary">Memuat pengelolaan acara...</div>}>
            <ProjectManagement
              projects={clientProjects}
              setProjects={setProjects}
              clients={[client]}
              packages={packages}
              teamMembers={teamMembers}
              teamProjectPayments={teamProjectPayments}
              setTeamProjectPayments={setTeamProjectPayments}
              teamPaymentRecords={teamPaymentRecords}
              paymentInvoiceProjects={projects}
              transactions={transactions}
              setTransactions={setTransactions}
              initialAction={null}
              setInitialAction={() => undefined}
              profile={profile}
              showNotification={showNotification}
              cards={cards}
              setCards={setCards}
              pockets={pockets}
              setPockets={setPockets}
              totals={{
                projects: clientProjects.length,
                activeProjects: clientProjects.filter(project => !/selesai|dibatalkan/i.test(project.status)).length,
                clients: 1,
                activeClients: 1,
                leads: 0,
                discussionLeads: 0,
                followUpLeads: 0,
                teamMembers: teamMembers.length,
                transactions: clientTransactions.length,
                revenue: 0,
                expense: 0,
              }}
              handleNavigation={handleNavigation}
              embeddedForClient
            />
          </Suspense>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: PAYMENTS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-5 animate-fade-in">
            {clientProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-semibold text-brand-text-light">Belum ada acara pernikahan</p>
                <p className="text-xs text-brand-text-secondary mt-1">Tambahkan acara pernikahan untuk pengantin ini.</p>
              </div>
            )}


            {clientProjects.map((p, projectIndex) => {
              const transactionsForProject = clientTransactions.filter(t => t.projectId === p.id);
              const clientPaymentTransactions = transactionsForProject.filter(t => t.type === TransactionType.INCOME);
              const teamProjectPaymentsForEvent = teamProjectPayments
                .filter(payment => payment.projectId === p.id)
                .sort((left, right) => left.teamMemberName.localeCompare(right.teamMemberName));
              const teamPaymentTransactions = transactionsForProject.filter(t =>
                t.type === TransactionType.EXPENSE && t.category?.toLowerCase().includes('gaji tim / vendor'),
              );
              const eventExpenseTransactions = transactionsForProject.filter(t =>
                t.type === TransactionType.EXPENSE && !t.category?.toLowerCase().includes('gaji tim / vendor'),
              );
              const teamPaymentHistoryRows = (() => {
                const matchedTransactionIds = new Set<string>();
                return teamProjectPaymentsForEvent.map(payment => {
                  const paymentRecord = teamPaymentRecords.find(record => record.projectPaymentIds.includes(payment.id));
                  const paymentTransaction = teamPaymentTransactions.find(transaction =>
                    !matchedTransactionIds.has(transaction.id) &&
                    transaction.description.toLowerCase().includes(payment.teamMemberName.toLowerCase()),
                  );
                  if (paymentTransaction) matchedTransactionIds.add(paymentTransaction.id);
                  return { payment, paymentRecord, paymentTransaction };
                });
              })();
              const totalTeamFees = teamProjectPaymentsForEvent.reduce((sum, payment) => sum + payment.fee, 0);
              const totalClientIncome = clientPaymentTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
              const totalEventExpenses = eventExpenseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
              const netProfit = totalClientIncome - totalTeamFees - totalEventExpenses;
              const projectLedgerRows = [
                ...clientPaymentTransactions.map(transaction => ({
                  id: `income-${transaction.id}`,
                  date: transaction.date,
                  direction: 'Masuk' as const,
                  title: transaction.description || 'Pembayaran klien',
                  category: transaction.category || 'Pembayaran Klien',
                  amount: transaction.amount,
                  receiptTransaction: transaction,
                  teamPayment: null as TeamProjectPayment | null,
                  paymentRecord: null as TeamPaymentRecord | null,
                })),
                ...teamPaymentHistoryRows.map(({ payment, paymentRecord, paymentTransaction }) => ({
                  id: `team-${payment.id}`,
                  date: payment.date,
                  direction: 'Keluar' as const,
                  title: payment.role ? `${payment.teamMemberName} (${payment.role})` : payment.teamMemberName,
                  category: 'Pembayaran Tim / Vendor',
                  amount: payment.fee,
                  receiptTransaction: paymentTransaction ?? null,
                  teamPayment: payment,
                  paymentRecord: paymentRecord ?? null,
                })),
                ...eventExpenseTransactions.map(transaction => ({
                  id: `expense-${transaction.id}`,
                  date: transaction.date,
                  direction: 'Keluar' as const,
                  title: transaction.description || 'Biaya acara',
                  category: transaction.category || 'Biaya Acara',
                  amount: transaction.amount,
                  receiptTransaction: transaction,
                  teamPayment: null as TeamProjectPayment | null,
                  paymentRecord: null as TeamPaymentRecord | null,
                })),
              ];
              const sortLedgerRows = (rows: typeof projectLedgerRows) =>
                [...rows].sort((left, right) => {
                  const categoryCompare = (left.category || '').localeCompare(right.category || '');
                  if (categoryCompare !== 0) return categoryCompare;
                  return new Date(left.date).getTime() - new Date(right.date).getTime();
                });
              const ledgerGroups: {
                key: string;
                direction: 'Masuk' | 'Keluar';
                category: string;
                rows: typeof projectLedgerRows;
              }[] = [];
              [
                ...sortLedgerRows(projectLedgerRows.filter(row => row.direction === 'Masuk')),
                ...sortLedgerRows(projectLedgerRows.filter(row => row.direction === 'Keluar')),
              ].forEach(row => {
                const key = `${row.direction}::${row.category}`;
                const lastGroup = ledgerGroups[ledgerGroups.length - 1];
                if (lastGroup && lastGroup.key === key) {
                  lastGroup.rows.push(row);
                } else {
                  ledgerGroups.push({ key, direction: row.direction, category: row.category, rows: [row] });
                }
              });
              const remainingBalance = p.totalCost - p.amountPaid;
              const eventDateLabel = p.date
                ? new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : '';
              const projectNameWithoutPrefix = (p.projectName || '').replace(/^Acara Pernikahan\s+/i, '').trim();
              const displayProjectName = eventDateLabel && projectNameWithoutPrefix.endsWith(eventDateLabel)
                ? projectNameWithoutPrefix.slice(0, -eventDateLabel.length).replace(/[\s,–—-]+$/, '').trim()
                : projectNameWithoutPrefix;
              const pkg = packages.find(pkg => pkg.id === p.packageId || (p.packageName && pkg.name.trim().toLowerCase() === p.packageName.trim().toLowerCase())) || null;
              const selectedDurationOption = pkg?.durationOptions?.find(option => option.label === p.durationSelection);
              const teamComposition = selectedDurationOption?.photographers || pkg?.photographers;
              const packageDescriptionItems = [...(pkg?.digitalItems || [])];
              if (teamComposition?.trim()) packageDescriptionItems.unshift(`Jumlah Tim: ${teamComposition}`);
              const selectedAddOns = (p.addOns || []).filter(a => a && (a.name || a.id));
              const selectedPackageIds = new Set(packages.map(packageItem => packageItem.id));
              const additionalPackages = p.additionalPackages?.length
                ? p.additionalPackages
                : selectedAddOns.filter(item => item.id && selectedPackageIds.has(item.id) && item.id !== p.packageId);
              const additionalPackageIds = new Set(additionalPackages.map(item => item.id));
              const regularAddOns = selectedAddOns.filter(item =>
                (!item.id || !selectedPackageIds.has(item.id)) && !additionalPackageIds.has(item.id),
              );

              return (
                <div key={p.id} className="relative">
                  {/* Project number connector line (skip last) */}
                  {projectIndex < clientProjects.length - 1 && (
                    <div className="absolute left-5 top-full w-px h-8 bg-gradient-to-b from-brand-border to-transparent" />
                  )}

                  {/* ── PROJECT HEADER ───────────────────────────────── */}
                  <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-200 mt-0.5">
                        <span className="text-white font-black text-xs">#{projectIndex + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="max-w-full truncate text-sm font-bold text-brand-text-light leading-tight" title={displayProjectName || p.projectName}>
                          {displayProjectName || p.projectName}
                        </h4>
                        <p className="text-[10px] text-brand-text-secondary mt-0.5">
                          PRJ-{p.id.slice(-6).toUpperCase()} &nbsp;•&nbsp;
                          {eventDateLabel || 'Belum ditentukan'}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-shrink-0 sm:items-end">
                      <div className="flex w-full min-w-0 flex-wrap gap-1 sm:w-auto sm:flex-nowrap sm:justify-end">
                        {remainingBalance > 0 ? (
                          <button
                            type="button"
                            onClick={() => setTransactionFormOpen(prev => ({
                              ...prev,
                              [p.id]: prev[p.id] === 'payment' ? null : 'payment',
                            }))}
                            className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-1 py-1 text-center text-[9px] font-bold leading-tight text-white transition-colors hover:bg-emerald-800 sm:flex-none sm:px-2.5 sm:text-[11px]"
                            aria-expanded={transactionFormOpen[p.id] === 'payment'}
                            aria-label="Catat pembayaran klien"
                            title="Catat pembayaran klien"
                          >
                            <Plus className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            <span className="sm:hidden">{transactionFormOpen[p.id] === 'payment' ? 'Tutup' : 'Bayar'}</span>
                            <span className="hidden sm:inline">{transactionFormOpen[p.id] === 'payment' ? 'Tutup' : 'Pembayaran'}</span>
                          </button>
                        ) : (
                          <span className="inline-flex min-h-9 min-w-0 w-full basis-full items-center justify-center rounded-lg bg-emerald-50 px-2 py-1.5 text-center text-[10px] font-bold leading-tight text-emerald-700 sm:w-auto sm:basis-auto sm:px-2.5">
                            Pembayaran lunas
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setTransactionFormOpen(prev => ({
                            ...prev,
                            [p.id]: prev[p.id] === 'charges' ? null : 'charges',
                          }))}
                            className="inline-flex min-h-9 min-w-0 flex-1 whitespace-nowrap items-center justify-center gap-1 rounded-lg border border-blue-700 bg-blue-600 px-1 py-1 text-center text-[9px] font-bold leading-tight text-white transition-colors hover:bg-blue-700 sm:flex-none sm:px-2.5 sm:text-[11px]"
                          aria-expanded={transactionFormOpen[p.id] === 'charges'}
                          aria-label="Tambah biaya atau paket ke tagihan"
                          title="Tambah biaya atau paket ke tagihan klien"
                        >
                          <Plus className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            <span className="sm:hidden">{transactionFormOpen[p.id] === 'charges' ? 'Tutup' : 'Tagihan'}</span>
                            <span className="hidden sm:inline">{transactionFormOpen[p.id] === 'charges' ? 'Tutup' : 'Tambah tagihan'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const shouldOpen = transactionFormOpen[p.id] !== 'expense';
                            setTransactionFormOpen(prev => ({ ...prev, [p.id]: shouldOpen ? 'expense' : null }));
                            if (shouldOpen) {
                              setNewExpense(prev => prev[p.id] ? prev : ({
                                ...prev,
                                [p.id]: {
                                  date: new Date().toISOString().slice(0, 10),
                                  description: '',
                                  amount: '',
                                  category: profile.expenseCategories[0] || 'Biaya Acara',
                                  sourceId: '',
                                },
                              }));
                            }
                          }}
                          className="inline-flex min-h-9 min-w-0 flex-1 whitespace-nowrap items-center justify-center gap-1 rounded-lg border border-red-700 bg-red-600 px-1 py-1 text-center text-[9px] font-bold leading-tight text-white transition-colors hover:bg-red-700 sm:flex-none sm:px-2.5 sm:text-[11px]"
                          aria-expanded={transactionFormOpen[p.id] === 'expense'}
                          aria-label="Catat pengeluaran acara"
                          title="Catat pengeluaran acara"
                        >
                          <TrendingDownIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                          <span className="sm:hidden">{transactionFormOpen[p.id] === 'expense' ? 'Tutup' : 'Biaya'}</span>
                          <span className="hidden sm:inline">{transactionFormOpen[p.id] === 'expense' ? 'Tutup' : 'Pengeluaran'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ══════════════════════════════════════════════════════
                      INPUT SECTION — CATAT PEMBAYARAN & BIAYA TAMBAHAN
                      (ditampilkan di atas detail acara agar mudah diakses)
                  ══════════════════════════════════════════════════════ */}
                  {transactionFormOpen[p.id] && <div className="mb-4 bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden p-4 space-y-6">

                    {/* ── CATAT PEMBAYARAN MASUK (PELUNASAN / DP) ──────── */}
                    {transactionFormOpen[p.id] === 'payment' && <>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-950">Catat Pembayaran Masuk</h4>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md border border-gray-200">Sisa Pembayaran: {formatCurrency(remainingBalance)}</span>
                      </div>
                      
                      {remainingBalance > 0 && (
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleNewPaymentChange(p.id, 'amount', String(remainingBalance))}
                            className="text-[10px] font-bold text-gray-700 underline underline-offset-2 hover:text-gray-950"
                            title="Isi otomatis dengan seluruh sisa pembayaran"
                          >
                            Isi otomatis sisa pembayaran
                          </button>
                        </div>
                      )}
                      {remainingBalance <= 0 ? (
                        <div className="px-4 py-3 flex items-center gap-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                          <CheckIcon className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-semibold">Semua pembayaran telah lunas — tidak ada sisa pembayaran.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-6 space-y-1.5">
                            <label htmlFor={`amount-${p.id}`} className="text-xs font-semibold text-brand-text-light flex items-center justify-between">
                              <span>Jumlah Pembayaran (Rp)</span>
                              <span className="text-[10px] font-normal text-brand-text-secondary">Maks: {formatCurrency(remainingBalance)}</span>
                            </label>
                            <RupiahInput
                              id={`amount-${p.id}`}
                              value={newPayments[p.id]?.amount || ''}
                              onChange={(raw) => handleNewPaymentChange(p.id, 'amount', raw)}
                              max={remainingBalance}
                              className="w-full h-[42px] px-3.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400"
                              placeholder="Masukkan nominal bayar..."
                            />
                          </div>
                          <div className="sm:col-span-4 space-y-1.5">
                            <label htmlFor={`dest-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                              Tujuan Rekening / Kas
                            </label>
                            <select
                              id={`dest-${p.id}`}
                              value={newPayments[p.id]?.destinationCardId || ''}
                              onChange={e => handleNewPaymentChange(p.id, 'destinationCardId', e.target.value)}
                              className="w-full h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                            >
                              <option value="">Pilih Tujuan Rekening / Kas...</option>
                              {cards.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.bankName} {c.lastFourDigits !== 'CASH' ? `**** ${c.lastFourDigits}` : '(Tunai)'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-10 space-y-1.5">
                            <label htmlFor={`payment-proof-${p.id}`} className="text-xs font-semibold text-brand-text-light">Bukti Transfer (Opsional)</label>
                            <input
                              id={`payment-proof-${p.id}`}
                              type="file"
                              accept="image/*"
                              onChange={event => setPaymentProofFiles(prev => ({ ...prev, [p.id]: event.target.files?.[0] || null }))}
                              className="w-full h-[42px] px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl text-gray-700 file:mr-3 file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              onClick={() => void handleNewPaymentSubmit(p.id)}
                              disabled={savingPaymentProjectId === p.id}
                              className="w-full h-[42px] bg-gray-950 hover:bg-gray-800 text-white !py-0 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              {savingPaymentProjectId === p.id ? 'Mengunggah...' : 'Catat'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </>}

                    {transactionFormOpen[p.id] === 'expense' && (
                      <form
                        onSubmit={event => {
                          event.preventDefault();
                          void handleNewExpenseSubmit(p.id);
                        }}
                        className="space-y-3"
                      >
                        <div>
                          <h4 className="text-sm font-bold text-gray-950">Catat Pengeluaran Acara</h4>
                          <p className="mt-0.5 text-xs text-gray-600">Transaksi ini masuk ke laporan pengeluaran dan tidak mengubah tagihan klien.</p>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label htmlFor={`expense-template-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                              Template Pengeluaran
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowManageExpenseTemplates(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-950 active:scale-95"
                              title="Kelola template pengeluaran / biaya yang sering dipakai"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              <span>Kelola Template</span>
                            </button>
                          </div>
                          <select
                            id={`expense-template-${p.id}`}
                            defaultValue=""
                            onChange={event => {
                              const val = event.target.value;
                              if (val) handleApplyExpenseTemplate(p.id, val);
                              event.target.value = '';
                            }}
                            className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-medium text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
                          >
                            <option value="">Pilih dari Template Pengeluaran (opsional)...</option>
                            {expenseTemplateCategories.map(([category, items]) => (
                              <optgroup key={category} label={category}>
                                {items.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}{t.defaultAmount > 0 ? ` — ${formatCurrency(t.defaultAmount)}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-semibold text-brand-text-light">
                            Tanggal
                            <input
                              type="date"
                              required
                              value={newExpense[p.id]?.date || ''}
                              onChange={event => handleNewExpenseChange(p.id, 'date', event.target.value)}
                              className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-medium text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                            />
                          </label>
                          <label className="space-y-1 text-xs font-semibold text-brand-text-light">
                            Jumlah (Rp)
                            <RupiahInput
                              value={newExpense[p.id]?.amount || ''}
                              onChange={value => handleNewExpenseChange(p.id, 'amount', value)}
                              className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                              placeholder="0"
                            />
                          </label>
                        </div>
                        <label className="block space-y-1 text-xs font-semibold text-brand-text-light">
                          Deskripsi
                          <input
                            type="text"
                            required
                            value={newExpense[p.id]?.description || ''}
                            onChange={event => handleNewExpenseChange(p.id, 'description', event.target.value)}
                            className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-medium text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                            placeholder="Contoh: Transportasi kru"
                          />
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-semibold text-brand-text-light">
                            Kategori
                            <select
                              required
                              value={newExpense[p.id]?.category || ''}
                              onChange={event => handleNewExpenseChange(p.id, 'category', event.target.value)}
                              className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-medium text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                            >
                              {(profile.expenseCategories.length ? profile.expenseCategories : ['Biaya Acara']).map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-semibold text-brand-text-light">
                            Sumber dana
                            <select
                              required
                              value={newExpense[p.id]?.sourceId || ''}
                              onChange={event => handleNewExpenseChange(p.id, 'sourceId', event.target.value)}
                              className="h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-medium text-gray-950 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                            >
                              <option value="">Pilih sumber dana...</option>
                              <optgroup label="Kartu / Kas">
                                {cards.map(card => (
                                  <option key={card.id} value={`card-${card.id}`}>
                                    {card.cardHolderName} · {card.bankName} {card.cardType !== CardType.TUNAI ? `**** ${card.lastFourDigits}` : '(Tunai)'} · {formatCurrency(card.balance)}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Kantong">
                                {pockets.map(pocket => (
                                  <option key={pocket.id} value={`pocket-${pocket.id}`}>
                                    {pocket.name} · {formatCurrency(pocket.amount)}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setTransactionFormOpen(prev => ({ ...prev, [p.id]: null }))}
                            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={savingExpenseProjectId === p.id}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                          >
                            <TrendingDownIcon className="h-3.5 w-3.5" />
                            {savingExpenseProjectId === p.id ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* ── INPUT BIAYA TAMBAHAN / BONUS ─────────────────── */}
                    {transactionFormOpen[p.id] === 'charges' && <>
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-950">Tambah Biaya Tambahan / Package</h4>
                        <button
                          type="button"
                          onClick={() => setShowManageTemplates(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-950 bg-white hover:bg-gray-100 border border-gray-300 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
                          title="Kelola template biaya tambahan & bonus otomatis"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Kelola Template</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Package Tambahan quick-pick */}
                        <div>
                          <h5 className="text-xs font-bold text-gray-950 mb-1.5">Pilih Package Tambahan</h5>
                          <div className="flex gap-2">
                            <select
                              id={`charge-package-${p.id}`}
                              value={selectedAddPkg[p.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setSelectedAddPkg(prev => ({ ...prev, [p.id]: val }));
                              }}
                              className="flex-1 h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                            >
                              <option value="">Pilih Package Tambahan...</option>
                              {packagesByRegion.map(([region, items]) => (
                                <optgroup key={region} label={region}>
                                  {items.map(pkgItem => (
                                    <option key={pkgItem.id} value={pkgItem.id}>
                                      {pkgItem.name} — {formatCurrency(pkgItem.price)}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const val = selectedAddPkg[p.id];
                                if (!val) return;
                                handleAddAdditionalPackage(p.id, val);
                                setSelectedAddPkg(prev => ({ ...prev, [p.id]: '' }));
                              }}
                              disabled={!selectedAddPkg[p.id]}
                              className="h-[42px] px-4 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 text-white flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Pilih
                            </button>
                          </div>
                        </div>

                        {/* Template quick-pick */}
                        <div>
                          <select
                            id={`charge-template-${p.id}`}
                            defaultValue=""
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) return;
                              const t = templates.find(item => item.name === val);
                              if (t) {
                                handleApplyTemplate(p.id, { name: t.name, defaultAmount: t.defaultAmount });
                              }
                              e.target.value = '';
                            }}
                            className="w-full h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                          >
                            <option value="">Pilih dari Template Biaya Tambahan...</option>
                            {templateCategories.map(([category, items]) => (
                              <optgroup key={category} label={category}>
                                {items.map(t => (
                                  <option key={`${category}-${t.name}`} value={t.name}>
                                    {t.name} — {t.defaultAmount === 0 ? 'Gratis (Rp 0)' : formatCurrency(t.defaultAmount)}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        {/* Manual input */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                          <div className="sm:col-span-6 space-y-1.5">
                            <label htmlFor={`charge-name-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                              Nama Biaya Tambahan Manual
                            </label>
                            <input
                              type="text"
                              id={`charge-name-${p.id}`}
                              value={newCharge[p.id]?.name || ''}
                              onChange={e => handleNewChargeChange(p.id, 'name', e.target.value)}
                              className="w-full h-[42px] px-3.5 text-xs bg-brand-bg border border-brand-border rounded-xl text-brand-text-primary focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                              placeholder="Contoh: Overtime Kru 1 Jam / Drone Aerial / Bonus"
                            />
                          </div>
                          <div className="sm:col-span-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label htmlFor={`charge-amount-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                                Jumlah Biaya (Rp)
                              </label>
                              <button
                                type="button"
                                onClick={() => handleSetZeroAmount(p.id)}
                                className="text-[10px] font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-0.5 rounded transition-all active:scale-95"
                                title="Set sebagai Gratis / Bonus (Rp 0)"
                              >
                                Set Rp 0 (Gratis)
                              </button>
                            </div>
                            <RupiahInput
                              id={`charge-amount-${p.id}`}
                              value={newCharge[p.id]?.amount ?? ''}
                              onChange={raw => handleNewChargeChange(p.id, 'amount', raw)}
                              className="w-full h-[42px] px-3.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400"
                              placeholder="0"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              onClick={() => handleNewChargeSubmit(p.id)}
                              className="w-full h-[42px] bg-gray-950 hover:bg-gray-800 text-white !py-0 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Tambah
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    </>}

                  </div>}
                  {/* END INPUT SECTION */}

                  <div className="mt-4 space-y-3">
                    <SectionTitle sub="Rincian tagihan dan riwayat pembayaran untuk acara ini.">
                      {customizeUiText('client.detail.section.transactions', 'Riwayat Pembayaran', uiTextOverrides)}
                    </SectionTitle>
                  </div>

                  {/* ── PROJECT CARD ──────────────────────────────────── */}
                  <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">

                    <div className="p-3 sm:p-5 space-y-3 sm:space-y-5">

                      {/* Cost breakdown */}
                      <details
                        open={openCostDetails[p.id] ?? true}
                        onToggle={e => {
                          const isOpen = e.currentTarget.open;
                          setOpenCostDetails(prev => (prev[p.id] === isOpen ? prev : { ...prev, [p.id]: isOpen }));
                        }}
                        className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-blue-600 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                          <span>Rincian biaya</span>
                          <span className="flex items-center gap-2">
                            {formatCurrency(p.totalCost)}
                            <ChevronDown className="h-4 w-4 text-white" />
                          </span>
                        </summary>
                        <div className="border-t border-slate-200 px-4 py-3 space-y-2.5">
                          {/* Base package */}
                          <div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary font-medium">
                                Package Utama {p.packageName || pkg?.name ? (
                                  <span className="font-bold text-brand-text-light">({p.packageName || pkg?.name})</span>
                                ) : ''}
                              </span>
                              <span className="font-bold text-brand-text-light">
                                {formatCurrency(
                                  p.totalCost
                                  + (Number(p.discountAmount) || 0)
                                  - (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0)
                                  - regularAddOns.reduce((s, a) => s + (Number(a.price) || 0), 0)
                                  - additionalPackages.reduce((s, packageItem) => s + (Number(packageItem.price) || 0), 0)
                                  - (Number(p.transportCost) || 0)
                                )}
                              </span>
                            </div>

                            {((p as any).durationSelection || '').trim() && (
                              <p className="text-[11px] text-brand-accent font-medium mt-1 pl-2.5 italic">
                                {(p as any).durationSelection}
                              </p>
                            )}
                            {packageDescriptionItems.length > 0 && (
                              <ul className="mt-1.5 pl-2.5 space-y-0.5 border-l-2 border-brand-accent/30 my-1">
                                {packageDescriptionItems.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5 text-[10px] text-brand-text-secondary">
                                    <span className="text-brand-accent font-bold mt-px">·</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Additional packages */}
                          {additionalPackages.map((item, index) => {
                            const additionalPackage = packages.find(packageItem => packageItem.id === item.id);
                            const deliverables = [
                              ...(additionalPackage?.digitalItems || []),
                              ...(additionalPackage?.physicalItems || []).map(physicalItem => physicalItem.name),
                            ].filter(Boolean);

                            return (
                              <div key={item.id || index} className="group/addpkg relative">
                                <div className="flex justify-between items-center text-xs pr-6">
                                  <span className="text-brand-text-secondary font-medium">
                                    Package Tambahan <span className="font-bold text-brand-text-light">({item.name || additionalPackage?.name})</span>
                                  </span>
                                  <span className="font-semibold text-brand-text-light">{formatCurrency(Number(item.price || 0))}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteAdditionalPackage(p.id, index);
                                  }}
                                  className="absolute top-0 right-0 text-red-500 opacity-0 group-hover/addpkg:opacity-100 transition-opacity p-0.5 hover:bg-red-600/10 rounded"
                                  title="Hapus Package Tambahan"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                                {deliverables.length > 0 && (
                                  <ul className="mt-1.5 pl-2.5 space-y-0.5 border-l-2 border-brand-accent/30 my-1">
                                    {deliverables.map((deliverable, deliverableIndex) => (
                                      <li key={`${item.id}-${deliverableIndex}`} className="flex items-start gap-1.5 text-[10px] text-brand-text-secondary">
                                        <span className="text-brand-accent font-bold mt-px">·</span>
                                        <span>{deliverable}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}

                          {/* Add-ons */}
                          {regularAddOns.map((a, idx) => (
                            <div key={a.id || a.name || idx} className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary">+ {a.name} <span className="opacity-60">(Add-on)</span></span>
                              <span className="font-semibold text-brand-text-light">{formatCurrency(Number(a.price || 0))}</span>
                            </div>
                          ))}

                          {/* Transport */}
                          {p.transportCost && Number(p.transportCost) > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary">+ Biaya Transport</span>
                              <span className="font-semibold text-brand-text-light">{formatCurrency(Number(p.transportCost))}</span>
                            </div>
                          )}

                          {/* Custom costs */}
                          {p.customCosts && p.customCosts.length > 0 && (
                            <div className="pt-1 space-y-1.5 border-t border-slate-200">
                              {p.customCosts.map(c => {
                                const isEditing = editingChargeId === c.id;
                                const isZero = Number(c.amount) === 0;
                                return (
                                  <div key={c.id} className={`rounded-xl px-3 py-2 border transition-all group/charge ${isZero ? 'bg-green-600/5 border-green-600/20' : 'bg-orange-600/5 border-orange-600/20'}`}>
                                    {isEditing ? (
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                          type="text"
                                          value={editChargeData.name}
                                          onChange={e => setEditChargeData({ ...editChargeData, name: e.target.value })}
                                          className="flex-grow p-1.5 text-xs bg-white border border-brand-border rounded-lg text-brand-text-light focus:border-brand-accent outline-none"
                                          placeholder="Nama biaya..."
                                        />
                                        <div className="flex items-center gap-1.5">
                                          <RupiahInput
                                            value={editChargeData.amount}
                                            onChange={val => setEditChargeData({ ...editChargeData, amount: val })}
                                            className="w-full sm:w-28 p-1.5 text-xs bg-white border border-brand-border rounded-lg text-brand-text-light focus:border-brand-accent outline-none"
                                            placeholder="0"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setEditChargeData({ ...editChargeData, amount: '0' })}
                                            className="px-2 py-1 text-[10px] font-bold rounded bg-white hover:bg-green-600/10 text-slate-600 hover:text-green-700 border border-slate-200 whitespace-nowrap"
                                            title="Ubah ke Rp 0"
                                          >
                                            Rp 0
                                          </button>
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => handleSaveEditCharge(p.id)} className="p-1.5 bg-green-600/10 text-green-700 rounded-lg hover:bg-green-600/20 transition-all" title="Simpan">
                                            <CheckIcon className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingChargeId(null)} className="p-1.5 bg-red-600/10 text-red-600 rounded-lg hover:bg-red-600/20 transition-all" title="Batal">
                                            <XIcon className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                          <span className={`font-semibold ${isZero ? 'text-green-800' : 'text-orange-700'} truncate`}>
                                            + {c.description}
                                          </span>
                                          {isZero && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider solid-green text-white">
                                              Gratis / Rp 0
                                            </span>
                                          )}
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover/charge:opacity-100 transition-all flex-shrink-0">
                                            <button onClick={() => handleStartEditCharge(c)} className="p-1 text-blue-500 hover:text-blue-700 active:scale-90 transition-all" title="Edit">
                                              <PencilIcon className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => handleDeleteCharge(p.id, c.id)} className="p-1 text-red-400 hover:text-red-600 active:scale-90 transition-all" title="Hapus">
                                              <Trash2Icon className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        <span className={`font-bold flex-shrink-0 ml-2 ${isZero ? 'text-green-700 font-mono' : 'text-orange-700'}`}>
                                          {isZero ? 'Rp 0' : formatCurrency(c.amount)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {Number(p.discountAmount) > 0 && (
                            <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-xs text-red-600">
                              <span>Diskon</span>
                              <span className="font-semibold">-{formatCurrency(Number(p.discountAmount))}</span>
                            </div>
                          )}

                        </div>
                      </details>

                      {/* Payment summary */}
                      <div className="grid grid-cols-3 gap-2">
                        <FinancePill label="Total" value={formatCurrency(p.totalCost)} color="neutral" />
                        <FinancePill label="Terbayar" value={formatCurrency(p.amountPaid)} color="green" />
                        <FinancePill label="Sisa" value={formatCurrency(remainingBalance)} color={remainingBalance > 0 ? 'red' : 'green'} />
                      </div>

                      {/* Action buttons */}
                      <div className="client-detail-action-group flex flex-nowrap items-center justify-end gap-1 sm:gap-2 pt-1">
                        {p.dpProofUrl && (
                          <a
                            href={p.dpProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-auto max-w-full button-secondary !py-1.5 !px-2 sm:!py-2 sm:!px-3 text-[10px] sm:text-xs inline-flex items-center justify-center gap-1"
                          >
                            <CreditCardIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-accent" />
                            <span className="sm:hidden">Bukti DP</span><span className="hidden sm:inline">Bukti DP</span>
                          </a>
                        )}
                        <button
                          onClick={() => onViewInvoice(p)}
                          className="w-auto max-w-full button-primary !py-1.5 !px-2 sm:!py-2 sm:!px-3 text-[10px] sm:text-xs inline-flex items-center justify-center gap-1"
                        >
                          <FileTextIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="sm:hidden">Invoice</span><span className="hidden sm:inline">Invoice PDF</span>
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus acara “${p.projectName}”? Data acara ini akan dihapus dan tindakan ini tidak dapat dibatalkan.`)) {
                              onDeleteProject(p.id);
                            }
                          }}
                          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-red-200 px-2 py-1.5 text-[10px] sm:px-3 sm:py-2 sm:text-[11px] sm:gap-1.5 font-bold text-red-700 transition-all hover:border-red-300 hover:bg-red-50 active:scale-95"
                          title="Hapus Acara"
                          aria-label={`Hapus acara ${p.projectName}`}
                        >
                          <Trash2Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="sm:hidden">Hapus</span><span className="hidden sm:inline">Hapus Acara</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* ── LEDGER: KLIEN + TIM + BIAYA (SATU TABEL) ─────── */}
                  <div className="mt-3 overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/60 px-3 py-2.5">
                      <div>
                        <h5 className="text-xs font-bold text-brand-text-primary sm:text-sm">Rincian Pemasukan &amp; Pengeluaran</h5>
                        <p className="text-[10px] text-brand-text-secondary">{projectLedgerRows.length} transaksi · Klien, Tim &amp; Biaya</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-brand-text-secondary">Masuk <span className="font-bold text-emerald-700">{formatCurrency(totalClientIncome)}</span></span>
                        <span className="text-brand-text-secondary">Keluar <span className="font-bold text-red-600">{formatCurrency(totalTeamFees + totalEventExpenses)}</span></span>
                      </div>
                    </div>
                    {projectLedgerRows.length === 0 ? (
                      <p className="px-3 py-5 text-center text-xs text-brand-text-secondary">Belum ada transaksi untuk proyek ini.</p>
                    ) : (
                      <>
                      <div className="hidden overflow-x-auto sm:block">
                        <table className="w-full min-w-[680px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-brand-border bg-brand-bg/40 text-[10px] font-bold uppercase tracking-wide text-brand-text-secondary">
                              <th className="px-3 py-2">Tanggal</th>
                              <th className="px-3 py-2">Tipe</th>
                              <th className="px-3 py-2">Keterangan</th>
                              <th className="px-3 py-2">Kategori</th>
                              <th className="px-3 py-2 text-right">Jumlah</th>
                              <th className="px-3 py-2 text-right">Bukti / Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-border">
                            {ledgerGroups.map(group => {
                              return (
                                <Fragment key={group.key}>
                                  <tr className="bg-slate-100">
                                    <td colSpan={5} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                      {group.direction === 'Masuk' ? 'Pembayaran Masuk' : 'Pengeluaran'} · {group.category}
                                    </td>
                                    <td className="px-3 py-1.5" />
                                  </tr>
                                  {group.rows.map(row => {
                                    const teamPayment = row.teamPayment;
                                    const receiptTransaction = row.receiptTransaction;
                                    return (
                                      <Fragment key={row.id}>
                                  <tr className="align-middle hover:bg-brand-bg/30">
                                    <td className="whitespace-nowrap px-3 py-2 text-brand-text-secondary">{new Date(row.date).toLocaleDateString('id-ID')}</td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${row.direction === 'Masuk' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{row.direction}</span>
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-brand-text-primary">{row.title}</td>
                                    <td className="px-3 py-2 text-brand-text-secondary">{row.category}</td>
                                    <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${row.direction === 'Masuk' ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {row.direction === 'Masuk' ? '+' : '−'}&nbsp;{formatCurrency(row.amount)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {teamPayment && (
                                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${teamPayment.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                                            {teamPayment.status === 'Paid' ? 'Lunas' : 'Belum lunas'}
                                          </span>
                                        )}
                                        {teamPayment && teamPayment.status === 'Unpaid' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingTeamPaymentId(teamPayment.id);
                                                setTeamPaymentEditDraft({ role: teamPayment.role || '', fee: String(teamPayment.fee) });
                                              }}
                                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                                              aria-label={`Edit fee ${teamPayment.teamMemberName}`}
                                            >
                                              <PencilIcon className="h-3 w-3" /> Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setTeamPaymentToPay(teamPayment);
                                                setTeamPaymentSourceId('');
                                              }}
                                              className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2 text-[10px] font-bold text-white hover:bg-emerald-800"
                                              aria-label={`Bayar fee ${teamPayment.teamMemberName}`}
                                            >
                                              <CreditCardIcon className="h-3 w-3" /> Bayar
                                            </button>
                                          </>
                                        )}
                                        {receiptTransaction && (
                                          <button
                                            type="button"
                                            onClick={() => onViewReceipt(receiptTransaction)}
                                            className="inline-flex items-center rounded-md border border-brand-border px-2 py-1 text-[10px] font-semibold text-brand-text-secondary hover:border-brand-accent/40 hover:bg-brand-accent/10 hover:text-brand-accent"
                                            title="Lihat bukti transaksi"
                                            aria-label={`Lihat bukti ${row.title}`}
                                          >
                                            Lihat
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {teamPayment && editingTeamPaymentId === teamPayment.id && (
                                    <tr className="bg-blue-50/40">
                                      <td colSpan={6} className="px-3 py-2">
                                        <form
                                          onSubmit={event => {
                                            event.preventDefault();
                                            void handleUpdateTeamPayment(teamPayment);
                                          }}
                                          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
                                        >
                                          <label className="space-y-1 text-[10px] font-semibold text-brand-text-secondary">
                                            Anggota / Peran
                                            <input
                                              type="text"
                                              value={teamPaymentEditDraft.role}
                                              onChange={event => setTeamPaymentEditDraft(prev => ({ ...prev, role: event.target.value }))}
                                              className="h-9 w-full rounded-lg border border-brand-border bg-white px-2 text-xs text-brand-text-primary"
                                              placeholder="Tim / Vendor"
                                            />
                                          </label>
                                          <label className="space-y-1 text-[10px] font-semibold text-brand-text-secondary">
                                            Pembayaran (Rp)
                                            <RupiahInput
                                              value={teamPaymentEditDraft.fee}
                                              onChange={value => setTeamPaymentEditDraft(prev => ({ ...prev, fee: value }))}
                                              className="h-9 w-full rounded-lg border border-brand-border bg-white px-2 text-xs font-semibold text-brand-text-primary"
                                              placeholder="0"
                                            />
                                          </label>
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditingTeamPaymentId(null)}
                                              className="min-h-9 rounded-lg border border-brand-border px-2.5 text-[10px] font-semibold text-brand-text-secondary hover:bg-brand-bg"
                                            >
                                              Batal
                                            </button>
                                            <button
                                              type="submit"
                                              disabled={savingTeamPaymentId === teamPayment.id}
                                              className="min-h-9 rounded-lg bg-blue-600 px-2.5 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                                            >
                                              {savingTeamPaymentId === teamPayment.id ? 'Menyimpan...' : 'Update'}
                                            </button>
                                          </div>
                                        </form>
                                      </td>
                                    </tr>
                                  )}
                                      </Fragment>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-brand-border bg-brand-bg/60">
                              <td colSpan={4} className="px-3 py-1.5 text-right text-[10px] font-bold text-brand-text-secondary">Total pemasukan (pembayaran klien)</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-right text-[11px] font-bold text-emerald-700">{formatCurrency(totalClientIncome)}</td>
                              <td />
                            </tr>
                            <tr className="border-t border-brand-border bg-brand-bg/60">
                              <td colSpan={4} className="px-3 py-1.5 text-right text-[10px] font-bold text-brand-text-secondary">Total pengeluaran (fee tim + biaya acara)</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-right text-[11px] font-bold text-red-600">{formatCurrency(totalTeamFees + totalEventExpenses)}</td>
                              <td />
                            </tr>
                            <tr className="border-t-2 border-brand-border bg-brand-bg">
                              <td colSpan={4} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-brand-text-primary">Laba bersih</td>
                              <td className={`whitespace-nowrap px-3 py-2.5 text-right text-sm font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(netProfit)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="space-y-2 px-2 py-2 sm:hidden">
                        {ledgerGroups.map(group => (
                          <section key={`mobile-${group.key}`} className="space-y-1.5">
                            <h6 className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 break-words">
                              {group.direction === 'Masuk' ? 'Pembayaran Masuk' : 'Pengeluaran'} · {group.category}
                            </h6>
                            {group.rows.map(row => {
                              const teamPayment = row.teamPayment;
                              const receiptTransaction = row.receiptTransaction;
                              return (
                                <article key={`mobile-${row.id}`} className="min-w-0 rounded-lg border border-brand-border bg-white p-2.5">
                                  <div className="flex min-w-0 items-start justify-between gap-1.5">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] text-brand-text-secondary">{new Date(row.date).toLocaleDateString('id-ID')}</span>
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${row.direction === 'Masuk' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                          {row.direction}
                                        </span>
                                      </div>
                                      <p className="mt-0.5 break-words text-[11px] font-semibold leading-tight text-brand-text-primary">{row.title}</p>
                                      <p className="mt-0.5 break-words text-[9px] leading-tight text-brand-text-secondary">{row.category}</p>
                                    </div>
                                    <span className={`max-w-[45%] shrink-0 break-words text-right text-[11px] font-bold ${row.direction === 'Masuk' ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {row.direction === 'Masuk' ? '+' : '−'} {formatCurrency(row.amount)}
                                    </span>
                                  </div>
                                  {teamPayment && (
                                    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1 border-t border-brand-border pt-1.5">
                                      {teamPayment && (
                                        <span className={`mr-auto rounded-full px-2 py-0.5 text-[9px] font-bold ${teamPayment.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                                          {teamPayment.status === 'Paid' ? 'Lunas' : 'Belum lunas'}
                                        </span>
                                      )}
                                      {teamPayment && teamPayment.status === 'Unpaid' && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingTeamPaymentId(teamPayment.id);
                                              setTeamPaymentEditDraft({ role: teamPayment.role || '', fee: String(teamPayment.fee) });
                                            }}
                                            className="inline-flex min-h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 text-[9px] font-bold text-blue-700 hover:bg-blue-100"
                                            aria-label={`Edit fee ${teamPayment.teamMemberName}`}
                                          >
                                            <PencilIcon className="h-3 w-3" /> Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTeamPaymentToPay(teamPayment);
                                              setTeamPaymentSourceId('');
                                            }}
                                            className="inline-flex min-h-7 items-center gap-1 rounded-md bg-emerald-700 px-1.5 text-[9px] font-bold text-white hover:bg-emerald-800"
                                            aria-label={`Bayar fee ${teamPayment.teamMemberName}`}
                                          >
                                            <CreditCardIcon className="h-3 w-3" /> Bayar
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {teamPayment && editingTeamPaymentId === teamPayment.id && (
                                    <form
                                      onSubmit={event => {
                                        event.preventDefault();
                                        void handleUpdateTeamPayment(teamPayment);
                                      }}
                                      className="mt-2 grid grid-cols-1 gap-1.5 border-t border-brand-border pt-2"
                                    >
                                      <label className="space-y-1 text-[10px] font-semibold text-brand-text-secondary">
                                        Anggota / Peran
                                        <input
                                          type="text"
                                          value={teamPaymentEditDraft.role}
                                          onChange={event => setTeamPaymentEditDraft(prev => ({ ...prev, role: event.target.value }))}
                                          className="h-8 w-full rounded-md border border-brand-border bg-white px-2 text-[11px] text-brand-text-primary"
                                          placeholder="Tim / Vendor"
                                        />
                                      </label>
                                      <label className="space-y-1 text-[10px] font-semibold text-brand-text-secondary">
                                        Pembayaran (Rp)
                                        <RupiahInput
                                          value={teamPaymentEditDraft.fee}
                                          onChange={value => setTeamPaymentEditDraft(prev => ({ ...prev, fee: value }))}
                                          className="h-8 w-full rounded-md border border-brand-border bg-white px-2 text-[11px] font-semibold text-brand-text-primary"
                                          placeholder="0"
                                        />
                                      </label>
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingTeamPaymentId(null)}
                                          className="min-h-8 rounded-md border border-brand-border px-2 text-[9px] font-semibold text-brand-text-secondary hover:bg-brand-bg"
                                        >Batal</button>
                                        <button
                                          type="submit"
                                          disabled={savingTeamPaymentId === teamPayment.id}
                                          className="min-h-8 rounded-md bg-blue-600 px-2 text-[9px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                                        >{savingTeamPaymentId === teamPayment.id ? 'Menyimpan...' : 'Update'}</button>
                                      </div>
                                    </form>
                                  )}
                                </article>
                              );
                            })}
                          </section>
                        ))}
                        <div className="space-y-1 rounded-lg border border-brand-border bg-brand-bg/60 p-2.5 text-[9px]">
                          <div className="flex justify-between gap-3"><span className="text-brand-text-secondary">Total pemasukan (pembayaran klien)</span><span className="shrink-0 font-bold text-emerald-700">{formatCurrency(totalClientIncome)}</span></div>
                          <div className="flex justify-between gap-3"><span className="text-brand-text-secondary">Total pengeluaran (fee tim + biaya acara)</span><span className="shrink-0 font-bold text-red-600">{formatCurrency(totalTeamFees + totalEventExpenses)}</span></div>
                          <div className="flex justify-between gap-3 border-t border-brand-border pt-1.5 font-bold"><span className="text-brand-text-primary">Laba bersih</span><span className={`shrink-0 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(netProfit)}</span></div>
                        </div>
                      </div>
                      </>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {showManageTemplates && (
          <ManageTemplatesModal onClose={() => setShowManageTemplates(false)} />
        )}
        {showManageExpenseTemplates && (
          <ManageExpenseTemplatesModal
            onClose={() => setShowManageExpenseTemplates(false)}
            categories={profile.expenseCategories}
          />
        )}
        <Modal
          isOpen={teamPaymentToPay !== null}
          onClose={() => {
            if (!isPayingTeamPayment) {
              setTeamPaymentToPay(null);
              setTeamPaymentSourceId('');
            }
          }}
          title="Bayar Pembayaran Tim / Vendor"
          size="md"
        >
          {teamPaymentToPay && (
            <form
              onSubmit={event => {
                event.preventDefault();
                void handlePayTeamPayment();
              }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
                <p className="text-xs font-semibold text-brand-text-secondary">
                  {teamPaymentToPay.teamMemberName} · {clientProjects.find(project => project.id === teamPaymentToPay.projectId)?.projectName}
                </p>
                <p className="mt-1 text-lg font-extrabold text-brand-text-primary">{formatCurrency(teamPaymentToPay.fee)}</p>
              </div>
              <label className="block space-y-1.5 text-xs font-bold text-brand-text-primary">
                Sumber dana
                <select
                  required
                  value={teamPaymentSourceId}
                  onChange={event => setTeamPaymentSourceId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm font-medium text-brand-text-primary focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                >
                  <option value="">Pilih sumber dana...</option>
                  <optgroup label="Kartu / Kas">
                    {cards.map(card => (
                      <option key={card.id} value={`card-${card.id}`}>
                        {card.cardHolderName} · {card.bankName} {card.cardType !== CardType.TUNAI ? `**** ${card.lastFourDigits}` : '(Tunai)'} · {formatCurrency(card.balance)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kantong">
                    {pockets.map(pocket => (
                      <option key={pocket.id} value={`pocket-${pocket.id}`}>
                        {pocket.name} · {formatCurrency(pocket.amount)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isPayingTeamPayment}
                  onClick={() => {
                    setTeamPaymentToPay(null);
                    setTeamPaymentSourceId('');
                  }}
                  className="min-h-10 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-bold text-brand-text-primary hover:bg-brand-bg disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!teamPaymentSourceId || isPayingTeamPayment}
                  className="min-h-10 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPayingTeamPayment ? 'Memproses...' : 'Bayar Sekarang'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ClientDetailModal;
