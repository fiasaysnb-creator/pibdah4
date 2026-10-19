import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Lead, LeadStatus, ContactChannel, Client, Project, Package, ViewType, NavigationAction, Profile, BookingStatus } from '../../types';
import { ModernStatCard } from '../../components/modernize/ModernStatCard';
import { MobileCollapsibleSection, MobileExpandableExtra } from '../../components/ui/MobileProgressiveDisclosure';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../../shared/ui/Modal';
import DonutChart from '../../shared/ui/DonutChart';
import { UsersIcon, DollarSignIcon, PackageIcon, EyeIcon, MessageSquareIcon, CalendarIcon, CheckCircleIcon, CheckIcon, BanIcon, LayoutGridIcon, ListIcon, MessageCircleIcon, WhatsappIcon, PencilIcon, Trash2Icon, BarChart2Icon, TrendingUpIcon, ChevronDownIcon, ClockIcon } from '../../constants';
import { cleanPhoneNumber, CHAT_TEMPLATES } from '../../constants';
import { formatIdNumber } from '../../utils/currency';
import { updateProject, deleteProject } from '../../services/projects';
import { createLead as createLeadRow, updateLead as updateLeadRow } from '../../services/leads';
import { upsertProfile } from '../../services/profile';
import { useChatTemplates } from '../../hooks/useChatTemplates';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format to dd/mm/yyyy
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};


const bookingStatusConfig: Record<BookingStatus, { color: string; bgColor: string, icon: React.ReactNode }> = {
    [BookingStatus.BARU]: { color: 'text-white', bgColor: 'solid-blue', icon: <WhatsappIcon className="w-4 h-4" /> },
    [BookingStatus.TERKONFIRMASI]: { color: 'text-white', bgColor: 'solid-green', icon: <CheckCircleIcon className="w-4 h-4" /> },
    [BookingStatus.DITOLAK]: { color: 'text-white', bgColor: 'bg-red-600', icon: <BanIcon className="w-4 h-4" /> },
};

