

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Client, TeamMember, Project, TeamProjectPayment, FreelancerFeedback, PerformanceNoteType, TeamPaymentRecord, PerformanceNote, Profile, FreelancerPortalProps } from '../../../types';
import { getTeamMemberByPortalAccessId } from '../../../services/teamMembers';
import { toPublicNameSlug } from '../../../utils/publicRouting';

import Modal from '../../../shared/ui/Modal';
import { CalendarIcon, CreditCardIcon, MessageSquareIcon, ClockIcon, UsersIcon, FileTextIcon, MapPinIcon, HomeIcon, FolderKanbanIcon, StarIcon, DollarSignIcon, AlertCircleIcon, BookOpenIcon, PrinterIcon, CheckSquareIcon, Share2Icon, DownloadIcon } from '../../../constants';
import { ModernStatCard } from '../../../components/modernize/ModernStatCard';
import SignaturePad from '../../../shared/ui/SignaturePad';
import HelpBox from '../../../shared/ui/HelpBox';
import PrintButton from '../../../shared/ui/PrintButton';
import PaymentSlipDocument from './PaymentSlipDocument';
import { downloadPaymentSlipPdf } from '../utils/paymentSlipPdf';

const formatCurrency = (amount: number, options?: {
    showDecimals?: boolean;
    compact?: boolean;
}) => {
    const { showDecimals = true, compact = false } = options || {};
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
        notation: compact ? 'compact' : 'standard'
    }).format(amount);
};

const formatDocumentCurrency = (amount: number) => {
    return formatCurrency(amount, { showDecimals: true });
};

const formatDisplayCurrency = (amount: number) => {
    return formatCurrency(amount, { showDecimals: false });
};
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();


