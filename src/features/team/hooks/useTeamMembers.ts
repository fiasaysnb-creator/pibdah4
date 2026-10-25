/**
 * useTeamMembers
 *
 * Owns:
 * - Team member form state (add/edit)
 * - CRUD handlers (create, update, delete)
 * - Portal QR logic
 * - Selected member + detail modal state
 */

import { useState, useEffect, useCallback } from 'react';
import { toPublicNameSlug } from '../../../utils/publicRouting';
import {
    TeamMember,
    Project,
    TeamProjectPayment,
    TeamPaymentRecord,
    NavigationAction,
    PerformanceNote,
    PerformanceNoteType,
} from '../../../types';
import {
    createTeamMember as createTeamMemberRow,
    updateTeamMember as updateTeamMemberRow,
    deleteTeamMember as deleteTeamMemberRow,
} from '../../../services/teamMembers';
import { generateUUID } from '../../../utils/uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamMemberFormData = Omit<TeamMember, 'id' | 'rating' | 'performanceNotes' | 'portalAccessId'>;

export type DetailTab = 'projects' | 'salary' | 'payments' | 'performance' | 'create-payment';

export interface QrModalContent {
    title: string;
    url: string;
}

const EMPTY_MEMBER: TeamMemberFormData = {
    name: '',
    role: '',
    email: '',
    phone: '',
    avatarUrl: '',
    standardFee: 0,
    noRek: '',
    category: 'Tim',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseTeamMembersParams {
    teamMembers: TeamMember[];
    setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords: TeamPaymentRecord[];
    setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    showNotification: (message: string) => void;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
}

export const useTeamMembers = ({
    teamMembers,
    setTeamMembers,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
    setProjects,
    showNotification,
    initialAction,
    setInitialAction,
}: UseTeamMembersParams) => {
    // ── Form state ──────────────────────────────────────────────────────────
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [formData, setFormData] = useState<TeamMemberFormData>(EMPTY_MEMBER);

    // ── Detail modal state ──────────────────────────────────────────────────
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('projects');

    // ── Performance state ───────────────────────────────────────────────────
    const [newNote, setNewNote] = useState('');
    const [newNoteType, setNewNoteType] = useState<PerformanceNoteType>(PerformanceNoteType.GENERAL);

    // ── Portal / QR state ───────────────────────────────────────────────────
    const [qrModalContent, setQrModalContent] = useState<QrModalContent | null>(null);

    // ── Keep selectedMember in sync when teamMembers updates ────────────────
    useEffect(() => {
        if (!selectedMember) return;
        const latest = teamMembers.find(m => m.id === selectedMember.id);
        if (
            latest &&
            (latest.name !== selectedMember.name ||
                latest.role !== selectedMember.role ||
                latest.rating !== selectedMember.rating ||
                latest.avatarUrl !== selectedMember.avatarUrl)
        ) {
            setSelectedMember(latest);
        }
    }, [teamMembers, selectedMember]);

    // ── Handle navigation action (e.g. deep-link to member detail) ──────────
    useEffect(() => {
        if (initialAction?.type === 'VIEW_FREELANCER_DETAILS' && initialAction.id) {
            const memberToView = teamMembers.find(m => m.id === initialAction.id);
            if (memberToView) {
                handleViewDetails(memberToView);
            }
            setInitialAction(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAction, teamMembers]);

    // ── Form handlers ────────────────────────────────────────────────────────
    const handleOpenForm = useCallback((mode: 'add' | 'edit', member?: TeamMember) => {
        setFormMode(mode);
        if (mode === 'edit' && member) {
            setSelectedMember(member);
            setFormData({
                name: member.name || '',
                role: member.role || '',
                email: member.email || '',
                phone: member.phone || '',
                avatarUrl: member.avatarUrl || '',
                standardFee: typeof member.standardFee === 'number' ? member.standardFee : 0,
                noRek: member.noRek || '',
                category: member.category || 'Tim',
            });
        } else {
            setSelectedMember(null);
            setFormData(EMPTY_MEMBER);
        }
        setIsFormOpen(true);
    }, []);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (isSubmitting) return;
            setIsSubmitting(true);
            try {
                if (formMode === 'add') {
                    const payload: Omit<TeamMember, 'id'> = {
                        ...formData,
                        rating: 0,
                        performanceNotes: [],
                        portalAccessId: generateUUID(),
                    };
                    const created = await createTeamMemberRow(payload);
                    setTeamMembers(prev => [...prev, created]);
                    showNotification(`Tim / Vendor ${created.name} berhasil ditambahkan.`);
                } else if (selectedMember) {
                    const updated = await updateTeamMemberRow(selectedMember.id, formData as Partial<TeamMember>);
                    setTeamMembers(prev => prev.map(m => (m.id === selectedMember.id ? updated : m)));
                    // Cascade name change to related structures
                    if (formData.name !== selectedMember.name) {
                        setProjects(prevProjects =>
                            prevProjects.map(proj => ({
                                ...proj,
                                team: proj.team.map(t =>
                                    t.memberId === selectedMember.id ? { ...t, name: formData.name } : t,
                                ),
                            })),
                        );
                        setTeamProjectPayments(prevPayments =>
                            prevPayments.map(p =>
                                p.teamMemberId === selectedMember.id
                                    ? { ...p, teamMemberName: formData.name }
                                    : p,
                            ),
                        );
                    }
                    showNotification(`Data ${updated.name} berhasil diperbarui.`);
                }
                setIsFormOpen(false);
            } catch (err: unknown) {
                console.error('[Supabase][teamMembers.save] error:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                alert(`Gagal menyimpan data Tim / Vendor. ${errorMessage || 'Coba lagi.'}`);
            } finally {
                setIsSubmitting(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isSubmitting, formMode, formData, selectedMember],
    );

    const handleDelete = useCallback(
        async (memberId: string) => {
            if (teamProjectPayments.some(p => p.teamMemberId === memberId && p.status === 'Unpaid')) {
                alert('Tim / Vendor ini memiliki pembayaran yang belum lunas dan tidak dapat dihapus.');
                return;
            }
            if (
                !window.confirm(
                    'Apakah Anda yakin ingin menghapus Tim / Vendor ini? Semua data terkait (Acara Pernikahan, pembayaran) juga akan dihapus.',
                )
            )
                return;
            try {
                await deleteTeamMemberRow(memberId);
                setProjects(prevProjects =>
                    prevProjects.map(p => ({
                        ...p,
                        team: p.team.filter(t => t.memberId !== memberId),
                    })),
                );
                setTeamProjectPayments(prevPayments =>
                    prevPayments.filter(p => p.teamMemberId !== memberId),
                );
                setTeamPaymentRecords(prevRecords =>
                    prevRecords.filter(r => r.teamMemberId !== memberId),
                );
                setTeamMembers(prev => prev.filter(m => m.id !== memberId));
                showNotification('Tim / Vendor dan semua data terkait berhasil dihapus.');
            } catch (err: unknown) {
                console.error('[Supabase][teamMembers.delete] error:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                alert(`Gagal menghapus Tim / Vendor di database. ${errorMessage || 'Coba lagi.'}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [teamProjectPayments],
    );

    // ── Detail modal handlers ────────────────────────────────────────────────
    const handleViewDetails = useCallback((member: TeamMember) => {
        setSelectedMember(member);
        setDetailTab('projects');
        setIsDetailOpen(true);
    }, []);

    // ── Performance handlers ─────────────────────────────────────────────────
    const handleSetRating = useCallback(
        async (rating: number) => {
            if (!selectedMember) return;
            try {
                const updated = await updateTeamMemberRow(selectedMember.id, { rating });
                setTeamMembers(prev => prev.map(m => (m.id === selectedMember.id ? updated : m)));
                setSelectedMember(updated);
            } catch (err: unknown) {
                console.error('[Supabase][teamMembers.rating] error:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                alert(`Gagal menyimpan rating. ${errorMessage || 'Coba lagi.'}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedMember],
    );

    const handleAddNote = useCallback(async () => {
        if (!selectedMember || !newNote.trim()) return;
        const note: PerformanceNote = {
            id: `PN-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            note: newNote,
            type: newNoteType,
        };
        const updatedNotes = [...selectedMember.performanceNotes, note];
        try {
            const updated = await updateTeamMemberRow(selectedMember.id, {
                performanceNotes: updatedNotes,
            });
            setTeamMembers(prev => prev.map(m => (m.id === selectedMember.id ? updated : m)));
            setSelectedMember(updated);
            setNewNote('');
            setNewNoteType(PerformanceNoteType.GENERAL);
        } catch (err: unknown) {
            console.error('[Supabase][teamMembers.addNote] error:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            alert(`Gagal menambah catatan. ${errorMessage || 'Coba lagi.'}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMember, newNote, newNoteType]);

    const handleDeleteNote = useCallback(
        async (noteId: string) => {
            if (!selectedMember) return;
            const updatedNotes = selectedMember.performanceNotes.filter(n => n.id !== noteId);
            try {
                const updated = await updateTeamMemberRow(selectedMember.id, {
                    performanceNotes: updatedNotes,
                });
                setTeamMembers(prev => prev.map(m => (m.id === selectedMember.id ? updated : m)));
                setSelectedMember(updated);
            } catch (err: unknown) {
                console.error('[Supabase][teamMembers.deleteNote] error:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                alert(`Gagal menghapus catatan. ${errorMessage || 'Coba lagi.'}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedMember],
    );

    // ── Portal / QR handler ──────────────────────────────────────────────────
    const handleOpenQrModal = useCallback(
        async (member: TeamMember) => {
            try {
                let accessId = member.portalAccessId;
                if (!accessId) {
                    accessId = generateUUID();
                    try {
                        const updated = await updateTeamMemberRow(member.id, {
                            portalAccessId: accessId,
                        } as Partial<TeamMember>);
                        setTeamMembers(prev =>
                            prev.map(m =>
                                m.id === member.id
                                    ? { ...m, portalAccessId: updated.portalAccessId || accessId! }
                                    : m,
                            ),
                        );
                    } catch {
                        setTeamMembers(prev =>
                            prev.map(m => (m.id === member.id ? { ...m, portalAccessId: accessId! } : m)),
                        );
                    }
                }
                const path = window.location.pathname.replace(/index\.html$/, '');
                const url = `${window.location.origin}${path}#/freelancer-portal/${toPublicNameSlug(member.name)}`;
                setQrModalContent({ title: `Portal Tautan untuk ${member.name}`, url });
            } catch {
                // silent – modal stays closed
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    return {
        // Form
        isFormOpen,
        setIsFormOpen,
        isSubmitting,
        formMode,
        formData,
        setFormData,
        handleOpenForm,
        handleSubmit,
        handleDelete,

        // Detail modal
        isDetailOpen,
        setIsDetailOpen,
        selectedMember,
        setSelectedMember,
        detailTab,
        setDetailTab,

        // Performance
        newNote,
        setNewNote,
        newNoteType,
        setNewNoteType,
        handleSetRating,
        handleAddNote,
        handleDeleteNote,

        // Portal / QR
        qrModalContent,
        setQrModalContent,
        handleOpenQrModal,

        // Expose for detail modal orchestration
        handleViewDetails,
    };
};
