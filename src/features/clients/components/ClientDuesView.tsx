import React from 'react';
import { WhatsappIcon } from '../../../constants';
import { ClientWithSummary } from '../hooks/useClients';
import { formatCurrency } from '../utils/clientHelpers';

interface ClientDuesViewProps {
    clientsWithDues: ClientWithSummary[];
    monthFilter: string;
    setMonthFilter: React.Dispatch<React.SetStateAction<string>>;
    showAllDues: boolean;
    setShowAllDues: React.Dispatch<React.SetStateAction<boolean>>;
    onBillingClick: (client: ClientWithSummary) => void;
}

export const ClientDuesView: React.FC<ClientDuesViewProps> = ({
    clientsWithDues,
    monthFilter,
    setMonthFilter,
    showAllDues,
    setShowAllDues,
    onBillingClick,
}) => {
    const displayedClients = showAllDues ? clientsWithDues : clientsWithDues.slice(0, 5);

    return (
        <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border widget-animate animate-fade-in">
            <div className="flex flex-col gap-2 border-b border-brand-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div>
                    <h3 className="font-semibold text-brand-text-light">
                        Rekap Pengantin Belum Lunas ({clientsWithDues.length})
                    </h3>
                    <p className="mt-0.5 text-[10px] text-brand-text-secondary">
                        {monthFilter ? `Periode ${new Date(`${monthFilter}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}` : 'Semua periode'}
                    </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-brand-text-secondary">
                    <span className="shrink-0">Filter bulan</span>
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={event => setMonthFilter(event.target.value)}
                        className="min-w-0 rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1.5 text-xs text-brand-text-primary outline-none focus:border-brand-accent"
                        aria-label="Filter rekap tunggakan per bulan"
                    />
                    {monthFilter && (
                        <button
                            type="button"
                            onClick={() => setMonthFilter('')}
                            className="shrink-0 text-[10px] font-semibold text-brand-accent hover:underline"
                        >Semua</button>
                    )}
                </label>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
                {displayedClients.map(client => (
                    <div key={client.id} className="rounded-2xl bg-white/5 border border-brand-border p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold text-brand-text-light leading-tight">{client.name}</p>
                                <p className="text-[11px] text-brand-text-secondary">{client.email}</p>
                            </div>
                            <button
                                onClick={() => onBillingClick(client)}
                                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-600 text-white !text-xs !px-3 !py-2 rounded-lg transition-colors"
                            >
                                <WhatsappIcon className="w-4 h-4" />
                                Ingatkan Pembayaran
                            </button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                            <span className="text-brand-text-secondary">Total Nilai</span>
                            <span className="text-right">{formatCurrency(client.totalProjectValue)}</span>
                            <span className="text-brand-text-secondary">Sisa Pembayaran</span>
                            <span className="text-right font-bold text-brand-danger">{formatCurrency(client.balanceDue)}</span>
                            <span className="text-brand-text-secondary">Acara Pernikahan Terbaru</span>
                            <span className="text-right">{client.mostRecentProject?.projectName || '-'}</span>
                        </div>
                    </div>
                ))}
                {clientsWithDues.length === 0 && (
                    <p className="text-center py-8 text-brand-text-secondary">Luar biasa! Semua pengantin sudah lunas.</p>
                )}
                {clientsWithDues.length > 5 && (
                    <button
                        onClick={() => setShowAllDues(p => !p)}
                        className="w-full py-2.5 text-sm font-medium text-brand-accent hover:text-brand-accent/80 border border-brand-accent/30 hover:border-brand-accent/60 rounded-xl transition-colors"
                    >
                        {showAllDues ? 'Tampilkan lebih sedikit' : `Lihat lebih banyak (${clientsWithDues.length - 5} lainnya)`}
                    </button>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-brand-text-secondary uppercase">
                        <tr>
                            <th className="px-4 py-4 font-medium tracking-wider text-center w-12">No</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Pengantin</th>
                            <th className="px-6 py-4 font-medium tracking-wider text-right">Total Package</th>
                            <th className="px-6 py-4 font-medium tracking-wider text-right">Sisa Pembayaran</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Acara Pernikahan Terbaru</th>
                            <th className="px-6 py-4 font-medium tracking-wider text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                        {displayedClients.map((client, index) => (
                            <tr key={client.id} className="hover:bg-brand-bg transition-colors">
                                <td className="px-4 py-4 text-center font-medium text-brand-text-secondary">{index + 1}</td>
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-brand-text-light">{client.name}</p>
                                    <p className="text-xs text-brand-text-secondary">{client.email}</p>
                                </td>
                                <td className="px-6 py-4 text-right">{formatCurrency(client.totalProjectValue)}</td>
                                <td className="px-6 py-4 text-right font-bold text-brand-danger">{formatCurrency(client.balanceDue)}</td>
                                <td className="px-6 py-4">{client.mostRecentProject?.projectName || '-'}</td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => onBillingClick(client)}
                                        className="btn-box-wa px-3 py-1.5 text-xs"
                                        title="Ingatkan Pembayaran via WhatsApp"
                                    >
                                        <WhatsappIcon className="w-4 h-4 flex-shrink-0 text-white" />
                                        <span>Ingatkan Pembayaran</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {clientsWithDues.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-brand-text-secondary">
                                    Luar biasa! Semua pengantin sudah lunas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {clientsWithDues.length > 5 && (
                    <div className="p-4 border-t border-brand-border text-center">
                        <button
                            onClick={() => setShowAllDues(p => !p)}
                            className="px-6 py-2.5 text-sm font-medium text-brand-accent hover:text-brand-accent/80 border border-brand-accent/30 hover:border-brand-accent/60 rounded-xl transition-colors"
                        >
                            {showAllDues ? 'Tampilkan lebih sedikit' : `Lihat lebih banyak (${clientsWithDues.length - 5} lainnya)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDuesView;
