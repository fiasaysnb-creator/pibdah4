import React, { useState, useMemo } from 'react';
import {
    Transaction,
    TransactionType,
    FinancialPocket,
    Profile,
    Project,
    Card,
    TeamMember,
    TeamProjectPayment,
    TeamPaymentRecord,
} from '../../types';

import { PlusIcon, DownloadIcon } from '../../constants';

import { FinanceHeaderStats } from '../../features/finance/components/FinanceHeaderStats';
import { FinanceTabs } from '../../features/finance/components/FinanceTabs';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import TransactionsTab from '../../features/finance/components/TransactionsTab';
import PocketsTab from '../../features/finance/components/PocketsTab';
import CardsTab from '../../features/finance/components/CardsTab';
import CashflowTab from '../../features/finance/components/CashflowTab';
import FinanceReportsTab from '../../features/finance/components/FinanceReportsTab';
import EventProfitabilityTab from '../../features/finance/components/EventProfitabilityTab';
import FinanceFormModal from '../../features/finance/components/FinanceFormModal';
import FinanceHistoryModal from '../../features/finance/components/FinanceHistoryModal';
import FinanceStatDetailModal from '../../features/finance/components/FinanceStatDetailModal';
import InteractiveCashflowChart from '../../shared/ui/InteractiveCashflowChart';
import CategoryBarChart from '../../features/finance/components/CategoryBarChart';

import { useFinance } from '../../features/finance/hooks/useFinance';
import { useFinanceCalculations } from '../../features/finance/hooks/useFinanceCalculations';
import { useFinanceOperations } from '../../features/finance/hooks/useFinanceOperations';
import {
    getTransactionSubDescription,
    pocketIcons
} from '../../features/finance/utils/financeHelpers';
import {
    downloadReportCSV,
    downloadTransactionsCSV,
    downloadProfitReportCSV,
    exportTransactionsToExcel,
    exportReportToExcel,
    exportProfitReportToExcel,
    exportCardsToExcel
} from '../../features/finance/utils/financeExport';
import {
    downloadReportPdf,
    buildReportFileName,
    ReportSection,
} from '../../shared/utils/reportPdf';

const formatRupiah = (amount: number): string =>
    `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0))}`;

interface FinanceProps {
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    profile: Profile;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords: TeamPaymentRecord[];
    setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
}

export type FinanceTabType =
    | 'transactions'
    | 'pockets'
    | 'cards'
    | 'cashflow'
    | 'laporan'
    | 'labaAcara Pernikahan';

// ── Small inline icon so we don't need to import a wallet icon ─────────────
const WalletIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4z" />
        <path d="M12 2v4M6 2v4" />
        <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
);

