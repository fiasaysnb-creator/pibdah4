import React, { useState } from 'react';
import {
    Client,
    Project,
    Package,
    AddOn,
    Transaction,
    TransactionType,
    Card,
    Profile,
    PromoCode,
    PaymentStatus,
    ClientStatus,
    ClientType
} from '../../../types';
import { createClient as createClientRow, updateClient as updateClientRow } from '../../../services/clients';
import { createProject as createProjectRow, updateProject as updateProjectRow } from '../../../services/projects';
import { createTransaction as createTransactionRow, updateTransaction as updateTransactionRow, updateCardBalance } from '../../../services/transactions';
import { findCardIdByMeta } from '../../../services/cards';
import { ensureOnlineOrNotify, initialFormState, ClientFormData, CustomFormItem } from '../utils/clientHelpers';
import { DocumentToView } from './useClientDocumentActions';

interface UseClientFormHandlerParams {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    packages: Package[];
    addOns: AddOn[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    promoCodes: PromoCode[];
    setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    userProfile: Profile;
    showNotification: (msg: string) => void;
    clientForDetail: Client | null;
    setClientForDetail: React.Dispatch<React.SetStateAction<Client | null>>;
    documentToView: DocumentToView | null;
    setDocumentToView: React.Dispatch<React.SetStateAction<DocumentToView | null>>;
    setIsSignatureModalOpen: (isOpen: boolean) => void;
}

export const useClientFormHandler = ({
    clients,
    setClients,
    projects,
    setProjects,
    packages,
    addOns,
    transactions,
    setTransactions,
    cards,
    setCards,
    promoCodes,
    setPromoCodes,
    userProfile,
    showNotification,
    clientForDetail,
    setClientForDetail,
    documentToView,
    setDocumentToView,
    setIsSignatureModalOpen,
}: UseClientFormHandlerParams) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState<ClientFormData>(initialFormState);

