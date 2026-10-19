import { useState, useMemo, useCallback } from 'react';
import { Transaction, TransactionType, FinancialPocket, Card, CardType, Project, TeamPaymentRecord, TeamProjectPayment } from '../../../types';
import { createTransaction as createTransactionRow, updateCardBalance, updateTransaction as updateTransactionRow, deleteTransaction as deleteTransactionApi } from '../../../services/transactions';
import { updatePocket as updatePocketRow, deletePocket as deletePocketRow } from '../../../services/pockets';
import { deleteCard as deleteCardRow, safeDeleteCard } from '../../../services/cards';
import { updateTeamProjectPayments as updateTeamProjectPaymentsApi } from '../../../services/teamProjectPayments';
import { updateTeamPaymentRecord as updateTeamPaymentRecordApi } from '../../../services/teamPaymentRecords';

export const useFinance = (
    transactions: Transaction[],
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>,
    pockets: FinancialPocket[],
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>,
    cards: Card[],
    setCards: React.Dispatch<React.SetStateAction<Card[]>>,
    showNotification: (message: string) => void,
    teamProjectPayments: TeamProjectPayment[],
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>,
    teamPaymentRecords: TeamPaymentRecord[],
    setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>,
) => {
    const handleAddTransaction = useCallback(async (data: any) => {
        try {
            const created = await createTransactionRow(data);
            setTransactions(prev => {
                const exists = prev.some(t => t.id === created.id);
                const list = exists ? prev.map(t => t.id === created.id ? created : t) : [created, ...prev];
                return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            if (created.cardId) {
                const delta = created.type === TransactionType.INCOME ? created.amount : -created.amount;
                setCards(prev => prev.map(c => c.id === created.cardId ? { ...c, balance: (c.balance || 0) + delta } : c));
            }
            if (created.pocketId) {
                const pocket = pockets.find(p => p.id === created.pocketId);
                if (pocket) {
                    const delta = created.type === TransactionType.INCOME ? created.amount : -created.amount;
                    const newAmount = pocket.amount + delta;
                    setPockets(prev => prev.map(p => p.id === created.pocketId ? { ...p, amount: newAmount } : p));
                    try { await updatePocketRow(created.pocketId, { amount: newAmount }); } catch { }
                }
            }

            showNotification('Transaksi berhasil dicatat.');
            return created;
        } catch (err) {
            showNotification('Gagal mencatat transaksi.');
            throw err;
        }
    }, [setTransactions, setCards, setPockets, pockets, showNotification]);

    const handleUpdateTransaction = useCallback(async (id: string, data: any, before: Transaction) => {
        try {
            const updated = await updateTransactionRow(id, data);
            
            // Adjust card balance
            if (before.cardId) {
                const prevDelta = before.type === TransactionType.INCOME ? before.amount : -before.amount;
                try { await updateCardBalance(before.cardId, -prevDelta); } catch { }
                setCards(prev => prev.map(c => c.id === before.cardId ? { ...c, balance: c.balance - prevDelta } : c));
            }
            if (before.pocketId) {
                const pocket = pockets.find(p => p.id === before.pocketId);
                if (pocket) {
                    const prevDelta = before.type === TransactionType.INCOME ? before.amount : -before.amount;
                    const newAmount = pocket.amount - prevDelta;
                    setPockets(prev => prev.map(p => p.id === before.pocketId ? { ...p, amount: newAmount } : p));
                    try { await updatePocketRow(before.pocketId, { amount: newAmount }); } catch { }
                }
            }
            if (updated.cardId) {
                const newDelta = updated.type === TransactionType.INCOME ? updated.amount : -updated.amount;
                try { await updateCardBalance(updated.cardId, newDelta); } catch { }
                setCards(prev => prev.map(c => c.id === updated.cardId ? { ...c, balance: c.balance + newDelta } : c));
            }
            if (updated.pocketId) {
                const pocket = pockets.find(p => p.id === updated.pocketId);
                if (pocket) {
                    const newDelta = updated.type === TransactionType.INCOME ? updated.amount : -updated.amount;
                    const newAmount = pocket.amount + newDelta;
                    setPockets(prev => prev.map(p => p.id === updated.pocketId ? { ...p, amount: newAmount } : p));
                    try { await updatePocketRow(updated.pocketId, { amount: newAmount }); } catch { }
                }
            }

            setTransactions(prev => prev.map(t => t.id === id ? updated : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            let teamPaymentSyncFailed = false;
            if (
                before.category === 'Gaji Tim / Vendor' &&
                before.projectId &&
                before.type === TransactionType.EXPENSE
            ) {
                const memberName = before.description.match(/^Gaji Freelance - (.+?) \(/)?.[1];
                const oldPaymentDate = before.date.slice(0, 10);
                const linkedPayment = teamProjectPayments.find(payment =>
                    payment.projectId === before.projectId &&
                    payment.teamMemberName === memberName &&
                    payment.status === 'Paid' &&
                    teamPaymentRecords.some(record =>
                        record.teamMemberId === payment.teamMemberId &&
                        record.date.slice(0, 10) === oldPaymentDate &&
                        record.projectPaymentIds.includes(payment.id)
                    )
                );
                const linkedRecord = linkedPayment && teamPaymentRecords.find(record =>
                    record.teamMemberId === linkedPayment.teamMemberId &&
                    record.date.slice(0, 10) === oldPaymentDate &&
                    record.projectPaymentIds.includes(linkedPayment.id)
                );

                if (linkedPayment && linkedRecord) {
                    try {
                        const [savedPayment] = await updateTeamProjectPaymentsApi([{
                            ...linkedPayment,
                            fee: updated.amount,
                        }]);
                        const savedRecord = await updateTeamPaymentRecordApi(linkedRecord.id, {
                            totalAmount: Math.max(0, linkedRecord.totalAmount + updated.amount - linkedPayment.fee),
                        });
                        setTeamProjectPayments(prev => prev.map(payment =>
                            payment.id === savedPayment.id ? savedPayment : payment,
                        ));
                        setTeamPaymentRecords(prev => prev.map(record =>
                            record.id === savedRecord.id ? savedRecord : record,
                        ));
                    } catch (syncError) {
                        teamPaymentSyncFailed = true;
                        console.error('[Finance] Gagal menyinkronkan perubahan pembayaran tim ke slip.', syncError);
                    }
                }
            }

            showNotification(teamPaymentSyncFailed
                ? 'Transaksi berubah, tetapi rincian pembayaran tim gagal disinkronkan.'
                : 'Transaksi berhasil diperbarui.');
            return updated;
        } catch (err) {
            showNotification('Gagal memperbarui transaksi.');
            throw err;
        }
    }, [transactions, setTransactions, setCards, setPockets, pockets, showNotification, teamProjectPayments, setTeamProjectPayments, teamPaymentRecords, setTeamPaymentRecords]);

    const handleDelete = useCallback(async (type: 'transaction' | 'pocket' | 'card', id: string) => {
        if (type === 'card') {
            const referenced = transactions.some(t => t.cardId === id) || pockets.some(p => p.sourceCardId === id);
            const msg = referenced
                ? 'Kartu ini terhubung dengan transaksi/kantong. Sistem akan melepas keterhubungan lalu menghapus kartu. Lanjutkan?'
                : 'Yakin ingin menghapus kartu ini?';
            if (!window.confirm(msg)) return;
            try {
                if (referenced) {
                    await safeDeleteCard(id);
                } else {
                    await deleteCardRow(id);
                }
                setCards(p => p.filter(i => i.id !== id));
                showNotification('Kartu berhasil dihapus.');
            } catch (err) {
                alert('Gagal menghapus kartu di database. Coba lagi.');
            }
            return;
        }
        if (!window.confirm('Yakin ingin menghapus item ini?')) return;
        if (type === 'transaction') {
            try {
                const tx = transactions.find(t => t.id === id);
                if (tx && tx.cardId) {
                    const delta = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
                    try { await updateCardBalance(tx.cardId, delta); } catch { }
                    setCards(prev => prev.map(c => c.id === tx.cardId ? { ...c, balance: c.balance + delta } : c));
                }
                if (tx && tx.pocketId) {
                    const pocket = pockets.find(p => p.id === tx.pocketId);
                    if (pocket) {
                        const delta = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
                        const newAmount = pocket.amount + delta;
                        setPockets(prev => prev.map(p => p.id === tx.pocketId ? { ...p, amount: newAmount } : p));
                        try { await updatePocketRow(tx.pocketId, { amount: newAmount }); } catch { }
                    }
                }
                await deleteTransactionApi(id);
                setTransactions(p => p.filter(i => i.id !== id));
                showNotification('Transaksi berhasil dihapus.');
            } catch (e) {
                alert('Gagal menghapus transaksi di database. Coba lagi.');
            }
            return;
        }
        if (type === 'pocket') {
            if (!window.confirm('Yakin ingin menghapus kantong ini?')) return;
            try {
                await deletePocketRow(id);
            } catch (e) {
                alert('Gagal menghapus kantong di database. Coba lagi.');
                return;
            }
            setPockets(p => p.filter(i => i.id !== id));
        }
    }, [transactions, setTransactions, pockets, setPockets, cards, setCards, showNotification]);

    return {
        handleAddTransaction,
        handleUpdateTransaction,
        handleDelete
    };
};