const Finance: React.FC<FinanceProps> = ({
    transactions,
    setTransactions,
    pockets,
    setPockets,
    projects,
    setProjects,
    profile,
    cards,
    setCards,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
}) => {
    const showNotification = (_message: string) => {};

    const { handleDelete, handleAddTransaction, handleUpdateTransaction } = useFinance(
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

    // ── Navigation & Modal State ─────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<FinanceTabType>('transactions');
    const [showVisualSummary, setShowVisualSummary] = useState(false);
    const [historyModalState, setHistoryModalState] = useState<{
        type: 'card' | 'pocket';
        item: Card | FinancialPocket | null;
    } | null>(null);
    const [activeStatModal, setActiveStatModal] = useState<'assets' | 'pockets' | 'income' | 'expense' | null>(null);

    // ── Filters ──────────────────────────────────────────────────────────────
    const [filters, setFilters] = useState({ searchTerm: '', dateFrom: '', dateTo: '' });
    const [categoryFilter, setCategoryFilter] = useState<{ type: TransactionType | 'all'; category: string }>({
        type: 'all',
        category: 'Semua'
    });
    const [reportFilters, setReportFilters] = useState({ client: 'all', dateFrom: '', dateTo: '' });
    const [profitReportFilters, setProfitReportFilters] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    });
    const [transactionProjectMonthFilter, setTransactionProjectMonthFilter] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [projectionMonths, setProjectionMonths] = useState<number>(6);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // ── Calculations ─────────────────────────────────────────────────────────
    const {
        cashflowChartData,
        cashflowMetrics,
        summary,
        thisMonthIncome,
        thisMonthExpense,
        monthlyBudgetPocket,
        categoryTotals,
        filteredTransactions,
        filteredSummary,
        reportClientOptions,
        reportTransactions,
        projectProfitabilityData,
        profitReportMetrics,
        generalReportMetrics,
        cardStats,
        expenseDonutData,
        incomeDonutData,
        projectionDecisionInsights
    } = useFinanceCalculations({
        transactions,
        cards,
        pockets,
        projects,
        filters,
        categoryFilter,
        reportFilters,
        profitReportFilters,
        projectionMonths
    });

    // ── Business Operations ───────────────────────────────────────────────────
    const {
        modalState,
        isSubmitting,
        form,
        setForm,
        hasMore,
        isLoadingMore,
        loadMoreTransactions,
        handleOpenModal,
        handleCloseModal,
        handleSubmit,
        handleFormChange,
        handleFilterChange,
        handleTutupAnggaran
    } = useFinanceOperations({
        transactions,
        setTransactions,
        pockets,
        setPockets,
        cards,
        setCards,
        projects,
        setProjects,
        handleAddTransaction,
        handleUpdateTransaction,
        showNotification,
        monthlyBudgetPocket,
        setFilters,
        setTransactionProjectMonthFilter
    });

    // ── Export context (hanya untuk memperkaya kolom; data sudah ter-filter per vendor) ──
    const financeExportContext = useMemo(() => ({
        companyName: profile.companyName,
        cards,
        pockets,
        projects,
        transactions
    }), [profile.companyName, cards, pockets, projects, transactions]);

    // ── CSV handlers (existing, dipertahankan) ────────────────────────────────
    const handleDownloadReportCSVClick = () =>
        downloadReportCSV(reportTransactions, reportFilters, reportClientOptions, financeExportContext);
    const handleDownloadTransactionsCSVClick = () =>
        downloadTransactionsCSV(filteredTransactions, transactions, filteredSummary, financeExportContext);
    const handleDownloadProfitReportCSVClick = () =>
        downloadProfitReportCSV(projectProfitabilityData, profitReportFilters);

    // ── Excel handlers (penyempurnaan; tombol CSV tetap ada) ──────────────────
    const handleDownloadTransactionsExcelClick = (): void => {
        void exportTransactionsToExcel(filteredTransactions, transactions, filteredSummary, financeExportContext);
    };
    const handleDownloadReportExcelClick = (): void => {
        void exportReportToExcel(reportTransactions, reportFilters, reportClientOptions, financeExportContext);
    };
    const handleDownloadProfitReportExcelClick = (): void => {
        void exportProfitReportToExcel(projectProfitabilityData, profitReportFilters, financeExportContext);
    };
    const handleDownloadCardsExcelClick = (): void => {
        void exportCardsToExcel(cards, pockets, cardStats, financeExportContext);
    };

    // ── Unduh laporan PDF (ringkasan + tabel sesuai filter tanggal) ───────────
    const financePeriodLabel = filters.dateFrom || filters.dateTo
        ? `${filters.dateFrom || '...'} s/d ${filters.dateTo || '...'}`
        : 'Semua Periode';

    const handleDownloadFinancePdf = async () => {
        if (isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const categoryRows: (string | number)[][] = [
                ...Object.entries(categoryTotals.income).map(([category, total]) => ['Pemasukan', category, total]),
                ...Object.entries(categoryTotals.expense).map(([category, total]) => ['Pengeluaran', category, total]),
            ].sort((left, right) => {
                const typeCompare = String(left[0]).localeCompare(String(right[0]));
                if (typeCompare !== 0) return typeCompare;
                return Number(right[2]) - Number(left[2]);
            });

            // ── Rekap laba per pengantin (transaksi sesuai filter tanggal) ──
            const projectById = new Map(projects.map(project => [project.id, project]));
            const clientProfitMap = new Map<string, { name: string; income: number; expense: number; projectIds: Set<string> }>();
            filteredTransactions.forEach(transaction => {
                if (!transaction.projectId) return;
                const project = projectById.get(transaction.projectId);
                if (!project) return;
                const entry = clientProfitMap.get(project.clientId) || {
                    name: project.clientName || project.projectName || 'Tanpa Pengantin',
                    income: 0,
                    expense: 0,
                    projectIds: new Set<string>(),
                };
                if (transaction.type === TransactionType.INCOME) entry.income += transaction.amount;
                else entry.expense += transaction.amount;
                entry.projectIds.add(project.id);
                clientProfitMap.set(project.clientId, entry);
            });

            const profitClients = Array.from(clientProfitMap.values())
                .sort((left, right) => (right.income - right.expense) - (left.income - left.expense));
            const profitRows: (string | number)[][] = profitClients.map(entry => [
                entry.name,
                entry.projectIds.size,
                entry.income,
                entry.expense,
                entry.income - entry.expense,
            ]);
            const profitTotals = profitClients.reduce((acc, entry) => ({
                events: acc.events + entry.projectIds.size,
                income: acc.income + entry.income,
                expense: acc.expense + entry.expense,
            }), { events: 0, income: 0, expense: 0 });
            profitRows.push([
                `TOTAL (${profitClients.length} pengantin)`,
                profitTotals.events,
                profitTotals.income,
                profitTotals.expense,
                profitTotals.income - profitTotals.expense,
            ]);

            // ── Rekap saldo akun (kartu & kantong) ──
            const accountRows: (string | number)[][] = [
                ...cards.map(card => [
                    `${card.bankName}${card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ''}`,
                    `Kartu ${card.cardType}`,
                    Number(card.balance) || 0,
                ]),
                ...pockets.map(pocket => [pocket.name, `Kantong ${pocket.type}`, Number(pocket.amount) || 0]),
            ];

            const sections: ReportSection[] = [
                {
                    title: 'Daftar Transaksi',
                    columns: [
                        { header: 'Tanggal', width: 1.1 },
                        { header: 'Keterangan', width: 2.4 },
                        { header: 'Kategori', width: 1.4 },
                        { header: 'Tipe', width: 0.9 },
                        { header: 'Jumlah', width: 1.5, isCurrency: true, tone: 'auto' },
                    ],
                    rows: filteredTransactions.map(transaction => [
                        transaction.date ? new Date(transaction.date).toLocaleDateString('id-ID') : '-',
                        transaction.description || '-',
                        transaction.category || '-',
                        transaction.type === TransactionType.INCOME ? 'Masuk' : 'Keluar',
                        transaction.type === TransactionType.INCOME ? transaction.amount : -transaction.amount,
                    ]),
                    emptyText: 'Tidak ada transaksi pada periode ini.',
                },
                {
                    title: 'Ringkasan per Kategori',
                    columns: [
                        { header: 'Tipe', width: 1.1 },
                        { header: 'Kategori', width: 2.4 },
                        { header: 'Total', width: 1.5, isCurrency: true },
                    ],
                    rows: categoryRows,
                    emptyText: 'Belum ada data kategori.',
                },
                {
                    title: 'Rekap Laba per Pengantin',
                    columns: [
                        { header: 'Pengantin', width: 2 },
                        { header: 'Acara', width: 0.8, align: 'right' },
                        { header: 'Pemasukan', width: 1.5, isCurrency: true, tone: 'positive' },
                        { header: 'Pengeluaran', width: 1.5, isCurrency: true, tone: 'negative' },
                        { header: 'Laba Bersih', width: 1.5, isCurrency: true, tone: 'auto' },
                    ],
                    rows: profitRows,
                    emptyText: 'Belum ada transaksi proyek pada periode ini.',
                },
                {
                    title: 'Rekap Saldo Akun & Kantong',
                    columns: [
                        { header: 'Nama Akun', width: 2.4 },
                        { header: 'Tipe', width: 1.6 },
                        { header: 'Saldo', width: 1.6, isCurrency: true },
                    ],
                    rows: accountRows,
                    emptyText: 'Belum ada akun atau kantong terdaftar.',
                },
            ];

            const periodKey = filters.dateFrom || filters.dateTo
                ? `${filters.dateFrom || 'awal'}_${filters.dateTo || 'akhir'}`
                : 'semua-periode';

            await downloadReportPdf({
                title: 'Laporan Keuangan',
                subtitle: profile.companyName,
                periodLabel: financePeriodLabel,
                profile,
                filename: buildReportFileName('Laporan-Keuangan', periodKey),
                summaryCards: [
                    { label: 'Total Pemasukan', value: formatRupiah(filteredSummary.income), tone: 'positive' },
                    { label: 'Total Pengeluaran', value: formatRupiah(filteredSummary.expense), tone: 'negative' },
                    {
                        label: 'Laba Bersih',
                        value: formatRupiah(filteredSummary.net),
                        tone: filteredSummary.net >= 0 ? 'positive' : 'negative',
                    },
                    { label: 'Jumlah Transaksi', value: String(filteredTransactions.length) },
                ],
                sections,
                footerNote: `Dibuat otomatis oleh sistem pada ${new Date().toLocaleString('id-ID')}.`,
            });
        } catch (error) {
            console.error('[FinancePage] Gagal membuat laporan PDF:', error);
        } finally {
            setIsExportingPdf(false);
        }
    };

    // ── Tab content ───────────────────────────────────────────────────────────
    const renderTabContent = () => {
        switch (activeTab) {
            case 'transactions':
                return (
                    <TransactionsTab
                        monthlyBudgetPocket={monthlyBudgetPocket}
                        onTutupAnggaran={handleTutupAnggaran}
                        categoryTotals={categoryTotals}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        handleDownloadTransactionsCSV={handleDownloadTransactionsCSVClick}
                        handleDownloadTransactionsExcel={handleDownloadTransactionsExcelClick}
                        filteredSummary={filteredSummary}
                        filteredTransactions={filteredTransactions}
                        getTransactionSubDescription={(t) => getTransactionSubDescription(t, cards, pockets, projects)}
                        onOpenModal={handleOpenModal}
                        onDeleteTransaction={(id) => handleDelete('transaction', id)}
                        hasMore={hasMore}
                        loadMoreTransactions={loadMoreTransactions}
                        isLoadingMore={isLoadingMore}
                    />
                );
            case 'pockets':
                return (
                    <PocketsTab
                        pockets={pockets}
                        cards={cards}
                        summary={summary}
                        onOpenModal={handleOpenModal}
                        onDeletePocket={(id) => handleDelete('pocket', id)}
                        onViewHistory={(p) => setHistoryModalState({ type: 'pocket', item: p })}
                    />
                );
            case 'cards':
                return (
                    <CardsTab
                        cards={cards}
                        pockets={pockets}
                        cardStats={cardStats}
                        onOpenModal={handleOpenModal}
                        onDeleteCard={(id) => handleDelete('card', id)}
                        onViewHistory={(card) => setHistoryModalState({ type: 'card', item: card })}
                        handleDownloadCardsExcel={handleDownloadCardsExcelClick}
                    />
                );
            case 'cashflow':
                return (
                    <CashflowTab
                        cashflowMetrics={cashflowMetrics}
                        filteredSummary={filteredSummary}
                        cashflowChartData={cashflowChartData}
                        expenseDonutData={expenseDonutData}
                        incomeDonutData={incomeDonutData}
                        decisionInsights={projectionDecisionInsights}
                        projectionMonths={projectionMonths}
                        onProjectionMonthsChange={setProjectionMonths}
                    />
                );
            case 'laporan':
                return (
                    <FinanceReportsTab
                        reportFilters={reportFilters}
                        setReportFilters={setReportFilters}
                        reportClientOptions={reportClientOptions}
                        handleDownloadReportCSV={handleDownloadReportCSVClick}
                        handleDownloadReportExcel={handleDownloadReportExcelClick}
                        generalReportMetrics={generalReportMetrics}
                        reportTransactions={reportTransactions}
                        profile={profile}
                        projects={projects}
                        onEditTransaction={(t) => handleOpenModal('transaction', 'edit', t)}
                        onDeleteTransaction={(id) => handleDelete('transaction', id)}
                        onAddTransaction={() => handleOpenModal('transaction', 'add')}
                    />
                );
            case 'labaAcara Pernikahan':
                return (
                    <EventProfitabilityTab
                        profitReportFilters={profitReportFilters}
                        setProfitReportFilters={setProfitReportFilters}
                        profitReportMetrics={profitReportMetrics}
                        projectProfitabilityData={projectProfitabilityData}
                        projects={projects}
                        profile={profile}
                        handleDownloadProfitReportCSV={handleDownloadProfitReportCSVClick}
                        handleDownloadProfitReportExcel={handleDownloadProfitReportExcelClick}
                    />
                );
            default:
                return null;
        }
    };

    // ── All-time totals for header stat cards ────────────────────────────────
    const allTimeTotals = useMemo(() => {
        const income = transactions
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense };
    }, [transactions]);

    // ── Derived values for summary panel ─────────────────────────────────────
    const netThisMonth = summary.totalIncomeThisMonth - summary.totalExpenseThisMonth;

    return (
        <div className="space-y-5">

            {/* ── Page header bar ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 non-printable">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ECF2FF] border border-[#d8e6ff]
                                    flex items-center justify-center flex-shrink-0 shadow-xs">
                        <WalletIcon className="w-5 h-5 text-[#5D87FF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#2A3547] leading-tight">Keuangan</h1>
                        <p className="text-xs text-[#5A6A85] font-medium leading-tight hidden sm:block">
                            {transactions.length} transaksi &middot; {cards.length} kartu &middot; {pockets.length} kantong
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadFinancePdf}
                        disabled={isExportingPdf}
                        className="bg-white hover:bg-[#F4F6F9] text-[#2A3547] font-bold rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm border border-[#EAEFF4] inline-flex items-center gap-1.5 transition-all disabled:opacity-60"
                    >
                        <DownloadIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{isExportingPdf ? 'Menyiapkan...' : 'Unduh PDF'}</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal('transaction', 'add')}
                        className="bg-[#5D87FF] hover:bg-[#4871e3] text-white font-bold rounded-xl px-4 py-2.5 text-xs sm:text-sm shadow-md shadow-[#5D87FF]/25 inline-flex items-center gap-1.5 transition-all"
                    >
                        <PlusIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Tambah Transaksi</span>
                        <span className="sm:hidden">+ Transaksi</span>
                    </button>
                </div>
            </div>

            {/* ── Stat cards ───────────────────────────────────────────────── */}
            <FinanceHeaderStats summary={summary} allTimeTotals={allTimeTotals} setActiveStatModal={setActiveStatModal} />

            {/* ── Tab bar (shared desktop + mobile) ────────────────────────── */}
            <FinanceTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showVisualSummary={showVisualSummary}
                setShowVisualSummary={setShowVisualSummary}
            />

            {/* ── Visual summary panel (real content, collapsible) ─────────── */}
            {showVisualSummary && (
                <div className="rounded-2xl border border-[#EAEFF4] bg-white shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] overflow-hidden animate-fade-in non-printable">
                    {/* Panel header */}
                    <div className="px-5 py-3.5 border-b border-[#EAEFF4] flex items-center justify-between">
                        <h3 className="font-bold text-[#2A3547] text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#5D87FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Ringkasan Visual
                        </h3>
                        {/* Quick KPI strip */}
                        <div className="hidden sm:flex items-center gap-4 text-xs">
                            <span className="text-[#5A6A85] font-medium">Bulan ini:</span>
                            <span className="font-bold text-[#166534]">
                                +{new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(summary.totalIncomeThisMonth)}
                            </span>
                            <span className="font-bold text-[#DC2626]">
                                -{new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(summary.totalExpenseThisMonth)}
                            </span>
                            <span className={`font-bold ${netThisMonth >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                Net: {new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(netThisMonth)}
                            </span>
                        </div>
                    </div>

                    {/* Chart grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#EAEFF4]">
                            {/* Cashflow bar+line chart — takes 2/3 */}
                            <div className="lg:col-span-2 p-4 md:p-5">
                                <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                    Arus Kas Bulanan
                                </h4>
                                <InteractiveCashflowChart data={cashflowChartData} />
                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-3 text-xs text-[#5A6A85] font-medium">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#13DEB9]"></span>Pemasukan</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FA896B]"></span>Pengeluaran</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-[#FFAE1F]"></span>Saldo</span>
                                </div>
                            </div>

                            {/* Category bar charts — takes 1/3, split in two */}
                            <div className="p-4 md:p-5 flex flex-col gap-6">
                                <div>
                                    <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                        Pemasukan per Kategori
                                    </h4>
                                    <div className="max-h-36 overflow-y-auto pr-1">
                                        <CategoryBarChart data={incomeDonutData} compact />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                        Pengeluaran per Kategori
                                    </h4>
                                    <div className="max-h-36 overflow-y-auto pr-1">
                                        <CategoryBarChart data={expenseDonutData} compact />
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* Monthly cashflow mini-table */}
                    {cashflowChartData.length > 0 && (
                        <div className="border-t border-[#EAEFF4]">
                            <div className="px-5 py-3 flex items-center justify-between">
                                <p className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider">
                                    Data Bulanan
                                </p>
                                <p className="text-xs text-[#5A6A85] font-medium">{cashflowChartData.length} bulan</p>
                            </div>
                            <div className="overflow-x-auto max-h-48">
                                <table className="w-full text-xs !border-0">
                                    <thead>
                                        <tr className="bg-[#F4F6F9] text-[#5A6A85]">
                                            <th className="px-4 py-2.5 text-left font-bold !border-0 border-b border-[#EAEFF4]">Periode</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Masuk</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Keluar</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Net</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...cashflowChartData].reverse().map((d) => {
                                            const net = d.income - d.expense;
                                            const fmt = (n: number) =>
                                                new Intl.NumberFormat('id-ID', {
                                                    notation: 'compact', style: 'currency',
                                                    currency: 'IDR', minimumFractionDigits: 0
                                                }).format(n);
                                            return (
                                                <tr key={d.label} className="border-t border-[#EAEFF4] hover:bg-[#F4F6F9]/60 transition-colors">
                                                    <td className="px-4 py-2 font-bold text-[#2A3547] !border-0">{d.label}</td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#166534] !border-0">{fmt(d.income)}</td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#DC2626] !border-0">{fmt(d.expense)}</td>
                                                    <td className={`px-4 py-2 text-right font-bold !border-0 ${net >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                                        {net >= 0 ? '+' : ''}{fmt(net)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#2A3547] !border-0">{fmt(d.balance)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab content ──────────────────────────────────────────────── */}
            <div className="widget-animate">
                {renderTabContent()}
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            <FinanceFormModal
                modalState={modalState}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                form={form}
                setForm={setForm}
                handleFormChange={handleFormChange}
                isSubmitting={isSubmitting}
                profile={profile}
                cards={cards}
                pockets={pockets}
                projects={projects}
                transactionProjectMonthFilter={transactionProjectMonthFilter}
                setTransactionProjectMonthFilter={setTransactionProjectMonthFilter}
                pocketIcons={pocketIcons}
            />

            <FinanceHistoryModal
                historyModalState={historyModalState}
                onClose={() => setHistoryModalState(null)}
                transactions={transactions}
                cards={cards}
            />

            <FinanceStatDetailModal
                activeStatModal={activeStatModal}
                onClose={() => setActiveStatModal(null)}
                cards={cards}
                pockets={pockets}
                thisMonthIncome={thisMonthIncome}
                thisMonthExpense={thisMonthExpense}
            />
        </div>
    );
};

export default Finance;