    const handleOpenModal = (mode: 'add' | 'edit', client?: Client, project?: Project) => {
        setModalMode(mode);
        if (mode === 'edit' && client) {
            // 1. Get the freshest client record from state
            const freshClient = clients.find(c => c.id === client.id) || client;
            setSelectedClient(freshClient);

            // 2. Find the exact matching project for this client
            const clientProjects = projects.filter(p => p.clientId === freshClient.id);
            const mostRecentProj = clientProjects.length > 0
                ? [...clientProjects].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                : null;
            const targetProject =
                project ||
                mostRecentProj ||
                (client as any).mostRecentProject ||
                null;
            const freshProject = targetProject
                ? (projects.find(p => p.id === targetProject.id) || targetProject)
                : null;
            setSelectedProject(freshProject);

            // 3. Reconstruct add-ons and custom items
            const standardAddOnIds: string[] = [];
            const additionalPackageIds: string[] = [];
            const customItemsList: CustomFormItem[] = [];
            freshProject?.additionalPackages?.forEach((packageItem: AddOn) => {
                if (packageItem.id) additionalPackageIds.push(packageItem.id);
            });
            if (freshProject?.addOns && Array.isArray(freshProject.addOns)) {
                freshProject.addOns.forEach((a: any) => {
                    const matchedStd = addOns.find(
                        std => std.id === a.id || std.name?.toLowerCase().trim() === a.name?.toLowerCase().trim()
                    );
                    const matchedPkg = packages.find(
                        pkg => pkg.id === a.id || pkg.name?.toLowerCase().trim() === a.name?.toLowerCase().trim()
                    );
                    if (matchedStd) {
                        standardAddOnIds.push(matchedStd.id);
                    } else if (matchedPkg && matchedPkg.id !== freshProject.packageId) {
                        if (!additionalPackageIds.includes(matchedPkg.id)) additionalPackageIds.push(matchedPkg.id);
                    } else {
                        customItemsList.push({
                            id: a.id || `custom-${Math.random().toString(36).substr(2, 9)}`,
                            name: a.name || 'Item Tambahan',
                            price: Number(a.price ?? 0),
                        });
                    }
                });
            }

            // 4. Resolve packageId: match by packageId, or by packageName, or keep existing without falling back to packages[0]
            let resolvedPackageId = freshProject?.packageId || '';
            if (!resolvedPackageId && freshProject?.packageName) {
                const matchedPkg = packages.find(
                    p => p.name?.toLowerCase().trim() === freshProject.packageName?.toLowerCase().trim()
                );
                if (matchedPkg) {
                    resolvedPackageId = matchedPkg.id;
                }
            }

            // 5. Sanitize date to YYYY-MM-DD for HTML input[type="date"]
            const sanitizeDate = (d?: string) => {
                if (!d) return '';
                if (d.includes('T')) return d.split('T')[0];
                return d;
            };

            // 6. Find existing DP transaction card if available
            const existingDpTx = transactions.find(
                t =>
                    t.projectId === freshProject?.id &&
                    (t.category === 'DP Acara Pernikahan' ||
                        t.category === 'DP Acara' ||
                        t.category === 'DP Proyek' ||
                        t.category === 'Booking Fee' ||
                        t.category === 'Pendaftaran' ||
                        (t.description && t.description.toLowerCase().includes('dp ')))
            );
            const initialCardId = existingDpTx?.cardId || '';

            setFormData({
                clientId: freshClient.id,
                clientName: freshClient.name || '',
                avatarUrl: freshClient.avatarUrl || '',
                email: freshClient.email || '',
                phone: freshClient.phone || '',
                whatsapp: freshClient.whatsapp || freshClient.phone || '',
                instagram: freshClient.instagram || '',
                clientType: freshClient.clientType || ClientType.DIRECT,
                projectId: freshProject?.id || '',
                projectName: freshProject?.projectName || '',
                projectType: freshProject?.projectType || '',
                location: freshProject?.location || '',
                date: sanitizeDate(freshProject?.date),
                packageId: resolvedPackageId,
                selectedAdditionalPackageIds: additionalPackageIds,
                selectedAddOnIds: standardAddOnIds,
                customItems: customItemsList,
                durationSelection: (freshProject as any)?.durationSelection || '',
                unitPrice: (freshProject as any)?.unitPrice,
                address: freshProject?.address || freshClient.address || '',
                homeAddress: freshClient.homeAddress || '',
                dp: freshProject?.amountPaid !== undefined && freshProject?.amountPaid !== null ? String(freshProject.amountPaid) : '',
                dpDestinationCardId: initialCardId,
                notes: freshProject?.notes || '',
                accommodation: freshProject?.accommodation || '',
                driveLink: freshProject?.driveLink || '',
                promoCodeId: freshProject?.promoCodeId || '',
            });

            // Auto-infer duration from notes if empty (helper for user pattern)
            if (
                freshProject &&
                !(freshProject as any).durationSelection &&
                freshProject.notes?.toLowerCase().includes('durasi')
            ) {
                const match = freshProject.notes.match(/durasi\s*(?:dipilih)?:\s*([^|,\n]+)/i);
                if (match) {
                    setFormData(prev => ({ ...prev, durationSelection: match[1].trim() }));
                }
            }
        } else if (mode === 'add' && client) {
            // Adding new project for existing client
            setSelectedClient(client);
            setFormData({
                ...initialFormState,
                clientId: client.id,
                clientName: client.name,
                avatarUrl: client.avatarUrl || '',
                email: client.email || '',
                phone: client.phone,
                whatsapp: client.whatsapp || client.phone,
                instagram: client.instagram || '',
                clientType: client.clientType,
                address: client.address || '',
                homeAddress: client.homeAddress || '',
                customItems: [],
            });
        } else {
            // Adding new client
            setSelectedClient(null);
            setSelectedProject(null);
            setFormData({
                ...initialFormState,
                projectType: userProfile.projectTypes[0] || '',
                customItems: [],
            });
        }

        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setIsSignatureModalOpen(false);
    };

