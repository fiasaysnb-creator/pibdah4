import React from 'react';
import { UsersIcon, UserCheckIcon, FileTextIcon, HistoryIcon } from '../../../constants';

export type MainTab = 'team' | 'vendor' | 'bukti' | 'analytics';

interface TabConfig {
  id: MainTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'default' | 'danger';
}

interface TeamTabNavProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  teamCount: number;
  vendorCount: number;
  unpaidCount: number;
}

const TeamTabNav: React.FC<TeamTabNavProps> = ({
  activeTab,
  onTabChange,
  teamCount,
  vendorCount,
  unpaidCount,
}) => {
  const tabs: TabConfig[] = [
    {
      id: 'team',
      label: 'Tim Internal',
      icon: UsersIcon,
      badge: teamCount,
      badgeVariant: 'default',
    },
    {
      id: 'vendor',
      label: 'Vendor Eksternal',
      icon: UserCheckIcon,
      badge: vendorCount,
      badgeVariant: 'default',
    },
    {
      id: 'bukti',
      label: 'Bukti Pembayaran',
      icon: FileTextIcon,
    },
    {
      id: 'analytics',
      label: 'Analitik & Performa',
      icon: HistoryIcon,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:p-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold border
              transition-all duration-200 whitespace-nowrap
              ${isActive
                ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
                : 'bg-[#F8FAFC] text-[#5A6A85] border-slate-200 hover:text-[#2A3547] hover:bg-brand-accent/10 hover:border-brand-accent/30'
              }
            `}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">
              {tab.id === 'team' ? 'Tim' : tab.id === 'vendor' ? 'Vendor' : tab.id === 'bukti' ? 'Bukti' : 'Analitik'}
            </span>
            {tab.badge !== undefined && (
              <span
                className={`
                  text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none
                  ${tab.badgeVariant === 'danger'
                    ? isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-red-600 text-white border border-red-600'
                    : isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-white text-[#2A3547] border border-slate-200'
                  }
                `}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TeamTabNav;
