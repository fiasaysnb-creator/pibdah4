import React, { useState, useMemo } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Trash2,
  X,
  ExternalLink,
  Sparkles,
  CalendarCheck,
  Clock,
  DollarSign,
  MessageSquare,
  Users,
  AlertTriangle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Notification, ViewType, NavigationAction } from '../../types';

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification?: (notificationId: string) => void;
}

type FilterTab = 'all' | 'unread';

interface CategoryConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

/**
 * Format timestamp into human-readable Indonesian relative time
 */
export function formatRelativeTimeIndo(timestamp: string): string {
  try {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000));

    if (diffInSeconds < 45) return 'Baru saja';
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) return `${minutes} mnt lalu`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Kemarin';
    if (days < 7) return `${days} hari lalu`;

    return past.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Beberapa saat lalu';
  }
}

/**
 * Get category styling & icon based on notification properties
 */
export function getCategoryConfig(notif: Notification): CategoryConfig {
  const iconKey = notif.icon;
  const titleLower = (notif.title || '').toLowerCase();
  const msgLower = (notif.message || '').toLowerCase();

  // 1. Leads / Calon Pengantin (Indigo)
  if (
    iconKey === 'lead' ||
    titleLower.includes('lead') ||
    titleLower.includes('calon pengantin') ||
    msgLower.includes('calon pengantin')
  ) {
    return {
      label: 'LEADS',
      badgeText: 'LEADS',
      badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
      iconBg: 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      icon: <Sparkles className="w-4 h-4" />,
    };
  }

  // 2. Pembayaran / Finance (Hijau)
  if (
    iconKey === 'payment' ||
    titleLower.includes('bayar') ||
    titleLower.includes('lunas') ||
    titleLower.includes('dp') ||
    msgLower.includes('rp') ||
    msgLower.includes('transfer')
  ) {
    return {
      label: 'PEMBAYARAN',
      badgeText: 'PEMBAYARAN',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      iconBg: 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      icon: <DollarSign className="w-4 h-4" />,
    };
  }

  // 3. Booking / Acara (Biru)
  if (
    titleLower.includes('booking') ||
    titleLower.includes('jadwal') ||
    titleLower.includes('acara') ||
    notif.link?.view === ViewType.BOOKING
  ) {
    return {
      label: 'BOOKING',
      badgeText: 'BOOKING',
      badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
      iconBg: 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none',
      iconColor: 'text-blue-600 dark:text-blue-400',
      icon: <CalendarCheck className="w-4 h-4" />,
    };
  }

  // 4. Pengingat / Deadline (Oranye)
  if (
    iconKey === 'deadline' ||
    titleLower.includes('pengingat') ||
    titleLower.includes('deadline') ||
    titleLower.includes('tenggat')
  ) {
    return {
      label: 'PENGINGAT',
      badgeText: 'PENGINGAT',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
      iconBg: 'bg-amber-600 text-white shadow-amber-200 dark:shadow-none',
      iconColor: 'text-amber-600 dark:text-amber-400',
      icon: <Clock className="w-4 h-4" />,
    };
  }

  // 5. Peringatan / Warning (Merah)
  if (
    titleLower.includes('peringatan') ||
    titleLower.includes('batal') ||
    titleLower.includes('gagal') ||
    titleLower.includes('ditolak')
  ) {
    return {
      label: 'PERINGATAN',
      badgeText: 'PERINGATAN',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
      iconBg: 'bg-rose-600 text-white shadow-rose-200 dark:shadow-none',
      iconColor: 'text-rose-600 dark:text-rose-400',
      icon: <AlertTriangle className="w-4 h-4" />,
    };
  }

  // 6. Aktivitas Tim / Feedback / Komentar (Ungu)
  if (
    iconKey === 'feedback' ||
    iconKey === 'comment' ||
    titleLower.includes('tim') ||
    titleLower.includes('feedback') ||
    titleLower.includes('ulasan')
  ) {
    return {
      label: 'TIM & ULASAN',
      badgeText: 'TIM & ULASAN',
      badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
      iconBg: 'bg-purple-600 text-white shadow-purple-200 dark:shadow-none',
      iconColor: 'text-purple-600 dark:text-purple-400',
      icon: <Users className="w-4 h-4" />,
    };
  }

  // Default / Umum (Biru Netral)
  return {
    label: 'INFO',
    badgeText: 'INFO',
    badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
    iconBg: 'bg-sky-600 text-white shadow-sky-200 dark:shadow-none',
    iconColor: 'text-sky-600 dark:text-sky-400',
    icon: <Bell className="w-4 h-4" />,
  };
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );
  const readNotifications = useMemo(
    () => notifications.filter((n) => n.isRead),
    [notifications]
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return unreadNotifications;
    }
    return notifications;
  }, [activeTab, unreadNotifications, notifications]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[70] sm:hidden transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Notification Container (Desktop Popover / Mobile Top Dropdown) */}
      <div
        role="dialog"
        aria-label="Panel Notifikasi Vena"
        className="
          fixed sm:absolute
          inset-x-0 top-[calc(4rem_+_var(--safe-area-inset-top))] sm:bottom-auto sm:top-full sm:right-0 sm:left-auto
          mt-0 sm:mt-2
          w-full sm:w-[420px] max-w-[100vw] sm:max-w-none
          max-h-[calc(100dvh_-_4rem_-_var(--safe-area-inset-top))] sm:max-h-[580px]
          bg-white dark:bg-[#1E293B]
          border-x border-b sm:border border-slate-200/80 dark:border-slate-700/80
          rounded-b-2xl sm:rounded-2xl
          shadow-2xl shadow-slate-900/20
          z-[75] sm:z-[65]
          flex flex-col
          overflow-hidden
          animate-slide-down
        "
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Panel */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Notifikasi
                  </h3>
                  {unreadNotifications.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/60">
                      {unreadNotifications.length} baru
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pemberitahuan aktivitas & pembaruan bisnis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  title="Tandai semua sudah dibaca"
                  className="
                    inline-flex items-center gap-1.5
                    px-2.5 py-1.5
                    text-xs font-semibold
                    text-blue-600 dark:text-blue-400
                    hover:text-blue-700 dark:hover:text-blue-300
                    hover:bg-blue-50 dark:hover:bg-blue-950/50
                    rounded-lg
                    transition-all
                    cursor-pointer
                  "
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tandai Dibaca</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup panel notifikasi"
                className="
                  p-1.5
                  text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                  hover:bg-slate-100 dark:hover:bg-slate-800
                  rounded-lg
                  transition-colors
                  cursor-pointer
                "
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs: Semua & Belum Dibaca */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`
                flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5
                ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <span>Semua</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-600 font-semibold">
                {notifications.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`
                flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5
                ${
                  activeTab === 'unread'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <span>Belum Dibaca</span>
              {unreadNotifications.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold">
                  {unreadNotifications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <div
          className="
            flex-1
            overflow-y-auto
            divide-y divide-slate-100 dark:divide-slate-800/60
            overscroll-contain
          "
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {displayedNotifications.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3.5 shadow-inner">
                <BellOff className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {activeTab === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                {activeTab === 'unread'
                  ? 'Bagus! Anda telah menyelesaikan semua pembaruan notifikasi.'
                  : 'Aktivitas calon pengantin baru, booking, dan pembayaran akan muncul di sini secara otomatis.'}
              </p>
              {activeTab === 'unread' && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 transition-colors"
                >
                  Lihat Riwayat Semua Notifikasi
                </button>
              )}
            </div>
          ) : (
            displayedNotifications.map((notif) => {
              const cat = getCategoryConfig(notif);
              const relativeTime = formatRelativeTimeIndo(notif.timestamp);

              return (
                <div
                  key={notif.id}
                  onClick={() => onNotificationClick(notif)}
                  className={`
                    group relative
                    p-3.5 sm:p-4
                    flex items-start gap-3.5
                    cursor-pointer
                    transition-all duration-150
                    ${
                      !notif.isRead
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                        : 'bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  `}
                >
                  {/* Left Unread Indicator Accent Bar */}
                  {!notif.isRead && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full" />
                  )}

                  {/* Category Icon Container */}
                  <div
                    className={`
                      w-9 h-9 sm:w-10 sm:h-10 rounded-xl
                      flex items-center justify-center
                      flex-shrink-0 mt-0.5
                      shadow-xs
                      ${cat.iconBg}
                    `}
                  >
                    {cat.icon}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    {/* Top Row: Category Chip & Time */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`
                          inline-flex items-center
                          px-2 py-0.5
                          rounded-md
                          text-[10px] font-bold tracking-wide uppercase
                          ${cat.badgeBg}
                        `}
                      >
                        {cat.label}
                      </span>

                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {relativeTime}
                      </span>
                    </div>

                    {/* Notification Title */}
                    <h5
                      className={`
                        text-xs sm:text-sm leading-snug mb-1
                        ${
                          !notif.isRead
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }
                      `}
                    >
                      {notif.title}
                    </h5>

                    {/* Notification Message (Max 2 lines) */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* Link Indicator Footer */}
                    {notif.link && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                        <span>Buka Halaman</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>

                  {/* Right Action Icons (Hover on Desktop, Clean Dots on Mobile) */}
                  <div
                    className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Unread Glow Dot */}
                    {!notif.isRead ? (
                      <span
                        title="Belum dibaca"
                        className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/50"
                      />
                    ) : null}

                    {/* Hover Quick Action Buttons */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notif.id);
                          }}
                          title="Tandai dibaca"
                          className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteNotification && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(notif.id);
                          }}
                          title="Hapus notifikasi"
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-center flex-shrink-0">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Terhubung ke Supabase Realtime &amp; Web Push Notification
          </p>
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
