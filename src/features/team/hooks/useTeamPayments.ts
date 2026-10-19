/**
 * useTeamPayments
 *
 * Owns:
 * - Payment flow state (projectsToPay, paymentAmount, paymentSourceId, isInstallment)
 * - Payment slip / signature modal state
 * - handleCreatePayment  — pre-fills amount & source, moves to create-payment tab
 * - handlePay            — executes full payment: card/pocket deduction, transactions,
 *                          team payment record, DB refresh (identical logic to original)
 * - handleSaveSignature  — persists signature on payment record
 * - handleDownloadPDF    — PDF vector export (jsPDF)
 * - renderPaymentSlipBody — renders PaymentSlipDocument (used in slip modal + create-payment preview)
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import React from 'react';
import {
    TeamMember,
    TeamProjectPayment,
    TeamPaymentRecord,
    Transaction,
    TransactionType,
    Project,
    Card,
    FinancialPocket,
    PocketType,
    CardType,
    Profile,
} from '../../../types';
import {
    markTeamPaymentStatus,
    listAllTeamPayments,
    updateTeamProjectPayments as updateTeamProjectPaymentsApi,
} from '../../../services/teamProjectPayments';
import {
    createTransactions as createTransactionsApi,
    listTransactions as listTransactionsApi,
    updateCardBalance as updateCardBalanceApi,
} from '../../../services/transactions';
import {
    createTeamPaymentRecord,
    deleteTeamPaymentRecord,
    updateTeamPaymentRecord,
} from '../../../services/teamPaymentRecords';
import { updatePocket as updatePocketRow } from '../../../services/pockets';
import { formatCurrency } from '../utils/teamUtils';
import PaymentSlipDocument from '../components/PaymentSlipDocument';
import { generatePDFBlob } from '../../../shared/utils/pdfUtils';
import { buildPaymentSlipFileName, buildPaymentSlipPdf, downloadPaymentSlipPdf } from '../utils/paymentSlipPdf';
import { generateWhatsAppLink } from '../../../utils/whatsapp';

interface UseTeamPaymentsParams {
    selectedMember: TeamMember | null;
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords: TeamPaymentRecord[];
    setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    projects: Project[];
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    teamMembers: TeamMember[];
    userProfile: Profile;
    showNotification: (message: string) => void;
    onSignPaymentRecord: (recordId: string, signatureDataUrl: string) => void;
    setDetailTab: (tab: 'projects' | 'payments' | 'performance' | 'create-payment') => void;
    setIsDetailOpen: (open: boolean) => void;
    /** Date-range-filtered payments — used to derive unpaid projects for selectedMember */
    teamProjectPaymentsInDateRange: TeamProjectPayment[];
}

