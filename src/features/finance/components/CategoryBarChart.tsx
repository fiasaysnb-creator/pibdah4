import React from 'react';
import { formatCurrency } from '../../../utils/currency';

interface CategoryBarChartProps {
    data: { label: string; value: number; color: string }[];
    emptyMessage?: string;
    compact?: boolean;
}

const CategoryBarChart: React.FC<CategoryBarChartProps> = ({ data, emptyMessage = 'Tidak ada data untuk ditampilkan', compact = false }) => {
    const maxValue = Math.max(...data.map(item => item.value), 0);

    if (maxValue <= 0) {
        return <p className="py-10 text-center text-xs text-[#5A6A85]">{emptyMessage}</p>;
    }

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'} role="list">
            {data.map(item => (
                <div key={item.label} className={compact ? 'space-y-1' : 'space-y-1.5'} role="listitem">
                    <div className={`flex items-center justify-between gap-3 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                        <span className="min-w-0 truncate font-medium text-[#5A6A85]" title={item.label}>{item.label}</span>
                        <span className="shrink-0 font-bold text-[#2A3547]">{formatCurrency(item.value)}</span>
                    </div>
                    <div className={`${compact ? 'h-1.5' : 'h-2.5'} overflow-hidden rounded-full bg-[#F4F6F9]`} aria-hidden="true">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${Math.max(0, Math.min(100, (item.value / maxValue) * 100))}%`,
                                backgroundColor: item.color
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CategoryBarChart;
