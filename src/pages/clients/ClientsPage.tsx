import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    PlusIcon,
    UsersIcon,
    AlertCircleIcon,
    TrendingUpIcon,
    DownloadIcon,
} from '../../constants';
import {
    Client,
    Project,
    Package,
    AddOn,
    Transaction,
    Profile,
    NavigationAction,
    Card,
    FinancialPocket,
    ViewType,
    ClientFeedback,
    PromoCode,
    Notification,
    ClientStatus,
    TeamMember,
    TeamProjectPayment,
    TeamPaymentRecord,
    TransactionType,
} from '../../types';
import Modal from '../../shared/ui/Modal';
import DonutChart from '../../shared/ui/DonutChart';
import ClientForm from '../../features/clients/components/ClientForm';
import ClientDetailModal from '../../features/clients/components/ClientDetailModal';
import BillingChatModal from '../../features/clients/components/BillingChatModal';
import NewClientsChart from '../../features/clients/components/NewClientsChart';
import { useClients } from '../../features/clients/hooks/useClients';
import { ensureOnlineOrNotify } from '../../features/clients/utils/clientHelpers';
import { exportClientsToExcel } from '../../features/clients/utils/clientExport';
import { deleteProject as deleteProjectRow, updateProject as updateProjectInDb } from '../../services/projects';
import { updateTransaction as updateTransactionInDb } from '../../services/transactions';
import { toPublicNameSlug } from '../../utils/publicRouting';

// Modular Components
import ClientStatsCards, { StatModalType } from '../../features/clients/components/ClientStatsCards';
import ClientFilterBar from '../../features/clients/components/ClientFilterBar';
import { ClientTableView, ClientTabType } from '../../features/clients/components/ClientTableView';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import ClientDuesView from '../../features/clients/components/ClientDuesView';
import ClientFinanceRecapView from '../../features/clients/components/ClientFinanceRecapView';
import ClientDocumentModal from '../../features/clients/components/ClientDocumentModal';
import ClientTransactionEditModal from '../../features/clients/components/ClientTransactionEditModal';
import ClientQrShareModals from '../../features/clients/components/ClientQrShareModals';

// Custom Hooks
import { useClientDocumentActions, DocumentToView } from '../../features/clients/hooks/useClientDocumentActions';
import { useClientPaymentOperations } from '../../features/clients/hooks/useClientPaymentOperations';
import { useClientFormHandler } from '../../features/clients/hooks/useClientFormHandler';
import {
    buildReportPdf,
    buildReportFileName,
    ReportSection,
    ReportPdfInput,
} from '../../shared/utils/reportPdf';
import PdfPreviewModal from '../../shared/ui/PdfPreviewModal';

const formatRupiah = (amount: number): string =>
    `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0))}`;

