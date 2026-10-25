/**
 * TeamMemberList
 *
 * Renders the member list for a single group (Tim or Vendor).
 * Desktop: table. Mobile: cards. Identical markup to original.
 */

import React from 'react';
import { TeamMember, TeamProjectPayment } from '../../../types';
import { dedupeCurrentTeamPayments, formatCurrency } from '../utils/teamUtils';
import {
    EyeIcon,
    PencilIcon,
    Trash2Icon,
    StarIcon,
    UsersIcon,
} from '../../../constants';
import { MobileExpandableExtra } from '../../../components/ui/MobileProgressiveDisclosure';
import TablePagination from '../../../shared/ui/TablePagination';

interface TeamMemberListProps {
    members: TeamMember[];
    teamProjectPaymentsInDateRange: TeamProjectPayment[];
    groupLabel: 'team' | 'vendor';
    onViewDetails: (member: TeamMember) => void;
    onEditMember: (member: TeamMember) => void;
    onDeleteMember: (memberId: string) => void;
}

const TeamMemberList: React.FC<TeamMemberListProps> = ({
    members,
    teamProjectPaymentsInDateRange,
    groupLabel,
    onViewDetails,
    onEditMember,
    onDeleteMember,
}) => {
    const currentTeamPayments = dedupeCurrentTeamPayments(teamProjectPaymentsInDateRange);
    const getUnpaidFee = (memberId: string) =>
        currentTeamPayments
            .filter(payment => payment.teamMemberId === memberId && payment.status === 'Unpaid')
            .reduce((sum, payment) => sum + payment.fee, 0);

    const emptyMessage =
        groupLabel === 'team'
            ? 'Tidak ada data anggota tim yang cocok.'
            : 'Tidak ada data vendor yang cocok.';

    const emptySearchMessage =
        groupLabel === 'team'
            ? 'Tidak ada data anggota tim yang cocok dengan pencarian.'
            : 'Tidak ada data vendor yang cocok dengan pencarian.';

    const nameHeader = groupLabel === 'vendor' ? 'Nama Vendor' : 'Nama';
    const roleHeader = groupLabel === 'vendor' ? 'Bidang / Layanan' : 'Peran / Posisi';

    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [members.length, groupLabel]);

    const paginatedMembers = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return members.slice(start, start + itemsPerPage);
    }, [members, currentPage, itemsPerPage]);

    return (
        <div className="bg-white rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden transition-all duration-300">
            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-3 bg-[#F8FAFC]">
                {paginatedMembers.map(member => {
                    const unpaidFee = getUnpaidFee(member.id);

                    const categoryBadgeClass =
                        groupLabel === 'vendor'
                            ? 'solid-orange text-white border border-orange-600'
                            : 'solid-blue text-white border border-blue-600';

                    return (
                        <div
                            key={member.id}
                            className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-xs group hover:border-brand-accent transition-all duration-200"
                        >
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                    <span className="w-9 h-9 rounded-full overflow-hidden shrink-0 grad-brand border border-brand-accent/20 flex items-center justify-center text-xs font-bold text-white">
                                        {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : member.name?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[#2A3547] text-sm leading-tight truncate">
                                            {member.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <p className="text-[11px] text-[#5A6A85] font-medium truncate">
                                                {member.role}
                                            </p>
                                            <span
                                                className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider ${categoryBadgeClass}`}
                                            >
                                                {member.category || (groupLabel === 'vendor' ? 'Vendor' : 'Tim')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right text-[11px] shrink-0">
                                    <div className="inline-flex items-center gap-1 solid-orange border border-orange-600 text-white font-bold px-2 py-0.5 rounded-lg">
                                        <StarIcon className="w-3 h-3 text-white fill-current" />
                                        {member.rating.toFixed(1)}
                                    </div>
                                </div>
                            </div>
                            <div className="py-2.5 flex items-center justify-between text-xs border-b border-slate-100">
                                <span className="text-[#5A6A85] font-medium">Pembayaran Belum Dibayar</span>
                                <span className={`text-right font-bold ${unpaidFee > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(unpaidFee)}
                                </span>
                            </div>
                            <MobileExpandableExtra
                                labelOpen="Lihat Aksi"
                                labelClose="Ringkas"
                                headerRight={
                                    <button
                                        onClick={() => onViewDetails(member)}
                                        className="btn-box-read text-[10px] px-2.5 py-1"
                                    >
                                        <EyeIcon className="w-3 h-3 flex-shrink-0 text-white" /> <span>Detail</span>
                                    </button>
                                }
                            >
                                <div className="flex justify-end gap-1.5 pt-1">
                                    <button
                                        onClick={() => onEditMember(member)}
                                        className="btn-box-edit text-[10px] px-2.5 py-1"
                                    >
                                        <PencilIcon className="w-3 h-3 flex-shrink-0" /> <span>Edit</span>
                                    </button>
                                    <button
                                        onClick={() => onDeleteMember(member.id)}
                                        className="btn-box-delete text-[10px] px-2.5 py-1"
                                    >
                                        <Trash2Icon className="w-3 h-3 flex-shrink-0 text-white" /> <span>Hapus</span>
                                    </button>
                                </div>
                            </MobileExpandableExtra>
                        </div>
                    );
                })}
                {members.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-xl border border-slate-200 text-[#5A6A85]">
                        <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">{emptyMessage}</p>
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-xs lg:text-sm border-collapse">
                    <thead className="text-[11px] lg:text-xs text-[#5A6A85] font-bold uppercase bg-[#F8FAFC] border-b border-slate-200">
                        <tr>
                            <th className="px-3 lg:px-4 py-3.5 text-center w-10 lg:w-14 border-r border-slate-200/70">No</th>
                            <th className="px-3 lg:px-4 py-3.5 text-left border-r border-slate-200/70">{nameHeader}</th>
                            <th className="px-3 lg:px-4 py-3.5 text-left border-r border-slate-200/70">{roleHeader}</th>
                            <th className="px-3 lg:px-4 py-3.5 text-left border-r border-slate-200/70">Pembayaran Belum Dibayar</th>
                            <th className="px-3 lg:px-4 py-3.5 text-center border-r border-slate-200/70">Rating</th>
                            <th className="px-3 lg:px-4 py-3.5 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {paginatedMembers.map((member, index) => {
                            const unpaidFee = getUnpaidFee(member.id);
                            return (
                                <tr
                                    key={member.id}
                                    className="hover:bg-[#F8FAFC] transition-colors"
                                >
                                    <td className="px-3 lg:px-4 py-3.5 text-center font-semibold text-[#5A6A85] border-r border-slate-100">
                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                    </td>
                                    <td className="px-3 lg:px-4 py-3.5 font-bold text-[#2A3547] border-r border-slate-100">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-8 h-8 rounded-full overflow-hidden shrink-0 grad-brand border border-brand-accent/20 flex items-center justify-center text-xs font-bold text-white">
                                                {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : member.name?.charAt(0).toUpperCase() || '?'}
                                            </span>
                                            <span className="truncate">{member.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 lg:px-4 py-3.5 border-r border-slate-100">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-slate-200 text-[#2A3547] text-xs font-semibold">
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className={`px-3 lg:px-4 py-3.5 font-bold whitespace-nowrap border-r border-slate-100 ${unpaidFee > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {formatCurrency(unpaidFee)}
                                    </td>
                                    <td className="px-3 lg:px-4 py-3.5 border-r border-slate-100">
                                        <div className="flex justify-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg solid-orange border border-orange-600 text-white font-bold text-xs">
                                                <StarIcon className="w-3.5 h-3.5 text-white fill-current" />
                                                {member.rating.toFixed(1)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 lg:px-4 py-3.5">
                                        <div className="flex items-center justify-center space-x-1.5">
                                            <button
                                                onClick={() => onViewDetails(member)}
                                                className="btn-box-read w-7 lg:w-8 h-7 lg:h-8 rounded-md lg:rounded-lg flex items-center justify-center"
                                                title="Detail"
                                            >
                                                <EyeIcon className="w-3.5 lg:w-4 h-3.5 lg:h-4 text-white flex-shrink-0" />
                                            </button>
                                            <button
                                                onClick={() => onEditMember(member)}
                                                className="btn-box-edit w-7 lg:w-8 h-7 lg:h-8 rounded-md lg:rounded-lg flex items-center justify-center"
                                                title="Edit"
                                            >
                                                <PencilIcon className="w-3.5 lg:w-4 h-3.5 lg:h-4 flex-shrink-0" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteMember(member.id)}
                                                className="btn-box-delete w-7 lg:w-8 h-7 lg:h-8 rounded-md lg:rounded-lg flex items-center justify-center"
                                                title="Hapus"
                                            >
                                                <Trash2Icon className="w-3.5 lg:w-4 h-3.5 lg:h-4 text-white flex-shrink-0" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {members.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-center py-10 text-[#5A6A85] font-medium"
                                >
                                    {emptySearchMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <TablePagination
                currentPage={currentPage}
                totalItems={members.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                label={groupLabel === 'vendor' ? 'vendor' : 'anggota tim'}
                pageSizeOptions={[10, 20, 50]}
            />
        </div>
    );
};

export default TeamMemberList;
