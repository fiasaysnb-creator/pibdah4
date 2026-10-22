import { useState, useMemo, useCallback } from 'react';
import { Client, Project, Transaction, Card, FinancialPocket, Notification, ClientStatus, PaymentStatus } from '../../../types';
import { createClient, updateClient, deleteClient } from '../../../services/clients';
import { createProject, updateProject, deleteProject } from '../../../services/projects';
import { ensureOnlineOrNotify } from '../utils/clientHelpers';
import { formatCurrency } from '../../../utils/currency';

export interface ClientWithSummary extends Client {
    projects: Project[];
    totalProjectValue: number;
    balanceDue: number;
    PackageTerbaru: string;
    overallPaymentStatus: PaymentStatus | null;
    mostRecentProject: Project | null;
}

export const useClients = (
    clients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>,
    projects: Project[],
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
    transactions: Transaction[],
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>,
    showNotification: (message: string) => void,
    cards: Card[],
    setCards: React.Dispatch<React.SetStateAction<Card[]>>,
    totals: any
) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('Semua Status');
    const [monthFilter, setMonthFilter] = useState(() => {
        const currentDate = new Date();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${currentDate.getFullYear()}-${month}`;
    });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const allClientData = useMemo(() => {
        const projectsByClient = new Map<string, {
            projects: Project[];
            totalValue: number;
            totalPaid: number;
            mostRecentProject: Project | null;
            mostRecentProjectTime: number;
        }>();

        projects.forEach(project => {
            let summary = projectsByClient.get(project.clientId);
            if (!summary) {
                summary = {
                    projects: [],
                    totalValue: 0,
                    totalPaid: 0,
                    mostRecentProject: null,
                    mostRecentProjectTime: Number.NEGATIVE_INFINITY,
                };
                projectsByClient.set(project.clientId, summary);
            }

            summary.projects.push(project);
            summary.totalValue += project.totalCost;
            summary.totalPaid += project.amountPaid;
            const projectTime = new Date(project.date).getTime();
            if (!summary.mostRecentProject || projectTime > summary.mostRecentProjectTime) {
                summary.mostRecentProject = project;
                summary.mostRecentProjectTime = projectTime;
            }
        });

        return clients.map(client => {
            const summary = projectsByClient.get(client.id);
            const clientProjects = summary?.projects ?? [];
            const mostRecentProject = summary?.mostRecentProject ?? null;
            const totalValue = summary?.totalValue ?? 0;
            const totalPaid = summary?.totalPaid ?? 0;

            return {
                ...client,
                projects: clientProjects,
                totalProjectValue: totalValue,
                balanceDue: totalValue - totalPaid,
                PackageTerbaru: mostRecentProject ? `${mostRecentProject.packageName}${mostRecentProject.addOns.length > 0 ? ` + ${mostRecentProject.addOns.length} Add-on` : ''}` : 'Belum ada Acara Pernikahan',
                overallPaymentStatus: mostRecentProject ? mostRecentProject.paymentStatus : null,
                mostRecentProject: mostRecentProject,
            };
        });
    }, [clients, projects]);

    const filteredClientData = useMemo(() => {
        return allClientData.filter(client => {
            // Search filter - cari di nama, email, phone, whatsapp
            const searchMatch = searchTerm === '' ||
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (client.whatsapp && client.whatsapp.toLowerCase().includes(searchTerm.toLowerCase()));

            // Status filter - bisa filter Payment Status atau Client Status
            const statusMatch = statusFilter === 'Semua Status' || 
                client.overallPaymentStatus === statusFilter ||
                client.status === statusFilter;

            // Month filter - filter berdasarkan bulan project atau bulan join client
            let monthMatch = true;
            if (monthFilter) {
                const [filterYear, filterMonth] = monthFilter.split('-').map(Number);
                monthMatch = client.projects.some(p => {
                    const projectDate = new Date(p.date);
                    return projectDate.getFullYear() === filterYear && projectDate.getMonth() + 1 === filterMonth;
                });
            }

            // Date range filter - filter berdasarkan tanggal project
            const from = dateFrom ? new Date(dateFrom) : null;
            const to = dateTo ? new Date(dateTo) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            const dateMatchRange = (!from && !to) || client.projects.some(project => {
                const projectDate = project.date ? new Date(project.date) : null;
                const hasValidDate = projectDate && !Number.isNaN(projectDate.getTime());
                if (project.bookingStatus && !hasValidDate) return true;
                return !!hasValidDate && (!from || projectDate >= from) && (!to || projectDate <= to);
            }) || (() => {
                // Jika tidak ada project, filter berdasarkan tanggal join client
                const clientJoinDate = new Date(client.since);
                return (!from || clientJoinDate >= from) && (!to || clientJoinDate <= to);
            })();

            return searchMatch && statusMatch && monthMatch && dateMatchRange;
        });
    }, [allClientData, searchTerm, statusFilter, monthFilter, dateFrom, dateTo]);

    const clientStats = useMemo(() => {
        const totalReceivables = allClientData.reduce((sum, c) => sum + c.balanceDue, 0);
        const locationCounts: Record<string, number> = {};
        allClientData.forEach(c => {
            c.projects.forEach(p => {
                if (p.location) {
                    locationCounts[p.location] = (locationCounts[p.location] || 0) + 1;
                }
            });
        });
        const topLocationEntry = Object.entries(locationCounts).sort(([, a], [, b]) => b - a)[0];
        const mostFrequentLocation = topLocationEntry ? topLocationEntry[0] : '-';

        return {
            activeClients: totals.activeClients,
            totalReceivables: formatCurrency(totalReceivables),
            totalClients: totals.clients,
            mostFrequentLocation
        };
    }, [allClientData, totals]);

    const handleDeleteClient = useCallback(async (clientId: string) => {
        if (!window.confirm('Menghapus pengantin akan menghapus semua Acara Pernikahan dan transaksi terkait. Apakah Anda yakin?')) return;

        if (!ensureOnlineOrNotify(showNotification)) return;
        try {
            await deleteClient(clientId);
            setClients(prev => prev.filter(c => c.id !== clientId));
            const projectsToDelete = projects.filter(p => p.clientId === clientId).map(p => p.id);
            setProjects(prev => prev.filter(p => p.clientId !== clientId));
            setTransactions(prev => prev.filter(t => !projectsToDelete.includes(t.projectId || '')));
            showNotification('Pengantin berhasil dihapus.');
            return true;
        } catch (err) {
            showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal menghapus pengantin di database. Coba lagi.');
            return false;
        }
    }, [clients, projects, setClients, setProjects, setTransactions, showNotification]);

    return {
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
        handleDeleteClient
    };
};