const FreelancerPortal: React.FC<FreelancerPortalProps> = ({ accessId, teamMembers, clients = [], projects, teamProjectPayments, teamPaymentRecords, showNotification, userProfile }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [slipToView, setSlipToView] = useState<TeamPaymentRecord | null>(null);
    const profile = userProfile;
    const [fetchedMember, setFetchedMember] = useState<TeamMember | null>(null);
    const [isFetchingDirect, setIsFetchingDirect] = useState(false);
    const [hasAttemptedDirectFetch, setHasAttemptedDirectFetch] = useState(false);

    const handleGenerateSlipPreview = useCallback(async (record?: TeamPaymentRecord) => {
        // PDF Snapshot Generation removed
    }, []);

    useEffect(() => {
        if (slipToView) {
            // handleGenerateSlipPreview(slipToView); // PDF Snapshot Generation removed
        } else {
            // setPdfBlob(null); // PDF Snapshot Generation removed
        }
    }, [slipToView, handleGenerateSlipPreview]);

    const handleDownloadPDF = useCallback(async () => {
        if (!slipToView) return;

        // Ekspor PDF vector (teks tajam) dibangun ulang dari data, bukan screenshot.
        try {
            await downloadPaymentSlipPdf({
                record: slipToView,
                teamMembers: teamMembers || [],
                teamProjectPayments: teamProjectPayments || [],
                projects: projects || [],
                profile,
            });
        } catch (err) {
            console.error('Failed to generate slip PDF:', err);
            window.print();
        }
    }, [slipToView, teamMembers, teamProjectPayments, projects, profile]);


    const member = useMemo(() => {
        const matches = teamMembers?.filter(m => m.portalAccessId === accessId || m.id === accessId || m.name === accessId || toPublicNameSlug(m.name) === accessId) || [];
        const fromProps = matches.length === 1 ? matches[0] : null;
        return fromProps || fetchedMember;
    }, [teamMembers, accessId, fetchedMember]);

    useEffect(() => {
        if (!accessId) return;
        const matchesInProps = teamMembers?.filter(m => m.portalAccessId === accessId || m.id === accessId || m.name === accessId || toPublicNameSlug(m.name) === accessId) || [];
        const existsInProps = matchesInProps.length === 1;
        if (!existsInProps && !member) {
            let active = true;
            setIsFetchingDirect(true);
            getTeamMemberByPortalAccessId(accessId)
                .then(m => {
                    if (active) setFetchedMember(m);
                })
                .catch(err => {
                    console.warn('[FreelancerPortal] direct fetch error:', err);
                })
                .finally(() => {
                    if (active) {
                        setIsFetchingDirect(false);
                        setHasAttemptedDirectFetch(true);
                    }
                });
            return () => { active = false; };
        }
    }, [accessId, teamMembers, member]);

    const assignedProjects = useMemo(() => (projects || []).filter(p => p.team?.some(t => t.memberId === member?.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [projects, member]);

    if (!member) {
        if (accessId && (isFetchingDirect || !hasAttemptedDirectFetch)) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-white p-4">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="relative flex justify-center items-center mb-6">
                            <div className="absolute border-4 border-brand-accent/20 rounded-full w-16 h-16"></div>
                            <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-16 h-16"></div>
                        </div>
                        <p className="text-sm font-medium text-slate-600 animate-pulse">Memuat Portal Tim...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center min-h-screen bg-white p-4">
                <div className="w-full max-w-lg p-8 text-center bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-3xl font-bold">!</div>
                    <h1 className="text-2xl font-bold text-slate-800">Portal Tidak Ditemukan</h1>
                    <p className="mt-3 text-slate-600 leading-relaxed">Tautan portal tim yang Anda gunakan tidak valid atau telah dihapus.</p>
                    <div className="mt-6 flex justify-center">
                        <a href="#/home" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-xl text-sm font-medium shadow-sm hover:opacity-90 transition-opacity">
                            Kembali ke Beranda
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'dashboard', label: 'Dasbor' },
        { id: 'projects', label: 'Acara Pernikahan' },
        { id: 'payments', label: 'Pembayaran' },
        { id: 'performance', label: 'Kinerja' },
    ];

    const renderPaymentSlipBody = (record: TeamPaymentRecord) => {
        if (!member) return null;
        const projectsBeingPaid = teamProjectPayments.filter(p => record.projectPaymentIds.includes(p.id));

        return (
            <div id={`payment-slip-content-${record.id}`} className="printable-content print-invoice print-portal-document print-slip-compact bg-slate-50 font-sans text-slate-800 printable-area avoid-break">
                <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-lg">
                    <header className="flex justify-between items-start mb-12">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900">{profile.companyName}</h1>
                            <p className="text-sm text-slate-500">{profile.address}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold uppercase text-slate-400 tracking-widest">Slip Pembayaran</h2>
                            <p className="text-sm text-slate-500 mt-1">No: <span className="font-semibold text-slate-700">{record.recordNumber}</span></p>
                            <p className="text-sm text-slate-500">Tanggal: <span className="font-semibold text-slate-700">{formatDate(record.date)}</span></p>
                        </div>
                    </header>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 doc-header-grid">
                        <div className="bg-slate-50 p-6 rounded-xl"><h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Dibayarkan Kepada</h3><p className="font-bold text-slate-800">{member.name}</p><p className="text-sm text-slate-600">{member.role}</p><p className="text-sm text-slate-600">No. Rek: {member.noRek}</p></div>
                        <div className="bg-slate-50 p-6 rounded-xl"><h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Dibayarkan Oleh</h3><p className="font-bold text-slate-800">{profile.companyName}</p><p className="text-sm text-slate-600">{profile.bankAccount}</p></div>
                    </section>

                    <section className="avoid-break">
                        <h3 className="font-semibold text-slate-800 mb-3">Rincian Pembayaran</h3>
                        <table className="w-full text-left responsive-table invoice-table">
                            <thead className="invoice-table-header"><tr className="border-b-2 border-slate-200"><th className="p-3 text-sm font-semibold uppercase text-slate-500 text-center w-12">No</th><th className="p-3 text-sm font-semibold uppercase text-slate-500">Acara Pernikahan</th><th className="p-3 text-sm font-semibold uppercase text-slate-500">Peran</th><th className="p-3 text-sm font-semibold uppercase text-slate-500 text-right">Pembayaran</th></tr></thead>
                            <tbody className="divide-y divide-slate-200 invoice-table-body">
                                {projectsBeingPaid.map((p, index) => {
                                    const project = projects.find(proj => proj.id === p.projectId);
                                    return (
                                        <tr key={p.id}>
                                            <td data-label="No" className="p-3 text-center font-medium text-slate-500">{index + 1}</td>
                                            <td data-label="Acara Pernikahan" className="p-3 font-semibold text-slate-800">{project?.projectName || 'N/A'}</td>
                                            <td data-label="Peran" className="p-3 text-slate-600">{project?.team.find(t => t.memberId === member.id)?.role || member.role}</td>
                                            <td data-label="Pembayaran" className="p-3 text-right text-slate-800">{formatDocumentCurrency(p.fee)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>

                    <section className="mt-12 avoid-break totals-section invoice-totals">
                        <div className="flex flex-col sm:flex-row justify-end">
                            <div className="w-full sm:w-2/5 space-y-2 text-sm">
                                <div className="flex justify-between font-bold text-xl text-slate-900 bg-slate-100 p-4 rounded-lg">
                                    <span>TOTAL DIBAYAR</span>
                                    <span>{formatDocumentCurrency(record.totalAmount)}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <footer className="mt-12 pt-8 border-t-2 border-slate-200 avoid-break signature-section">
                        <div className="flex justify-between items-end">
                            <div></div>
                            <div className="text-center w-full sm:w-2/5">
                                <p className="text-sm text-slate-600">Diverifikasi oleh,</p>
                                <div className="h-14 mt-2 flex items-center justify-center">{record.vendorSignature ? (<img src={record.vendorSignature} alt="Tanda Tangan" className="object-contain shrink-0" style={{ width: '150px', height: '48px' }}  loading="lazy" decoding="async" />) : (<div className="h-14 flex items-center justify-center text-xs text-slate-400 italic border-b border-dashed w-full">Belum Ditandatangani</div>)}</div>
                                <p className="text-sm font-semibold text-slate-800 mt-1 border-t-2 border-slate-300 pt-1">({profile.authorizedSigner || profile.companyName})</p>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab member={member} projects={assignedProjects} teamProjectPayments={teamProjectPayments} />;
            case 'projects': return <ProjectsTab projects={assignedProjects} clients={clients} onProjectClick={setSelectedProject} memberId={member.id} />;
            case 'payments': return <PaymentsTab member={member} projects={projects} teamProjectPayments={teamProjectPayments} teamPaymentRecords={teamPaymentRecords} onSlipView={setSlipToView} />;
            case 'performance': return <PerformanceTab member={member} />;
            default: return null;
        }
    }

return (
    <div className="freelancer-portal min-h-screen bg-[#f4f6f9] text-slate-800 px-3 py-5 sm:px-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
            <header className="relative isolate overflow-hidden mb-5 sm:mb-7 rounded-[1.75rem] bg-slate-900 text-white shadow-xl shadow-slate-900/10 widget-animate">
                <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10" />
                <div className="absolute -right-2 -top-14 h-52 w-52 rounded-full border border-white/10" />
                <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-center md:justify-between md:p-10">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shrink-0 bg-white/10 text-white ring-1 ring-white/20 flex items-center justify-center text-2xl font-semibold shadow-lg">
                            {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} avatar`} className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : member.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-slate-300">Portal Freelancer</p>
                            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">Halo, {member.name}</h1>
                            <p className="mt-1.5 text-sm text-slate-300">Kelola agenda, pembayaran, dan kinerja Anda.</p>
                        </div>
                    </div>
                    {profile?.phone && (
                        <HelpBox
                            variant="public"
                            phone={profile.phone}
                            buttonOnly
                            className="relative z-10 w-full sm:w-fit !bg-white !text-slate-800 !shadow-none hover:!bg-slate-100 focus:!ring-white"
                        />
                    )}
                </div>
            </header>
            <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm widget-animate" style={{ animationDelay: '100ms' }}>
                <nav className="grid grid-cols-4 gap-1.5 sm:flex" aria-label="Navigasi portal freelancer" role="tablist">
                    {tabs.map(tab => {
                        const TabIcon = tab.id === 'dashboard'
                            ? HomeIcon
                            : tab.id === 'projects'
                                ? FolderKanbanIcon
                                : tab.id === 'payments'
                                    ? CreditCardIcon
                                    : StarIcon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-label={tab.label}
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab.id)}
                                className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <TabIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.id === 'projects' ? 'Acara' : tab.id === 'payments' ? 'Pembayaran' : tab.id === 'performance' ? 'Kinerja' : 'Dasbor'}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <main>{renderTabContent()}</main>
            <Modal isOpen={!!selectedProject} onClose={() => setSelectedProject(null)} title="Detail Acara Pernikahan" size="3xl">
                {selectedProject && <ProjectDetailModal project={selectedProject} member={member} showNotification={showNotification} onClose={() => setSelectedProject(null)} />}
            </Modal>
            
            {slipToView && (
                <React.Fragment>
                    {/* Hidden Document for PDF Generation - Moved outside Modal to prevent clipping by overflow containers */}
                    <div style={{ position: 'fixed', left: 0, top: 0, zIndex: -9999, opacity: 0, pointerEvents: 'none', width: '800px' }}>
                        <PaymentSlipDocument
                            record={slipToView}
                            teamMembers={teamMembers && teamMembers.length > 0 ? teamMembers : [member]}
                            teamProjectPayments={teamProjectPayments}
                            projects={projects}
                            userProfile={profile}
                        />
                    </div>
                    
                    <Modal isOpen={!!slipToView} onClose={() => setSlipToView(null)} title={`Slip Pembayaran: ${slipToView?.recordNumber}`} size="4xl">

                        {/* Payment Slip Content */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto">
                            {slipToView && (
                                <PaymentSlipDocument
                                    record={slipToView}
                                    teamMembers={teamMembers && teamMembers.length > 0 ? teamMembers : [member]}
                                    teamProjectPayments={teamProjectPayments}
                                    projects={projects}
                                    userProfile={profile}
                                />
                            )}
                        </div>

                        <div className="mt-5 flex justify-end items-center gap-2 non-printable border-t border-slate-200 pt-4">
                            <PrintButton
                                areaId={`payment-slip-content-${slipToView.id}`}
                                label="Cetak"
                                title={`Slip Pembayaran - ${slipToView.recordNumber || ''}`}
                            />
                            <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Unduh PDF
                            </button>
                        </div>
                    </Modal>
                </React.Fragment>
            )}
        </div>
    </div>
);
};


// --- SUB-COMPONENTS ---

const DashboardTab: React.FC<{ member: TeamMember, projects: Project[], teamProjectPayments: TeamProjectPayment[] }> = ({ member, projects, teamProjectPayments }) => {
    const stats = useMemo(() => {
        const unpaidFee = teamProjectPayments.filter(p => p.teamMemberId === member.id && p.status === 'Unpaid').reduce((sum, p) => sum + p.fee, 0);
        const paidFee = teamProjectPayments.filter(p => p.teamMemberId === member.id && p.status === 'Paid').reduce((sum, p) => sum + p.fee, 0);
        const completedProjects = projects.filter(p => p.status === 'Selesai' && p.team.some(t => t.memberId === member.id)).length;

        return { unpaidFee, paidFee, completedProjects, activeProjects: projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan').length };
    }, [member, projects, teamProjectPayments]);

    const agendaItems = useMemo(() => {
        const nextProject = projects
            .filter(p => new Date(p.date) >= new Date() && p.status !== 'Selesai' && p.status !== 'Dibatalkan')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

        const agenda: (Project & { type: 'project' })[] = [];
        if (nextProject) {
            agenda.push({ ...nextProject, type: 'project' as const });
        }

        return agenda.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    }, [projects, member]);


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: 'Pembayaran Diterima', value: formatDisplayCurrency(stats.paidFee), icon: DollarSignIcon, note: 'Total pembayaran lunas', tone: 'solid-green text-white' },
                    { label: 'Pembayaran Pending', value: formatDisplayCurrency(stats.unpaidFee), icon: ClockIcon, note: 'Menunggu pembayaran', tone: 'solid-orange text-white' },
                    { label: 'Acara Aktif', value: stats.activeProjects, icon: CalendarIcon, note: 'Dalam penugasan', tone: 'solid-cyan text-white' },
                    { label: 'Acara Selesai', value: stats.completedProjects, icon: CheckSquareIcon, note: 'Penugasan tuntas', tone: 'solid-purple text-white' },
                ].map(stat => (
                    <article key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                                <p className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{stat.value}</p>
                                <p className="mt-1.5 text-xs text-slate-500">{stat.note}</p>
                            </div>
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                                <stat.icon className="h-5 w-5" />
                            </span>
                        </div>
                    </article>
                ))}
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                            <CalendarIcon className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-base font-semibold text-slate-900">Agenda Berikutnya</h3>
                            <p className="mt-0.5 text-xs text-slate-500">Jadwal acara terdekat Anda</p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {agendaItems.length} agenda
                    </span>
                </div>
                <div className="p-4 sm:p-6">
                    {agendaItems.length > 0 ? (
                        <div className="space-y-3">
                            {agendaItems.map((item, index) => (
                                <div key={index} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                    <div className="flex min-w-0 items-center gap-4">
                                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                                            <span className="text-[10px] font-medium uppercase tracking-wide">{new Date(item.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                            <span className="text-lg font-semibold leading-none">{new Date(item.date).getDate()}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-slate-900">{item.projectName}</p>
                                            <p className="mt-1 text-sm text-slate-500">{formatDate(item.date)}</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex w-fit items-center gap-2 rounded-full solid-cyan px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/25">
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                        Akan Datang
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                                <CalendarIcon className="h-5 w-5" />
                            </span>
                            <p className="mt-4 text-sm font-medium text-slate-700">Belum ada agenda mendatang</p>
                            <p className="mt-1 text-xs text-slate-500">Jadwal baru akan muncul di sini saat Anda mendapat penugasan.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

const ProjectsTab: React.FC<{ projects: Project[], clients: Client[], onProjectClick: (p: Project) => void, memberId: string }> = ({ projects, clients, onProjectClick, memberId }) => {
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');

    const classify = (p: Project) => {
        const today = new Date();
        const d = new Date(p.date);
        const isCompleted = p.status === 'Selesai';
        const isCancelled = p.status === 'Dibatalkan';
        const isUpcoming = !isCompleted && !isCancelled && d >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isOngoing = !isCompleted && !isCancelled && d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return { isCompleted, isUpcoming, isOngoing };
    };

    const counts = useMemo(() => {
        let upcoming = 0, ongoing = 0, completed = 0;
        projects.forEach(p => {
            const c = classify(p);
            if (c.isUpcoming) upcoming++; else if (c.isOngoing) ongoing++; else if (c.isCompleted) completed++;
        });
        return { upcoming, ongoing, completed, all: projects.length };
    }, [projects]);

    const filtered = useMemo(() => {
        let arr = projects.slice();
        if (filter !== 'all') {
            arr = arr.filter(p => {
                const c = classify(p);
                if (filter === 'upcoming') return c.isUpcoming;
                if (filter === 'ongoing') return c.isOngoing;
                if (filter === 'completed') return c.isCompleted;
                return true;
            });
        }
        if (filter === 'completed') {
            arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        return arr;
    }, [projects, filter]);

    const FilterButton: React.FC<{ id: typeof filter; label: string; count: number; }> = ({ id, label, count }) => {
        const base = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
        const colorById = {
            all: {
                active: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                inactive: 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
            },
            upcoming: {
                active: 'solid-cyan text-white border-transparent shadow-sm',
                inactive: 'bg-cyan-600/10 text-cyan-700 border-cyan-600/20 hover:bg-cyan-600/20',
            },
            ongoing: {
                active: 'solid-orange text-white border-transparent shadow-sm',
                inactive: 'bg-orange-600/10 text-orange-700 border-orange-600/20 hover:bg-orange-600/20',
            },
            completed: {
                active: 'solid-green text-white border-transparent shadow-sm',
                inactive: 'bg-green-600/10 text-green-700 border-green-600/20 hover:bg-green-600/20',
            },
        } as const;
        const cls = filter === id ? colorById[id].active : colorById[id].inactive;
        return (
            <button
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={`${base} ${cls}`}
            >
                {label} ({count})
            </button>
        );
    };

    return (
        <div className="space-y-3">
            <div className="freelancer-project-filters flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <FilterButton id="all" label="Semua" count={counts.all} />
                <FilterButton id="upcoming" label="Akan Datang" count={counts.upcoming} />
                <FilterButton id="ongoing" label="Berjalan" count={counts.ongoing} />
                <FilterButton id="completed" label="Selesai" count={counts.completed} />
            </div>

            {filtered.map((p, index) => {
                const assignmentDetails = p.team.find(t => t.memberId === memberId);
                const projectClient = clients.find(client => client.id === p.clientId);
                const { isUpcoming, isOngoing, isCompleted } = classify(p);
                const statusBadge = isCompleted
                    ? { text: 'Selesai', cls: 'solid-green text-white ring-white/25' }
                    : isUpcoming
                        ? { text: 'Akan Datang', cls: 'solid-cyan text-white ring-white/25' }
                        : { text: 'Berjalan', cls: 'solid-orange text-white ring-white/25' };
                return (
                    <button type="button" key={p.id} onClick={() => onProjectClick(p)} className="freelancer-project-card h-fit w-full p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/80 text-left hover:border-slate-400 flex justify-between items-center gap-3 transition-all duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 widget-animate" style={{ animationDelay: `${index * 80}ms` }}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                                {projectClient?.avatarUrl ? <img src={projectClient.avatarUrl} alt={`${p.clientName} avatar`} className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : (p.clientName || 'K').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <h3 className="font-semibold text-sm sm:text-base text-public-text-primary leading-tight truncate">{p.projectName}</h3>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {assignmentDetails?.subJob && (
                                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-block leading-none">{assignmentDetails.subJob}</span>
                                        )}
                                        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full leading-none ring-1 ring-inset ${statusBadge.cls}`}>{statusBadge.text}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-public-text-secondary leading-tight mt-1 truncate">{p.clientName} • {formatDate(p.date)}</p>
                            </div>
                        </div>
                    </button>
                );
            })}

            {filtered.length === 0 && <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm text-center widget-animate"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CalendarIcon className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-slate-700">Tidak ada acara pada kategori ini</p><p className="mt-1 text-xs text-slate-500">Coba pilih filter yang lain.</p></div>}
        </div>
    );
};

const PaymentsTab: React.FC<{ member: TeamMember, projects: Project[], teamProjectPayments: TeamProjectPayment[], teamPaymentRecords: TeamPaymentRecord[], onSlipView: (record: TeamPaymentRecord) => void }> = ({ member, projects, teamProjectPayments, teamPaymentRecords, onSlipView }) => (
    <section className="freelancer-payments overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm widget-animate">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Riwayat Pembayaran</h2>
            <p className="mt-1 text-xs text-slate-500">Ringkasan fee dari penugasan Anda</p>
        </div>
        <div className="freelancer-payment-cards hidden p-3">
            {teamProjectPayments.filter(p => p.teamMemberId === member.id).map(p => {
                const isPaid = p.status === 'Paid';
                const paymentRecord = isPaid ? teamPaymentRecords.find(rec => rec.projectPaymentIds.includes(p.id)) : null;
                return (
                    <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 break-words">
                                    {projects.find(proj => proj.id === p.projectId)?.projectName || 'N/A'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{formatDate(p.date)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${isPaid ? 'solid-green text-white' : 'solid-orange text-white'}`}>
                                {isPaid ? 'Lunas' : 'Belum Lunas'}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">Pembayaran</span>
                            <span className="text-sm font-semibold text-slate-900">{formatDisplayCurrency(p.fee)}</span>
                        </div>
                        {paymentRecord && (
                            <button
                                type="button"
                                onClick={() => onSlipView(paymentRecord)}
                                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Lihat slip pembayaran
                            </button>
                        )}
                    </article>
                );
            })}
            {teamProjectPayments.filter(p => p.teamMemberId === member.id).length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada riwayat pembayaran.
                </p>
            )}
        </div>
        <div className="overflow-x-auto">
        <table className="freelancer-payment-table w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50"><tr><th className="p-3 text-center font-medium text-slate-500 w-12">No</th><th className="p-3 text-left font-medium text-slate-500">Acara Pernikahan</th><th className="p-3 text-left font-medium text-slate-500">Tanggal</th><th className="p-3 text-right font-medium text-slate-500">Pembayaran</th><th className="p-3 text-center font-medium text-slate-500">Status &amp; Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
                {teamProjectPayments.filter(p => p.teamMemberId === member.id).map((p, index) => {
                    const isPaid = p.status === 'Paid';
                    const paymentRecord = isPaid ? teamPaymentRecords.find(rec => rec.projectPaymentIds.includes(p.id)) : null;
                    return (
                        <tr key={p.id} className="widget-animate" style={{ animationDelay: `${index * 50}ms` }}>
                            <td className="p-3 text-center font-medium text-slate-500">{index + 1}</td>
                            <td className="p-3 font-semibold text-public-text-primary">{projects.find(proj => proj.id === p.projectId)?.projectName || 'N/A'}</td>
                            <td className="p-3 text-public-text-secondary">{formatDate(p.date)}</td>
                            <td className="p-3 text-right font-medium text-public-text-primary">{formatDisplayCurrency(p.fee)}</td>
                            <td className="p-3 text-center space-x-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${p.status === 'Paid' ? 'solid-green text-white' : 'solid-orange text-white'}`}>{p.status === 'Paid' ? 'Lunas' : 'Belum Lunas'}</span>
                                {paymentRecord && (
                                    <button onClick={() => onSlipView(paymentRecord)} className="text-xs font-medium text-slate-700 hover:text-slate-950 hover:underline">Lihat Slip</button>
                                )}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
        </div>
    </section>
);

const PerformanceTab: React.FC<{ member: TeamMember }> = ({ member }) => (
    <div className="freelancer-performance space-y-5">
        <div className="freelancer-performance-rating overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm widget-animate" style={{ animationDelay: '100ms' }}>
            <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
                <div className="text-center sm:text-left">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">Ringkasan performa</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Peringkat Kinerja</h3>
                    <p className="mt-1 text-sm text-slate-500">Penilaian dari perjalanan kerja Anda</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-5 py-3 ring-1 ring-inset ring-slate-200">
                    <StarIcon className="h-6 w-6 text-amber-500" />
                    <p className="text-3xl font-semibold tracking-tight text-slate-900">{member.rating.toFixed(1)} <span className="text-base font-medium text-slate-400">/ 5.0</span></p>
                </div>
            </div>
        </div>
        <section className="freelancer-performance-notes rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm widget-animate" style={{ animationDelay: '200ms' }}>
            <h3 className="text-base font-semibold text-slate-900">Catatan Kinerja dari Admin</h3>
            <p className="mt-1 text-xs text-slate-500">Masukan dan apresiasi untuk Anda</p>
            <div className="mt-5 space-y-3 max-h-80 overflow-y-auto pr-1">
                {member.performanceNotes.map((note, index) => (<div key={note.id} className={`p-4 rounded-xl border widget-animate ${note.type === PerformanceNoteType.PRAISE ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`} style={{ animationDelay: `${300 + index * 100}ms` }}>
                    <p className="text-sm leading-relaxed text-slate-700">"{note.note}"</p>
                    <p className="text-right text-xs text-slate-500 mt-3">{formatDate(note.date)}</p>
                </div>))}
                {member.performanceNotes.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Belum ada catatan kinerja.</div>}
            </div>
        </section>
    </div>
);
const ProjectDetailModal: React.FC<{ project: Project, member: TeamMember, showNotification: any, onClose: any }> = ({ project, member, showNotification, onClose }) => {
    const assignmentDetails = project.team.find(t => t.memberId === member.id);
    const projectLinks = [
        { label: 'Brief & moodboard', description: 'Referensi internal acara', url: project.driveLink },
        { label: 'File dari pengantin', description: 'Dokumen yang dibagikan klien', url: project.clientDriveLink },
        { label: 'File hasil akhir', description: 'Materi final untuk pengantin', url: project.finalDriveLink },
    ];

    return (
        <div className="freelancer-project-detail space-y-5 sm:space-y-6">
            <section className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white sm:p-6">
                <div className="absolute -right-8 -top-14 h-40 w-40 rounded-full border border-white/10" />
                <div className="absolute -right-1 -top-8 h-28 w-28 rounded-full border border-white/10" />
                <div className="relative">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">Informasi acara</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{project.projectName}</h2>
                    <p className="mt-1 text-sm text-slate-300">{project.clientName}</p>
                    {assignmentDetails && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/15">
                                {assignmentDetails.role}
                            </span>
                            {assignmentDetails.subJob && (
                                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/15">
                                    {assignmentDetails.subJob}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <section>
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Jadwal & lokasi</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Informasi utama penugasan Anda</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <CalendarIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500">Tanggal acara</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(project.date)}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <MapPinIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500">Lokasi</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{project.location || 'Belum ditentukan'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <ClockIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500">Waktu kerja</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                                {project.startTime || 'Belum ditentukan'} <span className="px-1 text-slate-400">—</span> {project.endTime || 'Belum ditentukan'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Dokumen & tautan</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Materi yang terkait dengan acara ini</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    {projectLinks.map(link => (
                        <div key={link.label} className={`rounded-xl border p-3.5 ${link.url ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/70'}`}>
                            <p className="text-sm font-medium text-slate-800">{link.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{link.description}</p>
                            {link.url ? (
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 hover:text-slate-500 hover:underline"
                                >
                                    <FileTextIcon className="h-3.5 w-3.5" />
                                    Buka tautan
                                </a>
                            ) : (
                                <p className="mt-3 text-xs text-slate-400">Belum tersedia</p>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {project.notes && (
                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                        <FileTextIcon className="h-4 w-4 text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-900">Catatan acara</h3>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{project.notes}</p>
                </section>
            )}
        </div>
    );
}

export default FreelancerPortal;