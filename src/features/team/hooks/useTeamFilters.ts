/**
 * useTeamFilters
 *
 * Owns:
 * - Date range filter state (dateFrom, dateTo)
 * - Search query state (teamSearchQuery, vendorSearchQuery, unpaidSearchQuery)
 * - Derived filtered / grouped data consumed by all tabs
 */

import { useState, useMemo } from 'react';
import { TeamMember, TeamProjectPayment, Project } from '../../../types';
import { dedupeCurrentTeamPayments, filterUniqueMembers } from '../utils/teamUtils';

interface UseTeamFiltersParams {
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    projects: Project[];
}

/** Format tanggal lokal (YYYY-MM-DD) tanpa pergeseran timezone. */
const toLocalDateString = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getCurrentMonthKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Ubah kunci bulan (YYYY-MM) menjadi rentang [awal, akhir] tanggal lokal. */
const monthKeyToRange = (key: string): [string, string] => {
    if (!key) return ['', ''];
    const [year, month] = key.split('-').map(Number);
    if (!year || !month) return ['', ''];
    return [toLocalDateString(new Date(year, month - 1, 1)), toLocalDateString(new Date(year, month, 0))];
};

export const useTeamFilters = ({
    teamMembers,
    teamProjectPayments,
    projects,
}: UseTeamFiltersParams) => {
    // ── Bulan / rentang tanggal (default: bulan berjalan) ─────────────────────
    const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonthKey);
    const [dateFrom, setDateFrom] = useState(() => monthKeyToRange(getCurrentMonthKey())[0]);
    const [dateTo, setDateTo] = useState(() => monthKeyToRange(getCurrentMonthKey())[1]);

    // ── Search queries ───────────────────────────────────────────────────────
    const [teamSearchQuery, setTeamSearchQuery] = useState('');
    const [vendorSearchQuery, setVendorSearchQuery] = useState('');
    const [unpaidSearchQuery, setUnpaidSearchQuery] = useState('');

    const resetDateRange = () => {
        setMonthFilter('');
        setDateFrom('');
        setDateTo('');
    };

    /** Filter bulan: menetapkan rentang tanggal = satu bulan penuh (kosong = semua). */
    const handleMonthChange = (value: string) => {
        setMonthFilter(value);
        const [first, last] = monthKeyToRange(value);
        setDateFrom(first);
        setDateTo(last);
    };

    /** Perubahan tanggal manual membatalkan filter bulan. */
    const handleDateFromChange = (value: string) => {
        setMonthFilter('');
        setDateFrom(value);
    };

    const handleDateToChange = (value: string) => {
        setMonthFilter('');
        setDateTo(value);
    };

    // ── Date-filtered projects ───────────────────────────────────────────────
    const projectsInDateRange = useMemo(() => {
        if (!dateFrom && !dateTo) return projects;
        return projects.filter(p => {
            const d = new Date(p.date);
            if (!p.date || Number.isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            if (dateFrom) {
                const from = new Date(dateFrom);
                from.setHours(0, 0, 0, 0);
                if (d < from) return false;
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                if (d > to) return false;
            }
            return true;
        });
    }, [projects, dateFrom, dateTo]);

    // ── Date-filtered team project payments ──────────────────────────────────
    const teamProjectPaymentsInDateRange = useMemo(() => {
        if (!dateFrom && !dateTo) return teamProjectPayments;
        const projectIdsInRange = new Set(projectsInDateRange.map(p => p.id));
        return dedupeCurrentTeamPayments(
            teamProjectPayments.filter(p => projectIdsInRange.has(p.projectId)),
        );
    }, [teamProjectPayments, projectsInDateRange, dateFrom, dateTo]);

    // ── Member groups (team / vendor split) ──────────────────────────────────
    const memberGroups = useMemo(
        () => ({
            team: teamMembers.filter(m => m.category !== 'Vendor'),
            vendor: teamMembers.filter(m => m.category === 'Vendor'),
        }),
        [teamMembers],
    );

    // ── Filtered member lists ────────────────────────────────────────────────
    const uniqueTeamMembers = useMemo(
        () => filterUniqueMembers(memberGroups.team, teamSearchQuery),
        [memberGroups.team, teamSearchQuery],
    );

    const uniqueVendorMembers = useMemo(
        () => filterUniqueMembers(memberGroups.vendor, vendorSearchQuery),
        [memberGroups.vendor, vendorSearchQuery],
    );

    // ── Unpaid payments with joined member + project data ────────────────────
    const allUnpaidPayments = useMemo(() => {
        return teamProjectPaymentsInDateRange
            .filter(p => p.status === 'Unpaid')
            .map(p => ({
                payment: p,
                member: teamMembers.find(m => m.id === p.teamMemberId),
                project: projectsInDateRange.find(proj => proj.id === p.projectId),
            }));
    }, [teamProjectPaymentsInDateRange, teamMembers, projectsInDateRange]);

    const totalUnpaidAll = useMemo(
        () => allUnpaidPayments.reduce((sum, item) => sum + item.payment.fee, 0),
        [allUnpaidPayments],
    );

    const filteredUnpaidPayments = useMemo(() => {
        if (!unpaidSearchQuery.trim()) return allUnpaidPayments;
        const q = unpaidSearchQuery.trim().toLowerCase();
        return allUnpaidPayments.filter(
            item =>
                (item.member?.name && item.member.name.toLowerCase().includes(q)) ||
                (item.member?.role && item.member.role.toLowerCase().includes(q)) ||
                (item.project?.projectName && item.project.projectName.toLowerCase().includes(q)) ||
                (item.payment.role && item.payment.role.toLowerCase().includes(q)),
        );
    }, [allUnpaidPayments, unpaidSearchQuery]);

    return {
        // Date range
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        monthFilter,
        handleMonthChange,
        handleDateFromChange,
        handleDateToChange,
        resetDateRange,

        // Search queries
        teamSearchQuery,
        setTeamSearchQuery,
        vendorSearchQuery,
        setVendorSearchQuery,
        unpaidSearchQuery,
        setUnpaidSearchQuery,

        // Derived data
        projectsInDateRange,
        teamProjectPaymentsInDateRange,
        memberGroups,
        uniqueTeamMembers,
        uniqueVendorMembers,
        allUnpaidPayments,
        totalUnpaidAll,
        filteredUnpaidPayments,
    };
};
