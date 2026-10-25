import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Project, TeamMember, Client, Profile,
  Package, Transaction, TeamProjectPayment, TeamPaymentRecord, Card, AssignedTeamMember,
  FinancialPocket,
} from '../../../types';
import {
  FileTextIcon, SendIcon,
  PencilIcon, Share2Icon, ArrowDownIcon,
  X as XIcon, Save as SaveIcon, CalendarClock, ExternalLink, Video, Trash2,
  ChevronDown, ChevronUp, MessageCircle,
} from 'lucide-react';
import { updateProject as updateProjectInDb } from '../../../services/projects';
import {
  encodeProjectMeetingNotes,
  listProjectMeetings,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  ProjectMeeting,
  ProjectMeetingKind,
} from '../../../services/calendarEvents';
import { formatCurrency, getStatusClass, getProgressForStatus } from '../utils/projectHelpers';
import { EditFormData, ProjectEditSection } from '../hooks/useProjectEditMode';
import { getPackageTerms } from '../../packages/packageTerms';
import PackageTermsDisplay from '../../packages/components/PackageTermsDisplay';
import WorkflowDisplay from '../../packages/components/WorkflowDisplay';
import { getWorkflows } from '../../packages/workflows';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';
import { useChatTemplates } from '../../../hooks/useChatTemplates';
import Modal from '../../../shared/ui/Modal';
import { generateWhatsAppLink } from '../../../utils/whatsapp';
import PaymentSlipDocument from '../../team/components/PaymentSlipDocument';
import { buildPaymentSlipFileName, buildPaymentSlipPdf, downloadPaymentSlipPdf } from '../../team/utils/paymentSlipPdf';

const DOCUMENTATION_REMINDER_TITLE = 'Pengingat Persiapan Dokumentasi';
const DOCUMENTATION_REMINDER_TEMPLATE = `Kak, Aku izin mengingatkan persiapan dokumentasi yang perlu disiapkan untuk hari H 😊🙏🏻

1. Mohon dipersiapkan:
  - Keepsake/undangan
  - Cincin
  - Accessories lainnya jika ada dan ingin di shoot
2. Jika ada moodboard atau referensi foto dan video, mohon dikirimkan ke mimin maksimal H-1 sebelum acara.
3. Jika ada request backsound untuk video durasi teaser 1 menit dan cinematic clip 3 menit, mohon dikirimkan ke mimin maksimal H-1 sebelum acara. Dikarenakan tidak ada revisi untuk pemilihan backsound.

Jika seluruh poin di atas sudah aman, kakak tinggal fokus mempersiapkan diri dan menikmati momen menuju hari bahagia yaa. Terimakasih 😊🙏🏻`;

export interface ProjectDetailModalProps {
  selectedProject: Project | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
  teamMembers: TeamMember[];
  clients: Client[];
  profile: Profile;
  showNotification: (message: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  onClose: () => void;
  /** @deprecated tombol edit sekarang inline — prop ini dipertahankan agar kode lain tidak error */
  /** @deprecated retained for compatibility with project page callers */
  handleOpenForm: (mode: 'edit', project: Project) => void;
  handleProjectDelete: (projectId: string) => void;
  handleOpenBriefingModal: () => void;
  packages: Package[];
  transactions: Transaction[];
  teamProjectPayments: TeamProjectPayment[];
  teamPaymentRecords?: TeamPaymentRecord[];
  paymentInvoiceProjects?: Project[];
  cards: Card[];
  pockets: FinancialPocket[];
  onPayTeamAssignment?: (payment: TeamProjectPayment, sourceId: string) => Promise<void>;
  onOpenSharePreview: (data: { title: string; message: string; phone?: string | null }) => void;
  onNavigateToClient?: (clientId: string) => void;
  // ── Edit mode props (injected from ProjectsPage via useProjectEditMode) ──
  isEditing: boolean;
  isSaving: boolean;
  editFormData: EditFormData | null;
  editTeamByCategory: Record<string, Record<string, TeamMember[]>>;
  onEnterEditMode: (project: Project) => void;
  onCancelEditMode: () => void;
  onEditFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onEditSubStatusToggle: (name: string, checked: boolean) => void;
  onEditTeamChange: (member: TeamMember) => void;
  onEditTeamFeeChange: (memberId: string, fee: number) => void;
  onEditTeamSubJobChange: (memberId: string, subJob: string) => void;
  onEditReplaceTeamMember: (oldMemberId: string, newMember: TeamMember) => void;
  onSaveEdit: (section?: ProjectEditSection) => void;
  sectionEditingEnabled?: boolean;
}

// ─── Reusable atoms ──────────────────────────────────────────────────────────

const InfoField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`flex flex-col gap-1 p-2.5 sm:p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 ${className}`}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85]">{label}</span>
    <span className="text-xs sm:text-sm font-bold text-[#2A3547] break-words leading-snug">{children || <span className="text-slate-400">—</span>}</span>
  </div>
);

const SectionHeading: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-2.5 sm:mb-3.5 mt-4 sm:mt-6 first:mt-0">
    <h3 className="text-xs sm:text-sm font-extrabold text-[#2A3547] uppercase tracking-wider flex items-center gap-2">
      <span className="w-1.5 h-4 rounded-full bg-brand-accent inline-block" />
      {title}
    </h3>
    {action}
  </div>
);

const SectionCard: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
    {title && <h4 className="text-xs sm:text-sm font-bold text-[#2A3547] pb-2.5 mb-3.5 border-b border-slate-200">{title}</h4>}
    {children}
  </div>
);

// Shared input / label classes for edit mode
// bg-brand-input = var(--color-input-bg) = #ffffff, konsisten dengan design system
const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-brand-border bg-brand-input text-brand-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary mb-1.5';

