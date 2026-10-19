import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Project,
    TeamMember,
    Client,
    Package,
    TeamProjectPayment,
    TeamPaymentRecord,
    Transaction,
    Profile,
    NavigationAction,
    Card,
    FinancialPocket,
    CardType,
    TransactionType,
} from '../../types';

import Modal from '../../shared/ui/Modal';
import { ListIcon, LayoutGridIcon, CalendarIcon } from '../../constants';
import { PlusIcon, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import ProjectForm from '../../features/projects/components/ProjectForm';
import ProjectAnalytics from '../../features/projects/components/ProjectAnalytics';
import { ProjectListView, ProjectKanbanView } from '../../features/projects/components/ProjectViews';
import ProjectDetailModal from '../../features/projects/components/ProjectDetailModal';
import QuickStatusModal from '../../features/projects/components/QuickStatusModal';
import ChatModal from '../../features/communication/components/ChatModal';
import ShareMessageModal from '../../features/communication/components/ShareMessageModal';
import ProjectBriefingModal from '../../features/projects/components/ProjectBriefingModal';
import ProjectStatModals from '../../features/projects/components/ProjectStatModals';

import { useProjectFilters } from '../../features/projects/hooks/useProjectFilters';
import { useProjectBriefing } from '../../features/projects/hooks/useProjectBriefing';
import { useProjectForm } from '../../features/projects/hooks/useProjectForm';
import { useProjectEditMode } from '../../features/projects/hooks/useProjectEditMode';
import { useProjectOperations } from '../../features/projects/hooks/useProjectOperations';
import { calculateProjectsModalStats } from '../../features/projects/utils/projectCalculations';
import { getProjectWithRelations } from '../../services/projects';
import { createTransaction } from '../../services/transactions';
import { updatePocket as updatePocketRow } from '../../services/pockets';
import { updateTeamProjectPayments as updateTeamProjectPaymentsApi } from '../../services/teamProjectPayments';
import { createTeamPaymentRecord } from '../../services/teamPaymentRecords';

export interface ProjectsProps {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    clients: Client[];
    packages: Package[];
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords?: TeamPaymentRecord[];
    paymentInvoiceProjects?: Project[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
    profile: Profile;
    showNotification: (message: string) => void;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
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
    handleNavigation?: (view: any, action?: NavigationAction) => void;
    embeddedForClient?: boolean;
}

type SharePreviewData = {
    title: string;
    message: string;
    phone?: string | null;
} | null;

export const Projects: React.FC<ProjectsProps> = ({
    projects,
    setProjects,
    clients,
    packages,
    teamMembers,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords = [],
    paymentInvoiceProjects,
    transactions,
    setTransactions,
    initialAction,
    setInitialAction,
    profile,
    showNotification,
    cards,
    setCards,
    pockets,
    setPockets,
    totals,
    handleNavigation,
    embeddedForClient = false,
}) => {
    const queryClient = useQueryClient();
    // Communication & Preview States
    const [chatModalData, setChatModalData] = useState<{ project: Project; client: Client } | null>(null);
    const [sharePreview, setSharePreview] = useState<SharePreviewData>(null);

    // Detail & Selection States
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [quickStatusModalOpen, setQuickStatusModalOpen] = useState(false);
    const [selectedProjectForStatus, setSelectedProjectForStatus] = useState<Project | null>(null);
    const [activeStatModal, setActiveStatModal] = useState<string | null>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const hasAutoOpenedEmbeddedProject = useRef(false);

    // Custom Hooks
    const {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        viewMode,
        setViewMode,
        projectListTab,
        setProjectListTab,
        filteredProjects,
        activeProjects,
        completedAndCancelledProjects,
        displayProjects
    } = useProjectFilters(projects);

    const {
        isBriefingModalOpen,
        briefingProject,
        briefingData,
        handleOpenBriefingModal,
        handleCloseBriefingModal
    } = useProjectBriefing(profile);

    const {
        isFormModalOpen,
        formMode,
        formData,
        setFormData,
        teamByCategory,
        handleOpenForm,
        handleCloseForm,
        handleFormChange,
        handleSubStatusChange,
        handleClientChange,
        handleTeamChange,
        handleReplaceTeamMember,
        handleTeamFeeChange,
        handleTeamSubJobChange,
        handleTeamClientPortalLinkChange,
        handleCustomSubStatusChange,
        addCustomSubStatus,
        removeCustomSubStatus,
        handleFormSubmit
    } = useProjectForm({
        projects,
        setProjects,
        clients,
        packages,
        teamMembers,
        teamProjectPayments,
        setTeamProjectPayments,
        transactions,
        setTransactions,
        cards,
        setCards,
        profile,
        showNotification,
        setSelectedProject
    });

    const {
        draggedProjectId,
        handleProjectDelete,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleQuickStatusChange
    } = useProjectOperations({
        projects,
        setProjects,
        selectedProject,
        formData,
        setFormData,
        setTeamProjectPayments,
        setTransactions,
        cards,
        setCards,
        pockets,
        setPockets,
        profile,
        showNotification
    });

    // ── Edit mode (inline on detail modal) ──────────────────────────────────
    const {
        isEditing: isEditingProject,
        isSaving: isSavingProject,
        editFormData,
        teamByCategory: editTeamByCategory,
        enterEditMode,
        cancelEditMode,
        handleEditFormChange,
        handleEditSubStatusToggle,
        handleEditTeamChange,
        handleEditTeamFeeChange,
        handleEditTeamSubJobChange,
        handleEditReplaceTeamMember,
        handleSaveEdit,
    } = useProjectEditMode({
        projects,
        setProjects,
        teamMembers,
        teamProjectPayments,
        setTeamProjectPayments,
        transactions,
        setTransactions,
        cards,
        setCards,
        profile,
        showNotification,
        setSelectedProject,
    });

    // Modal Stats Calculation
    const { activeCount, allActiveProjectsForStats, deadlineSoonProjects, topProjectType, topStatus } =
        useMemo(() => calculateProjectsModalStats(projects), [projects]);

    const statsForModal = useMemo(
        () => ({
            activeCount,
            allActiveProjectsForStats,
            deadlineSoonProjects,
            topProjectType,
            topStatus
        }),
        [activeCount, allActiveProjectsForStats, deadlineSoonProjects, topProjectType, topStatus]
    );

    // Synchronize selectedProject if projects snapshot changes in background
    useEffect(() => {
        if (!selectedProject) return;
        const updated = projects.find(p => p.id === selectedProject.id);
        if (!updated) return;

        const hasChanged =
            updated.status !== selectedProject.status ||
            updated.progress !== selectedProject.progress ||
            updated.date !== selectedProject.date ||
            updated.deadlineDate !== selectedProject.deadlineDate ||
            updated.totalCost !== selectedProject.totalCost ||
            updated.amountPaid !== selectedProject.amountPaid ||
            updated.paymentStatus !== selectedProject.paymentStatus ||
            updated.finalDriveLink !== selectedProject.finalDriveLink ||
            updated.clientDriveLink !== selectedProject.clientDriveLink ||
            (updated as any).updatedAt !== (selectedProject as any).updatedAt;

        if (hasChanged) {
            setSelectedProject(prev => {
                if (!prev || prev.id !== updated.id) return prev;
                return {
                    ...prev,
                    ...updated,
                    team: (updated as any).team && (updated as any).team.length > 0 ? (updated as any).team : (prev as any).team,
                    weddingDayChecklist: (prev as any).weddingDayChecklist || (updated as any).weddingDayChecklist,
                } as Project;
            });
        }
    }, [projects, selectedProject?.id, selectedProject?.status, selectedProject?.progress, selectedProject?.totalCost, selectedProject?.amountPaid, selectedProject?.paymentStatus, selectedProject?.finalDriveLink, selectedProject?.clientDriveLink, selectedProject?.date, selectedProject?.deadlineDate, (selectedProject as any)?.updatedAt]);

    const handleOpenDetailModal = useCallback((project: Project) => {
        setSelectedProject(project);
        setIsDetailModalOpen(true);

        (async () => {
            try {
                const fresh = await getProjectWithRelations(project.id);
                if (fresh) {
                    setSelectedProject(fresh);
                    setProjects(prev => prev.map(p => p.id === project.id ? fresh : p));
                }
            } catch (err) {
                console.warn('[Projects] Background fetch failed for detail:', err);
            }
        })();
    }, [setProjects]);

    const handlePayTeamAssignment = useCallback(async (payment: TeamProjectPayment, sourceId: string) => {
        const currentPayment = teamProjectPayments.find(item => item.id === payment.id);
        const member = teamMembers.find(item => item.id === payment.teamMemberId);
        const project = projects.find(item => item.id === payment.projectId);
        if (!currentPayment || currentPayment.status !== 'Unpaid' || !member || !project) {
            showNotification('Fee sudah berubah atau data penugasan tidak ditemukan. Muat ulang detail acara.');
            return;
        }

        const pocket = sourceId.startsWith('pocket-')
            ? pockets.find(item => item.id === sourceId.slice('pocket-'.length))
            : undefined;
        const cardId = pocket?.sourceCardId || (sourceId.startsWith('card-') ? sourceId.slice('card-'.length) : undefined);
        const card = cards.find(item => item.id === cardId);
        if (sourceId.startsWith('pocket-') && (!pocket || pocket.amount < currentPayment.fee)) {
            showNotification('Saldo kantong tidak mencukupi untuk pembayaran ini.');
            return;
        }
        if (sourceId.startsWith('card-') && !card) {
            showNotification('Kartu sumber dana tidak ditemukan.');
            return;
        }
        if (card && card.balance < currentPayment.fee) {
            showNotification(`Saldo kartu ${card.bankName} tidak mencukupi.`);
            return;
        }
        if (!pocket && !sourceId.startsWith('card-')) {
            showNotification('Pilih sumber dana yang valid.');
            return;
        }

        const paymentDate = new Date().toISOString().slice(0, 10);
        let pocketDeducted = false;
        let paymentMarkedPaid = false;
        try {
            if (pocket) {
                await updatePocketRow(pocket.id, { amount: pocket.amount - currentPayment.fee });
                pocketDeducted = true;
            }

            const persistedPayments = await updateTeamProjectPaymentsApi([{
                ...currentPayment,
                status: 'Paid',
            }]);
            paymentMarkedPaid = true;

            const transaction = await createTransaction({
                date: paymentDate,
                description: `Gaji Freelance - ${member.name} (${project.projectName})`,
                amount: currentPayment.fee,
                type: TransactionType.EXPENSE,
                projectId: project.id,
                category: 'Gaji Tim / Vendor',
                method: card?.cardType === CardType.TUNAI ? 'Tunai' : pocket ? 'Sistem' : 'Kartu',
                pocketId: pocket?.id,
                cardId,
            });

            const savedPayment = persistedPayments.find(item => item.id === currentPayment.id);
            if (savedPayment) {
                setTeamProjectPayments(prev => prev.map(item => item.id === savedPayment.id ? savedPayment : item));
            }
            setTransactions(prev => [transaction, ...prev.filter(item => item.id !== transaction.id)]);
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
        } catch (error) {
            console.error('[Projects] Failed to pay team assignment:', error);
            if (paymentMarkedPaid) {
                try {
                    await updateTeamProjectPaymentsApi([currentPayment]);
                } catch (rollbackError) {
                    console.error('[Projects] Failed to restore unpaid status:', rollbackError);
                }
            }
            if (pocketDeducted && pocket) {
                try {
                    await updatePocketRow(pocket.id, { amount: pocket.amount });
                } catch (rollbackError) {
                    console.error('[Projects] Failed to restore pocket balance:', rollbackError);
                }
            }
            showNotification('Pembayaran gagal disimpan. Status fee dan saldo kantong dikembalikan.');
            return;
        }

        let slipSaved = true;
        try {
            await createTeamPaymentRecord({
                recordNumber: `PAY-FR-${member.id.slice(-4)}-${Date.now()}`,
                teamMemberId: member.id,
                date: paymentDate,
                projectPaymentIds: [currentPayment.id],
                totalAmount: currentPayment.fee,
            });
        } catch (error) {
            slipSaved = false;
            console.error('[Projects] Failed to create team payment slip:', error);
        }

        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['teamProjectPayments'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['teamPaymentRecords'] }),
        ]);
        showNotification(slipSaved
            ? `Pembayaran ${member.name} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(currentPayment.fee)} berhasil dicatat.`
            : 'Pembayaran berhasil dicatat, tetapi slip gagal disimpan. Jangan ulangi pembayaran ini.');
    }, [teamProjectPayments, teamMembers, projects, pockets, cards, setTeamProjectPayments, setTransactions, setCards, setPockets, showNotification, queryClient]);

    useEffect(() => {
        if (
            embeddedForClient &&
            projects.length === 1 &&
            !hasAutoOpenedEmbeddedProject.current
        ) {
            hasAutoOpenedEmbeddedProject.current = true;
            handleOpenDetailModal(projects[0]);
        }
    }, [embeddedForClient, projects, handleOpenDetailModal]);

    // Handle deep navigation initialAction
    useEffect(() => {
        if (initialAction && initialAction.type === 'VIEW_PROJECT_DETAILS' && initialAction.id) {
            const projectToView = projects.find(p => p.id === initialAction.id);
            if (projectToView) {
                handleOpenDetailModal(projectToView);
            }
            setInitialAction(null);
        }
    }, [initialAction, projects, setInitialAction, handleOpenDetailModal]);

    const handleSendMessage = (project: Project) => {
        const client = clients.find(c => c.id === project.clientId);
        if (!client) return;
        setChatModalData({ project, client });
    };

    const isShowingEmbeddedProjectDetail =
        embeddedForClient && isDetailModalOpen && selectedProject !== null;

    return (
        <div className="space-y-3 sm:space-y-4">
            {!isShowingEmbeddedProjectDetail && (
                <div className="flex flex-col sm:flex-row w-full items-stretch sm:items-center justify-between gap-2.5">
                    {!embeddedForClient && <div>
                        <h2 className="text-xl font-bold text-[#2A3547] tracking-tight">Acara Pernikahan</h2>
                        <p className="text-xs text-[#5A6A85] mt-0.5">Kelola progres dan operasional seluruh acara pernikahan pengantin</p>
                    </div>}
                    <button
                        onClick={() => handleOpenForm('add')}
                        className="min-h-[38px] sm:min-h-[42px] bg-[#5D87FF] hover:bg-[#4871e3] text-white font-bold px-4 py-2 rounded-xl shadow-[0_4px_12px_rgba(93,135,255,0.25)] inline-flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
                    >
                        <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                        Tambah Acara Pernikahan
                    </button>
                </div>
            )}

            {!isShowingEmbeddedProjectDetail && (
                <div className="space-y-3 sm:space-y-4">
                {!embeddedForClient && <ProjectAnalytics
                    projects={projects}
                    projectStatusConfig={profile.projectStatusConfig}
                    totals={totals}
                    onStatCardClick={setActiveStatModal}
                />}

                <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4]">
                    {/* Mobile Compact Bar: Search + Filter Toggle + View Switcher */}
                    <div className="flex sm:hidden items-center gap-2">
                        <div className="flex-1 min-w-0 relative">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 text-xs text-[#2A3547] placeholder-[#5A6A85] outline-none transition-all"
                                placeholder="Cari acara, pengantin..."
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileFiltersOpen(prev => !prev)}
                            className={`px-2.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-all ${
                                mobileFiltersOpen || dateFrom || dateTo || statusFilter !== 'all'
                                    ? 'bg-[#ECF2FF] border-[#5D87FF]/30 text-[#5D87FF]'
                                    : 'bg-[#F4F6F9] border-[#EAEFF4] text-[#5A6A85]'
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>{mobileFiltersOpen ? 'Tutup' : 'Filter'}</span>
                            {[dateFrom, dateTo, statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[9px] font-bold">
                                    {[dateFrom, dateTo, statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length}
                                </span>
                            )}
                            {mobileFiltersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <div className="p-0.5 bg-[#F4F6F9] border border-[#EAEFF4] rounded-xl flex items-center shrink-0">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'list' ? 'bg-white shadow-xs text-[#5D87FF]' : 'text-[#5A6A85]'
                                }`}
                                title="Tampilan Daftar"
                            >
                                <ListIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'kanban' ? 'bg-white shadow-xs text-[#5D87FF]' : 'text-[#5A6A85]'
                                }`}
                                title="Tampilan Kanban"
                            >
                                <LayoutGridIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Collapsible Extra Filters */}
                    {mobileFiltersOpen && (
                        <div className="sm:hidden mt-2.5 pt-2.5 border-t border-[#EAEFF4] grid grid-cols-2 gap-2 animate-fade-in">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] w-full outline-none"
                                title="Dari tanggal"
                            />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] w-full outline-none"
                                title="Sampai tanggal"
                            />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="col-span-2 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] w-full outline-none"
                            >
                                <option value="all">Semua Status</option>
                                {profile.projectStatusConfig.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Desktop / Tablet Filter Bar (Unchanged) */}
                    <div className="hidden sm:flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 md:gap-4">
                        <div className="flex-grow w-full lg:w-auto relative">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2.5 text-xs sm:text-sm text-[#2A3547] placeholder-[#5A6A85] outline-none transition-all"
                                placeholder="Cari acara pernikahan (nama, pengantin, lokasi)..."
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <CalendarIcon className="w-4 h-4 text-[#5A6A85] flex-shrink-0 hidden sm:block" />
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                        className="rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 text-xs sm:text-sm text-[#2A3547] w-full sm:w-36 outline-none transition-all"
                                        title="Dari tanggal"
                                    />
                                </div>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 text-xs sm:text-sm text-[#2A3547] w-full sm:w-36 outline-none transition-all"
                                    title="Sampai tanggal"
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2.5 text-xs sm:text-sm text-[#2A3547] w-full sm:w-44 outline-none transition-all"
                                >
                                    <option value="all">Semua Status</option>
                                    {profile.projectStatusConfig.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                                <div className="p-1 bg-[#F4F6F9] border border-[#EAEFF4] rounded-xl flex items-center h-11 sm:h-10 w-full sm:w-auto justify-center">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all h-full ${
                                            viewMode === 'list'
                                                ? 'bg-white shadow-xs text-[#5D87FF]'
                                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                                        }`}
                                        title="Tampilan Daftar"
                                    >
                                        <ListIcon className="w-4 h-4 flex-shrink-0" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all h-full ${
                                            viewMode === 'kanban'
                                                ? 'bg-white shadow-xs text-[#5D87FF]'
                                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                                        }`}
                                        title="Tampilan Kanban"
                                    >
                                        <LayoutGridIcon className="w-4 h-4 flex-shrink-0" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-white rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4] overflow-hidden">
                        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-[#EAEFF4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white">
                            <div className="flex items-center gap-1 p-1 bg-[#F4F6F9] rounded-xl border border-[#EAEFF4]">
                                <button
                                    type="button"
                                    onClick={() => setProjectListTab('active')}
                                    className={`min-h-[32px] sm:min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition-all truncate text-center ${
                                        projectListTab === 'active'
                                            ? 'bg-[#5D87FF] text-white shadow-xs'
                                            : 'text-[#5A6A85] hover:text-[#2A3547]'
                                    }`}
                                >
                                    Aktif ({activeProjects.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjectListTab('completed')}
                                    className={`min-h-[32px] sm:min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition-all truncate text-center ${
                                        projectListTab === 'completed'
                                            ? 'bg-[#5D87FF] text-white shadow-xs'
                                            : 'text-[#5A6A85] hover:text-[#2A3547]'
                                    }`}
                                >
                                    Selesai ({completedAndCancelledProjects.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjectListTab('all')}
                                    className={`min-h-[32px] sm:min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition-all truncate text-center ${
                                        projectListTab === 'all'
                                            ? 'bg-[#5D87FF] text-white shadow-xs'
                                            : 'text-[#5A6A85] hover:text-[#2A3547]'
                                    }`}
                                >
                                    Semua ({filteredProjects.length})
                                </button>
                            </div>
                            <div className="text-xs text-[#5A6A85] text-right">
                                Menampilkan <span className="font-bold text-[#2A3547]">
                                    {displayProjects.length}
                                </span> Acara
                            </div>
                        </div>
                        <ProjectListView
                            projects={displayProjects}
                            handleOpenDetailModal={handleOpenDetailModal}
                            handleOpenForm={handleOpenForm}
                            handleProjectDelete={handleProjectDelete}
                            config={profile.projectStatusConfig}
                            clients={clients}
                            handleQuickStatusChange={handleQuickStatusChange}
                            handleSendMessage={handleSendMessage}
                        />
                    </div>
                ) : (
                    <ProjectKanbanView
                        projects={filteredProjects}
                        clients={clients}
                        handleOpenDetailModal={handleOpenDetailModal}
                        draggedProjectId={draggedProjectId}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDrop={handleDrop}
                        config={profile.projectStatusConfig}
                    />
                )}
                </div>
            )}

            <ProjectForm
                isOpen={isFormModalOpen}
                onClose={handleCloseForm}
                mode={formMode}
                formData={formData}
                onFormChange={handleFormChange}
                onSubStatusChange={handleSubStatusChange}
                onClientChange={handleClientChange}
                onTeamChange={handleTeamChange}
                onTeamFeeChange={handleTeamFeeChange}
                onReplaceTeamMember={handleReplaceTeamMember}
                onTeamSubJobChange={handleTeamSubJobChange}
                onTeamClientPortalLinkChange={handleTeamClientPortalLinkChange}
                onCustomSubStatusChange={handleCustomSubStatusChange}
                onAddCustomSubStatus={addCustomSubStatus}
                onRemoveCustomSubStatus={removeCustomSubStatus}
                onSubmit={handleFormSubmit}
                clients={clients}
                teamMembers={teamMembers}
                teamProjectPayments={teamProjectPayments}
                profile={profile}
                teamByCategory={teamByCategory}
                showNotification={showNotification}
                setFormData={setFormData}
            />

            {embeddedForClient && isDetailModalOpen && selectedProject ? (
                <div className="space-y-3">
                    {projects.length > 1 && (
                        <button
                        type="button"
                        onClick={() => {
                            setIsDetailModalOpen(false);
                            setSelectedProject(null);
                        }}
                        className="inline-flex min-h-10 items-center rounded-xl border border-[#EAEFF4] bg-white px-3 py-2 text-xs font-bold text-[#5A6A85] hover:text-[#2A3547]"
                    >
                        Kembali ke daftar acara
                        </button>
                    )}
                    <ProjectDetailModal
                        selectedProject={selectedProject}
                        setSelectedProject={setSelectedProject}
                        teamMembers={teamMembers}
                        clients={clients}
                        profile={profile}
                        showNotification={showNotification}
                        setProjects={setProjects}
                        onClose={() => setIsDetailModalOpen(false)}
                        handleOpenForm={handleOpenForm}
                        handleProjectDelete={handleProjectDelete}
                        handleOpenBriefingModal={() => {
                            if (selectedProject) handleOpenBriefingModal(selectedProject);
                        }}
                        packages={packages}
                        transactions={transactions}
                        teamProjectPayments={teamProjectPayments}
                        teamPaymentRecords={teamPaymentRecords}
                        paymentInvoiceProjects={paymentInvoiceProjects ?? projects}
                        cards={cards}
                        pockets={pockets}
                        onPayTeamAssignment={handlePayTeamAssignment}
                        onOpenSharePreview={(data) => setSharePreview({ title: data.title, message: data.message, phone: data.phone })}
                        onNavigateToClient={(clientId) => {
                            setIsDetailModalOpen(false);
                            if (handleNavigation) {
                                handleNavigation('clients', { type: 'view', id: clientId });
                            } else {
                                window.location.hash = '#/clients';
                            }
                        }}
                        isEditing={isEditingProject}
                        isSaving={isSavingProject}
                        editFormData={editFormData}
                        editTeamByCategory={editTeamByCategory}
                        onEnterEditMode={enterEditMode}
                        onCancelEditMode={cancelEditMode}
                        onEditFormChange={handleEditFormChange}
                        onEditSubStatusToggle={handleEditSubStatusToggle}
                        onEditTeamChange={handleEditTeamChange}
                        onEditTeamFeeChange={handleEditTeamFeeChange}
                        onEditTeamSubJobChange={handleEditTeamSubJobChange}
                        onEditReplaceTeamMember={handleEditReplaceTeamMember}
                        onSaveEdit={handleSaveEdit}
                        sectionEditingEnabled={embeddedForClient}
                    />
                </div>
            ) : (
                <Modal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    title={`Detail Acara Pernikahan: ${selectedProject?.projectName}`}
                    size="3xl"
                >
                    <ProjectDetailModal
                    selectedProject={selectedProject}
                    setSelectedProject={setSelectedProject}
                    teamMembers={teamMembers}
                    clients={clients}
                    profile={profile}
                    showNotification={showNotification}
                    setProjects={setProjects}
                    onClose={() => setIsDetailModalOpen(false)}
                    handleOpenForm={handleOpenForm}
                    handleProjectDelete={handleProjectDelete}
                    handleOpenBriefingModal={() => {
                        if (selectedProject) handleOpenBriefingModal(selectedProject);
                    }}
                    packages={packages}
                    transactions={transactions}
                    teamProjectPayments={teamProjectPayments}
                    teamPaymentRecords={teamPaymentRecords}
                    paymentInvoiceProjects={paymentInvoiceProjects ?? projects}
                    cards={cards}
                    pockets={pockets}
                    onPayTeamAssignment={handlePayTeamAssignment}
                    onOpenSharePreview={(data) => setSharePreview({ title: data.title, message: data.message, phone: data.phone })}
                    onNavigateToClient={(clientId) => {
                        setIsDetailModalOpen(false);
                        if (handleNavigation) {
                            handleNavigation('clients', { type: 'view', id: clientId });
                        } else {
                            window.location.hash = '#/clients';
                        }
                    }}
                    isEditing={isEditingProject}
                    isSaving={isSavingProject}
                    editFormData={editFormData}
                    editTeamByCategory={editTeamByCategory}
                    onEnterEditMode={enterEditMode}
                    onCancelEditMode={cancelEditMode}
                    onEditFormChange={handleEditFormChange}
                    onEditSubStatusToggle={handleEditSubStatusToggle}
                    onEditTeamChange={handleEditTeamChange}
                    onEditTeamFeeChange={handleEditTeamFeeChange}
                    onEditTeamSubJobChange={handleEditTeamSubJobChange}
                    onEditReplaceTeamMember={handleEditReplaceTeamMember}
                    onSaveEdit={handleSaveEdit}
                    sectionEditingEnabled={embeddedForClient}
                    />
                </Modal>
            )}

            <ProjectBriefingModal
                isOpen={isBriefingModalOpen}
                onClose={handleCloseBriefingModal}
                project={briefingProject}
                briefingData={briefingData}
            />

            <ProjectStatModals
                activeStatModal={activeStatModal}
                onClose={() => setActiveStatModal(null)}
                statsForModal={statsForModal}
                allActiveProjectsForStats={allActiveProjectsForStats}
                projects={projects}
                clients={clients}
            />

            <QuickStatusModal
                isOpen={quickStatusModalOpen}
                onClose={() => {
                    setQuickStatusModalOpen(false);
                    setSelectedProjectForStatus(null);
                }}
                project={selectedProjectForStatus}
                statusConfig={profile.projectStatusConfig}
                onStatusChange={handleQuickStatusChange}
                showNotification={showNotification}
            />

            {chatModalData && (
                <ChatModal
                    isOpen={!!chatModalData}
                    onClose={() => setChatModalData(null)}
                    project={chatModalData.project}
                    client={chatModalData.client}
                    userProfile={profile}
                    onSendMessage={(_projectId, messageText) => {
                        setSharePreview({
                            title: `Bagikan Pesan - ${chatModalData.client.name}`,
                            message: messageText,
                            phone: chatModalData.client.whatsapp || chatModalData.client.phone,
                        });
                    }}
                />
            )}

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
        </div>
    );
};

export default Projects;
