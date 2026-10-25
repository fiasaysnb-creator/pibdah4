/**
 * TeamUnpaidTab
 *
 * Tab 3: Centralized "Pembayaran Belum Lunas" view.
 * Shows summary stats, search bar, and the unpaid list (mobile cards + desktop table).
 * Identical markup to original.
 */

import React from 'react';
import { TeamMember, TeamProjectPayment, Project } from '../../../types';
import { ModernStatCard } from '../../../components/modernize/ModernStatCard';
import { formatCurrency } from '../utils/teamUtils';
import { AlertCircleIcon, CalendarIcon, UsersIcon, EyeIcon } from '../../../constants';

interface UnpaidPaymentItem {
    payment: TeamProjectPayment;
    member: TeamMember | undefined;
    project: Project | undefined;
}

interface TeamUnpaidTabProps {
    filteredUnpaidPayments: UnpaidPaymentItem[];
    allUnpaidPayments: UnpaidPaymentItem[];
    totalUnpaidAll: number;
    unpaidSearchQuery: string;
    onSearchChange: (query: string) => void;
    onViewDetails: (member: TeamMember) => void;
}

const TeamUnpaidTab: React.FC<TeamUnpaidTabProps> = ({
    filteredUnpaidPayments,
    allUnpaidPayments,
    totalUnpaidAll,
    unpaidSearchQuery,
    onSearchChange,
    onViewDetails,
}) => {
    const uniqueWaitingCount = new Set(
        allUnpaidPayments.map(i => i.member?.id).filter(Boolean),
    ).size;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-6">
                <ModernStatCard
                    icon={<AlertCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    title="Total Pembayaran"
                    value={formatCurrency(totalUnpaidAll)}
                    subtitle="Belum lunas"
                    iconColorVariant="error"
                    compactOnMobile
                />
                <ModernStatCard
                    icon={<CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    title="Tertunda"
                    value={allUnpaidPayments.length.toString()}
                    subtitle="Belum dibayar"
                    iconColorVariant="warning"
                    compactOnMobile
                />
                <ModernStatCard
                    icon={<UsersIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                    title="Penerima"
                    value={uniqueWaitingCount.toString()}
                    subtitle="Menunggu pembayaran"
                    iconColorVariant="primary"
                    compactOnMobile
                />
            </div>

            {/* Search bar */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                <div className="relative flex-grow max-w-md">
                    <input
                        type="text"
                        placeholder="Cari nama penerima, peran, atau nama acara..."
                        value={unpaidSearchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2 text-xs sm:text-sm text-[#2A3547] placeholder:text-[#5A6A85] focus:outline-none focus:bg-white focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all pl-10"
                    />
                    <AlertCircleIcon className="w-4 h-4 text-[#5A6A85] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#5A6A85] text-center">
                    Ditemukan{' '}
                    <span className="font-bold text-[#2A3547]">
                        {filteredUnpaidPayments.length}
                    </span>{' '}
                    pembayaran tertunda
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
                {filteredUnpaidPayments.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full grad-green text-white flex items-center justify-center font-bold text-xl">
                            ✓
                        </div>
                        <h3 className="text-base font-bold text-[#2A3547] mb-1">
                            Semua Pembayaran Sudah Lunas!
                        </h3>
                        <p className="text-sm text-[#5A6A85]">
                            Tidak ada pembayaran Tim atau Vendor yang menunggu pembayaran dalam periode ini.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden p-3 space-y-3 bg-[#F8FAFC]">
                            {filteredUnpaidPayments.map((item, idx) => (
                                <div
                                    key={item.payment.id || idx}
                                    className="rounded-xl bg-white border border-slate-200 p-4 shadow-xs space-y-2.5 hover:border-brand-accent transition-all"
                                >
                                    <div className="flex items-start justify-between pb-2 border-b border-slate-200">
                                        <div>
                                            <p className="font-bold text-[#2A3547] text-sm">
                                                {item.member?.name || 'Anggota Tim'}
                                            </p>
                                            <p className="text-xs text-[#5A6A85] mt-0.5">
                                                {item.payment.role || item.member?.role}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                                                item.member?.category === 'Vendor'
                                                    ? 'solid-orange text-white border-orange-600'
                                                    : 'solid-blue text-white border-blue-600'
                                            }`}
                                        >
                                            {item.member?.category || 'Tim'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[#5A6A85] flex items-center justify-between py-1">
                                        <span>Acara:</span>
                                        <span className="font-semibold text-[#2A3547]">
                                            {item.project?.projectName || 'Acara Pernikahan'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
                                        <span className="text-base font-extrabold text-red-600">
                                            {formatCurrency(item.payment.fee)}
                                        </span>
                                        {item.member && (
                                            <button
                                                onClick={() => onViewDetails(item.member!)}
                                                className="button-primary !text-xs !py-1.5 !px-3 inline-flex items-center gap-1"
                                            >
                                                <EyeIcon className="w-3.5 h-3.5" /> Kelola Pembayaran
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="text-xs text-[#5A6A85] font-bold uppercase bg-[#F8FAFC] border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3.5 text-center w-12 border-r border-slate-200/70">No</th>
                                        <th className="px-4 py-3.5 text-left border-r border-slate-200/70">Nama Penerima</th>
                                        <th className="px-4 py-3.5 text-left border-r border-slate-200/70">Kategori</th>
                                        <th className="px-4 py-3.5 text-left border-r border-slate-200/70">Peran / Tugas</th>
                                        <th className="px-4 py-3.5 text-left border-r border-slate-200/70">Acara Pernikahan</th>
                                        <th className="px-4 py-3.5 text-right border-r border-slate-200/70">Nominal Pembayaran</th>
                                        <th className="px-4 py-3.5 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {filteredUnpaidPayments.map((item, idx) => (
                                        <tr
                                            key={item.payment.id || idx}
                                            className="hover:bg-[#F8FAFC] transition-colors"
                                        >
                                            <td className="px-4 py-3.5 text-center font-semibold text-[#5A6A85] border-r border-slate-100">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-[#2A3547] border-r border-slate-100">
                                                {item.member?.name || 'Anggota Tim'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-100">
                                                <span
                                                    className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border ${
                                                        item.member?.category === 'Vendor'
                                                            ? 'solid-orange text-white border-orange-600'
                                                            : 'solid-blue text-white border-blue-600'
                                                    }`}
                                                >
                                                    {item.member?.category || 'Tim'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-[#5A6A85] font-medium border-r border-slate-100">
                                                {item.payment.role || item.member?.role || '-'}
                                            </td>
                                            <td className="px-4 py-3.5 text-[#2A3547] font-semibold border-r border-slate-100">
                                                {item.project?.projectName || 'Acara'}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-bold text-red-600 border-r border-slate-100">
                                                {formatCurrency(item.payment.fee)}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                {item.member ? (
                                                    <button
                                                        onClick={() => onViewDetails(item.member!)}
                                                        className="button-primary !text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5"
                                                        title="Buka panel pembayaran anggota ini"
                                                    >
                                                        <EyeIcon className="w-3.5 h-3.5" />
                                                        <span>Bayar / Slip</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-[#5A6A85]">
                                                        -
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TeamUnpaidTab;