    const handleFormChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { id, checked } = e.target as HTMLInputElement;
            setFormData(prev => ({
                ...prev,
                selectedAddOnIds: checked
                    ? [...prev.selectedAddOnIds, id]
                    : prev.selectedAddOnIds.filter(addOnId => addOnId !== id),
            }));
        } else {
            setFormData(prev => {
                // If package changed, attempt to apply default duration option
                if (name === 'packageId') {
                    const pkg = packages.find(p => p.id === value);
                    if (pkg && Array.isArray(pkg.durationOptions) && pkg.durationOptions.length > 0) {
                        const defaultOpt = pkg.durationOptions.find(o => o.default) || pkg.durationOptions[0];
                        return {
                            ...prev,
                            [name]: value,
                            durationSelection: defaultOpt.label,
                            unitPrice: Number(defaultOpt.price),
                        };
                    }
                    return {
                        ...prev,
                        [name]: value,
                        durationSelection: '',
                        unitPrice: pkg ? pkg.price : undefined,
                    };
                }

                // If durationSelection changed, compute unitPrice from selected package
                if (name === 'durationSelection') {
                    const pkg = packages.find(p => p.id === prev.packageId);
                    if (pkg && Array.isArray(pkg.durationOptions)) {
                        const opt = pkg.durationOptions.find(o => o.label === value);
                        if (opt) return { ...prev, durationSelection: value, unitPrice: Number(opt.price) };
                    }
                    return { ...prev, durationSelection: value };
                }

                const updated = { ...prev, [name]: value };
                if (modalMode === 'add' && (name === 'clientName' || name === 'projectType')) {
                    const previousGeneratedName = `${prev.projectType} ${prev.clientName}`.trim();
                    const projectNameWasGenerated = !prev.projectName.trim() || prev.projectName.trim() === previousGeneratedName;
                    if (projectNameWasGenerated) {
                        updated.projectName = `${updated.projectType} ${updated.clientName}`.trim();
                    }
                }
                return updated;
            });
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ensureOnlineOrNotify(showNotification)) return;

        const selectedPackage = packages.find(p => p.id === formData.packageId);
        if (!selectedPackage && !formData.projectId) {
            alert('Harap pilih minimal 1 Package Utama.');
            return;
        }

        const selectedAdditionalPackages = packages.filter(p => formData.selectedAdditionalPackageIds?.includes(p.id));
        const selectedAddOns = addOns.filter(addon => formData.selectedAddOnIds.includes(addon.id));
        const additionalPackageRecords = selectedAdditionalPackages.map(pkg => ({ id: pkg.id, name: pkg.name, price: pkg.price }));
        const customItems = (formData.customItems || []).map(ci => ({
            id: ci.id,
            name: ci.name.trim(),
            price: Math.max(0, Number(ci.price) || 0),
        }));
        const allProjectAddOns = [
            ...selectedAddOns.map(a => ({ id: a.id, name: a.name, price: a.price })),
            ...customItems,
        ];

        const packagePriceChosen =
            formData.unitPrice !== undefined && !isNaN(Number(formData.unitPrice))
                ? Number(formData.unitPrice)
                : selectedPackage?.price || 0;
        const totalAddOnsPrice =
            selectedAddOns.reduce((sum, addon) => sum + addon.price, 0) +
            selectedAdditionalPackages.reduce((sum, pkg) => sum + pkg.price, 0) +
            customItems.reduce((sum, item) => sum + item.price, 0);
        const totalBeforeDiscount = packagePriceChosen + totalAddOnsPrice;
        let finalDiscountAmount = 0;
        const promoCode = promoCodes.find(p => p.id === formData.promoCodeId);
        if (promoCode) {
            if (promoCode.discountType === 'percentage') {
                finalDiscountAmount = (totalBeforeDiscount * promoCode.discountValue) / 100;
            } else {
                finalDiscountAmount = promoCode.discountValue;
            }
        }
        const totalProject = Math.max(0, totalBeforeDiscount - finalDiscountAmount);

        if (modalMode === 'add') {
            let clientId = selectedClient?.id;
            if (!selectedClient) {
                // New client
                try {
                    const created = await createClientRow({
                        name: formData.clientName,
                        avatarUrl: formData.avatarUrl || undefined,
                        email: (formData.email?.trim() || ''),
                        phone: formData.phone,
                        whatsapp: formData.whatsapp || formData.phone,
                        instagram: formData.instagram || undefined,
                        clientType: formData.clientType,
                        since: new Date().toISOString().split('T')[0],
                        status: ClientStatus.ACTIVE,
                        lastContact: new Date().toISOString(),
                        portalAccessId: crypto.randomUUID(),
                        address: formData.address || undefined,
                        homeAddress: formData.homeAddress || undefined,
                    } as Omit<Client, 'id'>);
                    clientId = created.id;
                    setClients(prev => [created, ...prev]);
                } catch (err) {
                    showNotification(
                        !navigator.onLine
                            ? 'Harus online untuk melakukan perubahan'
                            : 'Gagal menyimpan pengantin ke database. Coba lagi.'
                    );
                    return;
                }
            } else if (formData.avatarUrl && formData.avatarUrl !== selectedClient.avatarUrl) {
                try {
                    const updated = await updateClientRow(selectedClient.id, { avatarUrl: formData.avatarUrl });
                    setClients(prev => prev.map(client => client.id === updated.id ? updated : client));
                } catch (err) {
                    showNotification('Gagal menyimpan foto profil pengantin. Coba lagi.');
                    return;
                }
            }

            const dpAmount = Number(formData.dp) || 0;
            const remainingPayment = totalProject - dpAmount;

            // Create project in Supabase
            try {
                const createdProject = await createProjectRow({
                    projectName: formData.projectName,
                    clientName: formData.clientName,
                    clientId: clientId!,
                    projectType: formData.projectType,
                    packageName: selectedPackage?.name || 'Package Acara',
                    packageId: selectedPackage?.id,
                    date: formData.date,
                    location: formData.location,
                    status: 'Dikonfirmasi',
                    totalCost: totalProject,
                    amountPaid: dpAmount,
                    paymentStatus:
                        dpAmount > 0
                            ? remainingPayment <= 0
                                ? PaymentStatus.LUNAS
                                : PaymentStatus.DP_TERBAYAR
                            : PaymentStatus.BELUM_BAYAR,
                    durationSelection: formData.durationSelection || undefined,
                    unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : undefined,
                    notes: formData.notes || undefined,
                    accommodation: formData.accommodation || undefined,
                    driveLink: formData.driveLink || undefined,
                    promoCodeId: formData.promoCodeId || undefined,
                    discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : undefined,
                    address: formData.address || undefined,
                    printingCost: undefined,
                    transportCost: undefined,
                    completedDigitalItems: [],
                    addOns: allProjectAddOns,
                    additionalPackages: additionalPackageRecords,
                });
                const mergedProject: Project = { ...createdProject, addOns: allProjectAddOns as any, additionalPackages: additionalPackageRecords };
                setProjects(prev => [mergedProject, ...prev]);

                // Create DP transaction (persist to Supabase) if any
                if (mergedProject.amountPaid > 0) {
                    const selectedCard = cards.find(c => c.id === formData.dpDestinationCardId);
                    const supaCardId = selectedCard
                        ? await findCardIdByMeta(selectedCard.bankName, selectedCard.lastFourDigits)
                        : null;
                    try {
                        const cardIdToUse = supaCardId || formData.dpDestinationCardId || undefined;
                        const createdTx = await createTransactionRow({
                            date: new Date().toISOString().split('T')[0],
                            description: `DP Acara Pernikahan ${mergedProject.projectName}`,
                            amount: mergedProject.amountPaid,
                            type: TransactionType.INCOME,
                            projectId: mergedProject.id,
                            category: 'DP Acara Pernikahan',
                            method: 'Transfer Bank',
                            cardId: cardIdToUse,
                        } as Omit<Transaction, 'id' | 'vendorSignature'>);
                        setTransactions(prev => {
                            const exists = prev.some(t => t.id === createdTx.id);
                            const list = exists ? prev.map(t => t.id === createdTx.id ? createdTx : t) : [createdTx, ...prev];
                            return list.sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            );
                        });
                        if (formData.dpDestinationCardId) {
                            setCards(prev =>
                                prev.map(c =>
                                    c.id === formData.dpDestinationCardId
                                        ? { ...c, balance: c.balance + mergedProject.amountPaid }
                                        : c
                                )
                            );
                        }
                    } catch (err) {
                        console.warn('[Supabase] Gagal mencatat transaksi DP, gunakan fallback lokal.', err);
                        const newTransaction: Transaction = {
                            id: `TRN-DP-${mergedProject.id}`,
                            date: new Date().toISOString().split('T')[0],
                            description: `DP Acara Pernikahan ${mergedProject.projectName}`,
                            amount: mergedProject.amountPaid,
                            type: TransactionType.INCOME,
                            projectId: mergedProject.id,
                            category: 'DP Acara Pernikahan',
                            method: 'Transfer Bank',
                            cardId: formData.dpDestinationCardId,
                        };
                        setTransactions(prev => {
                            const exists = prev.some(t => t.id === newTransaction.id);
                            const list = exists ? prev.map(t => t.id === newTransaction.id ? newTransaction : t) : [newTransaction, ...prev];
                            return list.sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            );
                        });
                        setCards(prev =>
                            prev.map(c =>
                                c.id === formData.dpDestinationCardId
                                    ? { ...c, balance: c.balance + mergedProject.amountPaid }
                                    : c
                            )
                        );
                    }
                }
            } catch (err) {
                showNotification(
                    !navigator.onLine
                        ? 'Harus online untuk melakukan perubahan'
                        : 'Gagal membuat Acara Pernikahan di database. Coba lagi.'
                );
                return;
            }

            if (promoCode) {
                setPromoCodes(prev =>
                    prev.map(p => (p.id === promoCode.id ? { ...p, usageCount: p.usageCount + 1 } : p))
                );
            }
            showNotification(
                `Pengantin ${formData.clientName} dan Acara Pernikahan baru berhasil ditambahkan.`
            );
            handleCloseModal();
            setFormData(initialFormState);
            setSelectedClient(null);
            setSelectedProject(null);
        } else if (modalMode === 'edit') {
            if (!selectedClient) {
                alert('Data pengantin tidak ditemukan untuk mode edit.');
                return;
            }

            // 1. Retrieve the freshest client and project from state
            const existingClient = clients.find(c => c.id === selectedClient.id) || selectedClient;
            let existingProject = selectedProject
                ? (projects.find(p => p.id === selectedProject.id) || selectedProject)
                : (projects.find(p => p.clientId === existingClient.id) || null);

            // 2. Prepare merged Client: preserve all untouched fields, apply only modified fields
            const updatedClientPayload: Client = {
                ...existingClient,
                name: formData.clientName?.trim() || existingClient.name,
                avatarUrl: formData.avatarUrl || existingClient.avatarUrl,
                email: formData.email !== undefined ? formData.email.trim() : (existingClient.email || ''),
                phone: formData.phone?.trim() || existingClient.phone,
                whatsapp: formData.whatsapp?.trim() || formData.phone?.trim() || existingClient.whatsapp || existingClient.phone,
                instagram: formData.instagram !== undefined ? (formData.instagram.trim() || undefined) : existingClient.instagram,
                clientType: (formData.clientType as ClientType) || existingClient.clientType,
                address: formData.address !== undefined ? formData.address : (existingClient.address || ''),
                homeAddress: formData.homeAddress !== undefined ? formData.homeAddress : (existingClient.homeAddress || ''),
                status: existingClient.status,
                since: existingClient.since,
                portalAccessId: existingClient.portalAccessId,
                lastContact: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Update Client in database and update state
            try {
                const updatedClientRowResult = await updateClientRow(existingClient.id, {
                    name: updatedClientPayload.name,
                    avatarUrl: updatedClientPayload.avatarUrl,
                    email: updatedClientPayload.email || '',
                    phone: updatedClientPayload.phone,
                    whatsapp: updatedClientPayload.whatsapp,
                    instagram: updatedClientPayload.instagram || undefined,
                    clientType: updatedClientPayload.clientType,
                    lastContact: updatedClientPayload.lastContact,
                    address: updatedClientPayload.address || undefined,
                    homeAddress: updatedClientPayload.homeAddress || undefined,
                });
                const finalClient: Client = {
                    ...existingClient,
                    ...updatedClientRowResult,
                    ...updatedClientPayload,
                };
                setClients(prev => prev.map(c => (c.id === finalClient.id ? finalClient : c)));
                if (clientForDetail?.id === finalClient.id) {
                    setClientForDetail(finalClient);
                }
            } catch (err) {
                console.warn('Gagal update data pengantin di DB, fallback update lokal:', err);
                setClients(prev => prev.map(c => (c.id === updatedClientPayload.id ? updatedClientPayload : c)));
                if (clientForDetail?.id === updatedClientPayload.id) {
                    setClientForDetail(updatedClientPayload);
                }
            }

            const selectedPackage = packages.find(p => p.id === formData.packageId) ||
                (existingProject?.packageId ? packages.find(p => p.id === existingProject.packageId) : undefined) ||
                (existingProject?.packageName ? packages.find(p => p.name?.toLowerCase().trim() === existingProject.packageName?.toLowerCase().trim()) : undefined);

            const resolvedPackageName = selectedPackage?.name || existingProject?.packageName || formData.projectName || 'Package Acara';
            const resolvedPackageId = selectedPackage?.id || formData.packageId || existingProject?.packageId || '';

            // Selected add-ons + custom items + additional packages
            const selectedAdditionalPackages = packages.filter(p => formData.selectedAdditionalPackageIds?.includes(p.id));
            const selectedAddOns = addOns.filter(addon => formData.selectedAddOnIds.includes(addon.id));
            const additionalPackageRecords = selectedAdditionalPackages.map(pkg => ({ id: pkg.id, name: pkg.name, price: pkg.price }));
            const customItems = (formData.customItems || []).map(ci => ({
                id: ci.id,
                name: ci.name.trim(),
                price: Math.max(0, Number(ci.price) || 0),
            }));
            const allProjectAddOns = [
                ...selectedAddOns.map(a => ({ id: a.id, name: a.name, price: a.price })),
                ...customItems,
            ];

            // Package price calculation with safety fallback
            const fallbackPrice = existingProject
                ? (Number(existingProject.unitPrice) || Number(existingProject.totalCost) || 0)
                : 0;
            const packagePriceChosen =
                formData.unitPrice !== undefined && !isNaN(Number(formData.unitPrice))
                    ? Number(formData.unitPrice)
                    : (selectedPackage?.price ?? fallbackPrice);

            const totalAddOnsPrice =
                selectedAddOns.reduce((sum, addon) => sum + addon.price, 0) +
                selectedAdditionalPackages.reduce((sum, pkg) => sum + pkg.price, 0) +
                customItems.reduce((sum, item) => sum + item.price, 0);

            const totalBeforeDiscount = packagePriceChosen + totalAddOnsPrice;
            let finalDiscountAmount = 0;
            const promoCode = promoCodes.find(p => p.id === formData.promoCodeId);
            if (promoCode) {
                if (promoCode.discountType === 'percentage') {
                    finalDiscountAmount = (totalBeforeDiscount * promoCode.discountValue) / 100;
                } else {
                    finalDiscountAmount = promoCode.discountValue;
                }
            } else if (existingProject?.discountAmount && !formData.promoCodeId) {
                finalDiscountAmount = existingProject.discountAmount;
            }

            let totalProject = Math.max(0, totalBeforeDiscount - finalDiscountAmount);
            if (totalProject === 0 && existingProject && existingProject.totalCost > 0 && !formData.packageId && selectedAddOns.length === 0 && customItems.length === 0) {
                totalProject = existingProject.totalCost;
            }

            const oldAmountPaid = Number(existingProject?.amountPaid) || 0;
            const newAmountPaid = formData.dp !== '' && formData.dp !== undefined
                ? (Number(formData.dp) || 0)
                : oldAmountPaid;

            let newPaymentStatus: PaymentStatus = existingProject?.paymentStatus || PaymentStatus.BELUM_BAYAR;
            if (newAmountPaid !== oldAmountPaid || totalProject !== existingProject?.totalCost) {
                if (newAmountPaid <= 0) newPaymentStatus = PaymentStatus.BELUM_BAYAR;
                else if (newAmountPaid >= totalProject) newPaymentStatus = PaymentStatus.LUNAS;
                else newPaymentStatus = PaymentStatus.DP_TERBAYAR;
            }

            if (!existingProject && !formData.projectName && !formData.projectType && !formData.date && !formData.location && !formData.packageId) {
                showNotification('Data pengantin berhasil diperbarui.');
                handleCloseModal();
                setFormData(initialFormState);
                setSelectedClient(null);
                setSelectedProject(null);
                return;
            }

            if (!existingProject && (formData.projectName || formData.projectType || formData.location || formData.packageId)) {
                try {
                    const createdProject = await createProjectRow({
                        projectName: formData.projectName || `${formData.clientName} Wedding`,
                        clientName: formData.clientName,
                        clientId: updatedClientPayload.id,
                        projectType: formData.projectType || 'Wedding',
                        packageName: resolvedPackageName,
                        packageId: resolvedPackageId,
                        date: formData.date,
                        location: formData.location || '',
                        status: 'Dikonfirmasi',
                        totalCost: totalProject,
                        amountPaid: newAmountPaid,
                        paymentStatus: newPaymentStatus,
                        durationSelection: formData.durationSelection || undefined,
                        unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : undefined,
                        notes: formData.notes || undefined,
                        accommodation: formData.accommodation || undefined,
                        driveLink: formData.driveLink || undefined,
                        promoCodeId: formData.promoCodeId || undefined,
                        discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : undefined,
                        address: formData.address || undefined,
                        addOns: allProjectAddOns,
                        additionalPackages: additionalPackageRecords,
                    });
                    setProjects(prev => [createdProject, ...prev]);
                    setSelectedProject(createdProject);
                    existingProject = createdProject;
                } catch (err) {
                    console.error('Gagal membuat acara baru untuk pengantin yang belum punya acara:', err);
                    showNotification(
                        !navigator.onLine
                            ? 'Harus online untuk melakukan perubahan'
                            : 'Data pengantin tersimpan, tetapi acara gagal disimpan. Periksa koneksi database dan coba lagi.'
                    );
                    return;
                }
            }

            // Sync DP transaction ONLY if amount paid changed
            if (existingProject && newAmountPaid !== oldAmountPaid) {
                const diff = newAmountPaid - oldAmountPaid;

                const dpTransaction = transactions.find(
                    t =>
                        t.projectId === existingProject.id &&
                        (t.category === 'DP Acara Pernikahan' ||
                            t.category === 'DP Acara' ||
                            t.category === 'DP Proyek' ||
                            t.category === 'Booking Fee' ||
                            t.category === 'Pendaftaran' ||
                            (t.description && t.description.toLowerCase().includes('dp ')))
                );

                if (dpTransaction) {
                    try {
                        const updatedTx = await updateTransactionRow(dpTransaction.id, {
                            amount: newAmountPaid,
                        });
                        setTransactions(prev => prev.map(t => (t.id === updatedTx.id ? updatedTx : t)));
                        if (dpTransaction.cardId) {
                            await updateCardBalance(dpTransaction.cardId, diff);
                            setCards(prev =>
                                prev.map(c =>
                                    c.id === dpTransaction.cardId ? { ...c, balance: c.balance + diff } : c
                                )
                            );
                        }
                    } catch (e) {
                        console.warn('Gagal update transaksi DP asli:', e);
                        showNotification(
                            'Gagal memperbarui riwayat tanda terima, tapi data Acara Pernikahan telah disimpan.'
                        );
                    }
                } else if (newAmountPaid > 0 && formData.dpDestinationCardId) {
                    try {
                        const selectedCard = cards.find(c => c.id === formData.dpDestinationCardId);
                        const supaCardId = selectedCard
                            ? await findCardIdByMeta(selectedCard.bankName, selectedCard.lastFourDigits)
                            : null;

                        const newTx = await createTransactionRow({
                            date: new Date().toISOString().split('T')[0],
                            description: `DP Acara Pernikahan ${formData.projectName || existingProject.projectName}`,
                            amount: newAmountPaid,
                            type: TransactionType.INCOME,
                            projectId: existingProject.id,
                            category: 'DP Acara Pernikahan',
                            method: 'Transfer Bank',
                            cardId: supaCardId || undefined,
                        } as any);

                        setTransactions(prev =>
                            [newTx, ...prev].sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            )
                        );
                        if (supaCardId) {
                            setCards(prev =>
                                prev.map(c =>
                                    c.id === formData.dpDestinationCardId
                                        ? { ...c, balance: c.balance + newAmountPaid }
                                        : c
                                )
                            );
                        }
                    } catch (e) {
                        console.warn('Gagal membuat transaksi DP baru:', e);
                    }
                }
            }

            // 4. Update Project: preserve ALL existing project metadata (team, status, tasks, custom costs, progress, etc.)
            if (existingProject) {
                const updatedProjectPayload: Project = {
                    ...existingProject,
                    projectName: formData.projectName?.trim() || existingProject.projectName,
                    clientName: formData.clientName?.trim() || existingProject.clientName,
                    clientId: updatedClientPayload.id,
                    projectType: formData.projectType || existingProject.projectType,
                    packageName: resolvedPackageName,
                    packageId: resolvedPackageId,
                    additionalPackages: additionalPackageRecords,
                    date: formData.date,
                    location: formData.location !== undefined ? formData.location : existingProject.location,
                    address: formData.address !== undefined ? formData.address : (existingProject.address || updatedClientPayload.address || ''),
                    status: existingProject.status,
                    totalCost: totalProject,
                    amountPaid: newAmountPaid,
                    paymentStatus: newPaymentStatus,
                    durationSelection: formData.durationSelection || (existingProject as any).durationSelection,
                    unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : (existingProject as any).unitPrice,
                    notes: formData.notes !== undefined ? formData.notes : existingProject.notes,
                    accommodation: formData.accommodation !== undefined ? formData.accommodation : existingProject.accommodation,
                    driveLink: formData.driveLink !== undefined ? formData.driveLink : existingProject.driveLink,
                    promoCodeId: formData.promoCodeId || existingProject.promoCodeId,
                    discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : existingProject.discountAmount,
                    addOns: allProjectAddOns as any,
                };

                try {
                    const updatedProjectRowResult = await updateProjectRow(existingProject.id, {
                        projectName: updatedProjectPayload.projectName,
                        clientName: updatedProjectPayload.clientName,
                        clientId: updatedProjectPayload.clientId,
                        projectType: updatedProjectPayload.projectType,
                        packageName: updatedProjectPayload.packageName,
                        packageId: updatedProjectPayload.packageId,
                        date: updatedProjectPayload.date,
                        location: updatedProjectPayload.location,
                        status: updatedProjectPayload.status,
                        totalCost: updatedProjectPayload.totalCost,
                        amountPaid: updatedProjectPayload.amountPaid,
                        paymentStatus: updatedProjectPayload.paymentStatus,
                        durationSelection: updatedProjectPayload.durationSelection || undefined,
                        unitPrice: updatedProjectPayload.unitPrice !== undefined ? Number(updatedProjectPayload.unitPrice) : undefined,
                        notes: updatedProjectPayload.notes || undefined,
                        accommodation: updatedProjectPayload.accommodation || undefined,
                        driveLink: updatedProjectPayload.driveLink || undefined,
                        promoCodeId: updatedProjectPayload.promoCodeId || undefined,
                        discountAmount: updatedProjectPayload.discountAmount || undefined,
                        address: updatedProjectPayload.address || undefined,
                        addOns: allProjectAddOns,
                        additionalPackages: additionalPackageRecords,
                    });

                    const finalMergedProject: Project = {
                        ...existingProject,
                        ...updatedProjectRowResult,
                        ...updatedProjectPayload,
                        addOns: allProjectAddOns as any,
                        additionalPackages: additionalPackageRecords,
                    };
                    setProjects(prev => prev.map(p => (p.id === finalMergedProject.id ? finalMergedProject : p)));

                    if (documentToView?.type === 'invoice' && documentToView.project.id === finalMergedProject.id) {
                        setDocumentToView({ type: 'invoice', project: finalMergedProject });
                    }
                } catch (err) {
                    console.error('Gagal update Acara Pernikahan di DB:', err);
                    showNotification(
                        !navigator.onLine
                            ? 'Harus online untuk melakukan perubahan'
                            : 'Data pengantin tersimpan, tetapi perubahan acara gagal disimpan. Coba lagi.'
                    );
                    return;
                }
            }

            showNotification(`Data pengantin dan Acara Pernikahan berhasil diperbarui.`);
            handleCloseModal();
            setFormData(initialFormState);
            setSelectedClient(null);
            setSelectedProject(null);
        }
    };

    return {
        isModalOpen,
        setIsModalOpen,
        modalMode,
        selectedClient,
        selectedProject,
        formData,
        setFormData,
        handleOpenModal,
        handleCloseModal,
        handleFormChange,
        handleFormSubmit,
    };
};
