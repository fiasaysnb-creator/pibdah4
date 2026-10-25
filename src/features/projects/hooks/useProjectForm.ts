import { useState, useMemo, useCallback } from 'react';
import {
    Project,
    Profile,
    Client,
    Package,
    TeamMember,
    TeamProjectPayment,
    Transaction,
    TransactionType,
    Card,
    AssignedTeamMember,
    PrintingItem,
    SubStatusConfig,
    PaymentStatus,
    AddOn
} from '../../../types';
import {
    createProjectWithRelations,
    updateProject as updateProjectInDb,
    sanitizeProjectData,
    getProjectWithRelations
} from '../../../services/projects';
import { upsertAssignmentsForProject } from '../../../services/projectTeamAssignments';
import { upsertTeamPaymentsForProject } from '../../../services/teamProjectPayments';
import {
    createTransaction,
    updateCardBalance,
    updateTransaction as updateTransactionRow,
    deleteTransaction as deleteTransactionRow
} from '../../../services/transactions';
import { generateUUID } from '../../../utils/uuid';
import { syncClientStatusFromProjects } from '../../../services/clients';

const ensureOnlineOrNotify = (showNotification: (message: string) => void): boolean => {
    if (!navigator.onLine) {
        showNotification('Harus online untuk melakukan perubahan');
        return false;
    }
    return true;
};