// ─── Main component ──────────────────────────────────────────────────────────

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  selectedProject, setSelectedProject, teamMembers, clients, profile,
  showNotification, setProjects, onClose,
  handleProjectDelete, handleOpenBriefingModal, packages, transactions,
  teamProjectPayments, teamPaymentRecords = [], paymentInvoiceProjects = [], cards, pockets, onPayTeamAssignment,
  onOpenSharePreview, onNavigateToClient,
  // edit mode
  isEditing, isSaving, editFormData, editTeamByCategory,
  onEnterEditMode, onCancelEditMode,
  onEditFormChange, onEditTeamChange, onEditTeamFeeChange,
  onEditTeamSubJobChange, onEditReplaceTeamMember, onSaveEdit,
  onEditSubStatusToggle,
  sectionEditingEnabled = false,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  const chatTemplates = useChatTemplates(profile);
  // ── state ───────────────────────────────────────────────────────────────
  const [isDocumentationReminderOpen, setIsDocumentationReminderOpen] = useState(false);
  const [documentationReminderDraft, setDocumentationReminderDraft] = useState(DOCUMENTATION_REMINDER_TEMPLATE);
  const [isEditingFinalLink, setIsEditingFinalLink] = useState(false);
  const [editingSection, setEditingSection] = useState<ProjectEditSection | null>(null);
  const [tempFinalLink, setTempFinalLink] = useState('');
  const [paymentToProcess, setPaymentToProcess] = useState<TeamProjectPayment | null>(null);
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [isProcessingTeamPayment, setIsProcessingTeamPayment] = useState(false);
  const [paymentProofToView, setPaymentProofToView] = useState<TeamPaymentRecord | null>(null);
  const [isPreparingPaymentProof, setIsPreparingPaymentProof] = useState(false);
  const [mobileSectionTab, setMobileSectionTab] = useState<'info' | 'meetings' | 'team' | 'terms' | 'workflow' | 'files'>('info');

  const startSectionEdit = (section: ProjectEditSection) => {
    setEditingSection(section);
    onEnterEditMode(selectedProject!);
  };

  const sectionEditButton = (section: ProjectEditSection) => sectionEditingEnabled ? (
    <button
      type="button"
      onClick={() => startSectionEdit(section)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#5D6B82] transition-colors hover:border-brand-accent/40 hover:text-brand-accent"
      aria-label={`Edit ${section === 'info' ? 'informasi utama' : section === 'status' ? 'status acara' : section === 'notes' ? 'catatan khusus' : section === 'team' ? 'tugas tim dan vendor' : 'file dan tautan'}`}
    >
      <PencilIcon className="h-3.5 w-3.5" />
      Edit
    </button>
  ) : null;
  const [projectMeetings, setProjectMeetings] = useState<ProjectMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [savingMeetingKind, setSavingMeetingKind] = useState<ProjectMeetingKind | null>(null);
  const [meetingCardOpen, setMeetingCardOpen] = useState<Record<ProjectMeetingKind, boolean>>({
    regular: false,
    zoom: false,
  });
  const [meetingDrafts, setMeetingDrafts] = useState<Record<ProjectMeetingKind, { scheduledAt: string; zoomUrl: string; location: string; resultNotes: string }>>({
    regular: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
    zoom: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
  });

  // ── paidMemberIds — for edit form fee lock ────────────────────────────────
  const paidMemberIdsForProject = useMemo(() => {
    const projectId = selectedProject?.id;
    if (!projectId) return new Set<string>();
    return new Set(
      teamProjectPayments.filter(p => p.projectId === projectId && p.status === 'Paid').map(p => p.teamMemberId),
    );
  }, [teamProjectPayments, selectedProject?.id]);

  // ── team by category — for VIEW mode ─────────────────────────────────────
  const teamByCategory = useMemo(() => {
    if (!selectedProject?.team) return { Tim: {}, Vendor: {} };
    return selectedProject.team.reduce(
      (acc, member) => {
        const orig = teamMembers.find(m => m.id === member.memberId);
        const cat = orig?.category || 'Tim';
        if (!acc[cat]) acc[cat] = {};
        if (!acc[cat][member.role]) acc[cat][member.role] = [];
        acc[cat][member.role].push(member);
        return acc;
      },
      { Tim: {}, Vendor: {} } as Record<string, Record<string, AssignedTeamMember[]>>,
    );
  }, [selectedProject?.team, teamMembers]);

  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) {
      setProjectMeetings([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingMeetings(true);
    listProjectMeetings(projectId)
      .then(meetings => {
        if (!isCurrent) return;
        setProjectMeetings(meetings);
        setMeetingDrafts({
          regular: {
            scheduledAt: meetings.find(meeting => meeting.metadata.kind === 'regular')?.event.startAt.slice(0, 16) || '',
            zoomUrl: '',
            location: meetings.find(meeting => meeting.metadata.kind === 'regular')?.metadata.location || '',
            resultNotes: meetings.find(meeting => meeting.metadata.kind === 'regular')?.metadata.resultNotes || '',
          },
          zoom: {
            scheduledAt: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.event.startAt.slice(0, 16) || '',
            zoomUrl: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.zoomUrl || '',
            location: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.location || '',
            resultNotes: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.resultNotes || '',
          },
        });
      })
      .catch(error => {
        if (!isCurrent) return;
        console.error('[Projects][meetings.load] Failed to load project meetings:', error);
        showNotification('Gagal memuat jadwal meeting. Coba muat ulang detail acara.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingMeetings(false);
      });

    return () => { isCurrent = false; };
  }, [selectedProject?.id, showNotification]);

  // ── handlers (view mode) ─────────────────────────────────────────────────

  const formatDateFull = (d: string) =>
    d ? new Date(d).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  const handleSaveMeeting = async (kind: ProjectMeetingKind) => {
    if (!selectedProject) return;
    const draft = meetingDrafts[kind];
    if (!draft.scheduledAt) {
      showNotification('Pilih tanggal dan waktu meeting terlebih dahulu.');
      return;
    }
    if (kind === 'zoom' && draft.zoomUrl && !/^https?:\/\//i.test(draft.zoomUrl.trim())) {
      showNotification('Link Zoom harus menggunakan alamat yang diawali https:// atau http://.');
      return;
    }

    const startDate = new Date(draft.scheduledAt);
    if (Number.isNaN(startDate.getTime())) {
      showNotification('Tanggal dan waktu meeting tidak valid.');
      return;
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    const toLocalDateTime = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
    const existing = projectMeetings.find(meeting => meeting.metadata.kind === kind);
    const titlePrefix = kind === 'zoom' ? 'Zoom Meeting' : 'Meeting Pengantin';
    const payload = {
      title: `${titlePrefix} — ${selectedProject.clientName}`,
      eventType: selectedProject.projectType,
      date: draft.scheduledAt.slice(0, 10),
      startAt: `${draft.scheduledAt}:00`,
      endAt: toLocalDateTime(endDate),
      allDay: false,
      location: draft.location.trim() || undefined,
      notes: encodeProjectMeetingNotes({
        projectId: selectedProject.id,
        kind,
        zoomUrl: kind === 'zoom' ? draft.zoomUrl.trim() : '',
        location: draft.location.trim(),
        resultNotes: draft.resultNotes.trim(),
      }),
    };

    setSavingMeetingKind(kind);
    try {
      if (existing) {
        await updateCalendarEvent(existing.event.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
      const meetings = await listProjectMeetings(selectedProject.id);
      setProjectMeetings(meetings);
      showNotification(`${titlePrefix} berhasil disimpan dan ditambahkan ke kalender.`);
    } catch (error) {
      console.error('[Projects][meetings.save] Failed to save project meeting:', error);
      showNotification(`Gagal menyimpan ${titlePrefix.toLowerCase()}. Coba lagi.`);
    } finally {
      setSavingMeetingKind(null);
    }
  };

  const handleDeleteMeeting = async (kind: ProjectMeetingKind) => {
    const meeting = projectMeetings.find(item => item.metadata.kind === kind);
    if (!meeting) return;
    try {
      await deleteCalendarEvent(meeting.event.id);
      setProjectMeetings(items => items.filter(item => item.event.id !== meeting.event.id));
      setMeetingDrafts(drafts => ({
        ...drafts,
        [kind]: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
      }));
      showNotification('Jadwal meeting berhasil dihapus dari kalender.');
    } catch (error) {
      console.error('[Projects][meetings.delete] Failed to delete project meeting:', error);
      showNotification('Gagal menghapus jadwal meeting. Coba lagi.');
    }
  };

  const handleShareMeeting = (kind: ProjectMeetingKind) => {
    if (!selectedProject) return;
    const client = clients.find(item => item.id === selectedProject.clientId);
    const phone = client?.whatsapp || client?.phone;
    if (!phone) {
      showNotification('Nomor WhatsApp pengantin tidak ditemukan.');
      return;
    }

    const draft = meetingDrafts[kind];
    if (!draft.scheduledAt) {
      showNotification('Simpan tanggal dan waktu meeting sebelum membagikannya.');
      return;
    }

    const date = new Date(draft.scheduledAt);
    const meetingDate = Number.isNaN(date.getTime())
      ? draft.scheduledAt
      : date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const meetingTime = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const meetingType = kind === 'zoom' ? 'Zoom Meeting' : 'Meeting Pengantin';
    const template = profile.chatTemplates?.find(item =>
      kind === 'zoom'
        ? /zoom|meeting|jadwal/i.test(item.title)
        : /meeting|jadwal/i.test(item.title),
    )?.template;
    const details = [
      `Jadwal: ${meetingDate}${meetingTime ? ` pukul ${meetingTime}` : ''}`,
      draft.location.trim() ? `Lokasi: ${draft.location.trim()}` : '',
      kind === 'zoom' && draft.zoomUrl.trim() ? `Link meeting: ${draft.zoomUrl.trim()}` : '',
    ].filter(Boolean).join('\n');
    const defaultMessage = [
      `Halo Kak ${selectedProject.clientName},`,
      '',
      `Kami ingin menginformasikan jadwal ${meetingType} untuk acara ${selectedProject.projectName}:`,
      details,
      '',
      'Mohon konfirmasi apakah jadwal tersebut sesuai. Terima kasih.',
    ].join('\n');
    const values: Record<string, string> = {
      clientName: selectedProject.clientName,
      projectName: selectedProject.projectName,
      meetingType,
      meetingDate,
      meetingTime,
      meetingLocation: draft.location.trim(),
      location: draft.location.trim() || selectedProject.location || '',
      zoomLink: draft.zoomUrl.trim(),
      meetingNotes: draft.resultNotes.trim(),
    };
    let message = (template || defaultMessage).replace(/\{([^}]+)\}/g, (placeholder, key: string) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder,
    );
    if (!message.includes(meetingDate) && !message.includes(draft.scheduledAt)) {
      message = `${message.trim()}\n\n${details}`;
    } else if (kind === 'zoom' && draft.zoomUrl.trim() && !message.includes(draft.zoomUrl.trim())) {
      message = `${message.trim()}\nLink meeting: ${draft.zoomUrl.trim()}`;
    }

    onOpenSharePreview({ title: `Bagikan ${meetingType} — ${selectedProject.projectName}`, message, phone });
  };

  const handleShareDocumentationReminder = () => {
    if (!selectedProject) return;
    const client = clients.find(item => item.id === selectedProject.clientId);
    const phone = client?.whatsapp || client?.phone;
    if (!phone) {
      showNotification('Nomor WhatsApp pengantin tidak ditemukan.');
      return;
    }
    const whatsappWindow = window.open(generateWhatsAppLink(phone, documentationReminderDraft), '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    else showNotification('WhatsApp tidak dapat dibuka. Periksa pengaturan popup browser.');
  };

  const handleSaveDocumentationReminder = async () => {
    try {
      const existingTemplate = chatTemplates.templates.find(template => template.title === DOCUMENTATION_REMINDER_TITLE);
      if (existingTemplate) {
        await chatTemplates.updateTemplate(existingTemplate.id, { template: documentationReminderDraft });
      } else {
        await chatTemplates.addTemplate({ title: DOCUMENTATION_REMINDER_TITLE, template: documentationReminderDraft });
      }
      showNotification('Chat template pengingat dokumentasi berhasil disimpan.');
      setIsDocumentationReminderOpen(false);
    } catch (error) {
      showNotification(error instanceof Error ? `Gagal menyimpan template: ${error.message}` : 'Gagal menyimpan chat template.');
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedProject) return;
    const nextProgress = getProgressForStatus(newStatus, profile.projectStatusConfig);
    const statusConfig = profile.projectStatusConfig.find(s => s.name === newStatus);
    try {
      const updated = {
        ...selectedProject,
        status: newStatus,
        progress: nextProgress,
        activeSubStatuses: [],
        customSubStatuses: statusConfig?.subStatuses || []
      } as Project;
      await updateProjectInDb(selectedProject.id, {
        status: newStatus as any,
        progress: nextProgress as any,
        activeSubStatuses: [] as any,
        customSubStatuses: (statusConfig?.subStatuses || []) as any
      } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
      showNotification(`Status diubah ke "${newStatus}"`);
    } catch {
      showNotification('Gagal memperbarui status. Coba lagi.');
    }
  };

  const handleSubStatusToggle = async (subName: string, checked: boolean) => {
    if (!selectedProject) return;
    const nextActive = checked
      ? [...(selectedProject.activeSubStatuses || []), subName]
      : (selectedProject.activeSubStatuses || []).filter(s => s !== subName);
    try {
      const updated = { ...selectedProject, activeSubStatuses: nextActive };
      await updateProjectInDb(selectedProject.id, { activeSubStatuses: nextActive as any } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
    } catch {
      showNotification('Gagal memperbarui tahapan.');
    }
  };

  const handleSaveFinalLink = async () => {
    if (!selectedProject) return;
    try {
      const updated = { ...selectedProject, finalDriveLink: tempFinalLink };
      await updateProjectInDb(selectedProject.id, { finalDriveLink: tempFinalLink } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
      setIsEditingFinalLink(false);
      showNotification('Link File Jadi berhasil diperbarui.');
    } catch {
      showNotification('Gagal memperbarui link.');
    }
  };

  const handleSendFinalLink = () => {
    if (!selectedProject?.finalDriveLink) { showNotification('Link File Jadi belum tersedia.'); return; }
    const client = clients.find(c => c.id === selectedProject.clientId);
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { showNotification('Nomor WhatsApp pengantin tidak ditemukan.'); return; }
    const template =
      profile.chatTemplates?.find(t => t.title.toLowerCase().includes('link'))?.template ||
      `Halo Kak {clientName},\n\nTerima kasih telah mempercayakan acara {projectName} kepada kami.\nBerikut link file hasil dokumentasi:\n{finalDriveLink}\n\nSemoga suka!`;
    const message = template
      .replace(/{clientName}/g, selectedProject.clientName)
      .replace(/{projectName}/g, selectedProject.projectName)
      .replace(/{finalDriveLink}/g, selectedProject.finalDriveLink);
    onOpenSharePreview({ title: `Bagikan Link File Jadi — ${selectedProject.projectName}`, message, phone });
  };

  // ── guard ─────────────────────────────────────────────────────────────────
  if (!selectedProject) return null;

  // ── derived data ──────────────────────────────────────────────────────────
  const allSubStatuses =
    selectedProject.customSubStatuses ||
    profile.projectStatusConfig.find(s => s.name === selectedProject.status)?.subStatuses ||
    [];
  const eventDateParts = selectedProject.date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const eventDayUtc = eventDateParts
    ? Date.UTC(Number(eventDateParts[1]), Number(eventDateParts[2]) - 1, Number(eventDateParts[3]))
    : null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const overdueDays = eventDayUtc === null ? 0 : Math.floor((todayUtc - eventDayUtc) / 86400000);
  const isActionableOverdue = overdueDays > 0 && !/selesai|dibatalkan/i.test(selectedProject.status);

  const pkg = packages.find(p => p.id === selectedProject.packageId) ?? null;
  const packageTerms = getPackageTerms(profile.publicPageConfig?.packageTerms);
  const workflows = getWorkflows(profile.publicPageConfig);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -mt-1">

      {/* ══════════════════════════════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="relative mb-3 sm:mb-4 overflow-hidden rounded-xl border border-slate-200/40 bg-cover bg-center shadow-md sm:rounded-2xl"
        style={{ backgroundImage: `url(${profile.publicPageConfig?.backgroundImages?.eventDetail || '/assets/images/backgrounds/detail-acara-pernikahan.jpg'})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/75 via-slate-900/65 to-slate-900/85" />
        <div className="relative p-3.5 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-base font-black leading-snug text-white sm:text-2xl">
              {selectedProject.projectName}
            </h2>
            {selectedProject.clientName && !selectedProject.projectName.toLocaleLowerCase().startsWith(selectedProject.clientName.toLocaleLowerCase()) && (
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-200 sm:text-sm">
                Pengantin: {selectedProject.clientName}
              </p>
            )}
          </div>

          {!isEditing ? (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setDocumentationReminderDraft(DOCUMENTATION_REMINDER_TEMPLATE);
                  setIsDocumentationReminderOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-white/25 active:scale-95 sm:px-3 sm:py-2 sm:text-xs"
                title="Chat Template Pengingat Dokumentasi"
              >
                <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Chat Template</span>
              </button>
              <button
                onClick={handleOpenBriefingModal}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-emerald-700 bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 sm:py-2 sm:text-xs"
                title="Briefing Tim"
              >
                <Share2Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">Briefing</span>
              </button>
            </div>
          ) : (
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-orange-600 bg-orange-600 px-2.5 py-1.5 text-[11px] font-bold text-white sm:text-xs">
              <PencilIcon className="h-3.5 w-3.5 flex-shrink-0" />
              Mode Edit
            </span>
          )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isDocumentationReminderOpen}
        onClose={() => setIsDocumentationReminderOpen(false)}
        title={DOCUMENTATION_REMINDER_TITLE}
        size="lg"
        footer={(
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleSaveDocumentationReminder}
              disabled={chatTemplates.loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-bold text-brand-text-primary transition-colors hover:bg-brand-input disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <SaveIcon className="h-4 w-4" />
              Simpan Chat Template
            </button>
            <button
              type="button"
              onClick={handleShareDocumentationReminder}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 sm:w-auto"
            >
              <SendIcon className="h-4 w-4" />
              Bagikan via WhatsApp
            </button>
          </div>
        )}
      >
        <label htmlFor="documentation-reminder-message" className="mb-2 block text-sm font-bold text-brand-text-primary">
          Pesan untuk pengantin
        </label>
        <textarea
          id="documentation-reminder-message"
          value={documentationReminderDraft}
          onChange={event => setDocumentationReminderDraft(event.target.value)}
          rows={18}
          className="w-full resize-y rounded-xl border border-brand-border bg-brand-input p-3 text-sm leading-relaxed text-brand-text-primary focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        />
      </Modal>

      <Modal
        isOpen={paymentToProcess !== null}
        onClose={() => {
          if (!isProcessingTeamPayment) {
            setPaymentToProcess(null);
            setPaymentSourceId('');
          }
        }}
        title="Bayar Pembayaran Tim / Vendor"
        size="md"
        footer={(
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isProcessingTeamPayment}
              onClick={() => {
                setPaymentToProcess(null);
                setPaymentSourceId('');
              }}
              className="min-h-11 rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-bold text-brand-text-primary hover:bg-brand-input disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!paymentSourceId || isProcessingTeamPayment || !paymentToProcess || !onPayTeamAssignment}
              onClick={async () => {
                if (!paymentToProcess || !onPayTeamAssignment || !paymentSourceId) return;
                setIsProcessingTeamPayment(true);
                try {
                  await onPayTeamAssignment(paymentToProcess, paymentSourceId);
                  setPaymentToProcess(null);
                  setPaymentSourceId('');
                } finally {
                  setIsProcessingTeamPayment(false);
                }
              }}
              className="min-h-11 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessingTeamPayment ? 'Memproses...' : 'Bayar Sekarang'}
            </button>
          </div>
        )}
      >
        {paymentToProcess && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
              <p className="text-xs font-semibold text-brand-text-secondary">
                {paymentToProcess.teamMemberName} · {selectedProject.projectName}
              </p>
              <p className="mt-1 text-lg font-extrabold text-brand-text-primary">
                {formatCurrency(paymentToProcess.fee)}
              </p>
            </div>
            <label className="block text-xs font-bold text-brand-text-primary" htmlFor="team-payment-source">
              Sumber dana
              <select
                id="team-payment-source"
                value={paymentSourceId}
                onChange={event => setPaymentSourceId(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm font-medium text-brand-text-primary focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              >
                <option value="">Pilih kartu atau kantong</option>
                {cards.map(card => (
                  <option key={card.id} value={`card-${card.id}`}>
                    {card.bankName} ···{card.lastFourDigits} — {formatCurrency(card.balance)}
                  </option>
                ))}
                {pockets.map(pocket => (
                  <option key={pocket.id} value={`pocket-${pocket.id}`}>
                    {pocket.name} — {formatCurrency(pocket.amount)}
                  </option>
                ))}
              </select>
            </label>
            {cards.length === 0 && pockets.length === 0 && (
              <p className="text-xs text-amber-700">Tambahkan sumber dana di Keuangan sebelum memproses pembayaran.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={paymentProofToView !== null}
        onClose={() => setPaymentProofToView(null)}
        title="Bukti & Invoice Pembayaran"
        size="4xl"
      >
        {paymentProofToView && selectedProject && (
          <>
            <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-brand-border bg-white p-2 sm:p-4">
              <PaymentSlipDocument
                record={paymentProofToView}
                teamMembers={teamMembers}
                teamProjectPayments={teamProjectPayments}
                projects={paymentInvoiceProjects.length > 0 ? paymentInvoiceProjects : [selectedProject]}
                userProfile={profile}
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-brand-border pt-4">
              <button
                type="button"
                onClick={() => {
                  const member = teamMembers.find(item => item.id === paymentProofToView.teamMemberId);
                  const text = [
                    `Halo ${member?.name || 'Tim / Vendor'}, berikut bukti pembayaran honor untuk ${selectedProject.projectName}.`,
                    `Nomor invoice: ${paymentProofToView.recordNumber}`,
                    `Total: ${formatCurrency(paymentProofToView.totalAmount)}`,
                    'Silakan lihat lampiran bukti pembayaran.',
                  ].join('\n');
                  onOpenSharePreview({
                    title: 'Bukti & Invoice Pembayaran Tim',
                    message: text,
                    phone: member?.phone,
                  });
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4" /> Template WhatsApp
              </button>
              <button
                type="button"
                disabled={isPreparingPaymentProof}
                onClick={async () => {
                  if (!paymentProofToView) return;
                  setIsPreparingPaymentProof(true);
                  try {
                    const fileName = buildPaymentSlipFileName(paymentProofToView);
                    const pdf = await buildPaymentSlipPdf({
                      record: paymentProofToView,
                      teamMembers,
                      teamProjectPayments,
                      projects: paymentInvoiceProjects.length > 0 ? paymentInvoiceProjects : [selectedProject],
                      profile,
                    });
                    const file = new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
                    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
                      await navigator.share({
                        files: [file],
                        title: 'Bukti & Invoice Pembayaran Tim',
                        text: `Bukti pembayaran ${paymentProofToView.recordNumber}`,
                      });
                    } else {
                      pdf.save(fileName);
                      showNotification('PDF berhasil diunduh. Lampirkan file tersebut pada template WhatsApp.');
                    }
                  } catch (error) {
                    if (!(error instanceof DOMException && error.name === 'AbortError')) {
                      console.error('[Projects] Failed to share team payment PDF:', error);
                      showNotification('Gagal menyiapkan PDF bukti pembayaran. Coba lagi.');
                    }
                  } finally {
                    setIsPreparingPaymentProof(false);
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2Icon className="h-4 w-4" />
                {isPreparingPaymentProof ? 'Menyiapkan PDF...' : 'Bagikan PDF'}
              </button>
              <button
                type="button"
                disabled={isPreparingPaymentProof}
                onClick={async () => {
                  if (!paymentProofToView) return;
                  setIsPreparingPaymentProof(true);
                  try {
                    await downloadPaymentSlipPdf({
                      record: paymentProofToView,
                      teamMembers,
                      teamProjectPayments,
                      projects: paymentInvoiceProjects.length > 0 ? paymentInvoiceProjects : [selectedProject],
                      profile,
                    });
                  } catch (error) {
                    console.error('[Projects] Failed to download team payment PDF:', error);
                    showNotification('Gagal mengunduh PDF bukti pembayaran. Coba lagi.');
                  } finally {
                    setIsPreparingPaymentProof(false);
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-bold text-brand-text-primary hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownIcon className="h-4 w-4" /> Unduh PDF
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          EDIT MODE
      ══════════════════════════════════════════════════════════════════ */}
      {isEditing && editFormData && (
        <EditModeContent
          editFormData={editFormData}
          section={editingSection}
          profile={profile}
          teamMembers={teamMembers}
          teamByCategory={editTeamByCategory}
          paidMemberIds={paidMemberIdsForProject}
          isSaving={isSaving}
          onFormChange={onEditFormChange}
          onSubStatusToggle={onEditSubStatusToggle}
          onTeamChange={onEditTeamChange}
          onTeamFeeChange={onEditTeamFeeChange}
          onTeamSubJobChange={onEditTeamSubJobChange}
          onReplaceTeamMember={onEditReplaceTeamMember}
          onSave={() => onSaveEdit(editingSection || undefined)}
          onCancel={onCancelEditMode}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW MODE (UNIFIED SECTIONS WITH MOBILE TAB FILTER)
      ══════════════════════════════════════════════════════════════════ */}
      {!isEditing && (
        <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
          {/* Quick Section Navigation Bar */}
          <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-white/95 backdrop-blur-md border-b border-slate-200">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {([
                { id: 'info', label: customizeUiText('project.detail.tab.info', 'Info & Status', uiTextOverrides) },
                { id: 'meetings', label: customizeUiText('project.detail.tab.meetings', 'Meeting', uiTextOverrides) },
                { id: 'team', label: `${customizeUiText('project.detail.tab.team', 'Tim & Paket', uiTextOverrides)} (${selectedProject.team?.length || 0})` },
                { id: 'terms', label: customizeUiText('project.detail.tab.terms', 'Syarat & Ketentuan', uiTextOverrides) },
                { id: 'workflow', label: customizeUiText('project.detail.tab.workflow', 'Workflow', uiTextOverrides) },
                { id: 'files', label: customizeUiText('project.detail.tab.files', 'File & Link', uiTextOverrides) },
              ] as const).map(tab => {
                const active = mobileSectionTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMobileSectionTab(tab.id)}
                    className={`flex min-h-10 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-center text-[10px] sm:text-xs font-bold border transition-all ${
                      active
                        ? 'bg-brand-accent text-white border-brand-accent shadow-xs'
                        : 'bg-[#F8FAFC] text-[#5A6A85] border-slate-200 hover:text-[#2A3547] hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ──────────── SEKSI 1: INFORMASI & STATUS ACARA ──────────── */}
          {(mobileSectionTab === 'info' || mobileSectionTab === 'meetings') && (
            <>
              {mobileSectionTab === 'info' && (
                <>
              {isActionableOverdue && (
                <div role="status" className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-900">Lewat {overdueDays} hari · perlu diperbarui</p>
                    <p className="mt-0.5 text-xs text-amber-800">Tanggal acara sudah lewat. Periksa status acara sebelum menandai selesai.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startSectionEdit('status')}
                    className="min-h-10 shrink-0 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
                  >
                    Perbarui status
                  </button>
                </div>
              )}
              <section>
                <SectionHeading title={customizeUiText('project.detail.section.main', 'Informasi Utama', uiTextOverrides)} action={sectionEditButton('info')} />
                <SectionCard>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    <InfoField label={customizeUiText('project.detail.field.client', 'Pengantin', uiTextOverrides)}>{selectedProject.clientName}</InfoField>
                    <InfoField label={customizeUiText('project.detail.field.location', 'Lokasi / Kota', uiTextOverrides)}>{selectedProject.location || '—'}</InfoField>
                    <InfoField label={customizeUiText('project.detail.field.date', 'Tanggal Acara', uiTextOverrides)} className="col-span-2 sm:col-span-1">
                      {formatDateFull(selectedProject.date)}
                    </InfoField>
                    <InfoField label="Alamat Lengkap / Gedung" className="col-span-2 sm:col-span-1">
                      {selectedProject.address || '—'}
                    </InfoField>
                    <InfoField label="Google Maps" className="col-span-2">
                      {selectedProject.googleMapsLink ? (
                        <a href={selectedProject.googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline break-all">
                          Buka lokasi di Google Maps
                        </a>
                      ) : '—'}
                    </InfoField>
                    {selectedProject.startTime && <InfoField label="Jam Mulai">{selectedProject.startTime}</InfoField>}
                    {selectedProject.endTime && <InfoField label="Jam Selesai">{selectedProject.endTime}</InfoField>}
                  </div>

                </SectionCard>
              </section>

              <section>
                <SectionHeading title={customizeUiText('project.detail.section.status', 'Status & Progres Pengerjaan', uiTextOverrides)} action={sectionEditButton('status')} />
                <SectionCard>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                    <p className="text-[11px] sm:text-xs font-bold text-[#5A6A85] uppercase tracking-wider shrink-0">
                      Status Acara:
                    </p>
                    <div className="relative flex-grow">
                      <select
                        value={selectedProject.status}
                        onChange={e => handleStatusUpdate(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#2A3547] rounded-xl border border-slate-200 bg-[#F8FAFC] cursor-pointer focus:outline-none focus:bg-white focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all"
                      >
                        {profile.projectStatusConfig.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="flex justify-between text-xs font-bold text-[#2A3547] mb-1.5">
                      <span>Progres Pengerjaan</span>
                      <span className="text-brand-accent">{selectedProject.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-accent transition-all duration-700 rounded-full"
                        style={{ width: `${selectedProject.progress}%` }}
                      />
                    </div>
                  </div>

                  {allSubStatuses.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85] mb-2.5">
                        Tahapan Detail ({selectedProject.activeSubStatuses?.length || 0}/{allSubStatuses.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allSubStatuses.map(sub => {
                          const isActive = selectedProject.activeSubStatuses?.includes(sub.name);
                          return (
                            <label
                              key={sub.name}
                              className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                                isActive
                                  ? 'bg-brand-accent/10 border-brand-accent/40 text-[#2A3547]'
                                  : 'bg-[#F8FAFC] border-slate-200 text-[#5A6A85] hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-brand-accent border-slate-300 focus:ring-brand-accent/30 flex-shrink-0"
                                checked={!!isActive}
                                onChange={e => handleSubStatusToggle(sub.name, e.target.checked)}
                              />
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs sm:text-sm font-bold block leading-snug ${isActive ? 'text-[#2A3547]' : 'text-[#5A6A85]'}`}>
                                  {sub.name}
                                </span>
                                {sub.note && (
                                  <span className="text-[10px] text-[#5A6A85] block mt-0.5">{sub.note}</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </section>

              <section>
                  <SectionHeading title={customizeUiText('project.detail.section.notes', 'Catatan Khusus', uiTextOverrides)} action={sectionEditButton('notes')} />
                  <SectionCard>
                    <p className="text-xs sm:text-sm text-[#2A3547] leading-relaxed whitespace-pre-line">
                      {selectedProject.notes || <span className="italic text-[#5A6A85]">Belum ada catatan.</span>}
                    </p>
                  </SectionCard>
              </section>
                </>
              )}

              {mobileSectionTab === 'meetings' && (
              <section>
                <SectionHeading title={customizeUiText('project.detail.section.meetings', 'Jadwal Meeting & Hasil', uiTextOverrides)} />
                <div className="grid grid-cols-1 gap-3">
                  {([
                    { kind: 'regular', title: customizeUiText('project.detail.meeting.offline', 'Meeting Offline', uiTextOverrides), description: 'Atur pertemuan langsung dengan pengantin.', icon: CalendarClock },
                    { kind: 'zoom', title: customizeUiText('project.detail.meeting.online', 'Meeting Online', uiTextOverrides), description: 'Atur meeting online dan simpan tautan Zoom.', icon: Video },
                  ] as const).map(({ kind, title, description, icon: MeetingIcon }) => {
                    const draft = meetingDrafts[kind];
                    const meeting = projectMeetings.find(item => item.metadata.kind === kind);
                    const validZoomUrl = /^https?:\/\//i.test(draft.zoomUrl.trim());
                    const isOpen = meetingCardOpen[kind];
                    return (
                      <div key={kind} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMeetingCardOpen(current => ({ ...current, [kind]: !current[kind] }))}
                            aria-expanded={isOpen}
                            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-brand-accent/30 sm:gap-3"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl grad-brand text-white sm:h-10 sm:w-10">
                              <MeetingIcon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-extrabold text-[#2A3547]">{title}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-[#5A6A85] sm:text-xs">
                                {draft.scheduledAt
                                  ? new Date(draft.scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                                  : description}
                              </span>
                              {meeting && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Terjadwal</span>}
                            </span>
                            {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-[#73839B]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#73839B]" />}
                          </button>
                          {draft.scheduledAt && (
                            <button
                              type="button"
                              onClick={() => handleShareMeeting(kind)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1EBA59] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 sm:w-auto sm:px-3"
                              title="Bagikan jadwal melalui WhatsApp"
                              aria-label={`Bagikan jadwal ${title} melalui WhatsApp`}
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                          )}
                        </div>

                        {isOpen && (isLoadingMeetings ? (
                          <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-center text-xs text-[#5A6A85]">Memuat jadwal...</p>
                        ) : (
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              void handleSaveMeeting(kind);
                            }}
                            className="mt-4 space-y-4"
                          >
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label htmlFor={`meeting-date-${kind}`} className={labelCls}>Tanggal & Waktu</label>
                                <input
                                  id={`meeting-date-${kind}`}
                                  type="datetime-local"
                                  required
                                  value={draft.scheduledAt}
                                  onChange={e => setMeetingDrafts(current => ({
                                    ...current,
                                    [kind]: { ...current[kind], scheduledAt: e.target.value },
                                  }))}
                                  className={inputCls}
                                />
                              </div>

                              {kind === 'regular' && (
                                <div>
                                  <label htmlFor={`meeting-location-${kind}`} className={labelCls}>Lokasi Meeting</label>
                                  <input
                                    id={`meeting-location-${kind}`}
                                    type="text"
                                    value={draft.location}
                                    onChange={e => setMeetingDrafts(current => ({
                                      ...current,
                                      regular: { ...current.regular, location: e.target.value },
                                    }))}
                                    placeholder="Contoh: kantor, kafe, atau alamat"
                                    className={inputCls}
                                  />
                                </div>
                              )}

                              {kind === 'zoom' && (
                                <div>
                                  <label htmlFor={`meeting-zoom-url-${kind}`} className={labelCls}>Link Zoom</label>
                                  <input
                                    id={`meeting-zoom-url-${kind}`}
                                    type="url"
                                    value={draft.zoomUrl}
                                    onChange={e => setMeetingDrafts(current => ({
                                      ...current,
                                      zoom: { ...current.zoom, zoomUrl: e.target.value },
                                    }))}
                                    placeholder="https://zoom.us/j/..."
                                    className={inputCls}
                                  />
                                  {validZoomUrl && (
                                    <a href={draft.zoomUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accent hover:underline">
                                      <ExternalLink className="h-3.5 w-3.5" /> Buka link Zoom
                                    </a>
                                  )}
                                </div>
                              )}

                              <div>
                                <label htmlFor={`meeting-notes-${kind}`} className={labelCls}>Catatan / Hasil Meeting</label>
                                <textarea
                                  id={`meeting-notes-${kind}`}
                                  value={draft.resultNotes}
                                  onChange={e => setMeetingDrafts(current => ({
                                    ...current,
                                    [kind]: { ...current[kind], resultNotes: e.target.value },
                                  }))}
                                  rows={3}
                                  placeholder="Tuliskan hasil pembahasan, keputusan, dan tindak lanjut..."
                                  className={`${inputCls} resize-y`}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              {meeting && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMeeting(kind)}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" /> Hapus
                                </button>
                              )}
                              {draft.scheduledAt && (
                                <button
                                  type="button"
                                  onClick={() => handleShareMeeting(kind)}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1EBA59]"
                                >
                                  <MessageCircle className="h-4 w-4" /> Bagikan WhatsApp
                                </button>
                              )}
                              <button
                                type="submit"
                                disabled={savingMeetingKind !== null}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-accent px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <SaveIcon className="h-4 w-4" />
                                {savingMeetingKind === kind ? 'Menyimpan...' : meeting ? 'Perbarui & Sinkronkan Kalender' : 'Simpan & Tambahkan ke Kalender'}
                              </button>
                            </div>
                          </form>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
              )}
            </>
          )}

          {/* ──────────── SEKSI TIM & BIAYA PAKET ──────────── */}
          {mobileSectionTab === 'team' && (
            <>
              <section>
                <SectionHeading title="Tugas Tim dan Vendor" action={sectionEditButton('team')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {(['Tim', 'Vendor'] as const).map(category => {
                    const roleGroups = Object.entries(teamByCategory[category] || {});
                    const assignmentCount = roleGroups.reduce((count, [, members]) => count + members.length, 0);

                    return (
                      <div key={category} className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-slate-200">
                          <h4 className="text-xs sm:text-sm font-bold text-[#2A3547]">
                            {category === 'Tim' ? 'Tim Internal' : 'Vendor / Mitra'}
                          </h4>
                          <span className="text-[10px] font-bold text-white bg-brand-accent border border-brand-accent px-2.5 py-0.5 rounded-full">
                            {assignmentCount} orang
                          </span>
                        </div>
                        {assignmentCount === 0 ? (
                          <p className="text-xs text-[#5A6A85] italic py-3 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-slate-200">
                            Belum ada penugasan {category === 'Tim' ? 'tim' : 'vendor'}.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {roleGroups.map(([role, members]) => (
                              <div key={role}>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85] mb-1.5">{role}</p>
                                <div className="space-y-2">
                                  {members.map(assignment => {
                                    const teamMember = teamMembers.find(member => member.id === assignment.memberId);
                                    const matchingPayments = teamProjectPayments.filter(item =>
                                      item.projectId === selectedProject.id && item.teamMemberId === assignment.memberId,
                                    );
                                    const payment = matchingPayments.find(item => item.status === 'Unpaid') ?? matchingPayments[0];
                                    const isPaid = payment?.status === 'Paid';
                                    const paymentRecord = isPaid
                                      ? teamPaymentRecords.find(record => record.projectPaymentIds.includes(payment.id))
                                      : undefined;
                                    return (
                                      <div
                                        key={assignment.id || assignment.memberId}
                                        className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#F8FAFC] border border-slate-200"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-sm font-bold text-brand-accent">
                                            {teamMember?.avatarUrl ? (
                                              <img src={teamMember.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
                                            ) : (
                                              assignment.name?.charAt(0).toUpperCase() || '?'
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="team-assignment-name truncate text-[13px] font-bold text-[#2A3547] sm:text-[15px]">{assignment.name}</p>
                                            {assignment.subJob && (
                                              <p className="text-[11px] text-[#5A6A85] truncate">{assignment.subJob}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="text-xs font-extrabold text-[#2A3547] tabular-nums">
                                            {formatCurrency(payment?.fee ?? assignment.fee)}
                                          </p>
                                          <div className="mt-1 flex items-center justify-end gap-1.5">
                                            <span
                                              className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                                isPaid
                                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                                              }`}
                                            >
                                              {isPaid ? 'Lunas' : 'Belum dibayar'}
                                            </span>
                                            {!isPaid && payment && onPayTeamAssignment && teamMember && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPaymentToProcess(payment);
                                                  setPaymentSourceId('');
                                                }}
                                                className="rounded-md bg-brand-accent px-2 py-0.5 text-[9px] font-bold text-white transition-colors hover:bg-brand-accent-hover"
                                              >
                                                Bayar
                                              </button>
                                            )}
                                            {isPaid && paymentRecord && (
                                              <button
                                                type="button"
                                                onClick={() => setPaymentProofToView(paymentRecord)}
                                                aria-label={`Lihat bukti pembayaran ${assignment.name}`}
                                                className="inline-flex items-center gap-1 rounded-md border border-brand-accent/25 bg-brand-accent/5 px-1.5 py-0.5 text-[9px] font-bold text-brand-accent transition-colors hover:bg-brand-accent/10"
                                              >
                                                <FileTextIcon className="h-3 w-3" /> Bukti
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {mobileSectionTab === 'terms' && (
            <section className="pt-3 border-t border-slate-200">
              <PackageTermsDisplay terms={packageTerms} packageName={pkg?.name || selectedProject.packageName} showHeader={false} />
            </section>
          )}

          {mobileSectionTab === 'workflow' && (
            <section className="pt-3 border-t border-slate-200">
              <WorkflowDisplay workflows={workflows} projectName={selectedProject.projectName} showHeader={false} />
            </section>
          )}

          {/* ──────────── SEKSI 3: FILE & TAUTAN PENTING ───────────── */}
          {mobileSectionTab === 'files' && (
            <div className="space-y-3.5 pt-3 border-t border-slate-200">
              <SectionHeading title="File & Tautan Penting" action={sectionEditButton('files')} />
              <SectionCard>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">Brief / Moodboard</p>
                      <p className="text-xs text-[#5A6A85] mt-0.5">Link internal untuk tim</p>
                    </div>
                    {selectedProject.driveLink ? (
                      <a href={selectedProject.driveLink} target="_blank" rel="noopener noreferrer" className="button-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 border border-slate-200 bg-white text-[#2A3547]">
                        <FileTextIcon className="w-3.5 h-3.5 text-brand-accent" /> Buka
                      </a>
                    ) : <span className="text-xs text-[#5A6A85] italic shrink-0">Belum ada</span>}
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">File dari Pengantin</p>
                      <p className="text-xs text-[#5A6A85] mt-0.5">Foto / dokumen diterima dari pengantin</p>
                    </div>
                    {selectedProject.clientDriveLink ? (
                      <a href={selectedProject.clientDriveLink} target="_blank" rel="noopener noreferrer" className="button-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 border border-slate-200 bg-white text-[#2A3547]">
                        <FileTextIcon className="w-3.5 h-3.5 text-brand-accent" /> Buka
                      </a>
                    ) : <span className="text-xs text-[#5A6A85] italic shrink-0">Belum ada</span>}
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">File Jadi (Hasil Akhir)</p>
                        <p className="text-xs text-[#5A6A85] mt-0.5">Link hasil dokumentasi untuk dikirim ke pengantin</p>
                      </div>
                      {!isEditingFinalLink && (
                        <div className="flex items-center gap-1.5">
                          {selectedProject.finalDriveLink && (
                            <button onClick={handleSendFinalLink} className="btn-box-wa !py-1.5 !px-2.5 text-xs">
                              <SendIcon className="w-3.5 h-3.5 text-white" /> <span>Kirim WA</span>
                            </button>
                          )}
                          <button onClick={() => { setTempFinalLink(selectedProject.finalDriveLink || ''); setIsEditingFinalLink(true); }} className="btn-box-edit !py-1.5 !px-2.5 text-xs">
                            <PencilIcon className="w-3.5 h-3.5" /> <span>Edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingFinalLink ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <input
                          type="url"
                          value={tempFinalLink}
                          onChange={e => setTempFinalLink(e.target.value)}
                          placeholder="https://drive.google.com/…"
                          className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-[#2A3547] focus:outline-none focus:border-brand-accent transition-all"
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={handleSaveFinalLink} className="flex-1 sm:flex-none button-primary !py-2 !px-3.5 text-xs">Simpan</button>
                          <button onClick={() => setIsEditingFinalLink(false)} className="flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#5A6A85] hover:text-[#2A3547]">Batal</button>
                        </div>
                      </div>
                    ) : selectedProject.finalDriveLink ? (
                      <a href={selectedProject.finalDriveLink} target="_blank" rel="noopener noreferrer" className="block text-xs sm:text-sm text-brand-accent hover:underline font-bold break-all bg-white p-2.5 rounded-lg border border-slate-200">
                        {selectedProject.finalDriveLink}
                      </a>
                    ) : (
                      <p className="text-xs text-[#5A6A85] italic">Belum tersedia — klik Edit untuk menambahkan.</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ProjectDetailModal;

// ══════════════════════════════════════════════════════════════════════════════
// EDIT MODE CONTENT — sub-component agar ProjectDetailModal tetap terbaca
// ══════════════════════════════════════════════════════════════════════════════

interface EditModeContentProps {
  editFormData: EditFormData;
  section: ProjectEditSection | null;
  profile: Profile;
  teamMembers: TeamMember[];
  teamByCategory: Record<string, Record<string, TeamMember[]>>;
  paidMemberIds: Set<string>;
  isSaving: boolean;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubStatusToggle: (name: string, checked: boolean) => void;
  onTeamChange: (member: TeamMember) => void;
  onTeamFeeChange: (memberId: string, fee: number) => void;
  onTeamSubJobChange: (memberId: string, subJob: string) => void;
  onReplaceTeamMember: (oldMemberId: string, newMember: TeamMember) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EditModeContent: React.FC<EditModeContentProps> = ({
  editFormData, section, profile, teamMembers, teamByCategory, paidMemberIds,
  isSaving, onFormChange, onSubStatusToggle, onTeamChange, onTeamFeeChange,
  onTeamSubJobChange, onReplaceTeamMember, onSave, onCancel,
}) => {
  return (
    <div className="animate-fade-in">
      {/* Padding bawah agar konten tidak tertutup sticky action bar (~64px) */}
      <div className="pb-20 space-y-4">
        {section === 'status' && (
          <SectionCard title="Status & Progres Pengerjaan">
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-status" className={labelCls}>Status Acara</label>
                <select id="edit-status" name="status" value={editFormData.status} onChange={onFormChange} className={inputCls}>
                  {profile.projectStatusConfig.map(status => <option key={status.id} value={status.name}>{status.name}</option>)}
                </select>
              </div>
              {editFormData.customSubStatuses.map(subStatus => (
                <label key={subStatus.name} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                  <input
                    type="checkbox"
                    checked={editFormData.activeSubStatuses.includes(subStatus.name)}
                    onChange={event => onSubStatusToggle(subStatus.name, event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-accent"
                  />
                  <span className="text-sm font-semibold text-[#2A3547]">{subStatus.name}</span>
                </label>
              ))}
              {editFormData.status === 'Dikirim' && (
                <div>
                  <label htmlFor="edit-status-shippingDetails" className={labelCls}>Detail Pengiriman</label>
                  <input id="edit-status-shippingDetails" type="text" name="shippingDetails" value={editFormData.shippingDetails} onChange={onFormChange} className={inputCls} />
                </div>
              )}
            </div>
          </SectionCard>
        )}
        {section !== 'status' && (
        <div className={`grid grid-cols-1 gap-4 ${section ? '' : 'lg:grid-cols-2 lg:gap-6'}`}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          {section !== 'team' && <div className="space-y-4">

            {/* 1 — Informasi Dasar */}
            {(section === null || section === 'info') && <SectionCard title="Informasi Dasar Acara">
              <div className={section === 'info' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4' : 'space-y-4'}>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-projectName" className={labelCls}>Nama Acara Pernikahan <span className="text-red-400">*</span></label>
                  <input id="edit-projectName" type="text" name="projectName" value={editFormData.projectName} onChange={onFormChange} className={inputCls} placeholder="Contoh: Wedding Xander & Alya" required />
                </div>
                <div>
                  <label htmlFor="edit-projectType" className={labelCls}>Jenis Acara Pernikahan <span className="text-red-400">*</span></label>
                  <select id="edit-projectType" name="projectType" value={editFormData.projectType} onChange={onFormChange} className={inputCls} required>
                    <option value="" disabled>Pilih Jenis...</option>
                    {profile.projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-location" className={labelCls}>Lokasi / Kota</label>
                  <input id="edit-location" type="text" name="location" value={editFormData.location} onChange={onFormChange} className={inputCls} placeholder="Contoh: Jakarta" />
                </div>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-address" className={labelCls}>Alamat Lengkap / Gedung</label>
                  <textarea id="edit-address" name="address" value={editFormData.address} onChange={onFormChange} className={inputCls} placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1" rows={section === 'info' ? 2 : 3} />
                </div>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-googleMapsLink" className={labelCls}>Link Google Maps</label>
                  <input id="edit-googleMapsLink" type="url" name="googleMapsLink" value={editFormData.googleMapsLink} onChange={onFormChange} className={inputCls} placeholder="https://maps.google.com/..." />
                  <p className="mt-1 text-[11px] text-[#5A6A85]">Tempel tautan lokasi dari Google Maps.</p>
                </div>
              </div>
            </SectionCard>}

            {/* 2 — Jadwal & Detail */}
            {(section === null || section === 'info') && <SectionCard title="Jadwal & Detail">
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-date" className={labelCls}>Tanggal Acara <span className="text-red-400">*</span></label>
                    <input id="edit-date" type="date" name="date" value={editFormData.date} onChange={onFormChange} className={inputCls} required />
                  </div>
                  <div>
                    <label htmlFor="edit-deadlineDate" className={labelCls}>Deadline</label>
                    <input id="edit-deadlineDate" type="date" name="deadlineDate" value={editFormData.deadlineDate} onChange={onFormChange} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-startTime" className={labelCls}>Waktu Mulai</label>
                    <input id="edit-startTime" type="time" name="startTime" value={editFormData.startTime} onChange={onFormChange} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="edit-endTime" className={labelCls}>Waktu Selesai</label>
                    <input id="edit-endTime" type="time" name="endTime" value={editFormData.endTime} onChange={onFormChange} className={inputCls} />
                  </div>
                </div>
                {editFormData.status === 'Dikirim' && (
                  <div>
                    <label htmlFor="edit-shippingDetails" className={labelCls}>Detail Pengiriman</label>
                    <input id="edit-shippingDetails" type="text" name="shippingDetails" value={editFormData.shippingDetails} onChange={onFormChange} className={inputCls} placeholder="Informasi pengiriman hasil ke pengantin" />
                  </div>
                )}
              </div>
            </SectionCard>}

            {(section === null || section === 'files') && <SectionCard title="File & Tautan Penting">
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-driveLink" className={labelCls}>Link Brief / Moodboard (Internal)</label>
                  <input id="edit-driveLink" type="url" name="driveLink" value={editFormData.driveLink} onChange={onFormChange} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="edit-clientDriveLink" className={labelCls}>Link File dari Pengantin</label>
                  <input id="edit-clientDriveLink" type="url" name="clientDriveLink" value={editFormData.clientDriveLink} onChange={onFormChange} className={inputCls} placeholder="https://drive.google.com/..." />
                </div>
                <div>
                  <label htmlFor="edit-finalDriveLink" className={labelCls}>Link File Jadi (untuk Pengantin)</label>
                  <input id="edit-finalDriveLink" type="url" name="finalDriveLink" value={editFormData.finalDriveLink} onChange={onFormChange} className={inputCls} placeholder="https://drive.google.com/..." />
                </div>
              </div>
            </SectionCard>}
            {(section === null || section === 'notes') && <SectionCard title="Catatan Khusus">
              <label htmlFor="edit-notes" className={labelCls}>Catatan Acara</label>
              <textarea id="edit-notes" name="notes" value={editFormData.notes} onChange={onFormChange} className={inputCls} placeholder="Catatan penting terkait acara ini..." rows={5} />
            </SectionCard>}
          </div>}

          {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
          {(section === null || section === 'team') && <div className="space-y-4">
            {(['Tim', 'Vendor'] as const).map(category => (
              <SectionCard key={category} title={category === 'Tim' ? 'Tim Internal' : 'Vendor / Mitra'}>
                <div className="space-y-4">
                  {Object.entries(teamByCategory[category] || {}).length === 0 && (
                    <p className="text-xs text-[#5A6A85] italic text-center py-3 bg-[#F8FAFC] rounded-xl border border-dashed border-slate-200">
                      Belum ada {category === 'Tim' ? 'anggota tim' : 'vendor'} terdaftar.
                    </p>
                  )}
                  {Object.entries(teamByCategory[category] || {}).map(([role, members]) => (
                    <div key={role} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-[#5A6A85] uppercase tracking-wider">{role}</p>
                        <div className="h-px flex-grow bg-slate-200" />
                      </div>
                      {(members as TeamMember[]).map(member => {
                        const assignedMember = editFormData.team.find(t => t.memberId === member.id);
                        const isSelected = !!assignedMember;
                        const isPaid = paidMemberIds.has(member.id);
                        return (
                          <div key={member.id} className={`p-3 rounded-xl transition-all ${isSelected ? 'bg-brand-accent/10 border-2 border-brand-accent' : 'bg-[#F8FAFC] border border-slate-200 hover:border-brand-accent/40'}`}>
                            <label className="flex items-center gap-2.5 sm:gap-3 cursor-pointer">
                              <input type="checkbox" checked={isSelected} onChange={() => onTeamChange(member)} className="h-4 w-4 text-brand-accent rounded border-slate-300 focus:ring-brand-accent/40 flex-shrink-0" />
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-brand-accent">
                                {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" /> : member.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-[#2A3547] truncate">{member.name}</p>
                                {isSelected && <p className="text-[10px] text-[#5A6A85] mt-0.5">Pembayaran standar: {formatCurrency(member.standardFee)}</p>}
                              </div>
                            </label>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                <div>
                                  <label className={labelCls}>Biaya per Acara</label>
                                  <input type="number" value={assignedMember!.fee} onChange={e => onTeamFeeChange(member.id, Number(e.target.value))} disabled={isPaid} className={`${inputCls} text-right font-mono ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="0" />
                                  {isPaid && <p className="text-[10px] text-amber-600 mt-1">Sudah dibayar — tidak dapat diubah</p>}
                                </div>
                                <div>
                                  <label className={labelCls}>Keterangan Tugas</label>
                                  <input type="text" value={assignedMember!.subJob || ''} onChange={e => onTeamSubJobChange(member.id, e.target.value)} className={inputCls} placeholder="Contoh: Leader, Drone Operator..." />
                                </div>
                                <div>
                                  <label className={labelCls}>Ganti Personil / Freelance</label>
                                  <select value="" onChange={e => { const m = teamMembers.find(tm => tm.id === e.target.value); if (m) onReplaceTeamMember(member.id, m); }} className={`${inputCls} cursor-pointer`}>
                                    <option value="">— Tetap {member.name} (atau pilih pengganti) —</option>
                                    {teamMembers.filter(tm => tm.id !== member.id).map(tm => (
                                      <option key={tm.id} value={tm.id}>Ganti ke: {tm.name} ({tm.role || 'Tim'})</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>}
        </div>
        )}
      </div>

      {/* ── Sticky Action Bar ─────────────────────────────────────────── */}
      {/* z-50: di atas konten modal (overflow-y scroll), di bawah overlay (z-60) */}
      <div className="sticky bottom-0 left-0 right-0 z-50 flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <p className="flex-1 text-xs text-[#5A6A85] hidden sm:block truncate">
          <span className="font-bold text-amber-600">{section ? 'Edit Bagian Aktif' : 'Mode Edit Aktif'}</span> — Perubahan belum disimpan
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-[#5A6A85] text-xs sm:text-sm font-bold hover:text-[#2A3547] transition-all active:scale-95 disabled:opacity-50"
        >
          <XIcon className="w-4 h-4" />
          Batal
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-xs sm:text-sm font-bold hover:bg-brand-accent-hover transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-brand-accent/25"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Menyimpan...
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4 flex-shrink-0" />
              {section ? 'Update Bagian' : 'Simpan Perubahan'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
