/**
 * TeamPage (Freelancers)
 *
 * Pure orchestration layer — no business logic, no inline render helpers.
 *
 * Architecture:
 *   TeamPage
 *     ├─ useTeamFilters      (date range, search, derived data)
 *     ├─ useTeamStats        (stat card values)
 *     ├─ useTeamMembers      (CRUD, form, performance, portal/QR)
 *     ├─ useTeamPayments     (payment flow, slip, PDF)
 *     │
 *     ├─ TeamPageHeader      (date filter + action buttons)
 *     ├─ TeamTabNav          (tab switcher)
 *     ├─ TeamSectionStats    (stat cards per group)
 *     ├─ TeamSearchBar       (search input + count)
 *     ├─ TeamMemberList      (desktop table + mobile cards)
 *     ├─ TeamUnpaidTab       (centralized unpaid fee view)
 *     ├─ TeamAnalyticsTab    (analytics & performance widgets)
 *     │
 *     ├─ TeamMemberDetailModal  (full member detail — 4 tabs)
 *     ├─ TeamMemberFormModal    (add / edit form)
 *     ├─ TeamStatDrillModal     (stat card drill-down)
 *     └─ Modal (slip, signature, QR, info)
 */

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import {
  TeamMember,
  TeamProjectPayment,
  Profile,
  Transaction,
  TeamPaymentRecord,
  Project,
  Card,
  FinancialPocket,
  NavigationAction,
} from '../../types';

// Shared UI
import Modal from '../../shared/ui/Modal';
import SignaturePad from '../../shared/ui/SignaturePad';
import QrCodeDisplay from '../../shared/ui/QrCodeDisplay';

// Feature components
import TeamPageHeader from '../../features/team/components/TeamPageHeader';
import TeamTabNav, { MainTab } from '../../features/team/components/TeamTabNav';
import TeamSectionStats from '../../features/team/components/TeamSectionStats';
import TeamSearchBar from '../../features/team/components/TeamSearchBar';
import TeamMemberList from '../../features/team/components/TeamMemberList';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import TeamUnpaidTab from '../../features/team/components/TeamUnpaidTab';
import TeamAnalyticsTab from '../../features/team/components/TeamAnalyticsTab';
import TeamMemberDetailModal from '../../features/team/components/TeamMemberDetailModal';
import TeamMemberFormModal from '../../features/team/components/TeamMemberFormModal';
import TeamStatDrillModal, {
  ActiveStatModal,
} from '../../features/team/components/TeamStatDrillModal';

// Hooks
import { useTeamFilters } from '../../features/team/hooks/useTeamFilters';
import { useTeamStats } from '../../features/team/hooks/useTeamStats';
import { useTeamMembers } from '../../features/team/hooks/useTeamMembers';
import { useTeamPayments } from '../../features/team/hooks/useTeamPayments';

// Utils
import { downloadTeamCSV } from '../../features/team/utils/teamUtils';

