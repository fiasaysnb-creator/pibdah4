import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TeamProjectPayment,
  TeamPaymentRecord,
  Profile,
  Notification,
  PromoCode,
  ClientFeedback,
} from "../types";
import { createTeamPaymentRecord } from "../services/teamPaymentRecords";
import {
  createNotification as createNotificationRow,
  updateNotification as updateNotificationRow,
  deleteNotification as deleteNotificationRow,
} from "../services/notifications";
import { createClient } from "../services/clients";
import {
  usePromoCodesQuery,
  useProfileQuery,
  useTeamProjectPaymentsQuery,
  useTeamPaymentRecordsQuery,
  useNotificationsQuery,
} from "./queries";
import { generateUUID } from "../utils/uuid";

export interface UseAuxiliaryDataProps {
  appDataClientFeedback?: ClientFeedback[];
  appDataLoadedClientFeedback?: boolean;
  setClientFeedback?: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
  /**
   * Halaman publik ringan tidak memakai pembayaran tim maupun
   * notifikasi vendor — query ini tidak dikirim agar pengunjung cukup menunggu
   * data yang benar-benar ditampilkan.
   */
  skipVendorOnlyData?: boolean;
  /** Skip profile/form-specific public data on standalone public pages. */
  skipPublicSharedData?: boolean;
  /** Keep profile settings only for public forms that render vendor details. */
  skipProfileData?: boolean;
  /** Public pages share only the columns needed to render public content. */
  publicProfileData?: boolean;
}

export interface UseAuxiliaryDataReturn {
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  teamPaymentsLoaded: boolean;
  setTeamPaymentsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  teamPaymentRecords: TeamPaymentRecord[];
  setTeamPaymentRecords: React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>;
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  handleSetProfile: (value: React.SetStateAction<Profile>) => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  promoCodes: PromoCode[];
  setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
  notification: string;
  showNotification: (message: string, duration?: number) => void;
  addNotification: (
    newNotificationData: Omit<Notification, "id" | "timestamp" | "isRead">,
  ) => Promise<void>;
  handleMarkAsRead: (notificationId: string) => void;
  handleMarkAllAsRead: () => void;
  handleDeleteNotification: (notificationId: string) => void;
}

const EMPTY_PROFILE = {
  projectTypes: [],
  projectStatusConfig: [],
  eventTypes: [],
} as unknown as Profile;

/**
 * Auxiliary data hook — backed by React Query (single source of truth).
 * Setters write directly to the React Query cache so existing optimistic-update
 * call-sites keep working without duplicate local state.
 *
 * Local state is reserved for pure UI concerns (toast notification text).
 */