const formatMonthLabel = (key: string): string => {
    const [year, month] = key.split('-').map(Number);
    if (!year || !month) return '';
    return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

interface ClientsProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    packages: Package[];
    addOns: AddOn[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    userProfile: Profile;
    showNotification: (message: string) => void;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords?: TeamPaymentRecord[];
    handleNavigation: (view: ViewType, action: NavigationAction) => void;
    clientFeedback: ClientFeedback[];
    promoCodes: PromoCode[];
    setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    onSignInvoice: (projectId: string, signatureDataUrl: string) => void;
    onSignTransaction: (transactionId: string, signatureDataUrl: string) => void;
    onRecordPayment: (projectId: string, amount: number, destinationCardId: string, proofUrl?: string) => Promise<void>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
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

export const Clients: React.FC<ClientsProps> = ({
    clients,
    setClients,
    projects,
    setProjects,
    packages,
    addOns,
    transactions,
    setTransactions,
    userProfile,
    showNotification,
    initialAction,
    setInitialAction,
    cards,
    setCards,
    pockets,
    setPockets,
    teamMembers,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords = [],
    handleNavigation,
    promoCodes,
    setPromoCodes,
    onSignInvoice,
    onSignTransaction,
    addNotification,
    totals,
}) => {
    const {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        monthFilter,
        setMonthFilter,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        allClientData,
        filteredClientData,
        clientStats,
        handleDeleteClient,
    } = useClients(
        clients,
        setClients,
        projects,
        setProjects,
        transactions,
        setTransactions,
        showNotification,
        cards,
        setCards,
        totals
    );

    // Navigation and View Section States
    const [activeViewSection, setActiveViewSection] = useState<'clients' | 'dues' | 'analytics' | 'finance-recap'>('clients');
    const [clientTab, setClientTab] = useState<ClientTabType>('this-month');
    const [activeStatModal, setActiveStatModal] = useState<StatModalType>(null);
    const [showAllDues, setShowAllDues] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);

    // Detail & Document States
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [clientForDetail, setClientForDetail] = useState<Client | null>(null);
    const [billingChatModal, setBillingChatModal] = useState<Client | null>(null);
    const [documentToView, setDocumentToView] = useState<DocumentToView | null>(null);

    // Sharing Modals States
    const [qrModalContent, setQrModalContent] = useState<{
        title: string;
        url: string;
        clientName?: string;
        clientPhone?: string;
    } | null>(null);
    const [sharePreview, setSharePreview] = useState<{
        title: string;
        message: string;
        phone?: string;
    } | null>(null);

    // Document Actions Hook (PDF, WhatsApp, Signature)
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
        onSignInvoice,
        onSignTransaction,
        onRemoveInvoiceSignature: async (projectId) => {
            setProjects((prev) =>
                prev.map((p) => (p.id === projectId ? { ...p, invoiceSignature: undefined } : p)),
            );
            try {
                await updateProjectInDb(projectId, { invoiceSignature: null } as any);
            } catch (e) {
                console.warn('[ClientsPage] Failed to remove invoice signature:', e);
            }
        },
        onRemoveTransactionSignature: async (txId) => {
            setTransactions((prev) =>
                prev.map((t) => (t.id === txId ? { ...t, vendorSignature: undefined } : t)),
            );
            try {
                await updateTransactionInDb(txId, { vendorSignature: null } as any);
            } catch (e) {
                console.warn('[ClientsPage] Failed to remove transaction signature:', e);
            }
        },
        setSharePreview,
    });

    // Payment Operations Hook (Record Payment, Edit Transaction, Sync Cards)
    const {
        isTransactionEditModalOpen,
        setIsTransactionEditModalOpen,
        txFormData,
        setTxFormData,
        handleOpenEditTransaction,
        handleUpdateTransaction,
        handleRecordPayment,
    } = useClientPaymentOperations({
        projects,
        setProjects,
        transactions,
        setTransactions,
        cards,
        setCards,
        showNotification,
        addNotification,
        documentToView,
        setDocumentToView,
    });

    // Form Handling Hook (Client & Project modal add/edit)
    const {
        isModalOpen,
        modalMode,
        selectedClient,
        formData,
        setFormData,
        handleOpenModal,
        handleCloseModal,
        handleFormChange,
        handleFormSubmit,
    } = useClientFormHandler({
        clients,
        setClients,
        projects,
        setProjects,
        packages,
        addOns,
        transactions,
        setTransactions,
        cards,
        setCards,
        promoCodes,
        setPromoCodes,
        userProfile,
        showNotification,
        clientForDetail,
        setClientForDetail,
        documentToView,
        setDocumentToView,
        setIsSignatureModalOpen,
    });

    // Handle incoming deep navigation actions
    useEffect(() => {
        if (initialAction && initialAction.type === 'VIEW_CLIENT_DETAILS' && initialAction.id) {
            const clientToView = clients.find(c => c.id === initialAction.id);
            if (clientToView) {
                setClientForDetail(clientToView);
                setIsDetailModalOpen(true);
            }
            setInitialAction(null);
        } else if (initialAction && initialAction.type === 'EDIT_CLIENT' && initialAction.id) {
            const clientToEdit = clients.find(c => c.id === initialAction.id);
            if (clientToEdit) {
                const clientProj =
                    projects.find(p => p.clientId === clientToEdit.id) || (clientToEdit as any).mostRecentProject;
                handleOpenModal('edit', clientToEdit, clientProj);
            }
            setInitialAction(null);
        }
    }, [initialAction, clients, projects, setInitialAction]);

    // Konteks export: nama perusahaan.
    const exportContext = useMemo(
        () => ({ companyName: userProfile.companyName }),
        [userProfile.companyName],
    );

    const handleDownloadExcel = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await exportClientsToExcel(
                filteredClientData,
                transactions,
                teamProjectPayments,
                exportContext,
            );
        } catch (error) {
            console.error('[ClientsPage] Gagal membuat file Excel:', error);
            showNotification('Gagal membuat file Excel. Silakan coba lagi.');
        } finally {
            setIsExporting(false);
        }
    };

    // ── Unduh laporan PDF Data Pengantin (ringkasan + tabel sesuai filter bulan) ──
    // Membangun ReportPdfInput dari data reaktif saat ini (sync, tidak ada I/O).
    const buildPengantinPdfInput = useCallback((): ReportPdfInput => {
        const eventRows = filteredClientData
            .flatMap(client =>
                client.projects.map(project => [
                    project.date ? new Date(project.date).toLocaleDateString('id-ID') : '-',
                    client.name,
                    project.projectName || '-',
                    project.location || '-',
                    project.packageName || '-',
                    project.totalCost || 0,
                    project.paymentStatus || '-',
                ]),
            )
            .sort((left, right) => String(left[0]).localeCompare(String(right[0])));

        const totalProjectValue = filteredClientData.reduce((sum, client) => sum + client.totalProjectValue, 0);
        const totalBalanceDue = filteredClientData.reduce((sum, client) => sum + client.balanceDue, 0);

        const projectMetaById = new Map<string, { clientId: string; clientName: string; projectName: string }>();
        filteredClientData.forEach(client => {
            client.projects.forEach(project => {
                projectMetaById.set(project.id, {
                    clientId: client.id,
                    clientName: client.name,
                    projectName: project.projectName || project.packageName || 'Acara',
                });
            });
        });

        const ledgerEntries: {
            date: string;
            clientId: string;
            clientName: string;
            projectName: string;
            direction: 'Masuk' | 'Keluar';
            category: string;
            description: string;
            amount: number;
        }[] = [];

        transactions.forEach(transaction => {
            if (!transaction.projectId) return;
            const meta = projectMetaById.get(transaction.projectId);
            if (!meta) return;
            const isIncome = transaction.type === TransactionType.INCOME;
            if (!isIncome && (transaction.category || '').toLowerCase().includes('gaji tim / vendor')) return;
            ledgerEntries.push({
                date: transaction.date,
                clientId: meta.clientId,
                clientName: meta.clientName,
                projectName: meta.projectName,
                direction: isIncome ? 'Masuk' : 'Keluar',
                category: transaction.category || (isIncome ? 'Pembayaran Klien' : 'Biaya Acara'),
                description: transaction.description || '-',
                amount: isIncome ? transaction.amount : -transaction.amount,
            });
        });

        teamProjectPayments.forEach(payment => {
            const meta = projectMetaById.get(payment.projectId);
            if (!meta) return;
            ledgerEntries.push({
                date: payment.date,
                clientId: meta.clientId,
                clientName: meta.clientName,
                projectName: meta.projectName,
                direction: 'Keluar',
                category: 'Pembayaran Tim / Vendor',
                description: payment.role ? `${payment.teamMemberName} (${payment.role})` : payment.teamMemberName,
                amount: -payment.fee,
            });
        });

        ledgerEntries.sort((left, right) => {
            const dateDiff = new Date(left.date).getTime() - new Date(right.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return left.clientName.localeCompare(right.clientName);
        });

        const ledgerByClient = new Map<string, { income: number; expense: number }>();
        ledgerEntries.forEach(entry => {
            const totals = ledgerByClient.get(entry.clientId) || { income: 0, expense: 0 };
            if (entry.amount >= 0) totals.income += entry.amount;
            else totals.expense += Math.abs(entry.amount);
            ledgerByClient.set(entry.clientId, totals);
        });

        const recapRows: (string | number)[][] = filteredClientData.map(client => {
            const totals = ledgerByClient.get(client.id) || { income: 0, expense: 0 };
            return [
                client.name,
                client.projects.length,
                totals.income,
                totals.expense,
                totals.income - totals.expense,
                client.balanceDue,
            ];
        });
        const recapTotals = recapRows.reduce(
            (acc, row) => ({
                income: acc.income + Number(row[2]),
                expense: acc.expense + Number(row[3]),
                net: acc.net + Number(row[4]),
                balance: acc.balance + Number(row[5]),
            }),
            { income: 0, expense: 0, net: 0, balance: 0 },
        );
        recapRows.push([
            `TOTAL (${filteredClientData.length} pengantin)`,
            filteredClientData.reduce((sum, client) => sum + client.projects.length, 0),
            recapTotals.income,
            recapTotals.expense,
            recapTotals.net,
            recapTotals.balance,
        ]);

        type LedgerEntry = (typeof ledgerEntries)[number];
        const packageIdSet = new Set((packages || []).map(pkg => pkg.id));
        const expensesByClient = new Map<string, LedgerEntry[]>();
        ledgerEntries.forEach(entry => {
            if (entry.amount >= 0) return;
            const list = expensesByClient.get(entry.clientId) || [];
            list.push(entry);
            expensesByClient.set(entry.clientId, list);
        });

        const weddingRows: (string | number)[][] = filteredClientData
            .map(client => {
                const totals = ledgerByClient.get(client.id) || { income: 0, expense: 0 };
                const eventDate = client.mostRecentProject?.date || client.since || '';
                const eventTime = eventDate ? new Date(eventDate).getTime() : 0;

                const packageLines: string[] = [];
                client.projects.forEach(project => {
                    if (client.projects.length > 1) {
                        packageLines.push(`— ${project.projectName || project.packageName || 'Acara'}`);
                    }
                    const selectedAddOns = (project.addOns || []).filter(item => item && (item.name || item.id));
                    const additionalPackages = project.additionalPackages?.length
                        ? project.additionalPackages
                        : selectedAddOns.filter(item => item.id && packageIdSet.has(item.id) && item.id !== project.packageId);
                    const additionalPackageIds = new Set(additionalPackages.map(item => item.id));
                    const regularAddOns = selectedAddOns.filter(item =>
                        (!item.id || !packageIdSet.has(item.id)) && !additionalPackageIds.has(item.id),
                    );
                    const customCosts = project.customCosts || [];
                    const customTotal = customCosts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                    const additionalTotal = additionalPackages.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                    const addOnTotal = regularAddOns.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                    const transportCost = Number(project.transportCost) || 0;
                    const printingCost = Number(project.printingCost) || 0;
                    const primaryTotal = project.totalCost - customTotal - additionalTotal - addOnTotal - transportCost - printingCost;

                    packageLines.push(`Paket utama · ${project.packageName || 'Paket'}  ${formatRupiah(primaryTotal)}`);
                    additionalPackages.forEach(item => packageLines.push(
                        `Paket tambahan · ${item.name || (packages || []).find(pkg => pkg.id === item.id)?.name || 'Paket'}  ${formatRupiah(Number(item.price) || 0)}`,
                    ));
                    regularAddOns.forEach(item => packageLines.push(
                        `Add-on · ${item.name || 'Tambahan'}  ${formatRupiah(Number(item.price) || 0)}`,
                    ));
                    if (printingCost > 0) packageLines.push(`Produksi fisik  ${formatRupiah(printingCost)}`);
                    if (transportCost > 0) packageLines.push(`Transport  ${formatRupiah(transportCost)}`);
                    customCosts.forEach(item => packageLines.push(
                        `${item.description || 'Biaya tambahan'}  ${formatRupiah(Number(item.amount) || 0)}`,
                    ));
                });

                const expenseLines = (expensesByClient.get(client.id) || []).map(entry => {
                    const suffix = entry.projectName ? `(${entry.projectName})` : '';
                    let label = entry.description && entry.description !== '-' ? entry.description : entry.category;
                    const trimmed = label.trim();
                    if (suffix && trimmed.endsWith(suffix)) {
                        label = trimmed.slice(0, -suffix.length).replace(/[\s\-–—]+$/, '').trim() || label;
                    }
                    return `${label}  ${formatRupiah(Math.abs(entry.amount))}`;
                });
                if (expenseLines.length) expenseLines.push(`Total ${formatRupiah(totals.expense)}`);

                return {
                    eventTime,
                    row: [
                        eventDate ? new Date(eventDate).toLocaleDateString('id-ID') : '-',
                        client.name,
                        packageLines.length ? packageLines.join('\n') : 'Belum ada paket',
                        expenseLines.length ? expenseLines.join('\n') : 'Tanpa pengeluaran',
                        totals.income - totals.expense,
                    ] as (string | number)[],
                };
            })
            .sort((left, right) => left.eventTime - right.eventTime)
            .map(entry => entry.row);

        weddingRows.push([
            '',
            `TOTAL (${filteredClientData.length} pengantin)`,
            '',
            `Total ${formatRupiah(recapTotals.expense)}`,
            recapTotals.net,
        ]);

        const sections: ReportSection[] = [
            {
                title: 'Daftar Pengantin',
                columns: [
                    { header: 'Nama', width: 2 },
                    { header: 'Telepon', width: 1.4 },
                    { header: 'Status', width: 1 },
                    { header: 'Paket Terbaru', width: 2 },
                    { header: 'Nilai Proyek', width: 1.4, isCurrency: true, tone: 'positive' },
                    { header: 'Sisa Bayar', width: 1.4, isCurrency: true, tone: 'negative' },
                ],
                rows: filteredClientData.map(client => [
                    client.name,
                    client.whatsapp || client.phone || '-',
                    client.status,
                    client.PackageTerbaru || '-',
                    client.totalProjectValue,
                    client.balanceDue,
                ]),
                emptyText: 'Tidak ada pengantin pada periode ini.',
            },
            {
                title: 'Tabel Pengantin: Tanggal, Paket, Pengeluaran & Laba',
                columns: [
                    { header: 'Tanggal', width: 0.85 },
                    { header: 'Nama Pengantin', width: 1.25 },
                    { header: 'Rincian Paket yang Diambil', width: 3.2 },
                    { header: 'Total Rincian Pengeluaran', width: 2.9, align: 'left', tone: 'negative' },
                    { header: 'Laba Bersih', width: 1.2, isCurrency: true, tone: 'auto' },
                ],
                rows: weddingRows,
                emptyText: 'Tidak ada pengantin pada periode ini.',
            },
            {
                title: 'Daftar Acara Pernikahan',
                columns: [
                    { header: 'Tanggal', width: 1.1 },
                    { header: 'Pengantin', width: 1.8 },
                    { header: 'Nama Acara', width: 1.8 },
                    { header: 'Lokasi', width: 1.6 },
                    { header: 'Paket', width: 1.4 },
                    { header: 'Nilai', width: 1.3, isCurrency: true, tone: 'positive' },
                    { header: 'Status', width: 1 },
                ],
                rows: eventRows,
                emptyText: 'Tidak ada acara pernikahan pada periode ini.',
            },
            {
                title: 'Rincian Transaksi Kas per Pengantin',
                columns: [
                    { header: 'Tanggal', width: 1 },
                    { header: 'Pengantin', width: 1.5 },
                    { header: 'Acara', width: 1.6 },
                    { header: 'Tipe', width: 0.7 },
                    { header: 'Kategori', width: 1.3 },
                    { header: 'Keterangan', width: 2.2 },
                    { header: 'Jumlah', width: 1.3, isCurrency: true, tone: 'auto' },
                ],
                rows: ledgerEntries.map(entry => [
                    entry.date ? new Date(entry.date).toLocaleDateString('id-ID') : '-',
                    entry.clientName,
                    entry.projectName,
                    entry.direction,
                    entry.category,
                    entry.description,
                    entry.amount,
                ]),
                emptyText: 'Belum ada transaksi kas untuk pengantin pada periode ini.',
            },
            {
                title: 'Rekap Keuangan per Pengantin',
                columns: [
                    { header: 'Pengantin', width: 2 },
                    { header: 'Acara', width: 0.8, align: 'right' },
                    { header: 'Kas Masuk', width: 1.4, isCurrency: true, tone: 'positive' },
                    { header: 'Kas Keluar', width: 1.4, isCurrency: true, tone: 'negative' },
                    { header: 'Laba Bersih', width: 1.4, isCurrency: true, tone: 'auto' },
                    { header: 'Sisa Bayar', width: 1.4, isCurrency: true, tone: 'negative' },
                ],
                rows: recapRows,
                emptyText: 'Belum ada data keuangan pengantin pada periode ini.',
            },
        ];

        return {
            title: 'Laporan Data Pengantin',
            subtitle: userProfile.companyName,
            periodLabel: monthFilter ? formatMonthLabel(monthFilter) : 'Semua Periode',
            profile: userProfile,
            filename: buildReportFileName('Laporan-Data-Pengantin', monthFilter || 'semua-periode'),
            summaryCards: [
                { label: 'Total Pengantin', value: String(filteredClientData.length) },
                { label: 'Nilai Proyek', value: formatRupiah(totalProjectValue) },
                {
                    label: 'Sudah Dibayar',
                    value: formatRupiah(totalProjectValue - totalBalanceDue),
                    tone: 'positive',
                },
                {
                    label: 'Sisa Pembayaran',
                    value: formatRupiah(totalBalanceDue),
                    tone: totalBalanceDue > 0 ? 'negative' : 'positive',
                },
            ],
            sections,
            footerNote: `Dibuat otomatis oleh sistem pada ${new Date().toLocaleString('id-ID')}.`,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredClientData, transactions, teamProjectPayments, packages, userProfile, monthFilter]);

    // Membuka modal preview PDF — generate blob hanya dilakukan di dalam modal.
    const handleOpenPdfPreview = useCallback(() => {
        setShowPdfPreviewModal(true);
    }, []);

    // Callback yang diberikan ke PdfPreviewModal untuk generate blob URL.
    const handleGeneratePdfBlob = useCallback(async () => {
        const input = buildPengantinPdfInput();
        const doc = await buildReportPdf(input);
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        return { blobUrl, filename: input.filename };
    }, [buildPengantinPdfInput]);

    const handleOpenQrModal = (client: Client) => {
        const path = window.location.pathname.replace(/index\.html$/, '');
        const url = `${window.location.origin}${path}#/portal/${toPublicNameSlug(client.name)}`;
        setQrModalContent({
            title: `Portal QR Code untuk ${client.name}`,
            url,
            clientName: client.name,
            clientPhone: client.whatsapp || client.phone,
        });
    };

    const clientsWithDues = useMemo(() => {
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        return allClientData.flatMap(client => {
            const matchingProjects = monthFilter
                ? client.projects.filter(project => project.date?.slice(0, 7) === monthFilter)
                : client.projects.filter(project => project.date?.slice(0, 7) === currentMonthKey);
            const totalProjectValue = matchingProjects.reduce((sum, project) => sum + (Number(project.totalCost) || 0), 0);
            const balanceDue = matchingProjects.reduce(
                (sum, project) => sum + (Number(project.totalCost) || 0) - (Number(project.amountPaid) || 0),
                0,
            );
            if (balanceDue <= 0) return [];

            const mostRecentProject = [...matchingProjects].sort((left, right) =>
                (right.date || '').localeCompare(left.date || ''),
            )[0] || null;

            return [{
                ...client,
                projects: matchingProjects,
                totalProjectValue,
                balanceDue,
                mostRecentProject,
                PackageTerbaru: mostRecentProject?.packageName || 'Belum ada Acara Pernikahan',
                overallPaymentStatus: mostRecentProject?.paymentStatus || null,
            }];
        }).sort((a, b) => b.balanceDue - a.balanceDue);
    }, [allClientData, monthFilter]);

    const currentMonthEvents = useMemo(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return allClientData.flatMap(client => client.projects
            .filter(project => project.date?.slice(0, 7) === currentMonthKey)
            .map(project => ({
                ...client,
                projects: [project],
                totalProjectValue: Number(project.totalCost) || 0,
                balanceDue: Math.max(0, (Number(project.totalCost) || 0) - (Number(project.amountPaid) || 0)),
                PackageTerbaru: project.packageName || 'Belum memilih package',
                overallPaymentStatus: project.paymentStatus || null,
                mostRecentProject: project,
            })))
            .sort((left, right) => (right.mostRecentProject?.date || '').localeCompare(left.mostRecentProject?.date || ''));
    }, [allClientData]);

    const clientStatusDonutData = useMemo(() => {
        const statusCounts = clients.reduce((acc, client) => {
            acc[client.status] = (acc[client.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const statusColors: { [key in ClientStatus]?: string } = {
            [ClientStatus.ACTIVE]: '#10b981',
            [ClientStatus.INACTIVE]: '#64748b',
            [ClientStatus.LEAD]: '#3b82f6',
            [ClientStatus.LOST]: '#ef4444',
        };

        return Object.entries(statusCounts).map(([label, value]) => ({
            label,
            value,
            color: statusColors[label as ClientStatus] || '#9ca3af',
        }));
    }, [clients]);

    const newClientsChartData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const data = months.map(month => ({ name: month, count: 0 }));

        clients.forEach(c => {
            const joinDate = new Date(c.since);
            if (joinDate.getFullYear() === currentYear) {
                const monthIndex = joinDate.getMonth();
                data[monthIndex].count += 1;
            }
        });
        return data;
    }, [clients]);

    const handleDeleteProject = async (projectId: string) => {
        if (
            !window.confirm(
                'Hapus Acara Pernikahan ini? Semua transaksi terkait akan tetap ada, tetapi tidak lagi terhubung ke Acara Pernikahan. Lanjutkan?'
            )
        )
            return;

        if (!ensureOnlineOrNotify(showNotification)) return;
        const success = await deleteProjectRow(projectId);
        if (success) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
            showNotification('Acara Pernikahan berhasil dihapus.');
        } else {
            showNotification(
                !navigator.onLine
                    ? 'Harus online untuk melakukan perubahan'
                    : 'Gagal menghapus Acara Pernikahan di database. Coba lagi.'
            );
        }
    };

    const handleEditDocument = () => {
        if (!documentToView) return;
        if (documentToView.type === 'invoice') {
            const proj = documentToView.project;
            setDocumentToView(null);
            handleNavigation(ViewType.INVOICES, { type: 'openInvoice', id: proj.id });
        } else if (documentToView.type === 'receipt') {
            const tx = documentToView.transaction;
            handleOpenEditTransaction(tx);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Action Buttons */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[#2A3547] tracking-tight">Data Pengantin</h2>
                    <p className="text-xs text-[#5A6A85] mt-0.5">Kelola seluruh data calon pengantin, pembayaran, dan acara pernikahan</p>
                </div>
                <div className="flex flex-wrap sm:flex-row items-center justify-end gap-2 sm:gap-3">
                    <button
                        onClick={handleOpenPdfPreview}
                        className="w-auto max-w-full min-h-[44px] bg-white hover:bg-[#F4F6F9] text-[#2A3547] font-bold px-3 sm:px-4 py-2.5 rounded-xl border border-[#EAEFF4] inline-flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
                    >
                        <DownloadIcon className="w-5 h-5 flex-shrink-0" />
                        Unduh PDF
                    </button>
                    <button
                        onClick={() => handleOpenModal('add')}
                        className="w-auto max-w-full min-h-[44px] bg-[#5D87FF] hover:bg-[#4871e3] text-white font-bold px-3 sm:px-4 py-2.5 rounded-xl shadow-[0_4px_12px_rgba(93,135,255,0.25)] inline-flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
                    >
                        <PlusIcon className="w-5 h-5 flex-shrink-0" /> Tambah Pengantin
                    </button>
                </div>
            </div>

            {/* 4 Summary StatCards & Detail Modals */}
            <ClientStatsCards
                clientStats={clientStats}
                activeStatModal={activeStatModal}
                setActiveStatModal={setActiveStatModal}
                clients={clients}
                projects={projects}
            />

            {/* View Section Tabs for Progressive Disclosure */}
            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-[#EAEFF4] pb-2 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-3">
                <button
                    type="button"
                    onClick={() => setActiveViewSection('clients')}
                    className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeViewSection === 'clients'
                            ? 'bg-[#5D87FF] text-white shadow-sm shadow-[#5D87FF]/25'
                            : 'bg-white text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] border border-[#EAEFF4]'
                    }`}
                >
                    <UsersIcon className="w-4 h-4" />
                    <span className="sm:hidden">Pengantin</span>
                    <span className="hidden sm:inline">Daftar Pengantin</span>
                    <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                            activeViewSection === 'clients'
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F4F6F9] text-[#5A6A85]'
                        }`}
                    >
                        {clientStats.totalClients}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViewSection('dues')}
                    className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeViewSection === 'dues'
                            ? 'bg-[#FA896B] text-white shadow-sm shadow-[#FA896B]/25'
                            : 'bg-white text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] border border-[#EAEFF4]'
                    }`}
                >
                    <AlertCircleIcon className="w-4 h-4" />
                    <span className="sm:hidden">Pembayaran</span>
                    <span className="hidden sm:inline">Pembayaran Belum Lunas</span>
                    {clientsWithDues.length > 0 && (
                        <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                activeViewSection === 'dues' ? 'bg-white/25 text-white' : 'bg-[#FDEDE8] text-[#FA896B]'
                            }`}
                        >
                            {clientsWithDues.length}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViewSection('analytics')}
                    className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeViewSection === 'analytics'
                            ? 'bg-[#5D87FF] text-white shadow-sm shadow-[#5D87FF]/25'
                            : 'bg-white text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] border border-[#EAEFF4]'
                    }`}
                >
                    <TrendingUpIcon className="w-4 h-4" />
                    <span className="sm:hidden">Analitik</span>
                    <span className="hidden sm:inline">Grafik &amp; Analitik</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViewSection('finance-recap')}
                    className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeViewSection === 'finance-recap'
                            ? 'bg-[#5D87FF] text-white shadow-sm shadow-[#5D87FF]/25'
                            : 'bg-white text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] border border-[#EAEFF4]'
                    }`}
                >
                    <span className="sm:hidden">Rekap</span>
                    <span className="hidden sm:inline">Rekap Keuangan per Pengantin</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeViewSection === 'finance-recap' ? 'bg-white/20 text-white' : 'bg-[#F4F6F9] text-[#5A6A85]'}`}>{projects.length}</span>
                </button>
            </div>

            {/* Analytics Section */}
            {activeViewSection === 'analytics' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6 widget-animate animate-fade-in">
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4]">
                        <h3 className="font-bold text-base text-[#2A3547] mb-4">Distribusi Status Pengantin</h3>
                        <DonutChart data={clientStatusDonutData} />
                    </div>
                    <div className="lg:col-span-3">
                        <NewClientsChart data={newClientsChartData} />
                    </div>
                </div>
            )}

            {/* Dues Section */}
            {activeViewSection === 'dues' && (
                <ClientDuesView
                    clientsWithDues={clientsWithDues}
                    monthFilter={monthFilter}
                    setMonthFilter={setMonthFilter}
                    showAllDues={showAllDues}
                    setShowAllDues={setShowAllDues}
                    onBillingClick={client => setBillingChatModal(client)}
                />
            )}

            {activeViewSection === 'finance-recap' && (
                <ClientFinanceRecapView
                    clients={clients}
                    projects={projects}
                    transactions={transactions}
                />
            )}

            {/* Main Clients List Section */}
            {activeViewSection === 'clients' && (
                <>
                    <ClientFilterBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        dateFrom={dateFrom}
                        setDateFrom={setDateFrom}
                        dateTo={dateTo}
                        setDateTo={setDateTo}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        onDownloadExcel={handleDownloadExcel}
                        isExporting={isExporting}
                    />

                    <ClientTableView
                        clientTab={clientTab}
                        setClientTab={setClientTab}
                        filteredClientData={filteredClientData}
                        currentMonthEvents={currentMonthEvents}
                        onViewDetail={(client: Client) => {
                            setClientForDetail(client);
                            setIsDetailModalOpen(true);
                        }}
                        onEditClient={(client: Client, project?: Project) => handleOpenModal('edit', client, project)}
                        onDeleteClient={handleDeleteClient}
                        onAddProject={(client: Client) => handleOpenModal('add', client)}
                    />
                </>
            )}

            {/* Add / Edit Client & Project Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={
                    modalMode === 'add'
                        ? selectedClient
                            ? 'Tambah Acara Pernikahan Baru'
                            : 'Tambah Pengantin & Acara Pernikahan Baru'
                        : 'Edit Pengantin & Acara Pernikahan'
                }
                size="4xl"
            >
                <ClientForm
                    formData={formData}
                    setFormData={setFormData}
                    handleFormChange={handleFormChange}
                    handleFormSubmit={handleFormSubmit}
                    handleCloseModal={handleCloseModal}
                    packages={packages}
                    addOns={addOns}
                    userProfile={userProfile}
                    modalMode={modalMode}
                    cards={cards}
                    promoCodes={promoCodes}
                />
            </Modal>

            {/* Client Detail Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`Detail Pengantin: ${clientForDetail?.name}`}
                size="4xl"
            >
                <ClientDetailModal
                    client={clientForDetail}
                    profile={userProfile}
                    projects={projects}
                    transactions={transactions}
                    packages={packages}
                    addOns={addOns}
                    onClose={() => setIsDetailModalOpen(false)}
                    onEditClient={client => {
                        const clientProjects = projects.filter(p => p.clientId === client.id);
                        const mostRecent = clientProjects.length > 0
                            ? [...clientProjects].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                            : undefined;
                        handleOpenModal('edit', client, mostRecent);
                    }}
                    onDeleteClient={handleDeleteClient}
                    onViewReceipt={tx => setDocumentToView({ type: 'receipt', transaction: tx })}
                    onViewInvoice={proj => setDocumentToView({ type: 'invoice', project: proj })}
                    handleNavigation={handleNavigation}
                    onRecordPayment={handleRecordPayment}
                    cards={cards}
                    onSharePortal={handleOpenQrModal}
                    onDeleteProject={handleDeleteProject}
                    showNotification={showNotification}
                    setProjects={setProjects}
                    setTransactions={setTransactions}
                    setCards={setCards}
                    teamMembers={teamMembers}
                    teamProjectPayments={teamProjectPayments}
                    setTeamProjectPayments={setTeamProjectPayments}
                    teamPaymentRecords={teamPaymentRecords}
                    pockets={pockets}
                    setPockets={setPockets}
                />
            </Modal>

            {/* Invoice & Receipt Document Preview Modal */}
            <ClientDocumentModal
                documentToView={documentToView}
                onClose={() => setDocumentToView(null)}
                clientForDetail={clientForDetail}
                userProfile={userProfile}
                packages={packages}
                projects={projects}
                transactions={transactions}
                isSignatureModalOpen={isSignatureModalOpen}
                setIsSignatureModalOpen={setIsSignatureModalOpen}
                onSaveSignature={handleSaveSignature}
                onRemoveSignature={handleRemoveSignature}
                onEditDocument={handleEditDocument}
                onDownloadPDF={handleDownloadPDF}
                onShareDocumentWA={handleShareDocumentWA}
            />

            {/* QR Code & Message Sharing Modals */}
            <ClientQrShareModals
                qrModalContent={qrModalContent}
                onCloseQrModal={() => setQrModalContent(null)}
                sharePreview={sharePreview}
                setSharePreview={setSharePreview}
                userProfile={userProfile}
                showNotification={showNotification}
            />

            {/* Billing WhatsApp Reminder Modal */}
            {billingChatModal && (
                <BillingChatModal
                    isOpen={!!billingChatModal}
                    onClose={() => setBillingChatModal(null)}
                    client={billingChatModal}
                    projects={projects}
                    userProfile={userProfile}
                    showNotification={showNotification}
                />
            )}

            {/* Transaction / Receipt Edit Modal */}
            <ClientTransactionEditModal
                isOpen={isTransactionEditModalOpen}
                onClose={() => setIsTransactionEditModalOpen(false)}
                txFormData={txFormData}
                setTxFormData={setTxFormData}
                onSubmit={handleUpdateTransaction}
                cards={cards}
            />

            {/* PDF Preview Modal */}
            {showPdfPreviewModal && (
                <PdfPreviewModal
                    title="Preview Laporan Data Pengantin"
                    onGenerate={handleGeneratePdfBlob}
                    onClose={() => setShowPdfPreviewModal(false)}
                />
            )}
        </div>
    );
};

export default Clients;