// Icons
import { PencilIcon, DownloadIcon } from '../../constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FreelancersProps {
  teamMembers: TeamMember[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  teamPaymentRecords: TeamPaymentRecord[];
  setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  userProfile: Profile;
  showNotification: (message: string) => void;
  initialAction: NavigationAction | null;
  setInitialAction: (action: NavigationAction | null) => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  pockets: FinancialPocket[];
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  onSignPaymentRecord: (recordId: string, signatureDataUrl: string) => void;
  totals: {
    projects: number;
    activeProjects: number;
    clients: number;
    activeClients: number;
    leads: number;
    discussionLeads: number;
    followUpLeads: number;
    teamMembers: number;
    transactions: number;
    revenue: number;
    expense: number;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Freelancers: React.FC<FreelancersProps> = ({
  teamMembers,
  setTeamMembers,
  teamProjectPayments,
  setTeamProjectPayments,
  teamPaymentRecords,
  setTeamPaymentRecords,
  transactions,
  setTransactions,
  userProfile,
  showNotification,
  initialAction,
  setInitialAction,
  projects,
  setProjects,
  pockets,
  setPockets,
  cards,
  setCards,
  onSignPaymentRecord,
}) => {
  // ── Local UI state ───────────────────────────────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('team');
  const [showExtendedTeamStats, setShowExtendedTeamStats] = useState(false);
  const [showExtendedVendorStats, setShowExtendedVendorStats] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [activeStatModal, setActiveStatModal] = useState<ActiveStatModal | null>(null);

  // ── Filters hook ─────────────────────────────────────────────────────────
  const filters = useTeamFilters({ teamMembers, teamProjectPayments, projects });

  // ── Stats hook ───────────────────────────────────────────────────────────
  const { teamSectionStats, vendorSectionStats, teamStats } = useTeamStats({
    memberGroups: filters.memberGroups,
    teamMembers,
    teamProjectPaymentsInDateRange: filters.teamProjectPaymentsInDateRange,
    teamProjectPayments,
    teamPaymentRecords,
  });

  // ── Members hook ─────────────────────────────────────────────────────────
  const members = useTeamMembers({
    teamMembers,
    setTeamMembers,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
    setProjects,
    showNotification,
    initialAction,
    setInitialAction,
  });

  // ── Payments hook ────────────────────────────────────────────────────────
  const payments = useTeamPayments({
    selectedMember: members.selectedMember,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
    transactions,
    setTransactions,
    projects,
    cards,
    setCards,
    pockets,
    setPockets,
    teamMembers,
    userProfile,
    showNotification,
    onSignPaymentRecord,
    setDetailTab: members.setDetailTab,
    setIsDetailOpen: members.setIsDetailOpen,
    teamProjectPaymentsInDateRange: filters.teamProjectPaymentsInDateRange,
  });

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page header: date filter + actions ──────────────────────────── */}
      <TeamPageHeader
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={filters.setDateFrom}
        onDateToChange={filters.setDateTo}
        onResetDateRange={filters.resetDateRange}
        onDownload={() =>
          downloadTeamCSV(teamMembers, filters.teamProjectPaymentsInDateRange)
        }
        onAddMember={() => members.handleOpenForm('add')}
      />

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <TeamTabNav
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
        teamCount={filters.memberGroups.team.length}
        vendorCount={filters.memberGroups.vendor.length}
        unpaidCount={filters.allUnpaidPayments.length}
      />

      {/* ── Tab: Tim Internal ───────────────────────────────────────────── */}
      {activeMainTab === 'team' && (
        <div className="space-y-4">
          <TeamSectionStats
            group="team"
            stats={teamSectionStats}
            showExtended={showExtendedTeamStats}
            onToggleExtended={() => setShowExtendedTeamStats((p) => !p)}
            onStatClick={(stat) => setActiveStatModal({ group: 'team', stat })}
          />
          <TeamSearchBar
            placeholder="Cari nama anggota atau posisi tim..."
            value={filters.teamSearchQuery}
            onChange={filters.setTeamSearchQuery}
            resultCount={filters.uniqueTeamMembers.length}
            resultLabel="anggota tim"
          />
          <TeamMemberList
            members={filters.uniqueTeamMembers}
            teamProjectPaymentsInDateRange={filters.teamProjectPaymentsInDateRange}
            groupLabel="team"
            onViewDetails={members.handleViewDetails}
            onEditMember={(m) => members.handleOpenForm('edit', m)}
            onDeleteMember={members.handleDelete}
          />
        </div>
      )}

      {/* ── Tab: Vendor Eksternal ────────────────────────────────────────── */}
      {activeMainTab === 'vendor' && (
        <div className="space-y-4">
          <TeamSectionStats
            group="vendor"
            stats={vendorSectionStats}
            showExtended={showExtendedVendorStats}
            onToggleExtended={() => setShowExtendedVendorStats((p) => !p)}
            onStatClick={(stat) => setActiveStatModal({ group: 'vendor', stat })}
          />
          <TeamSearchBar
            placeholder="Cari nama vendor atau bidang keahlian..."
            value={filters.vendorSearchQuery}
            onChange={filters.setVendorSearchQuery}
            resultCount={filters.uniqueVendorMembers.length}
            resultLabel="mitra vendor"
          />
          <TeamMemberList
            members={filters.uniqueVendorMembers}
            teamProjectPaymentsInDateRange={filters.teamProjectPaymentsInDateRange}
            groupLabel="vendor"
            onViewDetails={members.handleViewDetails}
            onEditMember={(m) => members.handleOpenForm('edit', m)}
            onDeleteMember={members.handleDelete}
          />
        </div>
      )}

      {/* ── Tab: Fee Belum Lunas ─────────────────────────────────────────── */}
      {activeMainTab === 'unpaid' && (
        <TeamUnpaidTab
          filteredUnpaidPayments={filters.filteredUnpaidPayments}
          allUnpaidPayments={filters.allUnpaidPayments}
          totalUnpaidAll={filters.totalUnpaidAll}
          unpaidSearchQuery={filters.unpaidSearchQuery}
          onSearchChange={filters.setUnpaidSearchQuery}
          onViewDetails={members.handleViewDetails}
        />
      )}

      {/* ── Tab: Analitik & Performa ─────────────────────────────────────── */}
      {activeMainTab === 'analytics' && (
        <TeamAnalyticsTab
          teamMembers={teamMembers}
          teamPaymentRecords={teamPaymentRecords}
          teamStats={teamStats}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════════════════════ */}

      {/* Add / Edit member form */}
      <TeamMemberFormModal
        isOpen={members.isFormOpen}
        onClose={() => members.setIsFormOpen(false)}
        formMode={members.formMode}
        formData={members.formData}
        setFormData={members.setFormData}
        onSubmit={members.handleSubmit}
        isSubmitting={members.isSubmitting}
      />

      {/* Member detail (4 tabs: projects / payments / performance / create-payment) */}
      {members.selectedMember && (
        <TeamMemberDetailModal
          isOpen={members.isDetailOpen}
          onClose={() => members.setIsDetailOpen(false)}
          selectedMember={members.selectedMember}
          detailTab={members.detailTab}
          setDetailTab={members.setDetailTab}
          selectedMemberUnpaidProjects={payments.selectedMemberUnpaidProjects}
          projectsToPay={payments.projectsToPay}
          onToggleProject={(id) =>
            payments.setProjectsToPay((prev) =>
              prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
            )
          }
          onProceedToPayment={payments.handleCreatePayment}
          teamProjectPayments={teamProjectPayments}
          teamPaymentRecords={payments.uniqueTeamPaymentRecords}
          projects={projects}
          expandedRecordId={payments.expandedRecordId}
          onToggleExpandRecord={(id) =>
            payments.setExpandedRecordId((prev) => (prev === id ? null : id))
          }
          onViewSlip={payments.setPaymentSlipToView}
          onUpdatePaymentRecord={payments.handleUpdatePaymentRecord}
          onDeletePaymentRecord={payments.handleDeletePaymentRecord}
          newNote={members.newNote}
          setNewNote={members.setNewNote}
          newNoteType={members.newNoteType}
          setNewNoteType={members.setNewNoteType}
          onSetRating={members.handleSetRating}
          onAddNote={members.handleAddNote}
          onDeleteNote={members.handleDeleteNote}
          paymentAmount={payments.paymentAmount}
          setPaymentAmount={payments.setPaymentAmount}
          isInstallment={payments.isInstallment}
          setIsInstallment={payments.setIsInstallment}
          onPay={payments.handlePay}
          renderPaymentSlipBody={payments.renderPaymentSlipBody}
          cards={cards}
          monthlyBudgetPocket={payments.monthlyBudgetPocket}
          paymentSourceId={payments.paymentSourceId}
          setPaymentSourceId={payments.setPaymentSourceId}
          onSign={() => payments.setIsSignatureModalOpen(true)}
          onOpenQrModal={members.handleOpenQrModal}
        />
      )}

      {/* Payment slip viewer */}
      {payments.paymentSlipToView && (
        <Modal
            isOpen={!!payments.paymentSlipToView}
            onClose={() => payments.setPaymentSlipToView(null)}
            title={`Slip Pembayaran: ${payments.paymentSlipToView.recordNumber}`}
            size="4xl"
          >
          <div className="bg-slate-50 border border-brand-border rounded-xl overflow-x-auto min-h-[450px] p-2 sm:p-4">
            {payments.renderPaymentSlipBody(payments.paymentSlipToView)}
          </div>

          <div className="mt-5 flex justify-end items-center gap-2 non-printable border-t border-brand-border pt-4">
            <button
              type="button"
              onClick={() => payments.setIsSignatureModalOpen(true)}
              className="button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <PencilIcon className="w-4 h-4" />
              {payments.paymentSlipToView.vendorSignature || userProfile?.signatureBase64 ? 'Ganti TTD' : 'Bubuhkan TTD'}
            </button>
            <button
              type="button"
              onClick={payments.handleSharePaymentSlip}
              className="button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Share2 className="w-4 h-4" />
              Bagikan Bukti &amp; Invoice PDF
            </button>
            <button
              type="button"
              onClick={payments.handleDownloadPDF}
              className="button-primary inline-flex items-center gap-2 px-5 py-2 text-sm"
            >
              <DownloadIcon className="w-4 h-4" />
              Unduh PDF
            </button>
          </div>
        </Modal>
      )}

      {/* Signature pad */}
      <Modal
        isOpen={payments.isSignatureModalOpen}
        onClose={() => payments.setIsSignatureModalOpen(false)}
        title="Bubuhkan Tanda Tangan Anda"
      >
        <SignaturePad
          onClose={() => payments.setIsSignatureModalOpen(false)}
          onSave={payments.handleSaveSignature}
        />
      </Modal>

      {/* Stat drill-down */}
      <TeamStatDrillModal
        activeStatModal={activeStatModal}
        onClose={() => setActiveStatModal(null)}
        memberGroups={filters.memberGroups}
        teamProjectPaymentsInDateRange={filters.teamProjectPaymentsInDateRange}
        projects={projects}
        uniqueTeamMembers={filters.uniqueTeamMembers}
        uniqueVendorMembers={filters.uniqueVendorMembers}
        projectsInDateRange={filters.projectsInDateRange}
      />

      {/* QR / Portal link */}
      {members.qrModalContent && (
        <Modal
          isOpen={!!members.qrModalContent}
          onClose={() => members.setQrModalContent(null)}
          title={members.qrModalContent.title}
          size="sm"
        >
          <div className="flex flex-col items-center gap-4 p-4">
            <QrCodeDisplay
              value={members.qrModalContent.url}
              size={200}
              wrapperId="team-portal-qrcode"
            />
            <p className="text-xs text-brand-text-secondary text-center break-all">
              {members.qrModalContent.url}
            </p>
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(members.qrModalContent!.url);
                  showNotification('Tautan berhasil disalin!');
                }}
                className="button-secondary flex-1 py-2 text-sm"
              >
                Salin Tautan
              </button>
              <button
                onClick={() => {
                  const canvas = document.querySelector(
                    '#team-portal-qrcode canvas',
                  ) as HTMLCanvasElement | null;
                  if (canvas) {
                    const link = document.createElement('a');
                    link.download = 'team-portal-qr.png';
                    link.href = canvas.toDataURL();
                    link.click();
                  }
                }}
                className="button-primary flex-1 py-2 text-sm"
              >
                Unduh QR
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Info / Guide modal */}
      <Modal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="Panduan Halaman Tim / Vendor"
      >
        <div className="space-y-3 text-sm text-brand-text-secondary leading-relaxed">
          <p>Pusat manajemen semua tim internal dan vendor eksternal Anda.</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-brand-text-primary">Tambah & Edit</strong> — tombol di kanan atas untuk tambah anggota baru, atau ikon pensil di tabel untuk edit.
            </li>
            <li>
              <strong className="text-brand-text-primary">Detail</strong> — klik baris untuk buka panel detail dengan 4 tab: Acara, Pembayaran, Kinerja, dan Buat Pembayaran.
            </li>
            <li>
              <strong className="text-brand-text-primary">Pembayaran</strong> — pilih acara yang belum dibayar, buat slip pembayaran, dan catat transaksi langsung dari detail.
            </li>
            <li>
              <strong className="text-brand-text-primary">Kinerja</strong> — beri rating bintang dan tambah catatan kinerja per anggota.
            </li>
            <li>
              <strong className="text-brand-text-primary">Portal</strong> — bagikan tautan portal pribadi agar tim bisa lihat jadwal dan tugas mereka.
            </li>
          </ul>
        </div>
      </Modal>

    </div>
  );
};

export default Freelancers;
