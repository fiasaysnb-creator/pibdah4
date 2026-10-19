import React, { useState } from 'react';
import {
    Transaction,
    TransactionType,
    Project,
    Card,
    PaymentStatus,
    Notification,
    ViewType
} from '../../../types';
import {
    createTransaction as createTransactionRow,
    updateCardBalance,
    updateTransaction as updateTxRow,
} from '../../../services/transactions';
import { updateProject as updateProjectRow } from '../../../services/projects';
import { findCardIdByMeta } from '../../../services/cards';
import { ensureOnlineOrNotify, formatCurrency } from '../utils/clientHelpers';
import { TxFormData } from '../components/ClientTransactionEditModal';
import { DocumentToView } from './useClientDocumentActions';

interface UseClientPaymentOperationsParams {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    showNotification: (msg: string) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
    documentToView: DocumentToView | null;
    setDocumentToView: React.Dispatch<React.SetStateAction<DocumentToView | null>>;
}

export const useClientPaymentOperations = ({
    projects,
    setProjects,
    transactions,
    setTransactions,
    cards,
    setCards,
    showNotification,
    addNotification,
    documentToView,
    setDocumentToView,
}: UseClientPaymentOperationsParams) => {
    const [isTransactionEditModalOpen, setIsTransactionEditModalOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [txFormData, setTxFormData] = useState<TxFormData>({
        date: '',
        description: '',
        amount: 0,
        category: '',
        method: '',
        cardId: ''
    });

    const handleOpenEditTransaction = (tx: Transaction) => {
        setTransactionToEdit(tx);
        setTxFormData({
            date: tx.date,
            description: tx.description || '',
            amount: tx.amount,
            category: tx.category || '',
            method: tx.method || '',
            cardId: tx.cardId || ''
        });
        setIsTransactionEditModalOpen(true);
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transactionToEdit) return;
        if (!ensureOnlineOrNotify(showNotification)) return;

        const id = transactionToEdit.id;
        const patch: Partial<Transaction> = {
            date: txFormData.date,
            description: txFormData.description,
            amount: Number(txFormData.amount),
            category: txFormData.category,
            method: txFormData.method as any,
            cardId: txFormData.cardId || undefined
        };

        const before = transactions.find(t => t.id === id);
        if (!before) return;

        try {
            const updated = await updateTxRow(id, patch);

            // 1. Sync local transactions state
            setTransactions(prev =>
                prev.map(t => (t.id === id ? updated : t)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            );

            // 2. Adjust card balance if card/amount/type changed
            if (before.cardId) {
                const prevDelta = before.type === TransactionType.INCOME ? before.amount : -before.amount;
                try {
                    await updateCardBalance(before.cardId, -prevDelta);
                } catch (e) {
                    console.warn('Balance sync warning:', e);
                }
                setCards(prev => prev.map(c => (c.id === before.cardId ? { ...c, balance: c.balance - prevDelta } : c)));
            }
            if (updated.cardId) {
                const newDelta = updated.type === TransactionType.INCOME ? updated.amount : -updated.amount;
                try {
                    await updateCardBalance(updated.cardId, newDelta);
                } catch (e) {
                    console.warn('Balance sync warning:', e);
                }
                setCards(prev => prev.map(c => (c.id === updated.cardId ? { ...c, balance: c.balance + newDelta } : c)));
            }

            // 3. Adjust project amountPaid if it's a project payment (INCOME)
            if (updated.projectId && updated.type === TransactionType.INCOME) {
                const diff = updated.amount - before.amount;
                if (diff !== 0) {
                    const project = projects.find(p => p.id === updated.projectId);
                    if (project) {
                        const newAmountPaid = (project.amountPaid || 0) + diff;
                        const remaining = project.totalCost - newAmountPaid;
                        const updatedProject = await updateProjectRow(project.id, {
                            amountPaid: newAmountPaid,
                            paymentStatus: remaining <= 0 ? PaymentStatus.LUNAS : PaymentStatus.DP_TERBAYAR
                        });
                        setProjects(prev =>
                            prev.map(p =>
                                p.id === updatedProject.id
                                    ? { ...p, amountPaid: updatedProject.amountPaid, paymentStatus: updatedProject.paymentStatus }
                                    : p
                            )
                        );
                    }
                }
            }

            showNotification('Transaksi berhasil diperbarui.');
            setIsTransactionEditModalOpen(false);
            setTransactionToEdit(null);

            // Refresh document view if it was being viewed
            if (documentToView?.type === 'receipt' && documentToView.transaction.id === id) {
                setDocumentToView({ type: 'receipt', transaction: updated });
            }
        } catch (err) {
            console.error('Failed to update transaction:', err);
            showNotification('Gagal memperbarui transaksi. Coba lagi.');
        }
    };

    const handleRecordPayment = async (projectId: string, amount: number, destinationCardId: string, proofUrl?: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        if (!ensureOnlineOrNotify(showNotification)) return;

        try {
            const selectedCard = cards.find(c => c.id === destinationCardId);
            const cardIdToUse = selectedCard ? selectedCard.id : destinationCardId;
            const createdTx = await createTransactionRow({
                date: new Date().toISOString().split('T')[0],
                description: `Pembayaran Acara Pernikahan ${project.projectName}`,
                amount,
                type: TransactionType.INCOME,
                projectId: project.id,
                category: 'Pelunasan Acara Pernikahan',
                method: 'Transfer Bank',
                cardId: cardIdToUse || undefined,
            } as Omit<Transaction, 'id' | 'vendorSignature'>);
            setTransactions(prev => {
                const exists = prev.some(t => t.id === createdTx.id);
                const list = exists ? prev.map(t => t.id === createdTx.id ? createdTx : t) : [createdTx, ...prev];
                return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
            if (destinationCardId) {
                setCards(prev => prev.map(c => (c.id === destinationCardId ? { ...c, balance: c.balance + amount } : c)));
            }
        } catch (err) {
            console.warn('[Supabase] Gagal mencatat pembayaran, gunakan fallback lokal.', err);
            const newTransaction: Transaction = {
                id: `TRN-PAY-${project.id}-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                description: `Pembayaran Acara Pernikahan ${project.projectName}`,
                amount,
                type: TransactionType.INCOME,
                projectId: project.id,
                category: 'Pelunasan Acara Pernikahan',
                method: 'Transfer Bank',
                cardId: destinationCardId,
            };
            setTransactions(prev => {
                const exists = prev.some(t => t.id === newTransaction.id);
                const list = exists ? prev.map(t => t.id === newTransaction.id ? newTransaction : t) : [newTransaction, ...prev];
                return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
            setCards(prev => prev.map(c => (c.id === destinationCardId ? { ...c, balance: c.balance + amount } : c)));
        }

        // Persist updated amountPaid and paymentStatus to Supabase, then sync local state
        try {
            const currentProject = projects.find(p => p.id === project.id);
            if (currentProject) {
                const newAmountPaid = currentProject.amountPaid + amount;
                const remaining = currentProject.totalCost - newAmountPaid;
                const paymentProofs = proofUrl
                    ? [...(currentProject.paymentProofs || []), { url: proofUrl, amount, date: new Date().toISOString().slice(0, 10) }]
                    : currentProject.paymentProofs || [];
                const updated = await updateProjectRow(project.id, {
                    amountPaid: newAmountPaid,
                    paymentStatus: remaining <= 0 ? PaymentStatus.LUNAS : PaymentStatus.DP_TERBAYAR,
                    ...(proofUrl ? { paymentProofs } : {}),
                });
                setProjects(prev =>
                    prev.map(p =>
                        p.id === updated.id
                            ? { ...p, amountPaid: updated.amountPaid, paymentStatus: updated.paymentStatus, paymentProofs: updated.paymentProofs }
                            : p
                    )
                );
            }
        } catch (err) {
            // Fallback: update local state to keep UI responsive even if persistence fails
            setProjects(prev =>
                prev.map(p => {
                    if (p.id === project.id) {
                        const newAmountPaid = p.amountPaid + amount;
                        const remaining = p.totalCost - newAmountPaid;
                        return {
                            ...p,
                            amountPaid: newAmountPaid,
                            ...(proofUrl ? { paymentProofs: [...(p.paymentProofs || []), { url: proofUrl, amount, date: new Date().toISOString().slice(0, 10) }] } : {}),
                            paymentStatus: remaining <= 0 ? PaymentStatus.LUNAS : PaymentStatus.DP_TERBAYAR
                        };
                    }
                    return p;
                })
            );
        }

        showNotification('Pembayaran berhasil dicatat.');
        addNotification({
            title: 'Pembayaran Diterima',
            message: `Pembayaran sebesar ${formatCurrency(amount)} untuk Acara Pernikahan "${project.projectName}" telah diterima.`,
            icon: 'payment',
            link: {
                view: ViewType.CLIENTS,
                action: { type: 'VIEW_CLIENT_DETAILS', id: project.clientId }
            }
        });
    };

    return {
        isTransactionEditModalOpen,
        setIsTransactionEditModalOpen,
        transactionToEdit,
        txFormData,
        setTxFormData,
        handleOpenEditTransaction,
        handleUpdateTransaction,
        handleRecordPayment,
    };
};