export const useTeamPayments = ({
    selectedMember,
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentRecords,
    setTeamPaymentRecords,
    transactions,
    setTransactions,
    projects,
    cards,
    setCards,
    pockets,
    setPockets,
    teamMembers,
    userProfile,
    showNotification,
    onSignPaymentRecord,
    setDetailTab,
    setIsDetailOpen,
    teamProjectPaymentsInDateRange,
}: UseTeamPaymentsParams) => {
    // ── Payment flow state ───────────────────────────────────────────────────
    const [projectsToPay, setProjectsToPay] = useState<string[]>([]);
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [paymentSourceId, setPaymentSourceId] = useState('');
    const [isInstallment, setIsInstallment] = useState(false);
    const paymentSubmissionLock = useRef(false);

    // ── Slip / signature state ───────────────────────────────────────────────
    const [paymentSlipToView, setPaymentSlipToView] = useState<TeamPaymentRecord | null>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // ── Generate PDF preview blob ────────────────────────────────────────────
    const handleGenerateSlipPreview = useCallback(async (record?: TeamPaymentRecord) => {
        const rec = record || paymentSlipToView;
        if (!rec) return;
        setIsGeneratingPdf(true);
        try {
            const blob = await generatePDFBlob(
                `payment-slip-content-${rec.id}`,
                `Slip-Gaji-${rec.recordNumber}.pdf`
            );
            setPdfBlob(blob);
        } catch (err) {
            console.error('[useTeamPayments] Error generating slip PDF preview:', err);
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [paymentSlipToView]);

    useEffect(() => {
        if (paymentSlipToView) {
            const timer = setTimeout(() => {
                handleGenerateSlipPreview(paymentSlipToView);
            }, 350);
            return () => clearTimeout(timer);
        } else {
            setPdfBlob(null);
        }
    }, [paymentSlipToView?.id, paymentSlipToView?.vendorSignature, handleGenerateSlipPreview]);

    // ── Derived: unpaid projects for selected member (date-range-aware) ──────
    const selectedMemberUnpaidProjects = useMemo(() => {
        if (!selectedMember) return [];
        return teamProjectPaymentsInDateRange.filter(
            p => p.teamMemberId === selectedMember.id && p.status === 'Unpaid',
        );
    }, [teamProjectPaymentsInDateRange, selectedMember]);

    // ── Derived: budget pocket ───────────────────────────────────────────────
    const monthlyBudgetPocket = useMemo(
        () => pockets.find(p => p.type === PocketType.EXPENSE),
        [pockets],
    );

    // ── Unique payment records (de-duplicated) ───────────────────────────────
    const uniqueTeamPaymentRecords = useMemo(() => {
        const seen = new Set<string>();
        return teamPaymentRecords.filter(r => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
        });
    }, [teamPaymentRecords]);

    const handleUpdatePaymentRecord = useCallback(async (
        recordId: string,
        patch: Pick<TeamPaymentRecord, 'recordNumber' | 'date'>,
    ) => {
        try {
            const updatedRecord = await updateTeamPaymentRecord(recordId, patch);
            setTeamPaymentRecords(prev => prev.map(record =>
                record.id === recordId ? updatedRecord : record,
            ));
            setPaymentSlipToView(current =>
                current?.id === recordId ? updatedRecord : current,
            );
            showNotification('Rincian slip pembayaran berhasil diperbarui.');
            return true;
        } catch (error) {
            console.error('[useTeamPayments] Failed to update payment record:', error);
            showNotification('Gagal memperbarui slip pembayaran. Coba lagi.');
            return false;
        }
    }, [setTeamPaymentRecords, showNotification]);

    const handleDeletePaymentRecord = useCallback(async (record: TeamPaymentRecord) => {
        const confirmed = window.confirm(
            `Hapus slip ${record.recordNumber} dari riwayat? Transaksi dan status fee acara tidak berubah.`,
        );
        if (!confirmed) return false;

        try {
            await deleteTeamPaymentRecord(record.id);
            setTeamPaymentRecords(prev => prev.filter(item => item.id !== record.id));
            setPaymentSlipToView(current => current?.id === record.id ? null : current);
            setExpandedRecordId(current => current === record.id ? null : current);
            showNotification('Slip pembayaran berhasil dihapus dari riwayat.');
            return true;
        } catch (error) {
            console.error('[useTeamPayments] Failed to delete payment record:', error);
            showNotification('Gagal menghapus slip pembayaran. Coba lagi.');
            return false;
        }
    }, [setTeamPaymentRecords, showNotification]);

    // ── handleCreatePayment — pre-fill amount/source, navigate to payment tab ─
    const handleCreatePayment = useCallback(() => {
        if (!selectedMember || projectsToPay.length === 0) return;

        const totalToPay = selectedMemberUnpaidProjects
            .filter(p => projectsToPay.includes(p.id))
            .reduce((sum, p) => sum + p.fee, 0);
        setPaymentAmount(totalToPay);

        const budgetPocket = pockets.find(p => p.type === PocketType.EXPENSE);
        if (budgetPocket && budgetPocket.amount >= totalToPay) {
            setPaymentSourceId(`pocket-${budgetPocket.id}`);
        } else {
            setPaymentSourceId('');
        }

        setDetailTab('create-payment');
    }, [selectedMember, projectsToPay, selectedMemberUnpaidProjects, pockets, setDetailTab]);

    // ── handlePay — full payment execution ──────────────────────────────────
    const handlePay = useCallback(async () => {
        if (paymentSubmissionLock.current) return;
        paymentSubmissionLock.current = true;

        try {
            if (!selectedMember || paymentAmount === '' || paymentAmount <= 0 || !paymentSourceId) {
                alert('Harap isi jumlah dan pilih sumber dana.');
                return;
            }

            const paymentDate = new Date().toISOString().split('T')[0];
            const selectedIds = new Set(projectsToPay);
            const selectedProjectIds = new Set<string>();
            const selectedPayments = teamProjectPayments
                .filter(payment =>
                    selectedIds.has(payment.id) &&
                    payment.teamMemberId === selectedMember.id &&
                    payment.status === 'Unpaid',
                )
                .filter(payment => {
                    if (selectedProjectIds.has(payment.projectId)) return false;
                    selectedProjectIds.add(payment.projectId);
                    return true;
                })
                .sort((a, b) => a.date.localeCompare(b.date));

            if (selectedPayments.length === 0) {
                showNotification('Fee yang dipilih sudah lunas atau tidak ditemukan. Muat ulang daftar lalu coba lagi.');
                return;
            }

            const actualPaidAmount = Number(paymentAmount);
            const totalDue = selectedPayments.reduce((sum, payment) => sum + payment.fee, 0);
            if (actualPaidAmount > totalDue) {
                alert(
                    `Jumlah bayar (${formatCurrency(actualPaidAmount)}) melebihi total pembayaran (${formatCurrency(totalDue)}).`,
                );
                return;
            }

            let method = 'Transfer Bank';
            let cardId: string | undefined;
            let pocketId: string | undefined;
            let selectedPocket: FinancialPocket | undefined;

            if (paymentSourceId.startsWith('card-')) {
                cardId = paymentSourceId.replace('card-', '');
                const card = cards.find(item => item.id === cardId);
                if (!card || card.balance < actualPaidAmount) {
                    alert(`Saldo di kartu ${card?.bankName} tidak mencukupi.`);
                    return;
                }
                method = card.cardType === CardType.TUNAI ? 'Tunai' : 'Kartu';
            } else if (paymentSourceId.startsWith('pocket-')) {
                pocketId = paymentSourceId.replace('pocket-', '');
                selectedPocket = pockets.find(item => item.id === pocketId);
                if (!selectedPocket || selectedPocket.amount < actualPaidAmount) {
                    alert(`Saldo di kantong ${selectedPocket?.name} tidak mencukupi.`);
                    return;
                }
                cardId = selectedPocket.sourceCardId;
                if (cardId) {
                    const sourceCard = cards.find(item => item.id === cardId);
                    if (!sourceCard || sourceCard.balance < actualPaidAmount) {
                        alert(`Saldo di kartu sumber (${sourceCard?.bankName}) yang terhubung ke kantong ini tidak mencukupi.`);
                        return;
                    }
                }
                method = 'Sistem';
            } else {
                alert('Pilih sumber dana yang valid.');
                return;
            }

            let remainingToDistribute = actualPaidAmount;
            const transactionsToCreate: Omit<Transaction, 'id' | 'vendorSignature'>[] = [];
            const paymentsToUpdate: TeamProjectPayment[] = [];

            for (const payment of selectedPayments) {
                if (remainingToDistribute <= 0) break;

                const amountForProject = Math.min(payment.fee, remainingToDistribute);
                const isFullyPaid = amountForProject >= payment.fee;
                remainingToDistribute -= amountForProject;

                const project = projects.find(item => item.id === payment.projectId);
                transactionsToCreate.push({
                    date: paymentDate,
                    description: `Gaji Freelance - ${selectedMember.name}${project ? ` (${project.projectName})` : ''}${!isFullyPaid ? ' (Cicilan)' : ''}`,
                    amount: amountForProject,
                    type: TransactionType.EXPENSE,
                    projectId: payment.projectId,
                    category: 'Gaji Tim / Vendor',
                    method,
                    pocketId,
                    cardId,
                });

                const validPaymentDate = payment.date && !Number.isNaN(Date.parse(payment.date))
                    ? payment.date
                    : paymentDate;
                paymentsToUpdate.push({
                    ...payment,
                    date: validPaymentDate,
                    fee: isFullyPaid ? payment.fee : payment.fee - amountForProject,
                    status: isFullyPaid ? 'Paid' : 'Unpaid',
                });
            }

            let persistedPayments: TeamProjectPayment[];
            try {
                persistedPayments = await updateTeamProjectPaymentsApi(paymentsToUpdate);
            } catch (error) {
                console.error('[useTeamPayments] Failed to update fee status:', error);
                showNotification('Status fee gagal disimpan. Transaksi tidak dibuat. Periksa tanggal acara lalu coba lagi.');
                return;
            }

            const persistedById = new Map(persistedPayments.map(payment => [payment.id, payment]));
            setTeamProjectPayments(prev => prev.map(payment => persistedById.get(payment.id) ?? payment));

            try {
                await createTransactionsApi(transactionsToCreate);
            } catch (error) {
                console.error('[useTeamPayments] Failed to create payment transactions:', error);
                const rollbackPayments = selectedPayments
                    .filter(payment => paymentsToUpdate.some(updated => updated.id === payment.id))
                    .map(payment => ({
                        ...payment,
                        date: payment.date && !Number.isNaN(Date.parse(payment.date)) ? payment.date : paymentDate,
                    }));
                try {
                    await updateTeamProjectPaymentsApi(rollbackPayments);
                } catch (rollbackError) {
                    console.error('[useTeamPayments] Failed to roll back fee status:', rollbackError);
                }
                const rollbackById = new Map(rollbackPayments.map(payment => [payment.id, payment]));
                setTeamProjectPayments(prev => prev.map(payment => rollbackById.get(payment.id) ?? payment));
                showNotification('Transaksi gagal disimpan. Status fee dikembalikan; belum ada slip pembayaran yang dibuat.');
                return;
            }

            let balanceUpdateFailed = false;
            if (cardId) {
                try {
                    await updateCardBalanceApi(cardId, -actualPaidAmount);
                    setCards(prev => prev.map(card =>
                        card.id === cardId ? { ...card, balance: card.balance - actualPaidAmount } : card,
                    ));
                } catch (error) {
                    console.error('[useTeamPayments] Failed to update card balance:', error);
                    balanceUpdateFailed = true;
                }
            }

            if (selectedPocket && pocketId) {
                try {
                    await updatePocketRow(pocketId, { amount: selectedPocket.amount - actualPaidAmount });
                    setPockets(prev => prev.map(pocket =>
                        pocket.id === pocketId ? { ...pocket, amount: pocket.amount - actualPaidAmount } : pocket,
                    ));
                } catch (error) {
                    console.error('[useTeamPayments] Failed to update pocket balance:', error);
                    balanceUpdateFailed = true;
                    if (cardId) {
                        try {
                            await updateCardBalanceApi(cardId, actualPaidAmount);
                            setCards(prev => prev.map(card =>
                                card.id === cardId ? { ...card, balance: card.balance + actualPaidAmount } : card,
                            ));
                        } catch (rollbackError) {
                            console.error('[useTeamPayments] Failed to restore source card balance:', rollbackError);
                        }
                    }
                }
            }

            try {
                const freshTransactions = await listTransactionsApi();
                setTransactions(prev => {
                    const merged = new Map<string, Transaction>();
                    for (const transaction of freshTransactions) merged.set(transaction.id, transaction);
                    for (const transaction of prev) {
                        if (!merged.has(transaction.id)) merged.set(transaction.id, transaction);
                    }
                    return Array.from(merged.values()).sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                    );
                });
            } catch (error) {
                console.warn('[useTeamPayments] Failed to refresh transactions:', error);
            }

            const newRecordPayload: Omit<TeamPaymentRecord, 'id'> = {
                recordNumber: `PAY-FR-${selectedMember.id.slice(-4)}-${Date.now()}`,
                teamMemberId: selectedMember.id,
                date: paymentDate,
                projectPaymentIds: paymentsToUpdate.map(payment => payment.id),
                totalAmount: actualPaidAmount,
            };

            let recordSaved = false;
            try {
                const createdRecord = await createTeamPaymentRecord(newRecordPayload);
                setTeamPaymentRecords(prev => [...prev, createdRecord]);
                recordSaved = true;
                const freshPayments = await listAllTeamPayments();
                setTeamProjectPayments(Array.isArray(freshPayments) ? freshPayments : []);
            } catch (error) {
                console.error('[useTeamPayments] Failed to persist payment slip:', error);
            }

            if (!recordSaved) {
                showNotification('Transaksi sudah tercatat, tetapi slip gagal disimpan. Jangan ulangi pembayaran ini.');
            } else if (balanceUpdateFailed) {
                showNotification('Pembayaran dan slip tercatat, tetapi saldo sumber dana gagal diperbarui.');
            } else {
                showNotification(
                    `Pembayaran untuk ${selectedMember.name} sebesar ${formatCurrency(actualPaidAmount)} berhasil dicatat.`,
                );
            }

            setProjectsToPay([]);
            setPaymentAmount('');
            setIsDetailOpen(false);
        } finally {
            paymentSubmissionLock.current = false;
        }
    }, [
        selectedMember,
        paymentAmount,
        paymentSourceId,
        projectsToPay,
        selectedMemberUnpaidProjects,
        teamProjectPayments,
        cards,
        pockets,
        projects,
        setCards,
        setPockets,
        setTeamProjectPayments,
        setTeamPaymentRecords,
        setTransactions,
        showNotification,
        setIsDetailOpen,
    ]);

    // ── handleSaveSignature ──────────────────────────────────────────────────
    const handleSaveSignature = useCallback(
        (signatureDataUrl: string) => {
            if (paymentSlipToView) {
                onSignPaymentRecord(paymentSlipToView.id, signatureDataUrl);
                const updated = { ...paymentSlipToView, vendorSignature: signatureDataUrl };
                setPaymentSlipToView(updated);
                setTimeout(() => {
                    handleGenerateSlipPreview(updated);
                }, 300);
            }
            setIsSignatureModalOpen(false);
        },
        [paymentSlipToView, onSignPaymentRecord, handleGenerateSlipPreview],
    );

    // ── handleDownloadPDF ────────────────────────────────────────────────────
    const handleDownloadPDF = useCallback(async () => {
        if (!paymentSlipToView) return;

        // Ekspor PDF vector (teks tajam) dibangun ulang dari data, bukan screenshot.
        try {
            await downloadPaymentSlipPdf({
                record: paymentSlipToView,
                teamMembers,
                teamProjectPayments,
                projects,
                profile: userProfile,
            });
        } catch (err) {
            console.error('Failed to generate slip PDF:', err);
            window.print();
        }
    }, [paymentSlipToView, teamMembers, teamProjectPayments, projects, userProfile]);

    const handleSharePaymentSlip = useCallback(async () => {
        if (!paymentSlipToView) return;

        const member = teamMembers.find(item => item.id === paymentSlipToView.teamMemberId);
        const fileName = buildPaymentSlipFileName(paymentSlipToView);
        const placeholderFile = typeof File !== 'undefined'
            ? new File([''], fileName, { type: 'application/pdf' })
            : null;
        const supportsFileSharing = !!placeholderFile &&
            typeof navigator !== 'undefined' &&
            !!navigator.share &&
            !!navigator.canShare?.({ files: [placeholderFile] });
        const whatsappWindow = supportsFileSharing ? null : window.open('about:blank', '_blank');

        try {
            const pdf = await buildPaymentSlipPdf({
                record: paymentSlipToView,
                teamMembers,
                teamProjectPayments,
                projects,
                profile: userProfile,
            });
            const blob = pdf.output('blob');
            const file = new File([blob], fileName, { type: 'application/pdf' });
            const message = [
                `Bukti pembayaran tim untuk ${member?.name || 'Tim / Vendor'}`,
                `Invoice: ${paymentSlipToView.recordNumber}`,
                `Total: ${formatCurrency(paymentSlipToView.totalAmount)}`,
                `Tanggal: ${paymentSlipToView.date}`,
            ].join('\n');

            if (supportsFileSharing && navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Bukti & Invoice Pembayaran Tim',
                        text: message,
                    });
                    return;
                } catch (shareError) {
                    if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
                    console.warn('[useTeamPayments] File sharing unavailable; falling back to WhatsApp link.', shareError);
                }
            }

            pdf.save(fileName);
            const whatsappUrl = generateWhatsAppLink(
                member?.phone,
                `${message}\nPDF sudah diunduh. Silakan lampirkan file PDF ini di chat WhatsApp.`,
            );
            if (whatsappUrl === '#') {
                whatsappWindow?.close();
                showNotification('PDF berhasil diunduh, tetapi nomor WhatsApp anggota belum tersedia.');
                return;
            }
            if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
            else window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            whatsappWindow?.close();
            console.error('[useTeamPayments] Failed to prepare payment slip for sharing:', error);
            showNotification('Gagal menyiapkan PDF bukti pembayaran. Coba lagi.');
        }
    }, [paymentSlipToView, teamMembers, teamProjectPayments, projects, userProfile, showNotification]);

    // ── renderPaymentSlipBody ────────────────────────────────────────────────
    const renderPaymentSlipBody = useCallback(
        (record: TeamPaymentRecord) => {
            return React.createElement(PaymentSlipDocument, {
                record,
                teamMembers,
                teamProjectPayments,
                projects,
                userProfile,
            });
        },
        [teamMembers, teamProjectPayments, projects, userProfile],
    );

    return {
        // State
        projectsToPay,
        setProjectsToPay,
        paymentAmount,
        setPaymentAmount,
        paymentSourceId,
        setPaymentSourceId,
        isInstallment,
        setIsInstallment,
        paymentSlipToView,
        setPaymentSlipToView,
        pdfBlob,
        setPdfBlob,
        isGeneratingPdf,
        handleGenerateSlipPreview,
        isSignatureModalOpen,
        setIsSignatureModalOpen,
        expandedRecordId,
        setExpandedRecordId,
        handleUpdatePaymentRecord,
        handleDeletePaymentRecord,

        // Derived
        selectedMemberUnpaidProjects,
        monthlyBudgetPocket,
        uniqueTeamPaymentRecords,

        // Handlers
        handleCreatePayment,
        handlePay,
        handleSaveSignature,
        handleDownloadPDF,
        handleSharePaymentSlip,
        renderPaymentSlipBody,
    };
};
