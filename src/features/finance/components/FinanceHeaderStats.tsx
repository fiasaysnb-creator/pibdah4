import React from 'react';
import { ModernStatCard } from '../../../components/modernize/ModernStatCard';
import { CreditCardIcon, ClipboardListIcon, ArrowUpIcon, ArrowDownIcon } from '../../../constants';
import { formatCurrency } from '../../../utils/currency';
import { Scale } from 'lucide-react';

interface FinanceHeaderStatsProps {
    summary: {
        totalAssets: number;
        pocketsTotal: number;
        totalIncomeThisMonth: number;
        totalExpenseThisMonth: number;
    };
    /** All-time totals computed from full transactions list */
    allTimeTotals: {
        income: number;
        expense: number;
    };
    setActiveStatModal: (type: 'assets' | 'pockets' | 'income' | 'expense' | null) => void;
}

export const FinanceHeaderStats: React.FC<FinanceHeaderStatsProps> = ({
    summary,
    allTimeTotals,
    setActiveStatModal,
}) => {
    const netAllTime = allTimeTotals.income - allTimeTotals.expense;
    const isProfit = netAllTime >= 0;

    return (
        <div className="space-y-2 non-printable">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 transition-all duration-300">
                {/* 1. Total Aset */}
                <div className="cursor-pointer" onClick={() => setActiveStatModal('assets')}>
                    <ModernStatCard
                        icon={<CreditCardIcon className="w-5 h-5" />}
                        title="Total Aset"
                        value={formatCurrency(summary.totalAssets)}
                        subtitle="Saldo kartu & tunai"
                        iconColorVariant="primary"
                        compactOnMobile
                    />
                </div>

                {/* 2. Dana di Kantong */}
                <div className="cursor-pointer" onClick={() => setActiveStatModal('pockets')}>
                    <ModernStatCard
                        icon={<ClipboardListIcon className="w-5 h-5" />}
                        title="Dana di Kantong"
                        value={formatCurrency(summary.pocketsTotal)}
                        subtitle="Total alokasi kantong"
                        iconColorVariant="warning"
                        compactOnMobile
                    />
                </div>

                {/* 3. Total Pemasukan (all-time) */}
                <div className="cursor-pointer" onClick={() => setActiveStatModal('income')}>
                    <ModernStatCard
                        icon={<ArrowUpIcon className="w-5 h-5" />}
                        title="Total Pemasukan"
                        value={formatCurrency(allTimeTotals.income)}
                        subtitle="Semua pemasukan"
                        iconColorVariant="success"
                        valueClassName="!text-[#166534]"
                        compactOnMobile
                    />
                </div>

                {/* 4. Total Pengeluaran (all-time) */}
                <div className="cursor-pointer" onClick={() => setActiveStatModal('expense')}>
                    <ModernStatCard
                        icon={<ArrowDownIcon className="w-5 h-5" />}
                        title="Total Pengeluaran"
                        value={formatCurrency(allTimeTotals.expense)}
                        subtitle="Semua pengeluaran"
                        iconColorVariant="error"
                        valueClassName="!text-[#DC2626]"
                        compactOnMobile
                    />
                </div>

                {/* 5. Laba / Rugi Bersih (all-time) — full width on 2-col mobile */}
                <div className="col-span-2 lg:col-span-1">
                    <ModernStatCard
                        icon={<Scale className="w-5 h-5" />}
                        title="Laba / Rugi Bersih"
                        value={formatCurrency(netAllTime)}
                        subtitle={isProfit ? 'Surplus keseluruhan' : 'Defisit keseluruhan'}
                        iconColorVariant={isProfit ? 'success' : 'error'}
                        valueClassName={isProfit ? '!text-[#166534]' : '!text-[#DC2626]'}
                        compactOnMobile
                        badge={{
                            text: isProfit ? '+ Surplus' : '- Defisit',
                            variant: isProfit ? 'success' : 'error'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
