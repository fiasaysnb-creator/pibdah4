import React from 'react';
import { EyeIcon, PencilIcon, Trash2Icon, PlusIcon } from '../../../constants';
import { Client, Project, ClientStatus } from '../../../types';
import { ClientWithSummary } from '../hooks/useClients';
import { formatCurrency, getPaymentStatusClass } from '../utils/clientHelpers';
import { MobileExpandableExtra } from '../../../components/ui/MobileProgressiveDisclosure';

export type ClientTabType = 'active' | 'inactive' | 'all' | 'no-date' | 'this-month';

interface ClientTableViewProps {
    clientTab: ClientTabType;
    setClientTab: React.Dispatch<React.SetStateAction<ClientTabType>>;
    filteredClientData: ClientWithSummary[];
    currentMonthEvents: ClientWithSummary[];
    onViewDetail: (client: Client) => void;
    onEditClient: (client: Client, project?: Project) => void;
    onDeleteClient: (clientId: string) => void;
    onAddProject: (client: Client) => void;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({
    clientTab,
    setClientTab,
    filteredClientData,
    currentMonthEvents,
    onViewDetail,
    onEditClient,
    onDeleteClient,
    onAddProject,
}) => {
    const activeClients = filteredClientData.filter(c => c.status === ClientStatus.ACTIVE);
    const inactiveClients = filteredClientData.filter(c => c.status !== ClientStatus.ACTIVE);
    const noDateClients = filteredClientData.filter(client => {
        const mainProject = client.mostRecentProject ?? client.projects[0] ?? null;
        if (!mainProject) return true;

        const rawDate = typeof mainProject.date === 'string' ? mainProject.date.trim() : '';
        return rawDate === '' || Number.isNaN(new Date(rawDate).getTime());
    });

    const displayedClients =
        clientTab === 'this-month'
            ? currentMonthEvents
            : clientTab === 'active'
            ? activeClients
            : clientTab === 'inactive'
            ? inactiveClients
            : clientTab === 'no-date'
            ? noDateClients
            : filteredClientData;

    return (
        <div className="bg-white rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4] overflow-hidden">
            <div className="p-4 border-b border-[#EAEFF4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
                {/* Segmented View Switcher */}
                <div className="flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto p-1 bg-[#F4F6F9] rounded-xl border border-[#EAEFF4]">
                    <button
                        type="button"
                        onClick={() => setClientTab('this-month')}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            clientTab === 'this-month'
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                        }`}
                    >
                        Pengantin Bulan Ini ({currentMonthEvents.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setClientTab('active')}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            clientTab === 'active'
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                        }`}
                    >
                        Pengantin Aktif ({activeClients.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setClientTab('inactive')}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            clientTab === 'inactive'
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                        }`}
                    >
                        Selesai / Non-Aktif ({inactiveClients.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setClientTab('no-date')}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            clientTab === 'no-date'
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                        }`}
                    >
                        Belum Ada Tanggal ({noDateClients.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setClientTab('all')}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            clientTab === 'all'
                                ? 'bg-brand-accent text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547]'
                        }`}
                    >
                        Semua ({filteredClientData.length})
                    </button>
                </div>
                <div className="text-xs text-[#5A6A85] text-right">
                    Menampilkan <span className="font-bold text-[#2A3547]">{displayedClients.length}</span> {clientTab === 'this-month' ? 'acara' : 'pengantin'}
                </div>
            </div>

            {/* Mobile Cards for Selected Tab */}
            <div className="md:hidden p-2.5 space-y-2 bg-[#F4F6F9]/50">
                {displayedClients.map(client => (
                    <div
                        key={client.id + (clientTab === 'this-month' ? `-${client.mostRecentProject?.id || ''}` : '')}
                        className={`rounded-xl bg-white border border-[#EAEFF4] p-3 shadow-xs transition-all ${
                            client.status !== ClientStatus.ACTIVE ? 'opacity-75' : ''
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#F4F6F9] flex items-center justify-center text-xs font-bold text-[#5A6A85]">
                                    {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-xs text-[#2A3547] leading-tight truncate">{client.name}</p>
                                    <p className="text-[10px] text-[#5A6A85] mt-0.5 truncate">{client.email || client.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {client.status !== ClientStatus.ACTIVE && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-gray-100 text-gray-600">
                                        {client.status}
                                    </span>
                                )}
                                {client.overallPaymentStatus && (
                                    <span
                                        className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${getPaymentStatusClass(
                                            client.overallPaymentStatus
                                        )}`}
                                    >
                                        {client.overallPaymentStatus}
                                    </span>
                                )}
                            </div>
                        </div>
                        {clientTab === 'this-month' && client.mostRecentProject && (
                            <div className="mt-2 border-t border-[#EAEFF4] pt-1.5">
                                <p className="truncate text-[11px] font-semibold text-brand-accent">{client.mostRecentProject.projectName}</p>
                                <p className="text-[10px] text-[#5A6A85]">{new Date(`${client.mostRecentProject.date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        )}
                        <div className="mt-2 flex items-center justify-between text-[11px] border-t border-[#EAEFF4] pt-1.5">
                            <div>
                                <span className="text-[#5A6A85] text-[10px] block">Total Nilai</span>
                                <span className="font-bold text-[11px] text-[#2A3547] tabular-nums">{formatCurrency(client.totalProjectValue)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[#5A6A85] text-[10px] block">Sisa Pembayaran</span>
                                <span className="font-bold text-[11px] text-red-600 tabular-nums">{formatCurrency(client.balanceDue)}</span>
                            </div>
                        </div>
                        <MobileExpandableExtra
                            labelOpen="Lihat Detail & Aksi"
                            labelClose="Ringkas"
                            headerRight={
                                <button
                                    onClick={() => onViewDetail(client)}
                                    className="px-2 py-1 rounded-lg bg-brand-accent text-white transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                                    title="Detail"
                                >
                                    <EyeIcon className="w-3 h-3 flex-shrink-0" />
                                    <span>Detail</span>
                                </button>
                            }
                        >
                            <div className="grid grid-cols-2 gap-y-1 text-[11px] mb-2">
                                <span className="text-[#5A6A85] text-[10px]">{clientTab === 'this-month' ? 'Acara Bulan Ini' : 'Acara Terbaru'}</span>
                                <span className="text-right text-[11px] font-medium truncate text-[#2A3547]">{client.mostRecentProject?.projectName || '-'}</span>
                                <span className="text-[#5A6A85] text-[10px]">Kontak</span>
                                <span className="text-right text-[10px] truncate text-[#5A6A85]">{client.phone || client.email || '-'}</span>
                            </div>
                            <div className="flex justify-end gap-1.5 pt-1 border-t border-[#EAEFF4]/60">
                                <button
                                    onClick={() => onEditClient(client, client.mostRecentProject || undefined)}
                                    className="px-2.5 py-1 rounded-lg solid-orange text-white transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                                    title="Edit"
                                >
                                    <PencilIcon className="w-3 h-3 flex-shrink-0" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={() => onAddProject(client)}
                                    className="px-2.5 py-1 rounded-lg solid-teal text-white transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                                    title="Tambah Acara"
                                >
                                    <PlusIcon className="w-3 h-3 flex-shrink-0" />
                                    <span>+ Acara</span>
                                </button>
                                <button
                                    onClick={() => onDeleteClient(client.id)}
                                    className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg bg-red-600 text-white transition-colors flex items-center justify-center"
                                    title="Hapus"
                                >
                                    <Trash2Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                </button>
                            </div>
                        </MobileExpandableExtra>
                    </div>
                ))}
                {displayedClients.length === 0 && (
                    <p className="text-center py-8 text-xs text-[#5A6A85]">Tidak ada data pengantin yang sesuai.</p>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-xs lg:text-sm text-left">
                    <thead className="text-[11px] font-bold text-[#5A6A85] uppercase tracking-wider bg-[#F4F6F9] border-b border-[#EAEFF4]">
                        <tr>
                            <th className="px-3 lg:px-4 py-3.5 text-center w-10">No</th>
                            <th className="px-3 lg:px-6 py-3.5">Pengantin</th>
                            <th className="px-3 lg:px-6 py-3.5">Status</th>
                            <th className="px-3 lg:px-6 py-3.5">Total Package</th>
                            <th className="px-3 lg:px-6 py-3.5">Sisa Pembayaran</th>
                            <th className="px-3 lg:px-6 py-3.5">{clientTab === 'this-month' ? 'Nama Acara Bulan Ini' : 'Acara Pernikahan Terbaru'}</th>
                            <th className="px-3 lg:px-6 py-3.5 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEFF4]">
                        {displayedClients.map((client, index) => (
                            <tr
                                key={client.id + (clientTab === 'this-month' ? `-${client.mostRecentProject?.id || ''}` : '')}
                                className={`hover:bg-[#F4F6F9]/60 transition-colors ${
                                    client.status !== ClientStatus.ACTIVE ? 'opacity-75' : ''
                                }`}
                            >
                                <td className="px-3 lg:px-4 py-3.5 text-center font-medium text-[#5A6A85]">{index + 1}</td>
                                <td className="px-3 lg:px-6 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#F4F6F9] flex items-center justify-center text-xs font-bold text-[#5A6A85]">
                                            {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#2A3547] text-sm truncate">{client.name}</p>
                                            <p className="text-xs text-[#5A6A85] truncate">{client.email || client.phone || '-'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 lg:px-6 py-3.5">
                                    <span
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                            client.status === ClientStatus.ACTIVE
                                                ? 'solid-teal text-white'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {client.status}
                                    </span>
                                </td>
                                <td className="px-3 lg:px-6 py-3.5 font-bold text-[#2A3547] whitespace-nowrap">{formatCurrency(client.totalProjectValue)}</td>
                                <td className="px-3 lg:px-6 py-3.5 font-bold text-red-600 whitespace-nowrap">{formatCurrency(client.balanceDue)}</td>
                                <td className="px-3 lg:px-6 py-3.5">
                                    <p className="font-medium text-[#2A3547] truncate max-w-[140px] lg:max-w-none">{client.mostRecentProject?.projectName || '-'}</p>
                                    {clientTab === 'this-month' && client.mostRecentProject?.date && (
                                        <p className="mt-0.5 text-[10px] text-[#5A6A85]">
                                            {new Date(`${client.mostRecentProject.date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    )}
                                    {client.overallPaymentStatus && (
                                        <div className="mt-1">
                                            <span
                                                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${getPaymentStatusClass(
                                                    client.overallPaymentStatus
                                                )}`}
                                            >
                                                {client.overallPaymentStatus}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 lg:px-6 py-3.5">
                                    <div className="flex items-center justify-center space-x-1.5">
                                        <button
                                            onClick={() => onViewDetail(client)}
                                            className="w-8 h-8 rounded-xl bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-white transition-colors flex items-center justify-center"
                                            title="Detail Pengantin"
                                        >
                                            <EyeIcon className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                        <button
                                            onClick={() => onEditClient(client, client.mostRecentProject || undefined)}
                                            className="w-8 h-8 rounded-xl bg-orange-600/10 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors flex items-center justify-center"
                                            title="Edit Pengantin"
                                        >
                                            <PencilIcon className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteClient(client.id)}
                                            className="w-8 h-8 rounded-xl bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
                                            title="Hapus Pengantin"
                                        >
                                            <Trash2Icon className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                        <button
                                            onClick={() => onAddProject(client)}
                                            className="w-8 h-8 rounded-xl bg-teal-600/10 text-teal-600 hover:bg-teal-600 hover:text-white transition-colors flex items-center justify-center"
                                            title="Tambah Acara Pernikahan Baru"
                                        >
                                            <PlusIcon className="w-4 h-4 flex-shrink-0" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {displayedClients.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-xs text-[#5A6A85]">
                        Tidak ada data pengantin yang sesuai dengan filter yang dipilih.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ClientTableView;