interface UseProjectFormParams {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    clients: Client[];
    packages: Package[];
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    profile: Profile;
    showNotification: (msg: string) => void;
    setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

export function useProjectForm({
    projects,
    setProjects,
    clients,
    packages,
    teamMembers,
    teamProjectPayments,
    setTeamProjectPayments,
    transactions,
    setTransactions,
    cards,
    setCards,
    profile,
    showNotification,
    setSelectedProject
}: UseProjectFormParams) {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');

    const initialFormState = useMemo(() => ({
        id: '',
        clientId: '',
        projectName: '',
        clientName: '',
        projectType: '',
        status: profile.projectStatusConfig.find(s => s.name === 'Persiapan')?.name || profile.projectStatusConfig[0]?.name || '',
        activeSubStatuses: [] as string[],
        customSubStatuses: [] as SubStatusConfig[],
        customCosts: [] as { id: string; description: string; amount: string | number }[],
        location: '',
        date: new Date().toISOString().split('T')[0],
        deadlineDate: '',
        team: [] as AssignedTeamMember[],
        notes: '',
        driveLink: '',
        clientDriveLink: '',
        finalDriveLink: '',
        startTime: '',
        endTime: '',
        shippingDetails: '',
        printingDetails: [] as PrintingItem[],
        printingCost: 0,
        address: '',
        durationSelection: undefined as string | undefined,
        unitPrice: undefined as number | undefined,
    }), [profile]);

    const [formData, setFormData] = useState(initialFormState);

    const teamByCategory = useMemo(() => {
        return teamMembers.reduce((acc, member) => {
            const category = member.category || 'Tim';
            if (!acc[category]) acc[category] = {};
            if (!acc[category][member.role]) acc[category][member.role] = [];
            acc[category][member.role].push(member);
            return acc;
        }, { 'Tim': {}, 'Vendor': {} } as Record<string, Record<string, TeamMember[]>>);
    }, [teamMembers]);

    const handleOpenForm = useCallback((mode: 'add' | 'edit', project?: Project, clientId?: string) => {
        setFormMode(mode);
        if (mode === 'edit' && project) {
            const createFormData = (current: Project): any => {
                const { addOns, paymentStatus, amountPaid, totalCost, progress, packageId, dpProofUrl, ...operationalData } = current;
                const statusConfig = profile.projectStatusConfig.find(s => s.name === current.status);
                const subStatuses = current.customSubStatuses ?? statusConfig?.subStatuses ?? [];

                let printingDetailsBase = (current.printingDetails || []) as PrintingItem[];
                if (!printingDetailsBase || printingDetailsBase.length === 0) {
                    const pkg = packages.find(p => (p as any).id === (current as any).packageId || p.name === current.packageName);
                    if (pkg && Array.isArray(pkg.physicalItems) && pkg.physicalItems.length > 0) {
                        printingDetailsBase = pkg.physicalItems.map((it, idx) => ({
                            id: `pi-${current.id}-${idx}`,
                            type: 'Custom' as const,
                            customName: it.name,
                            details: '',
                            cost: Number(it.price || 0),
                            paymentStatus: 'Unpaid' as const,
                        }));
                    }
                }
                const printingDetailsWithStatus = (printingDetailsBase || []).map(item => ({
                    ...item,
                    paymentStatus: item.paymentStatus || 'Unpaid'
                }));

                return {
                    ...initialFormState,
                    ...operationalData,
                    date: (current.date || initialFormState.date).split('T')[0],
                    deadlineDate: current.deadlineDate ? current.deadlineDate.split('T')[0] : '',
                    startTime: current.startTime ? current.startTime.split(':').slice(0, 2).join(':') : '',
                    endTime: current.endTime ? current.endTime.split(':').slice(0, 2).join(':') : '',
                    location: current.location || '',
                    notes: current.notes || '',
                    clientDriveLink: current.clientDriveLink || '',
                    finalDriveLink: current.finalDriveLink || '',
                    shippingDetails: current.shippingDetails || '',
                    address: current.address || '',
                    durationSelection: (current as any).durationSelection || '',
                    unitPrice: (current as any).unitPrice,
                    printingDetails: printingDetailsWithStatus,
                    team: (current.team || []).map((t: AssignedTeamMember) => ({
                        id: t.id,
                        memberId: t.memberId,
                        name: t.name,
                        role: t.role,
                        fee: t.fee,
                        subJob: t.subJob,
                    })),
                    activeSubStatuses: current.activeSubStatuses || [],
                    customSubStatuses: subStatuses,
                };
            };

            let projectToUse = project;
            if (!projectToUse.team || projectToUse.team.length === 0) {
                const payments = teamProjectPayments.filter(p => p.projectId === projectToUse.id);
                if (payments.length > 0) {
                    const enrichedTeam = payments.map(p => {
                        const tm = teamMembers.find(m => m.id === p.teamMemberId);
                        return {
                            memberId: p.teamMemberId,
                            name: p.teamMemberName,
                            role: tm?.role || 'Tim',
                            fee: p.fee,
                        } as AssignedTeamMember;
                    });
                    projectToUse = { ...projectToUse, team: enrichedTeam } as Project;
                }
            }
            setFormData(createFormData(projectToUse));

            (async () => {
                try {
                    const fresh = await getProjectWithRelations(project.id);
                    if (fresh) {
                        setFormData(prev => {
                            if (prev.id === fresh.id) {
                                return createFormData(fresh);
                            }
                            return prev;
                        });
                        setProjects(prev => prev.map(p => p.id === project.id ? fresh : p));
                    }
                } catch (err) {
                    console.warn('[Projects] Background fetch failed for edit form:', err);
                }
            })();
        } else {
            const client = clientId ? clients.find(item => item.id === clientId) : undefined;
            setFormData({
                ...initialFormState,
                projectType: profile.projectTypes[0] || '',
                clientId: client?.id || '',
                clientName: client?.name || '',
            });
        }
        setIsFormModalOpen(true);
    }, [initialFormState, profile, packages, teamMembers, teamProjectPayments, setProjects, clients]);

    const handleCloseForm = useCallback(() => {
        setIsFormModalOpen(false);
        setFormData(initialFormState);
    }, [initialFormState]);

    const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'status') {
                newState.activeSubStatuses = [];
                const statusConfig = profile.projectStatusConfig.find(s => s.name === value);
                newState.customSubStatuses = statusConfig?.subStatuses || [];
                if (value !== 'Dikirim') {
                    newState.shippingDetails = '';
                }
            }
            return newState;
        });
    }, [profile]);

    const handleSubStatusChange = useCallback((option: string, isChecked: boolean) => {
        setFormData(prev => {
            const currentSubStatuses = prev.activeSubStatuses || [];
            if (isChecked) {
                return { ...prev, activeSubStatuses: [...currentSubStatuses, option] };
            } else {
                return { ...prev, activeSubStatuses: currentSubStatuses.filter(s => s !== option) };
            }
        });
    }, []);

    const handleClientChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setFormData(prev => ({
                ...prev,
                clientId: client.id,
                clientName: client.name,
                projectName: prev.projectName || `Acara Pernikahan ${client.name}`
            }));
        }
    }, [clients]);

    const handleTeamChange = useCallback((member: TeamMember) => {
        setFormData(prev => {
            const isSelected = prev.team.some(t => t.memberId === member.id);
            if (isSelected) {
                return {
                    ...prev,
                    team: prev.team.filter(t => t.memberId !== member.id)
                };
            } else {
                if (prev.team.some(t => t.memberId === member.id)) {
                    return prev;
                }
                const newTeamMember: AssignedTeamMember = {
                    memberId: member.id,
                    name: member.name,
                    role: member.role,
                    fee: member.standardFee,
                };
                return {
                    ...prev,
                    team: [...prev.team, newTeamMember]
                };
            }
        });
    }, []);

    const handleReplaceTeamMember = useCallback((oldMemberId: string, newMember: TeamMember) => {
        setFormData(prev => {
            if (prev.team.some(t => t.memberId === newMember.id && t.memberId !== oldMemberId)) {
                showNotification(`${newMember.name} sudah dipilih dalam project ini.`);
                return prev;
            }
            return {
                ...prev,
                team: prev.team.map(t => {
                    if (t.memberId === oldMemberId) {
                        return {
                            ...t,
                            memberId: newMember.id,
                            name: newMember.name,
                            role: newMember.role || t.role,
                            fee: newMember.standardFee || t.fee,
                        };
                    }
                    return t;
                })
            };
        });
    }, [showNotification]);

    const handleTeamFeeChange = useCallback((memberId: string, newFee: number) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map(t => t.memberId === memberId ? { ...t, fee: newFee } : t)
        }));
    }, []);

    const handleTeamSubJobChange = useCallback((memberId: string, subJob: string) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map(t => t.memberId === memberId ? { ...t, subJob: subJob } : t)
        }));
    }, []);

    const handleTeamClientPortalLinkChange = useCallback((memberId: string, link: string) => {
        setFormData(prev => ({
            ...prev,
            team: prev.team.map((t: any) => t.memberId === memberId ? { ...t, clientPortalLink: link } : t)
        }));
    }, []);

    const handleCustomSubStatusChange = useCallback((index: number, field: 'name' | 'note', value: string) => {
        setFormData(prev => {
            const newCustomSubStatuses = [...(prev.customSubStatuses || [])];
            const oldName = newCustomSubStatuses[index]?.name;
            newCustomSubStatuses[index] = { ...newCustomSubStatuses[index], [field]: value };

            if (field === 'name' && oldName && (prev.activeSubStatuses || []).includes(oldName)) {
                const newActiveSubStatuses = (prev.activeSubStatuses || []).map(name => name === oldName ? value : name);
                return { ...prev, customSubStatuses: newCustomSubStatuses, activeSubStatuses: newActiveSubStatuses };
            }

            return { ...prev, customSubStatuses: newCustomSubStatuses };
        });
    }, []);

    const addCustomSubStatus = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            customSubStatuses: [...(prev.customSubStatuses || []), { name: '', note: '' }]
        }));
    }, []);

    const removeCustomSubStatus = useCallback((index: number) => {
        setFormData(prev => {
            const customSubStatuses = prev.customSubStatuses || [];
            const subStatusToRemove = customSubStatuses[index];
            const newCustomSubStatuses = customSubStatuses.filter((_, i) => i !== index);

            let newActiveSubStatuses = prev.activeSubStatuses || [];
            if (subStatusToRemove) {
                newActiveSubStatuses = newActiveSubStatuses.filter(name => name !== subStatusToRemove.name);
            }

            return {
                ...prev,
                customSubStatuses: newCustomSubStatuses,
                activeSubStatuses: newActiveSubStatuses
            };
        });
    }, []);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ensureOnlineOrNotify(showNotification)) return;
        let projectData: Project;
        let costSyncPromise: Promise<void> = Promise.resolve();

        const clientIdsToSync = new Set<string>();

        if (formMode === 'add') {
            const sanitized = sanitizeProjectData({ ...initialFormState, ...formData });
            try {
                const created = await createProjectWithRelations({
                    projectName: sanitized.projectName,
                    clientName: sanitized.clientName,
                    clientId: sanitized.clientId,
                    projectType: sanitized.projectType,
                    packageName: sanitized.packageName,
                    date: sanitized.date,
                    location: sanitized.location,
                    status: sanitized.status,
                    progress: 0,
                    totalCost: 0,
                    amountPaid: 0,
                    paymentStatus: PaymentStatus.BELUM_BAYAR,
                    bookingStatus: sanitized.bookingStatus,
                    notes: sanitized.notes,
                    accommodation: sanitized.accommodation,
                    driveLink: sanitized.driveLink,
                    promoCodeId: sanitized.promoCodeId,
                    discountAmount: sanitized.discountAmount,
                    printingCost: sanitized.printingCost,
                    address: sanitized.address,
                    addOns: (sanitized.addOns || []).map((a: AddOn) => ({ id: a.id, name: a.name, price: a.price })),
                    durationSelection: sanitized.durationSelection,
                    unitPrice: sanitized.unitPrice,
                    team: (sanitized.team || []).map((t: AssignedTeamMember) => ({
                        memberId: t.memberId,
                        name: t.name,
                        role: t.role,
                        fee: t.fee,
                        subJob: t.subJob,
                    })),
                    activeSubStatuses: sanitized.activeSubStatuses,
                    customSubStatuses: sanitized.customSubStatuses,
                } as any);
                projectData = created;
                if (projectData?.clientId) clientIdsToSync.add(projectData.clientId);
            } catch (err) {
                console.warn('[Projects] Failed to create project in Supabase:', err);
                showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal membuat Acara Pernikahan. Coba lagi.');
                return;
            }
        } else {
            const originalProject = projects.find(p => p.id === formData.id);
            if (!originalProject) return;

            if (originalProject.clientId) clientIdsToSync.add(originalProject.clientId);

            const oldPrintingCost = originalProject.printingCost || 0;
            const oldCustomCostsTotal = (originalProject.customCosts || []).reduce((sum, c) => sum + c.amount, 0);

            const newPrintingCost = Number(formData.printingCost) || 0;
            const newCustomCosts = (formData.customCosts || [])
                .filter((c: any) => c.description && !isNaN(Number(c.amount)) && Number(c.amount) >= 0)
                .map((c: any) => ({ ...c, id: c.id || `cc-${Date.now()}`, amount: Number(c.amount) }));
            const newCustomCostsTotal = newCustomCosts.reduce((sum, c) => sum + c.amount, 0);

            const costDifference = (newPrintingCost - oldPrintingCost) + (newCustomCostsTotal - oldCustomCostsTotal);

            const newTotalCost = originalProject.totalCost + costDifference;
            const newAmountPaid = originalProject.amountPaid;
            const newPaymentStatus = newAmountPaid >= newTotalCost ? PaymentStatus.LUNAS : (newAmountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);

            projectData = {
                ...originalProject,
                ...formData,
                customCosts: newCustomCosts,
                printingCost: newPrintingCost,
                totalCost: newTotalCost,
                paymentStatus: newPaymentStatus,
            };

            if (projectData?.clientId) clientIdsToSync.add(projectData.clientId);

            try {
                const projectUpdatePromise = updateProjectInDb(projectData.id, {
                    projectName: projectData.projectName,
                    clientName: projectData.clientName,
                    clientId: projectData.clientId,
                    projectType: projectData.projectType,
                    packageName: projectData.packageName,
                    date: projectData.date,
                    deadlineDate: projectData.deadlineDate as any,
                    location: projectData.location,
                    status: projectData.status,
                    progress: projectData.progress,
                    totalCost: projectData.totalCost,
                    amountPaid: projectData.amountPaid,
                    paymentStatus: projectData.paymentStatus,
                    notes: projectData.notes,
                    accommodation: projectData.accommodation,
                    driveLink: projectData.driveLink,
                    clientDriveLink: projectData.clientDriveLink as any,
                    finalDriveLink: projectData.finalDriveLink as any,
                    startTime: projectData.startTime as any,
                    endTime: projectData.endTime as any,
                    discountAmount: projectData.discountAmount,
                    printingDetails: projectData.printingDetails as any,
                    customCosts: projectData.customCosts as any,
                    printingCost: projectData.printingCost,
                    address: projectData.address as any,
                    transportPaid: projectData.transportPaid as any,
                    transportNote: projectData.transportNote as any,
                    printingCardId: projectData.printingCardId as any,
                    transportCardId: projectData.transportCardId as any,
                    completedDigitalItems: projectData.completedDigitalItems,
                    dpProofUrl: projectData.dpProofUrl,
                    shippingDetails: projectData.shippingDetails as any,
                    durationSelection: (projectData as any).durationSelection,
                    unitPrice: (projectData as any).unitPrice,
                    activeSubStatuses: projectData.activeSubStatuses as any,
                    customSubStatuses: projectData.customSubStatuses as any,
                    confirmedSubStatuses: projectData.confirmedSubStatuses as any,
                    clientSubStatusNotes: projectData.clientSubStatusNotes as any,
                    subStatusConfirmationSentAt: projectData.subStatusConfirmationSentAt as any,
                    invoiceSignature: projectData.invoiceSignature as any,
                } as any);

                const assignmentsPromise = upsertAssignmentsForProject(projectData.id, (projectData.team || []).map((t: AssignedTeamMember) => ({
                    id: t.id,
                    memberId: t.memberId,
                    name: t.name,
                    role: t.role,
                    fee: t.fee,
                    subJob: t.subJob,
                })));
                const [savedProjectResult, assignmentsResult] = await Promise.allSettled([
                    projectUpdatePromise,
                    assignmentsPromise,
                ]);
                if (savedProjectResult.status === 'rejected') throw savedProjectResult.reason;
                projectData = {
                    ...projectData,
                    ...savedProjectResult.value,
                    team: projectData.team,
                    addOns: originalProject.addOns,
                };
                if (assignmentsResult.status === 'fulfilled' && assignmentsResult.value.length > 0) {
                    projectData.team = assignmentsResult.value;
                } else if (assignmentsResult.status === 'rejected') {
                    console.warn('[Projects] Failed to persist team assignments:', assignmentsResult.reason);
                }
            } catch (err) {
                console.warn('[Projects] Failed to update project in Supabase:', err);
                showNotification(!navigator.onLine ? 'Harus online untuk melakukan perubahan' : 'Gagal menyimpan perubahan Acara Pernikahan. Coba lagi.');
                return;
            }

            costSyncPromise = (async () => {
                const paymentCardId = cards.find(c => c.id !== 'CARD_CASH')?.id;
                if (paymentCardId) {
                const fieldsToProcess: ('printingCost')[] = [];
                if (originalProject.printingCost !== projectData.printingCost) fieldsToProcess.push('printingCost');

                for (const field of fieldsToProcess) {
                    const cost = projectData[field] || 0;
                    const oldCost = originalProject[field] || 0;
                    const costDiff = cost - oldCost;
                    const category = field === 'printingCost' ? 'Produksi Fisik' : 'Transportasi';
                    const description = `${category} - ${projectData.projectName}`;

                    const existingTx = transactions.find(t => t.projectId === projectData.id && t.category === category && t.description === description);

                    try {
                        if (existingTx) {
                            if (cost > 0) {
                                const updated = await updateTransactionRow(existingTx.id, { amount: cost });
                                if (costDiff !== 0) await updateCardBalance(paymentCardId, -Math.abs(costDiff) * Math.sign(costDiff));
                                setTransactions(prev => prev.map(tx => tx.id === existingTx.id ? updated : tx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                                setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance - costDiff } : c));
                            } else {
                                await deleteTransactionRow(existingTx.id);
                                await updateCardBalance(paymentCardId, Math.abs(oldCost));
                                setTransactions(prev => prev.filter(tx => tx.id !== existingTx.id));
                                setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance + oldCost } : c));
                            }
                        } else if (cost > 0) {
                            const created = await createTransaction({
                                date: new Date().toISOString().split('T')[0],
                                description,
                                amount: cost,
                                type: TransactionType.EXPENSE,
                                projectId: projectData.id,
                                category,
                                method: 'Sistem',
                                cardId: paymentCardId,
                            } as any);
                            setTransactions(prev => [created, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                            setCards(prev => prev.map(c => c.id === paymentCardId ? { ...c, balance: c.balance - cost } : c));
                        }
                    } catch (e) {
                        console.warn('[Projects] Failed to persist cost transaction:', e);
                    }
                }
                }
            })();
        }

        const allTeamMembersOnProject = projectData.team || [];
        const otherProjectPayments = teamProjectPayments.filter(p => p.projectId !== projectData.id);
        const existingProjectPayments = teamProjectPayments.filter(p => p.projectId === projectData.id);
        const existingPaymentsByMemberId = new Map(existingProjectPayments.map(p => [p.teamMemberId, p] as const));
        const unusedExistingPayments = existingProjectPayments.filter(
            p => p.status !== 'Paid' && !allTeamMembersOnProject.some(m => m.memberId === p.teamMemberId)
        );

        const newProjectPaymentEntries: TeamProjectPayment[] = allTeamMembersOnProject.map(teamMember => {
            const prev = existingPaymentsByMemberId.get(teamMember.memberId);
            if (prev) {
                const isPaid = prev.status === 'Paid';
                return {
                    id: prev.id,
                    projectId: projectData.id,
                    teamMemberName: isPaid ? (prev.teamMemberName || teamMember.name) : teamMember.name,
                    teamMemberId: teamMember.memberId,
                    date: isPaid ? (prev.date || projectData.date) : projectData.date,
                    status: isPaid ? 'Paid' : 'Unpaid',
                    fee: isPaid ? (prev.fee || teamMember.fee) : teamMember.fee,
                };
            }
            if (unusedExistingPayments.length > 0) {
                const reused = unusedExistingPayments.shift()!;
                const isPaid = reused.status === 'Paid';
                return {
                    id: reused.id,
                    projectId: projectData.id,
                    teamMemberName: teamMember.name,
                    teamMemberId: teamMember.memberId,
                    date: reused.date || projectData.date,
                    status: isPaid ? 'Paid' : 'Unpaid',
                    fee: isPaid ? reused.fee : teamMember.fee,
                };
            }
            return {
                id: generateUUID(),
                projectId: projectData.id,
                teamMemberName: teamMember.name,
                teamMemberId: teamMember.memberId,
                date: projectData.date,
                status: 'Unpaid',
                fee: teamMember.fee,
            };
        });

        let persistedPayments = existingProjectPayments;
        try {
            persistedPayments = await upsertTeamPaymentsForProject(projectData.id, newProjectPaymentEntries);
        } catch (e) {
            console.warn('[Projects] Failed to persist team payments:', e);
        }
        await costSyncPromise;
        setTeamProjectPayments([...otherProjectPayments, ...persistedPayments]);

        const finalProject = projectData;

        if (formMode === 'add') {
            setProjects(prev => [finalProject, ...prev.filter(p => p.id !== finalProject.id)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
            setProjects(prev => prev.map(p => p.id === finalProject.id ? finalProject : p).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        setSelectedProject(prev => prev && prev.id === finalProject.id ? finalProject : prev);

        handleCloseForm();
        if (clientIdsToSync.size > 0) {
            void Promise.all(Array.from(clientIdsToSync).map(id => syncClientStatusFromProjects(id))).catch(e => {
                console.warn('[Projects] Failed to sync client status from projects:', e);
            });
        }
    };

    return {
        isFormModalOpen,
        formMode,
        formData,
        setFormData,
        teamByCategory,
        handleOpenForm,
        handleCloseForm,
        handleFormChange,
        handleSubStatusChange,
        handleClientChange,
        handleTeamChange,
        handleReplaceTeamMember,
        handleTeamFeeChange,
        handleTeamSubJobChange,
        handleTeamClientPortalLinkChange,
        handleCustomSubStatusChange,
        addCustomSubStatus,
        removeCustomSubStatus,
        handleFormSubmit
    };
}
