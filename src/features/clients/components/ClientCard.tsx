import React from 'react';
import { Client, Project } from '../../../types';
import {
    PhoneIcon,
    MailIcon,
    InstagramIcon,
    WhatsappIcon,
    FileTextIcon,
    EyeIcon,
    FolderKanbanIcon,
    DollarSignIcon,
    CalendarIcon,
    AlertCircleIcon,
    CheckCircleIcon,
    StarIcon
} from '../../../constants';

interface ClientCardProps {
    client: Client;
    projects: Project[];
    onViewDetails: (client: Client) => void;
    onSendMessage: (client: Client) => void;
    onViewInvoice: (client: Client) => void;
    onSendReminder: (client: Client) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};

const formatPhoneNumber = (phone: string) => {
    // Format: 0812-3456-7890
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
};

export const ClientCard: React.FC<ClientCardProps> = ({
    client,
    projects,
    onViewDetails,
    onSendMessage,
    onViewInvoice,
    onSendReminder,
}) => {
    // Calculate statistics
    const clientProjects = projects.filter(p => p.clientId === client.id);
    const activeProjects = clientProjects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan');
    const completedProjects = clientProjects.filter(p => p.status === 'Selesai');

    const lifetimeValue = clientProjects.reduce((sum, p) => sum + p.totalCost, 0);
    const totalPaid = clientProjects.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalDue = lifetimeValue - totalPaid;

    // Get next upcoming project
    const upcomingProjects = activeProjects
        .filter(p => new Date(p.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextProject = upcomingProjects[0];

    // Determine if VIP (example: lifetime value > 20M or > 5 projects)
    const isVIP = lifetimeValue > 20000000 || completedProjects.length >= 5;

    // Member since
    const memberSince = new Date(client.since).toLocaleDateString('id-ID', {
        month: 'short',
        year: 'numeric'
    });

    return (
        <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border hover:shadow-xl transition-all duration-200 overflow-hidden">
            <div className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 flex items-center justify-center flex-shrink-0 border-2 border-brand-accent/20">
                            {client.avatarUrl ? (
                                <img src={client.avatarUrl} alt={`${client.name} avatar`} className="w-full h-full object-cover"  loading="lazy" decoding="async" />
                            ) : (
                                <span className="text-lg font-bold text-brand-accent">{client.name.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base sm:text-lg text-brand-text-light truncate">
                                {client.name}
                            </h3>
                            <p className="text-xs text-brand-text-secondary">
                                Terdaftar sejak {memberSince}
                            </p>
                        </div>
                    </div>
                    {isVIP && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-full solid-orange text-white font-semibold">
                            <StarIcon className="w-3 h-3 fill-current" />
                            VIP
                        </span>
                    )}
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                    {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-brand-text-secondary">
                            <PhoneIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{formatPhoneNumber(client.phone)}</span>
                        </div>
                    )}
                    {client.email && (
                        <div className="flex items-center gap-2 text-sm text-brand-text-secondary">
                            <MailIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{client.email}</span>
                        </div>
                    )}
                    {client.instagram && (
                        <div className="flex items-center gap-2 text-sm text-brand-text-secondary">
                            <InstagramIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">@{client.instagram}</span>
                        </div>
                    )}
                </div>

                {/* Statistics */}
                <div className="bg-brand-bg rounded-lg p-3 mb-4">
                    <h4 className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">
                        Statistik
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center gap-1 text-brand-text-secondary text-xs mb-1">
                                <FolderKanbanIcon className="w-3 h-3" />
                                <span>Acara Pernikahan</span>
                            </div>
                            <p className="text-sm font-bold text-brand-text-light">
                                {activeProjects.length} aktif • {completedProjects.length} selesai
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-brand-text-secondary text-xs mb-1">
                                <DollarSignIcon className="w-3 h-3" />
                                <span>Lifetime Value</span>
                            </div>
                            <p className="text-sm font-bold text-brand-text-light">
                                {formatCurrency(lifetimeValue)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Payment Status */}
                {totalDue > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircleIcon className="w-4 h-4 text-orange-500" />
                                <span className="text-sm font-semibold text-orange-500">
                                    Sisa Pembayaran
                                </span>
                            </div>
                            <span className="text-sm font-bold text-orange-500">
                                {formatCurrency(totalDue)}
                            </span>
                        </div>
                    </div>
                )}

                {totalDue === 0 && activeProjects.length > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-semibold text-green-500">
                                Semua Pembayaran Lunas
                            </span>
                        </div>
                    </div>
                )}

                {/* Next Project */}
                {nextProject && (
                    <div className="bg-brand-bg rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 text-brand-text-secondary text-xs mb-1">
                            <CalendarIcon className="w-3 h-3" />
                            <span>Acara Pernikahan Terdekat</span>
                        </div>
                        <p className="text-sm font-semibold text-brand-text-light truncate">
                            {nextProject.projectName}
                        </p>
                        <p className="text-xs text-brand-text-secondary">
                            {new Date(nextProject.date).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 justify-end">
                    <button
                        onClick={() => onSendMessage(client)}
                        className="w-8 h-8 rounded-lg bg-teal-600/10 text-teal-600 hover:bg-teal-600 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                        title="Chat WhatsApp"
                    >
                        <WhatsappIcon className="w-4 h-4 flex-shrink-0" />
                    </button>

                    <button
                        onClick={() => onViewInvoice(client)}
                        className="w-8 h-8 rounded-lg bg-[#F4F6F9] text-[#5A6A85] hover:bg-brand-accent hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                        title="Lihat Invoice"
                    >
                        <FileTextIcon className="w-4 h-4 flex-shrink-0" />
                    </button>

                    {totalDue > 0 && (
                        <button
                            onClick={() => onSendReminder(client)}
                            className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-600 hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                            title="Kirim Reminder"
                        >
                            <AlertCircleIcon className="w-4 h-4 flex-shrink-0" />
                        </button>
                    )}

                    <button
                        onClick={() => onViewDetails(client)}
                        className="w-8 h-8 rounded-lg bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                        title="Lihat Detail"
                    >
                        <EyeIcon className="w-4 h-4 flex-shrink-0" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientCard;
