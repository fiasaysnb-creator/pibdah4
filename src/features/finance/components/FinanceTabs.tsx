import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    FileTextIcon, ClipboardListIcon, CreditCardIcon, TrendingUpIcon,
    BarChart2Icon, DollarSignIcon, ChevronDownIcon
} from '../../../constants';

interface FinanceTabsProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    showVisualSummary: boolean;
    setShowVisualSummary: (show: boolean) => void;
}

export const FinanceTabs: React.FC<FinanceTabsProps> = ({
    activeTab,
    setActiveTab,
    showVisualSummary,
    setShowVisualSummary
}) => {
    const [showReports, setShowReports] = useState(false);
    const [reportMenuPosition, setReportMenuPosition] = useState({ top: 0, left: 0 });
    const reportsButtonRef = useRef<HTMLButtonElement>(null);

    const toggleReports = () => {
        if (showReports) {
            setShowReports(false);
            return;
        }

        const buttonRect = reportsButtonRef.current?.getBoundingClientRect();
        if (buttonRect) {
            const menuWidth = 192;
            setReportMenuPosition({
                top: buttonRect.bottom + 8,
                left: Math.max(8, Math.min(buttonRect.left, window.innerWidth - menuWidth - 8)),
            });
        }
        setShowReports(true);
    };

    const operasionalTabs = [
        { id: 'transactions', label: 'Transaksi', icon: FileTextIcon },
        { id: 'pockets', label: 'Kantong', icon: ClipboardListIcon },
        { id: 'cards', label: 'Kartu', icon: CreditCardIcon },
        { id: 'cashflow', label: 'Arus Kas', icon: TrendingUpIcon },
    ];

    const reportTabs = [
        { id: 'laporan', label: 'Laporan Umum', icon: BarChart2Icon },
        { id: 'labaAcara Pernikahan', label: 'Laba Acara', icon: DollarSignIcon },
    ];

    const TabButton = ({ tab, isActive }: { tab: any, isActive: boolean }) => (
        <button
            onClick={() => {
                setActiveTab(tab.id);
                setShowReports(false);
            }}
            className={`
                shrink-0 inline-flex items-center gap-2 whitespace-nowrap
                min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm
                transition-all duration-200
                ${isActive
                    ? 'bg-[#5D87FF] text-white shadow-md'
                    : 'text-[#5A6A85] hover:bg-[#F4F6F9]'
                }
            `}
        >
            <tab.icon className="w-4 h-4" />
            {tab.label}
        </button>
    );

    return (
        <div className="scrollbar-hide flex w-full flex-nowrap items-center gap-1 overflow-x-auto bg-white p-2 rounded-2xl border border-[#EAEFF4] shadow-sm sm:flex-wrap sm:overflow-visible sm:gap-2">
            {/* Operasional */}
            <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:contents">
                {operasionalTabs.map(tab => (
                    <TabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} />
                ))}
            </div>

            {/* Reports Dropdown */}
            <div className="flex shrink-0 items-center gap-2 sm:contents">
            <div className="relative shrink-0">
                <button
                    ref={reportsButtonRef}
                    onClick={toggleReports}
                        className={`
                        inline-flex shrink-0 items-center gap-2 whitespace-nowrap min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm
                        ${reportTabs.some(t => t.id === activeTab) ? 'bg-[#5D87FF] text-white' : 'text-[#5A6A85] hover:bg-[#F4F6F9]'}
                    `}
                >
                    <BarChart2Icon className="w-4 h-4" />
                    Laporan
                    <ChevronDownIcon className="w-3 h-3" />
                </button>
                
                {showReports && createPortal(
                    <div
                        className="fixed w-48 bg-white border border-[#EAEFF4] rounded-xl shadow-xl z-50 p-2 space-y-1"
                        style={reportMenuPosition}
                    >
                        {reportTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setShowReports(false); }}
                                className="w-full min-h-[44px] text-left px-3 py-2 text-sm font-semibold text-[#5A6A85] hover:bg-[#F4F6F9] rounded-lg"
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
            </div>

            <div className="hidden sm:block sm:flex-1" />

            {/* Graph Toggle */}
            <button
                onClick={() => setShowVisualSummary(!showVisualSummary)}
                className={`
                    shrink-0 whitespace-nowrap min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all
                    ${showVisualSummary ? 'bg-[#ECFDF5] border-[#13DEB9] text-[#13DEB9]' : 'border-[#EAEFF4] text-[#5A6A85]'}
                `}
            >
                {showVisualSummary ? 'Tutup Grafik' : 'Grafik'}
            </button>
            </div>
        </div>
    );
};