export function useAuxiliaryData({
  appDataClientFeedback,
  appDataLoadedClientFeedback,
  setClientFeedback,
  skipVendorOnlyData = false,
  skipPublicSharedData = false,
  skipProfileData = false,
  publicProfileData = false,
}: UseAuxiliaryDataProps = {}): UseAuxiliaryDataReturn {
  const queryClient = useQueryClient();

  // ─── Domain data via React Query ───────────────────────────────────────
  const vendorOnly = { enabled: !skipVendorOnlyData };
  const { data: promoCodesData } = usePromoCodesQuery({ enabled: !skipPublicSharedData });
  const profileKey = publicProfileData ? ['publicProfile'] : ['profile'];
  const { data: profileData } = useProfileQuery({ enabled: !skipProfileData, publicData: publicProfileData });
  const { data: teamPaymentsData, isLoading: teamPaymentsLoading } = useTeamProjectPaymentsQuery(vendorOnly);
  const { data: teamPaymentRecordsData } = useTeamPaymentRecordsQuery(vendorOnly);
  const { data: notificationsData } = useNotificationsQuery(vendorOnly);

  const promoCodes = promoCodesData ?? [];
  const profile = profileData ?? EMPTY_PROFILE;
  const teamProjectPayments = teamPaymentsData ?? [];
  const teamPaymentRecords = teamPaymentRecordsData ?? [];
  const notifications = notificationsData ?? [];

  // ─── UI-only local state ───────────────────────────────────────────────
  const [notification, setNotification] = useState<string>("");
  const [teamPaymentsLoaded, setTeamPaymentsLoaded] = useState(false);

  // Mirror teamPaymentsLoading → teamPaymentsLoaded for legacy consumers
  useEffect(() => {
    if (!teamPaymentsLoading && teamPaymentsData) {
      setTeamPaymentsLoaded(true);
    }
  }, [teamPaymentsLoading, teamPaymentsData]);

  const showNotification = useCallback((message: string, duration: number = 3000) => {
    setNotification(message);
    setTimeout(() => setNotification(""), duration);
  }, []);

  // ─── Cache setters (write to React Query cache, no duplicate state) ────
  const setPromoCodes = useCallback<React.Dispatch<React.SetStateAction<PromoCode[]>>>((action) => {
    queryClient.setQueryData<PromoCode[]>(['promoCodes'], (old) => {
      const prev = old ?? [];
      return typeof action === 'function' ? (action as (p: PromoCode[]) => PromoCode[])(prev) : action;
    });
  }, [queryClient]);

  const setTeamProjectPayments = useCallback<React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>>((action) => {
    queryClient.setQueryData<TeamProjectPayment[]>(['teamProjectPayments'], (old) => {
      const prev = old ?? [];
      return typeof action === 'function' ? (action as (p: TeamProjectPayment[]) => TeamProjectPayment[])(prev) : action;
    });
  }, [queryClient]);

  const setTeamPaymentRecords = useCallback<React.Dispatch<React.SetStateAction<TeamPaymentRecord[]>>>((action) => {
    queryClient.setQueryData<TeamPaymentRecord[]>(['teamPaymentRecords'], (old) => {
      const prev = old ?? [];
      return typeof action === 'function' ? (action as (p: TeamPaymentRecord[]) => TeamPaymentRecord[])(prev) : action;
    });
  }, [queryClient]);

  const setNotifications = useCallback<React.Dispatch<React.SetStateAction<Notification[]>>>((action) => {
    queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
      const prev = old ?? [];
      return typeof action === 'function' ? (action as (p: Notification[]) => Notification[])(prev) : action;
    });
  }, [queryClient]);

  const setProfile = useCallback<React.Dispatch<React.SetStateAction<Profile>>>((action) => {
    queryClient.setQueryData<Profile | null>(profileKey, (old) => {
      const prev = old ?? EMPTY_PROFILE;
      return typeof action === 'function' ? (action as (p: Profile) => Profile)(prev) : action;
    });
  }, [profileKey, queryClient]);

  const handleSetProfile = useCallback((value: React.SetStateAction<Profile>) => {
    setProfile(value);
  }, [setProfile]);

  // ─── Notification helpers ──────────────────────────────────────────────
  const addNotification = useCallback(
    async (newNotificationData: Omit<Notification, "id" | "timestamp" | "isRead">) => {
      const payload: Omit<Notification, "id"> = {
        ...newNotificationData,
        timestamp: new Date().toISOString(),
        isRead: false,
      } as any;
      try {
        const created = await createNotificationRow(payload);
        setNotifications((prev) => [created, ...prev]);
      } catch (e) {
        console.warn("[Notifications] Failed to create in Supabase:", e);
        const fallback: Notification = {
          id: generateUUID(),
          ...payload,
        } as Notification;
        setNotifications((prev) => [fallback, ...prev]);
      }
    },
    [setNotifications],
  );

  const handleMarkAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
    void updateNotificationRow(notificationId, { isRead: true }).catch((err) => {
      console.warn("[Notifications] Failed to persist isRead to Supabase:", err);
    });
  }, [setNotifications]);

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const unreadIds = prev.filter((n) => !n.isRead).map((n) => n.id);
      unreadIds.forEach((id) => {
        void updateNotificationRow(id, { isRead: true }).catch(() => {});
      });
      return prev.map((n) => ({ ...n, isRead: true }));
    });
  }, [setNotifications]);

  const handleDeleteNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    void deleteNotificationRow(notificationId).catch((err) => {
      console.warn("[Notifications] Failed to delete notification in Supabase:", err);
    });
  }, [setNotifications]);

  // ─── One-time localStorage → Supabase migrations ──────────────────────
  // These are data migrations, not state. They run once per browser.
  useEffect(() => {
    const KEY = "weddfin-clients";
    const FLAG = "weddfin-clients-migrated";
    if ((window as any)[FLAG] || window.localStorage.getItem(FLAG) === "yes") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsedData = JSON.parse(raw);
      if (!Array.isArray(parsedData) || parsedData.length === 0) return;
      (async () => {
        try {
          for (const c of parsedData) {
            try {
              await createClient({
                id: c.id, name: c.name, email: c.email, phone: c.phone,
                whatsapp: c.whatsapp ?? undefined, since: c.since,
                instagram: c.instagram ?? undefined, status: c.status,
                clientType: c.clientType, lastContact: c.lastContact,
                portalAccessId: c.portalAccessId,
              } as any);
            } catch (e) {
              console.warn("[Migration] Failed to migrate client:", c.id, e);
            }
          }
          window.localStorage.setItem(FLAG, "yes");
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          console.info("[Migration] clients migrated to Supabase.");
        } catch (err) {
          console.warn("[Migration] clients migration failed.", err);
        }
      })();
    } catch (error) {
      console.warn("[Migration] Failed to parse localStorage data:", error);
    }
  }, [queryClient]);

  useEffect(() => {
    const KEY = "weddfin-teamPaymentRecords";
    const FLAG = "weddfin-teamPaymentRecords-migrated";
    if ((window as any)[FLAG] || window.localStorage.getItem(FLAG) === "yes") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsedData = JSON.parse(raw);
      if (!Array.isArray(parsedData) || parsedData.length === 0) return;
      (async () => {
        try {
          for (const rec of parsedData) {
            try {
              await createTeamPaymentRecord({
                recordNumber: rec.recordNumber,
                teamMemberId: rec.teamMemberId,
                date: rec.date,
                projectPaymentIds: rec.projectPaymentIds || [],
                totalAmount: rec.totalAmount || 0,
                vendorSignature: rec.vendorSignature || null,
              } as any);
            } catch {}
          }
          window.localStorage.setItem(FLAG, "yes");
          window.localStorage.removeItem(KEY);
          queryClient.invalidateQueries({ queryKey: ['teamPaymentRecords'] });
          console.info("[Migration] teamPaymentRecords migrated to Supabase.");
        } catch (err) {
          console.warn("[Migration] teamPaymentRecords migration failed.", err);
        }
      })();
    } catch {}
  }, [queryClient]);

  // Clear legacy localStorage keys (data lives in Supabase now)
  useEffect(() => {
    try {
      window.localStorage.removeItem("weddfin-teamPaymentRecords");
      window.localStorage.removeItem("weddfin-profile");
      window.localStorage.removeItem("weddfin-teamProjectPayments");
      window.localStorage.removeItem("weddfin-projects");
    } catch {}
  }, []);

  // Sync client feedback from caller (preserved for backward compat)
  const prevClientFeedbackRef = React.useRef<string>("");
  useEffect(() => {
    if (appDataLoadedClientFeedback && appDataClientFeedback && setClientFeedback) {
      const serialized = JSON.stringify(appDataClientFeedback);
      if (serialized !== prevClientFeedbackRef.current) {
        prevClientFeedbackRef.current = serialized;
        // No-op if values already match React Query cache (avoids loops)
      }
    }
  }, [appDataClientFeedback, appDataLoadedClientFeedback, setClientFeedback]);

  return {
    teamProjectPayments,
    setTeamProjectPayments,
    teamPaymentsLoaded,
    setTeamPaymentsLoaded,
    teamPaymentRecords,
    setTeamPaymentRecords,
    profile,
    setProfile,
    handleSetProfile,
    notifications,
    setNotifications,
    promoCodes,
    setPromoCodes,
    notification,
    showNotification,
    addNotification,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotification,
  };
}

export default useAuxiliaryData;