const BookingChart: React.FC<{ bookings: { lead: Lead; project: Project }[] }> = ({ bookings }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; data: { name: string; count: number; value: number } } | null>(null);

    const chartData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const data = months.map(month => ({ name: month, count: 0, value: 0 }));

        bookings.forEach(booking => {
            const bookingDate = new Date(booking.lead.date);
            if (bookingDate.getFullYear() === currentYear) {
                const monthIndex = bookingDate.getMonth();
                data[monthIndex].count += 1;
                data[monthIndex].value += booking.project.totalCost;
            }
        });
        return data;
    }, [bookings]);

    const maxCount = Math.max(...chartData.map(d => d.count), 1);
    const maxValue = Math.max(...chartData.map(d => d.value), 1);

    const hasData = chartData.some(d => d.count > 0 || d.value > 0);

    if (!hasData) {
        return (
            <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border h-full">
                <h3 className="font-bold text-lg text-gradient mb-6">Grafik Booking Tahun Ini</h3>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-brand-bg border-2 border-dashed border-brand-border flex items-center justify-center mb-3">
                        <BarChart2Icon className="w-10 h-10 text-brand-text-secondary" />
                    </div>
                    <p className="text-sm font-medium text-brand-text-light mb-1">Belum Ada Booking Tahun Ini</p>
                    <p className="text-xs text-brand-text-secondary">Data booking akan muncul di sini</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border h-full">
            <h3 className="font-bold text-lg text-gradient mb-2">Grafik Booking Tahun Ini</h3>
            <p className="text-xs text-brand-text-secondary mb-6">Jumlah dan nilai booking per bulan</p>
            <div className="h-48 flex justify-between items-end gap-1.5 relative bg-brand-bg/30 rounded-lg p-3">
                {chartData.map((item, index) => {
                    const countHeight = Math.max((item.count / maxCount) * 100, 3);
                    const valueHeight = Math.max((item.value / maxValue) * 100, 3);
                    const isHovered = tooltip?.data.name === item.name;
                    return (
                        <div
                            key={item.name}
                            className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                            onMouseEnter={() => setTooltip({ x: (index / chartData.length) * 100, y: 0, data: item })}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <div className="flex-1 flex items-end w-full justify-center gap-0.5">
                                <div
                                    className={`w-1/2 rounded-t-md transition-all duration-300 ${isHovered ? 'bg-blue-600 shadow-lg' : 'bg-blue-600/40 hover:bg-blue-600/60'}`}
                                    style={{ height: `${countHeight}%` }}
                                ></div>
                                <div
                                    className={`w-1/2 rounded-t-md transition-all duration-300 ${isHovered ? 'bg-green-600 shadow-lg' : 'bg-green-100 hover:bg-green-100'}`}
                                    style={{ height: `${valueHeight}%` }}
                                ></div>
                            </div>
                            <span className={`text-[10px] mt-2 transition-colors ${isHovered ? 'text-brand-accent font-semibold' : 'text-brand-text-secondary'}`}>
                                {item.name}
                            </span>
                        </div>
                    );
                })}
                {tooltip && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-br from-brand-surface to-brand-bg border-2 border-brand-accent/30 p-3 rounded-xl shadow-2xl text-xs z-10 min-w-[160px]">
                        <p className="font-bold text-center border-b border-brand-accent/30 pb-1.5 mb-2 text-brand-accent">{tooltip.data.name}</p>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                                    <span className="text-brand-text-secondary">Jumlah</span>
                                </div>
                                <span className="font-semibold text-blue-800">{tooltip.data.count}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 bg-green-600 rounded-full"></span>
                                    <span className="text-brand-text-secondary">Nilai</span>
                                </div>
                                <span className="font-semibold text-green-800">{formatCurrency(tooltip.data.value)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex justify-center items-center gap-6 text-xs mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600/40 rounded-md"></div>
                    <span className="text-brand-text-secondary">Jumlah Booking</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-100 rounded-md"></div>
                    <span className="text-brand-text-secondary">Nilai Booking</span>
                </div>
            </div>
        </div>
    );
};


interface WhatsappTemplateModalProps {
    project: Project;
    client: Client;
    onClose: () => void;
    showNotification: (message: string) => void;
    userProfile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
}

const WhatsappTemplateModal: React.FC<WhatsappTemplateModalProps> = ({ project, client, onClose, showNotification, userProfile, setProfile }) => {
    const { templates, processTemplate: processTemplateFunc, updateTemplate, isOnline } = useChatTemplates(userProfile);
    const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id || '');
    const [customMessage, setCustomMessage] = useState('');

    useEffect(() => {
        const template = templates.find(t => t.id === selectedTemplate)?.template || '';
        
        const sisaTagihan = (project.totalCost || 0) - (project.amountPaid || 0);
        const portalBaseUrl = `${window.location.origin}${window.location.pathname}#/portal/`;
        const portalLink = client.portalAccessId ? `${portalBaseUrl}${client.portalAccessId}` : '{portalLink}';

        const processedMessage = processTemplateFunc(template, {
            clientName: client.name,
            projectName: project.projectName,
            packageName: project.packageName || '-',
            amountPaid: formatIdNumber(project.amountPaid || 0),
            totalCost: formatIdNumber(project.totalCost || 0),
            sisaTagihan: formatIdNumber(sisaTagihan),
            portalLink: portalLink
        });
        setCustomMessage(processedMessage);
    }, [selectedTemplate, client, project, templates, processTemplateFunc]);

    // Ensure selectedTemplate is always valid when templates list changes
    useEffect(() => {
        if (!templates.find(t => t.id === selectedTemplate)) {
            setSelectedTemplate(templates[0]?.id || '');
        }
    }, [templates, selectedTemplate]);

    const handleSelectTemplate = (templateId: string) => {
        setSelectedTemplate(templateId);
    };

    const handleShareToWhatsApp = () => {
        if (!client.phone) {
            showNotification('Nomor telepon pengantin tidak tersedia.');
            return;
        }
        const phoneNumber = cleanPhoneNumber(client.phone);
        const encodedMessage = encodeURIComponent(customMessage);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        onClose();
    };

    const handleSaveTemplate = async () => {
        const rawTemplate = customMessage
            .replace(new RegExp(client.name, 'g'), '{clientName}')
            .replace(new RegExp(project.projectName, 'g'), '{projectName}');

        try {
            await updateTemplate(selectedTemplate, { template: rawTemplate });
            showNotification(isOnline ? 'Template berhasil disimpan!' : 'Template disimpan offline, akan disinkronkan saat online');
        } catch (err) {
            console.error('[Chat Template] Gagal menyimpan template:', err);
            showNotification('Gagal menyimpan template.');
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Kirim Pesan ke ${client.name}`} size="2xl">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-brand-text-secondary">Gunakan Template Pesan:</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {templates.map(template => (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => handleSelectTemplate(template.id)}
                                className={`button-secondary !text-xs !px-3 !py-1.5 ${selectedTemplate === template.id ? '!bg-brand-accent !text-white !border-brand-accent' : ''}`}
                            >
                                {template.title}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="input-group">
                    <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows={8} className="input-field"></textarea>
                    <label className="input-label">Isi Pesan</label>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-brand-border">
                    <button onClick={handleSaveTemplate} className="button-secondary">Simpan Template Ini</button>
                    <button onClick={handleShareToWhatsApp} className="button-primary inline-flex items-center gap-2">
                        <WhatsappIcon className="w-5 h-5" /> Kirim via WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
};


interface BookingProps {
    leads: Lead[];
    setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
    leadsLoaded: boolean;
    projectsLoaded: boolean;
    clients: Client[];
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    packages: Package[];
    userProfile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    handleNavigation: (view: ViewType, action?: NavigationAction) => void;
    showNotification: (message: string) => void;
}

const Booking: React.FC<BookingProps> = ({ leads, setLeads, leadsLoaded, projectsLoaded, clients, projects, setProjects, packages, userProfile, setProfile, handleNavigation, showNotification }) => {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'new' | 'confirmed' | 'analytics'>('new');
    const [showVisualSummary, setShowVisualSummary] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
    const [whatsappTemplateModal, setWhatsappTemplateModal] = useState<{ project: Project, client: Client } | null>(null);
    const [activeStatModal, setActiveStatModal] = useState<string | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [mobileDateOpen, setMobileDateOpen] = useState(false);
    const activeBookingFilterCount = [dateFrom, dateTo].filter(Boolean).length;

    const allBookings = useMemo(() => {
        return projects
            .filter(p => p.bookingStatus)
            .map(project => {
                const lead = leads.find(l => l.notes?.includes(project.clientId)) || {
                    id: `lead-fallback-${project.id}`,
                    name: project.clientName,
                    date: project.date, // Fallback to project date
                };
                return { lead: lead as Lead, project };
            })
            .sort((a, b) => new Date(b.lead.date).getTime() - new Date(a.lead.date).getTime());
    }, [projects, leads]);

    const newBookings = useMemo(() => allBookings.filter(b => b.project.bookingStatus === BookingStatus.BARU), [allBookings]);
    const confirmedBookings = useMemo(() => allBookings.filter(b => b.project.bookingStatus === BookingStatus.TERKONFIRMASI), [allBookings]);

    const matchesSearchAndDate = (booking: { lead: Lead; project: Project }) => {
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        const bookingDate = new Date(booking.lead.date);
        const dateMatch = (!from || bookingDate >= from) && (!to || bookingDate <= to);

        const q = searchQuery.trim().toLowerCase();
        const searchMatch = !q ||
            booking.project.clientName.toLowerCase().includes(q) ||
            booking.project.projectName.toLowerCase().includes(q) ||
            (booking.project.packageName && booking.project.packageName.toLowerCase().includes(q)) ||
            (booking.project.location && booking.project.location.toLowerCase().includes(q));

        return dateMatch && searchMatch;
    };

    const filteredNewBookings = useMemo(() => {
        return newBookings.filter(matchesSearchAndDate);
    }, [newBookings, dateFrom, dateTo, searchQuery]);

    const filteredConfirmedBookings = useMemo(() => {
        return confirmedBookings.filter(matchesSearchAndDate);
    }, [confirmedBookings, dateFrom, dateTo, searchQuery]);

    const syncedClientIds = useRef(new Set<string>());
    const syncingClientIds = useRef(new Set<string>());
    const hasSyncedExistingBookings = useRef(false);

    const syncBookingToLead = async (project: Project) => {
        const clientId = project.clientId;
        if (!clientId || syncedClientIds.current.has(clientId) || syncingClientIds.current.has(clientId)) return;
        syncingClientIds.current.add(clientId);

        try {
            const client = clients.find(item => item.id === clientId);
            const clientName = client?.name || project.clientName;
            const existingLead = leads.find(lead => lead.notes?.includes(clientId)) ||
                leads.find(lead => lead.name.trim().toLowerCase() === clientName.trim().toLowerCase());
            const linkedNotes = existingLead?.notes?.includes(clientId)
                ? existingLead.notes
                : [existingLead?.notes, `Dikonversi menjadi Pengantin ID: ${clientId}`].filter(Boolean).join('\n');

            if (existingLead) {
                if (existingLead.status === LeadStatus.CONVERTED && existingLead.notes?.includes(clientId)) {
                    syncedClientIds.current.add(clientId);
                    return;
                }
                const updated = await updateLeadRow(existingLead.id, {
                    status: LeadStatus.CONVERTED,
                    notes: linkedNotes,
                });
                setLeads(prev => prev.map(lead => lead.id === updated.id ? updated : lead));
            } else {
                const created = await createLeadRow({
                    name: clientName,
                    contactChannel: ContactChannel.OTHER,
                    location: project.location || '',
                    status: LeadStatus.CONVERTED,
                    date: project.date || new Date().toISOString(),
                    notes: `Dikonversi dari booking terkonfirmasi. Pengantin ID: ${clientId}`,
                    whatsapp: client?.whatsapp || client?.phone || undefined,
                    address: client?.address || client?.homeAddress || undefined,
                });
                setLeads(prev => prev.some(lead => lead.id === created.id) ? prev : [created, ...prev]);
            }
            syncedClientIds.current.add(clientId);
        } finally {
            syncingClientIds.current.delete(clientId);
        }
    };

    useEffect(() => {
        if (!leadsLoaded || !projectsLoaded || hasSyncedExistingBookings.current) return;
        hasSyncedExistingBookings.current = true;

        void (async () => {
            for (const booking of confirmedBookings) {
                try {
                    await syncBookingToLead(booking.project);
                } catch (error) {
                    console.warn('[Booking] Failed to sync confirmed booking to conversions:', error);
                }
            }
        })();
    }, [leadsLoaded, projectsLoaded]);

    // Removed public booking share feature per request

    const packageDonutData = useMemo(() => {
        const packageCounts = allBookings.reduce((acc, booking) => {
            const name = booking.project.packageName || 'Unknown';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444'];
        return Object.entries(packageCounts)
            .map(([label, value], i) => ({
                label,
                value,
                color: colors[i % colors.length]
            }));
    }, [allBookings]);

    // Removed share QR generation effect

    // Removed share helpers (copy link, download QR)

    const mostPopularPackage = useMemo(() => {
        const counts = allBookings.reduce((acc, p) => { acc[p.project.packageName] = (acc[p.project.packageName] || 0) + 1; return acc; }, {} as Record<string, number>);
        return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'N/A';
    }, [allBookings]);

    const statModalData = useMemo(() => {
        if (!activeStatModal) return { title: '', bookings: [] };

        switch (activeStatModal) {
            case 'total':
                return { title: 'Semua Booking', bookings: allBookings };
            case 'value':
                return { title: 'Semua Booking (berdasarkan Nilai)', bookings: allBookings };
            case 'popular':
                return { title: `Booking untuk Package: ${mostPopularPackage}`, bookings: allBookings.filter(b => b.project.packageName === mostPopularPackage) };
            case 'new':
                return { title: 'Booking Baru', bookings: newBookings };
            default:
                return { title: '', bookings: [] };
        }
    }, [activeStatModal, allBookings, newBookings, mostPopularPackage]);

    const handleDeleteBooking = async (projectId: string, clientName: string) => {
        if (!window.confirm(`Apakah Anda yakin ingin menghapus booking untuk ${clientName}? Tindakan ini tidak dapat dibatalkan.`)) return;
        try {
            await deleteProject(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
            showNotification('Booking berhasil dihapus.');
        } catch (err) {
            console.error('[Booking] Failed to delete booking:', err);
            showNotification('Gagal menghapus booking. Silakan coba lagi.');
        }
    };

    const handleEditBooking = (clientId: string) => {
        handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: clientId });
    };

    const handleStatusChange = async (projectId: string, newStatus: BookingStatus) => {
        const prevStatus = projects.find(p => p.id === projectId)?.bookingStatus;
        const project = projects.find(p => p.id === projectId);
        // Optimistic update
        setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, bookingStatus: newStatus } : p)));
        try {
            await updateProject(projectId, { bookingStatus: newStatus });
        } catch (err) {
            console.warn('[Booking] Failed to persist booking status:', err);
            // Revert on failure
            setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, bookingStatus: prevStatus } : p)));
            showNotification('Gagal menyimpan perubahan status booking. Silakan coba lagi.');
            return;
        }

        if (newStatus === BookingStatus.TERKONFIRMASI && project) {
            try {
                await syncBookingToLead(project);
            } catch (err) {
                console.warn('[Booking] Failed to sync confirmed booking to conversions:', err);
                showNotification('Booking dikonfirmasi, tetapi data konversi gagal disinkronkan.');
                return;
            }
        }

        showNotification(`Booking berhasil ${newStatus === BookingStatus.TERKONFIRMASI ? 'dikonfirmasi' : 'ditolak'}.`);
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Primary Metrics Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
                <div onClick={() => setActiveStatModal('total')} className="cursor-pointer transition-transform duration-200 hover:scale-[1.02]">
                    <ModernStatCard icon={<UsersIcon className="w-5 h-5" />} title="Total Booking" value={allBookings.length.toString()} subtitle="Semua booking yang masuk" iconColorVariant="primary" compactOnMobile />
                </div>
                <div onClick={() => setActiveStatModal('value')} className="cursor-pointer transition-transform duration-200 hover:scale-[1.02]">
                    <ModernStatCard icon={<DollarSignIcon className="w-5 h-5" />} title="Total Nilai Booking" value={formatCurrency(allBookings.reduce((sum, b) => sum + b.project.totalCost, 0))} subtitle="Nilai keseluruhan booking" iconColorVariant="warning" compactOnMobile />
                </div>
                <div onClick={() => setActiveStatModal('popular')} className="cursor-pointer transition-transform duration-200 hover:scale-[1.02]">
                    <ModernStatCard icon={<PackageIcon className="w-5 h-5" />} title="Package Terpopuler" value={mostPopularPackage} subtitle="Package paling banyak dipilih" iconColorVariant="secondary" compactOnMobile />
                </div>
                <div onClick={() => setActiveStatModal('new')} className="cursor-pointer transition-transform duration-200 hover:scale-[1.02]">
                    <ModernStatCard icon={<WhatsappIcon className="w-5 h-5" />} title="Booking Baru" value={newBookings.length.toString()} subtitle="Menunggu konfirmasi" iconColorVariant="error" compactOnMobile />
                </div>
            </div>

            {/* Segmented Tab Navigation */}
            <div className="border-b border-brand-border non-printable">
                <div className="flex items-center justify-between overflow-x-auto pb-1 gap-2">
                    <nav className="-mb-px flex space-x-4 sm:space-x-8">
                        <button
                            onClick={() => setActiveTab('new')}
                            className={`shrink-0 inline-flex items-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 border-b-2 ${activeTab === 'new' ? 'border-blue-600 text-blue-800 bg-blue-100' : 'border-transparent text-blue-700 bg-blue-50 hover:bg-blue-100'}`}
                        >
                            <ClockIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Booking Baru</span>
                            {newBookings.length > 0 && (
                                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    {newBookings.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('confirmed')}
                            className={`shrink-0 inline-flex items-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 border-b-2 ${activeTab === 'confirmed' ? 'border-blue-600 text-blue-800 bg-blue-100' : 'border-transparent text-blue-700 bg-blue-50 hover:bg-blue-100'}`}
                        >
                            <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Riwayat Booking</span>
                            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-bg text-brand-text-secondary">
                                {confirmedBookings.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`shrink-0 inline-flex items-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 border-b-2 ${activeTab === 'analytics' ? 'border-blue-600 text-blue-800 bg-blue-100' : 'border-transparent text-blue-700 bg-blue-50 hover:bg-blue-100'}`}
                        >
                            <BarChart2Icon className="w-4 h-4 flex-shrink-0" />
                            <span>Analitik & Distribusi</span>
                        </button>
                    </nav>

                    {(activeTab === 'new' || activeTab === 'confirmed') && (
                        <button
                            onClick={() => setShowVisualSummary(prev => !prev)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showVisualSummary ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-brand-surface border-brand-border text-brand-text-secondary hover:text-brand-text-light'}`}
                            title="Buka/Tutup visualisasi ringkas"
                        >
                            <TrendingUpIcon className="w-3.5 h-3.5" />
                            <span>{showVisualSummary ? 'Sembunyikan Grafik' : 'Lihat Ringkasan Grafik'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Optional Collapsible Visual Summary for List Tabs */}
            {(activeTab === 'new' || activeTab === 'confirmed') && showVisualSummary && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-4 rounded-2xl bg-brand-bg/60 border border-brand-border animate-fade-in">
                    <div className="lg:col-span-3">
                        <BookingChart bookings={allBookings} />
                    </div>
                    <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                        <h3 className="font-bold text-lg text-gradient mb-4">Distribusi Package</h3>
                        <DonutChart data={packageDonutData} />
                    </div>
                </div>
            )}

            {/* Tab Content: Booking Baru */}
            {activeTab === 'new' && (
                <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border space-y-3 p-3 sm:space-y-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border pb-2.5 sm:pb-4">
                        <div>
                            <h3 className="font-semibold text-brand-text-light text-sm sm:text-lg">
                                Booking Baru Menunggu Konfirmasi ({newBookings.length})
                            </h3>
                            <p className="text-[10px] text-brand-text-secondary mt-0.5 sm:text-xs">
                                Verifikasi bukti bayar DP dan konfirmasi jadwal untuk pengantin.
                            </p>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="space-y-2">
                        <div className="flex sm:hidden items-center gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 flex-1 min-w-0 text-xs"
                                placeholder="Cari nama, acara, paket..."
                            />
                            <button
                                type="button"
                                onClick={() => setMobileDateOpen(prev => !prev)}
                                className={`px-2.5 py-2 rounded-lg border text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-all ${
                                    mobileDateOpen || activeBookingFilterCount > 0
                                        ? 'bg-[#ECF2FF] border-[#5D87FF]/30 text-[#5D87FF]'
                                        : 'bg-brand-bg border-brand-border text-brand-text-secondary'
                                }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Tanggal</span>
                                {activeBookingFilterCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[9px] font-bold">
                                        {activeBookingFilterCount}
                                    </span>
                                )}
                                {mobileDateOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        </div>
                        {mobileDateOpen && (
                            <div className="sm:hidden grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2 py-1.5 w-full text-xs"
                                    title="Dari Tanggal"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2 py-1.5 w-full text-xs"
                                    title="Sampai Tanggal"
                                />
                            </div>
                        )}
                        <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
                            <div className="sm:col-span-1">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    placeholder="Cari nama, acara, paket..."
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    title="Dari Tanggal"
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    title="Sampai Tanggal"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2.5">
                        {filteredNewBookings.map(booking => (
                            <div key={booking.project.id} className="rounded-xl bg-white/5 border border-brand-border p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-brand-text-light leading-tight text-sm truncate">{booking.project.clientName}</p>
                                        <p className="text-[10px] text-brand-text-secondary mt-0.5 truncate">{booking.project.projectName} • {formatDate(booking.lead.date)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-semibold text-brand-accent">{booking.project.packageName}</p>
                                        <p className="text-[10px] font-bold text-green-800">DP: {formatCurrency(booking.project.amountPaid)}</p>
                                    </div>
                                </div>
                                <MobileExpandableExtra
                                    labelOpen="Lihat Rincian & Aksi"
                                    labelClose="Ringkas"
                                    headerRight={
                                        <button onClick={() => handleStatusChange(booking.project.id, BookingStatus.TERKONFIRMASI)} className="button-primary !text-[10px] !px-2.5 !py-1">Konfirmasi</button>
                                    }
                                >
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-y-1 text-xs">
                                            <span className="text-brand-text-secondary">Jenis & Lokasi</span>
                                            <span className="text-right font-medium">{booking.project.projectType} • {booking.project.location || '-'}</span>
                                            <span className="text-brand-text-secondary">Total Biaya</span>
                                            <span className="text-right font-semibold">{formatCurrency(booking.project.totalCost)}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 pt-1">
                                            {booking.project.dpProofUrl && (
                                                <button onClick={() => setViewingProofUrl(booking.project.dpProofUrl!)} className="button-secondary !text-[10px] !px-2.5 !py-1">Lihat Bukti</button>
                                            )}
                                            <button onClick={() => handleEditBooking(booking.project.clientId)} className="button-secondary !text-[10px] !px-2.5 !py-1 inline-flex items-center gap-1"><PencilIcon className="w-3 h-3" /> Edit</button>
                                            <button onClick={() => handleDeleteBooking(booking.project.id, booking.project.clientName)} className="button-secondary !text-[10px] !px-2.5 !py-1 !text-brand-danger !border-brand-danger hover:!bg-brand-danger/10 inline-flex items-center gap-1"><Trash2Icon className="w-3 h-3" /> Hapus</button>
                                        </div>
                                    </div>
                                </MobileExpandableExtra>
                            </div>
                        ))}
                        {filteredNewBookings.length === 0 && (
                            <p className="text-center py-8 text-sm text-brand-text-secondary">Tidak ada booking baru yang cocok dengan filter.</p>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-brand-text-secondary uppercase bg-brand-bg/40">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">No</th>
                                    <th className="px-4 py-3">Tanggal Booking</th>
                                    <th className="px-4 py-3">Nama Pengantin</th>
                                    <th className="px-4 py-3">Nama Acara</th>
                                    <th className="px-4 py-3">Jenis Acara</th>
                                    <th className="px-4 py-3">Lokasi</th>
                                    <th className="px-4 py-3">Package</th>
                                    <th className="px-4 py-3 text-right">Total Biaya</th>
                                    <th className="px-4 py-3 text-right">DP Dibayar</th>
                                    <th className="px-4 py-3 text-center">Bukti Bayar</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border">
                                {filteredNewBookings.map((booking, index) => (
                                    <tr key={booking.project.id} className="hover:bg-brand-bg/60 transition-colors">
                                        <td className="px-4 py-3 text-center font-medium text-brand-text-secondary">{index + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(booking.lead.date)}</td>
                                        <td className="px-4 py-3 font-semibold text-brand-text-light">{booking.project.clientName}</td>
                                        <td className="px-4 py-3">{booking.project.projectName}</td>
                                        <td className="px-4 py-3">{booking.project.projectType}</td>
                                        <td className="px-4 py-3">{booking.project.location}</td>
                                        <td className="px-4 py-3">{booking.project.packageName}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(booking.project.totalCost)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-green-800">{formatCurrency(booking.project.amountPaid)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {booking.project.dpProofUrl ? (
                                                <button
                                                    onClick={() => setViewingProofUrl(booking.project.dpProofUrl!)}
                                                    className="button-secondary !text-xs !px-3 !py-1.5"
                                                >
                                                    Lihat Bukti
                                                </button>
                                            ) : (
                                                <span className="text-brand-text-secondary text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => handleEditBooking(booking.project.clientId)} className="p-1.5 text-brand-text-secondary hover:bg-brand-input rounded-lg" title="Edit Booking"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteBooking(booking.project.id, booking.project.clientName)} className="p-1.5 text-brand-danger hover:bg-brand-danger/10 rounded-lg" title="Hapus Booking"><Trash2Icon className="w-4 h-4" /></button>
                                                <button
                                                    onClick={() => handleStatusChange(booking.project.id, BookingStatus.TERKONFIRMASI)}
                                                    className="button-primary !text-xs !px-3 !py-1.5"
                                                >
                                                    Konfirmasi
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredNewBookings.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="text-center py-10 text-brand-text-secondary">Tidak ada booking baru yang cocok dengan filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab Content: Riwayat Terkonfirmasi */}
            {activeTab === 'confirmed' && (
                <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border space-y-4 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
                        <div>
                            <h3 className="font-semibold text-brand-text-light text-base sm:text-lg">
                                Riwayat Booking Dikonfirmasi ({confirmedBookings.length})
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Daftar seluruh booking yang telah aktif dan masuk ke pipeline jadwal produksi.
                            </p>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="space-y-2">
                        <div className="flex sm:hidden items-center gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 flex-1 min-w-0 text-xs"
                                placeholder="Cari nama, acara, paket..."
                            />
                            <button
                                type="button"
                                onClick={() => setMobileDateOpen(prev => !prev)}
                                className={`px-2.5 py-2 rounded-lg border text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-all ${
                                    mobileDateOpen || activeBookingFilterCount > 0
                                        ? 'bg-[#ECF2FF] border-[#5D87FF]/30 text-[#5D87FF]'
                                        : 'bg-brand-bg border-brand-border text-brand-text-secondary'
                                }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Tanggal</span>
                                {activeBookingFilterCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[9px] font-bold">
                                        {activeBookingFilterCount}
                                    </span>
                                )}
                                {mobileDateOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        </div>
                        {mobileDateOpen && (
                            <div className="sm:hidden grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2 py-1.5 w-full text-xs"
                                    title="Dari Tanggal"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2 py-1.5 w-full text-xs"
                                    title="Sampai Tanggal"
                                />
                            </div>
                        )}
                        <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
                            <div className="sm:col-span-1">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    placeholder="Cari nama, acara, paket..."
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    title="Dari Tanggal"
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="input-field !rounded-lg !border !bg-brand-bg px-2.5 py-2 w-full text-xs sm:text-sm"
                                    title="Sampai Tanggal"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2.5">
                        {filteredConfirmedBookings.map(booking => {
                            const client = clients.find(c => c.id === booking.project.clientId);
                            return (
                                <div key={booking.project.id} className="rounded-xl bg-white/5 border border-brand-border p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-brand-text-light leading-tight text-sm truncate">{booking.project.clientName}</p>
                                            <p className="text-[10px] text-brand-text-secondary mt-0.5 truncate">{booking.project.projectName} • {formatDate(booking.lead.date)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-semibold text-brand-accent">{booking.project.packageName}</p>
                                            <p className="text-[10px] font-bold text-green-800">DP: {formatCurrency(booking.project.amountPaid)}</p>
                                        </div>
                                    </div>
                                    <MobileExpandableExtra
                                        labelOpen="Lihat Rincian & Aksi"
                                        labelClose="Ringkas"
                                        headerRight={
                                            <button onClick={() => handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: booking.project.clientId })} className="btn-box-read !text-[10px] !px-2.5 !py-1">Detail</button>
                                        }
                                    >
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-y-1 text-xs">
                                                <span className="text-brand-text-secondary">Jenis & Lokasi</span>
                                                <span className="text-right font-medium">{booking.project.projectType} • {booking.project.location || '-'}</span>
                                                <span className="text-brand-text-secondary">Total Biaya</span>
                                                <span className="text-right font-semibold">{formatCurrency(booking.project.totalCost)}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-1.5 pt-1">
                                                {client && (
                                                    <button onClick={() => setWhatsappTemplateModal({ project: booking.project, client })} className="button-secondary !text-[10px] !px-2.5 !py-1 inline-flex items-center gap-1"><WhatsappIcon className="w-3 h-3" /> Chat WA</button>
                                                )}
                                                <button onClick={() => handleEditBooking(booking.project.clientId)} className="button-secondary !text-[10px] !px-2.5 !py-1 inline-flex items-center gap-1"><PencilIcon className="w-3 h-3" /> Edit</button>
                                                <button onClick={() => handleDeleteBooking(booking.project.id, booking.project.clientName)} className="button-secondary !text-[10px] !px-2.5 !py-1 !text-brand-danger !border-brand-danger hover:!bg-brand-danger/10 inline-flex items-center gap-1"><Trash2Icon className="w-3 h-3" /> Hapus</button>
                                            </div>
                                        </div>
                                    </MobileExpandableExtra>
                                </div>
                            );
                        })}
                        {filteredConfirmedBookings.length === 0 && (
                            <p className="text-center py-8 text-sm text-brand-text-secondary">Belum ada booking yang dikonfirmasi cocok dengan filter.</p>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-brand-text-secondary uppercase bg-brand-bg/40">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">No</th>
                                    <th className="px-4 py-3">Tanggal Booking</th>
                                    <th className="px-4 py-3">Nama Pengantin</th>
                                    <th className="px-4 py-3">Nama Acara</th>
                                    <th className="px-4 py-3">Jenis Acara</th>
                                    <th className="px-4 py-3">Lokasi</th>
                                    <th className="px-4 py-3">Package</th>
                                    <th className="px-4 py-3 text-right">Total Biaya</th>
                                    <th className="px-4 py-3 text-right">DP Dibayar</th>
                                    <th className="px-4 py-3 text-center">Bukti Bayar</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border">
                                {filteredConfirmedBookings.map((booking, index) => {
                                    const client = clients.find(c => c.id === booking.project.clientId);
                                    return (
                                        <tr key={booking.project.id} className="hover:bg-brand-bg/60 transition-colors">
                                            <td className="px-4 py-3 text-center font-medium text-brand-text-secondary">{index + 1}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(booking.lead.date)}</td>
                                            <td className="px-4 py-3 font-semibold text-brand-text-light">{booking.project.clientName}</td>
                                            <td className="px-4 py-3">{booking.project.projectName}</td>
                                            <td className="px-4 py-3">{booking.project.projectType}</td>
                                            <td className="px-4 py-3">{booking.project.location}</td>
                                            <td className="px-4 py-3">{booking.project.packageName}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(booking.project.totalCost)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-800">{formatCurrency(booking.project.amountPaid)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {booking.project.dpProofUrl ? (
                                                    <button
                                                        onClick={() => setViewingProofUrl(booking.project.dpProofUrl!)}
                                                        className="button-secondary !text-xs !px-3 !py-1.5"
                                                    >
                                                        Lihat Bukti
                                                    </button>
                                                ) : (
                                                    <span className="text-brand-text-secondary text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => handleEditBooking(booking.project.clientId)} className="p-1.5 text-brand-text-secondary hover:bg-brand-input rounded-lg" title="Edit Booking"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteBooking(booking.project.id, booking.project.clientName)} className="p-1.5 text-brand-danger hover:bg-brand-danger/10 rounded-lg" title="Hapus Booking"><Trash2Icon className="w-4 h-4" /></button>
                                                    {client && (
                                                        <button
                                                            onClick={() => setWhatsappTemplateModal({ project: booking.project, client })}
                                                            className="button-secondary text-xs px-2.5 py-1.5 inline-flex items-center gap-1.5"
                                                            title="Kirim Pesan WhatsApp"
                                                        >
                                                            <WhatsappIcon className="w-3.5 h-3.5" /> Chat WA
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: booking.project.clientId })}
                                                        className="button-secondary text-xs px-2.5 py-1.5"
                                                    >
                                                        Detail
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredConfirmedBookings.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="text-center py-10 text-brand-text-secondary">Belum ada booking yang dikonfirmasi cocok dengan filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab Content: Analitik & Distribusi */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3">
                            <BookingChart bookings={allBookings} />
                        </div>
                        <div className="lg:col-span-2 bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                            <h3 className="font-bold text-lg text-gradient mb-4">Distribusi Package</h3>
                            <DonutChart data={packageDonutData} />
                        </div>
                    </div>

                    {/* Package Popularity Breakdown Card */}
                    <div className="bg-brand-surface p-6 rounded-2xl shadow-lg border border-brand-border">
                        <h4 className="font-semibold text-brand-text-light mb-4">Rincian Paket Terpilih</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {packageDonutData.map((item) => (
                                <div key={item.label} className="p-4 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                        <div>
                                            <p className="font-semibold text-sm text-brand-text-light">{item.label}</p>
                                            <p className="text-xs text-brand-text-secondary">Paket Acara</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-brand-text-light text-base">{item.value} <span className="text-xs text-brand-text-secondary font-normal">booking</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Booking">
                <div className="space-y-4 text-sm text-brand-text-primary">
                    <p>Halaman ini adalah pusat kendali untuk semua booking yang masuk dari formulir publik.</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Statistik:</strong> Kartu di atas memberikan ringkasan cepat. Klik kartu untuk melihat detailnya.</li>
                        <li><strong>Grafik:</strong> Visualisasikan tren booking per bulan dan popularitas Package.</li>
                        <li><strong>Booking Baru:</strong> Tabel teratas berisi semua booking yang menunggu tindakan Anda. Verifikasi bukti bayar dan konfirmasi booking untuk memindahkannya ke riwayat.</li>
                        <li><strong>Riwayat Booking:</strong> Tabel bawah berisi semua booking yang sudah Anda konfirmasi. Dari sini, Anda bisa memulai komunikasi dengan pengantin atau melihat detail Acara Pernikahan lebih lanjut.</li>
                        <li><strong>Aksi Cepat:</strong> Gunakan tombol "Konfirmasi", "Chat & WA", dan "Lihat Detail" untuk alur kerja yang lebih cepat.</li>
                    </ul>
                </div>
            </Modal>

            {/* Removed Share Booking Form modal per request */}

            <Modal isOpen={!!activeStatModal} onClose={() => setActiveStatModal(null)} title={statModalData.title} size="2xl">
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <div className="space-y-3">
                        {statModalData.bookings.length > 0 ? statModalData.bookings.map(booking => (
                            <div key={booking.project.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-brand-text-light">{booking.project.projectName}</p>
                                    <p className="text-sm text-brand-text-secondary">{booking.project.clientName}</p>
                                </div>
                                <span className="font-semibold text-brand-text-primary">{formatCurrency(booking.project.totalCost)}</span>
                            </div>
                        )) : <p className="text-center text-brand-text-secondary py-8">Tidak ada booking dalam kategori ini.</p>}
                    </div>
                </div>
            </Modal>

            {whatsappTemplateModal && (
                <WhatsappTemplateModal
                    project={whatsappTemplateModal.project}
                    client={whatsappTemplateModal.client}
                    onClose={() => setWhatsappTemplateModal(null)}
                    showNotification={showNotification}
                    userProfile={userProfile}
                    setProfile={setProfile}
                />
            )}
            <Modal isOpen={!!viewingProofUrl} onClose={() => setViewingProofUrl(null)} title="Bukti Pembayaran">
                {viewingProofUrl && (
                    <img src={viewingProofUrl} alt="Bukti Pembayaran Penuh" className="w-full h-auto rounded-lg" />
                )}
            </Modal>
        </div>
    );
};

export default Booking;