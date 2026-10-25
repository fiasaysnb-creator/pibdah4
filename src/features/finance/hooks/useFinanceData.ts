import { useState } from 'react';
import { TransactionType, Card, FinancialPocket } from '../../../types';

export const useFinanceData = () => {
    // TABS & MODALS STATE
    const [activeTab, setActiveTab] = useState<'transactions' | 'pockets' | 'cards' | 'cashflow' | 'laporan' | 'labaAcara Pernikahan'>('transactions');
    const [modalState, setModalState] = useState<{ type: null | 'transaction' | 'pocket' | 'card' | 'transfer' | 'topup-cash', mode: 'add' | 'edit', data?: any }>({ type: null, mode: 'add' });
    const [historyModalState, setHistoryModalState] = useState<{ type: 'card' | 'pocket', item: Card | FinancialPocket | null } | null>(null);
    const [form, setForm] = useState<any>({});
    const [activeStatModal, setActiveStatModal] = useState<'assets' | 'pockets' | 'income' | 'expense' | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // FILTERS STATE
    const [filters, setFilters] = useState({ searchTerm: '', dateFrom: '', dateTo: '' });
    const [categoryFilter, setCategoryFilter] = useState<{ type: TransactionType | 'all', category: string }>({ type: 'all', category: 'Semua' });
    const [reportFilters, setReportFilters] = useState({ client: 'all', dateFrom: '', dateTo: '' });
    const [profitReportFilters, setProfitReportFilters] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
    const [transactionProjectMonthFilter, setTransactionProjectMonthFilter] = useState<string>(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    });

    // PAGINATION STATE
    const [offset, setOffset] = useState(100);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    return {
        activeTab, setActiveTab,
        modalState, setModalState,
        historyModalState, setHistoryModalState,
        form, setForm,
        activeStatModal, setActiveStatModal,
        isInfoModalOpen, setIsInfoModalOpen,
        filters, setFilters,
        categoryFilter, setCategoryFilter,
        reportFilters, setReportFilters,
        profitReportFilters, setProfitReportFilters,
        transactionProjectMonthFilter, setTransactionProjectMonthFilter,
        offset, setOffset,
        hasMore, setHasMore,
        isLoadingMore, setIsLoadingMore
    };
};
