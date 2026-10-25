import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { normalizeTransaction } from '../services/transactions';
import { normalizeClient } from '../services/clients';
import { normalizeLead } from '../services/leads';
import { normalizePocket } from '../services/pockets';
import { normalizeCard } from '../services/cards';
import { normalizeTeamMember } from '../services/teamMembers';
import { normalizePackage } from '../services/packages';
import { normalizeAddOn } from '../services/addOns';
import { normalizeClientFeedback } from '../services/clientFeedback';
import { normalizeCalendarEvent } from '../services/calendarEvents';
import { normalizeProfileRow } from '../services/profile';
import {
  useClientsQuery,
  useProjectsQuery,
  useTeamMembersQuery,
  useTransactionsQuery,
  useLeadsQuery,
  useCardsQuery,
  usePocketsQuery,
  usePackagesQuery,
  useAddOnsQuery,
  useCalendarEventsQuery,
} from '../hooks/queries';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useClientFeedback } from '../hooks/useClientFeedback';
import { useIsLightweightPublicRoute } from '../hooks/useIsLightweightPublicRoute';
import { useIsPublicFormDataRoute } from '../hooks/useIsLightweightPublicRoute';
import {
  Client,
  Project,
  TeamMember,
  Transaction,
  Lead,
  Card,
  FinancialPocket,
  Package,
  AddOn,
  ClientFeedback,
  CalendarEvent,
  Profile,
} from '../types';

interface SimplifiedDataContextType {
  // Domain data — single source of truth: React Query cache (server state from Supabase)
  clients: Client[] | undefined;
  projects: Project[] | undefined;
  teamMembers: TeamMember[] | undefined;
  transactions: Transaction[] | undefined;
  leads: Lead[] | undefined;
  cards: Card[] | undefined;
  pockets: FinancialPocket[] | undefined;
  packages: Package[] | undefined;
  addOns: AddOn[] | undefined;
  clientFeedback: ClientFeedback[] | undefined;
  calendarEvents: CalendarEvent[] | undefined;
  totals: ReturnType<typeof useDashboardStats>['data'];

  isLoading: boolean;
  loading: {
    clients: boolean;
    projects: boolean;
    teamMembers: boolean;
    transactions: boolean;
    clientFeedback: boolean;
    totals: boolean;
  };
  isError: boolean;
  error: Error | null;

  refetchAll: () => Promise<void>;
  refetchClients: () => Promise<void>;
  refetchProjects: () => Promise<void>;
  refetchTeamMembers: () => Promise<void>;
  refetchTransactions: () => Promise<void>;
  refetchClientFeedback: () => Promise<void>;
  refetchDashboardStats: () => Promise<void>;

  // Cache writers — exposed as React.Dispatch<SetStateAction<T[]>> so the
  // existing 525 call-sites that perform optimistic updates keep working.
  // Internally these write directly to the React Query cache (the only state
  // container). No duplicate local state.
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
  setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
  setAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
  setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
}

const SimplifiedDataContext = createContext<SimplifiedDataContextType | undefined>(undefined);

/**
 * Build a setter that applies React.SetStateAction<T[]> directly to the
 * React Query cache for the given key. This is the bridge that lets legacy
 * call-sites (e.g. setClients(prev => [...prev, created])) keep working
 * while making React Query the single source of truth.
 */
function makeCacheSetter<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  invalidateAfterWrite = false,
): React.Dispatch<React.SetStateAction<T[]>> {
  return (action: React.SetStateAction<T[]>) => {
    queryClient.setQueryData<T[]>([queryKey], (old) => {
      const prev = old ?? [];
      return typeof action === 'function'
        ? (action as (p: T[]) => T[])(prev)
        : action;
    });
    if (invalidateAfterWrite) {
      void queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: 'none' });
    }
  };
}

export const SimplifiedDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  // Rute publik yang tidak membutuhkan dataset vendor menahan query global dan
  // listener Realtime. Form paket/booking mempertahankan data pendukungnya.
  const isLightPublic = useIsLightweightPublicRoute();
  const isPublicFormData = useIsPublicFormDataRoute();
  const vendorOnly = { enabled: !isLightPublic };
  const publicFormData = { enabled: !isLightPublic || isPublicFormData };

  // ─── Domain queries (single source of truth) ────────────────────────────
  const { data: clients, isLoading: loadingClients, error: errorClients } = useClientsQuery(vendorOnly);
  const { data: projects, isLoading: loadingProjects, error: errorProjects } = useProjectsQuery(vendorOnly);
  const { data: teamMembers, isLoading: loadingTeamMembers, error: errorTeamMembers } = useTeamMembersQuery(vendorOnly);
  const { data: transactions, isLoading: loadingTransactions, error: errorTransactions } = useTransactionsQuery(vendorOnly);
  const { data: leads, isLoading: loadingLeads, error: errorLeads } = useLeadsQuery(publicFormData);
  const { data: cards, isLoading: loadingCards, error: errorCards } = useCardsQuery(publicFormData);
  const { data: pockets, isLoading: loadingPockets, error: errorPockets } = usePocketsQuery(vendorOnly);
  const { data: packages, isLoading: loadingPackages, error: errorPackages } = usePackagesQuery(publicFormData);
  const { data: addOns, isLoading: loadingAddOns, error: errorAddOns } = useAddOnsQuery(publicFormData);
  const { data: calendarEvents, isLoading: loadingCalendarEvents, error: errorCalendarEvents } = useCalendarEventsQuery(vendorOnly);
  const { data: clientFeedback, isLoading: loadingClientFeedback, error: errorClientFeedback } = useClientFeedback({ enabled: !isLightPublic });
  const { data: totals, isLoading: loadingTotals, error: errorTotals } = useDashboardStats({ enabled: !isLightPublic });

  const isLoading =
    loadingClients || loadingProjects || loadingTeamMembers ||
    loadingTransactions || loadingLeads || loadingCards ||
    loadingPockets || loadingPackages || loadingAddOns ||
    loadingCalendarEvents || loadingClientFeedback || loadingTotals;

  const error =
    errorClients || errorProjects || errorTeamMembers ||
    errorTransactions || errorLeads || errorCards ||
    errorPockets || errorPackages || errorAddOns ||
    errorCalendarEvents || errorClientFeedback || errorTotals;

  const isError = !!error;

  // ─── Cache setters (functional; replace previous stub no-ops) ──────────
  const setClients = useCallback(makeCacheSetter<Client>(queryClient, 'clients', isLightPublic), [queryClient, isLightPublic]);
  const setProjects = useCallback(makeCacheSetter<Project>(queryClient, 'projects', isLightPublic), [queryClient, isLightPublic]);
  const setTeamMembers = useCallback(makeCacheSetter<TeamMember>(queryClient, 'teamMembers'), [queryClient]);
  const setTransactions = useCallback(makeCacheSetter<Transaction>(queryClient, 'transactions'), [queryClient]);
  const setLeads = useCallback(makeCacheSetter<Lead>(queryClient, 'leads'), [queryClient]);
  const setCards = useCallback(makeCacheSetter<Card>(queryClient, 'cards'), [queryClient]);
  const setPockets = useCallback(makeCacheSetter<FinancialPocket>(queryClient, 'pockets'), [queryClient]);
  const setPackages = useCallback(makeCacheSetter<Package>(queryClient, 'packages'), [queryClient]);
  const setAddOns = useCallback(makeCacheSetter<AddOn>(queryClient, 'addOns'), [queryClient]);
  const setClientFeedback = useCallback(makeCacheSetter<ClientFeedback>(queryClient, 'clientFeedback'), [queryClient]);

  const refetchClients = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient]);
  const refetchProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  }, [queryClient]);
  const refetchTeamMembers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
  }, [queryClient]);
  const refetchTransactions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  }, [queryClient]);
  const refetchClientFeedback = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['clientFeedback'] });
  }, [queryClient]);
  const refetchDashboardStats = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
  }, [queryClient]);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchClients(),
      refetchProjects(),
      refetchTeamMembers(),
      refetchTransactions(),
      queryClient.invalidateQueries({ queryKey: ['leads'] }),
      queryClient.invalidateQueries({ queryKey: ['cards'] }),
      queryClient.invalidateQueries({ queryKey: ['pockets'] }),
      queryClient.invalidateQueries({ queryKey: ['packages'] }),
      queryClient.invalidateQueries({ queryKey: ['addOns'] }),
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] }),
      refetchClientFeedback(),
      refetchDashboardStats(),
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: ['teamProjectPayments'] }),
      queryClient.invalidateQueries({ queryKey: ['teamPaymentRecords'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  }, [queryClient, refetchClients, refetchProjects, refetchTeamMembers, refetchTransactions, refetchClientFeedback, refetchDashboardStats]);

  // ─── Realtime: Supabase → React Query cache (no double state) ──────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    // Pengunjung halaman publik tidak membutuhkan sinkronisasi live; menahan
    // socket + 18 listener juga mencegah setiap perubahan di sisi vendor
    // memicu invalidate/refetch berulang di tab pengunjung.
    if (isLightPublic) {
      return;
    }

    const channel = supabase.channel('global-realtime-channel');
    const pendingInvalidations = new Map<string, number>();
    const scheduleInvalidation = (queryKey: string) => {
      if (pendingInvalidations.has(queryKey)) return;
      const timer = window.setTimeout(() => {
        pendingInvalidations.delete(queryKey);
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }, 300);
      pendingInvalidations.set(queryKey, timer);
    };

    const makeHandler = <T extends { id: string }>(
      queryKey: string,
      normalize: (row: any) => T,
      options: { sortByDateDesc?: boolean; tempIdPrefixes?: string[]; amountMatchField?: keyof T; invalidateQueryKeys?: string[] } = {},
    ) => (payload: any) => {
      options.invalidateQueryKeys?.forEach((key) => {
        scheduleInvalidation(key);
      });
      if (!queryClient.getQueryData<T[]>([queryKey])) {
        scheduleInvalidation(queryKey);
        return;
      }

      queryClient.setQueryData<T[]>([queryKey], (old) => {
        if (!old) return old;
        const ev = payload.eventType;

        if (ev === 'INSERT' || ev === 'UPDATE') {
          const next = normalize(payload.new);
          const idx = old.findIndex((it) => it.id === next.id);
          if (idx !== -1) {
            const copy = old.slice();
            copy[idx] = { ...copy[idx], ...next };
            return copy;
          }
          if (options.tempIdPrefixes && options.amountMatchField) {
            const tempIdx = old.findIndex((t: any) =>
              options.tempIdPrefixes!.some((p) => String(t.id).startsWith(p)) &&
              t.projectId === (next as any).projectId &&
              Math.abs(Number(t[options.amountMatchField!]) - Number((next as any)[options.amountMatchField!])) < 0.01,
            );
            if (tempIdx !== -1) {
              const copy = old.slice();
              copy[tempIdx] = next;
              return copy;
            }
          }
          const merged = [next, ...old];
          if (options.sortByDateDesc) {
            merged.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          }
          return merged;
        }
        if (ev === 'DELETE') {
          const deletedId = payload.old?.id;
          return old.filter((it) => it.id !== deletedId);
        }
        return old;
      });
    };

    const addOnsRealtimeHandler = makeHandler<AddOn>('addOns', normalizeAddOn);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' },
        makeHandler<Transaction>('transactions', normalizeTransaction, {
          sortByDateDesc: true,
          tempIdPrefixes: ['TRN-PAY-', 'TRN-DP-'],
          amountMatchField: 'amount' as keyof Transaction,
          invalidateQueryKeys: ['dashboardStats'],
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' },
        makeHandler<Client>('clients', normalizeClient, { invalidateQueryKeys: ['dashboardStats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        scheduleInvalidation('projects');
        scheduleInvalidation('dashboardStats');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' },
        makeHandler<Card>('cards', normalizeCard))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pockets' },
        makeHandler<FinancialPocket>('pockets', normalizePocket))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },
        makeHandler<Lead>('leads', normalizeLead, { invalidateQueryKeys: ['dashboardStats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' },
        makeHandler<TeamMember>('teamMembers', normalizeTeamMember, { invalidateQueryKeys: ['projects', 'dashboardStats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' },
        makeHandler<Package>('packages', normalizePackage))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'add_ons' }, (payload: any) => {
        // Snapshot add-on pada proyek hanya menyimpan nama & harga. Perubahan
        // kolom lain (region, deskripsi, urutan) tidak perlu memuat ulang
        // dataset proyek yang besar.
        const row = payload.new;
        let isDisplayChange = true;
        if (payload.eventType === 'UPDATE' && row) {
          const next = normalizeAddOn(row);
          const prev = queryClient.getQueryData<AddOn[]>(['addOns'])?.find((a) => a.id === next.id);
          if (prev) {
            isDisplayChange = prev.name !== next.name || Number(prev.price) !== Number(next.price);
          }
        }
        if (isDisplayChange) {
          scheduleInvalidation('projects');
        }
        addOnsRealtimeHandler(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_feedback' },
        makeHandler<ClientFeedback>('clientFeedback', normalizeClientFeedback))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' },
        makeHandler<CalendarEvent>('calendarEvents', normalizeCalendarEvent))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_add_ons' }, () => {
        scheduleInvalidation('projects');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_team_assignments' }, () => {
        scheduleInvalidation('projects');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, () => {
        scheduleInvalidation('promoCodes');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        const row = payload.eventType === 'DELETE' ? null : payload.new;
        const cached = queryClient.getQueryData<Profile>(['profile']);
        if (!row || !cached || row.id !== cached.id) {
          scheduleInvalidation('profile');
          return;
        }
        queryClient.setQueryData<Profile>(['profile'], normalizeProfileRow(row));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_project_payments' }, () => {
        scheduleInvalidation('teamProjectPayments');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_payment_records' }, () => {
        scheduleInvalidation('teamPaymentRecords');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        scheduleInvalidation('notifications');
      })
      .subscribe((status, subscribeError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription unavailable; continuing without live sync.', { status, subscribeError });
        }
      });

    return () => {
      pendingInvalidations.forEach((timer) => window.clearTimeout(timer));
      pendingInvalidations.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient, isLightPublic]);

  const value = useMemo<SimplifiedDataContextType>(() => ({
    clients,
    projects,
    teamMembers,
    transactions,
    leads,
    cards,
    pockets,
    packages,
    addOns,
    clientFeedback,
    calendarEvents,
    totals,
    isLoading,
    loading: {
      clients: loadingClients,
      projects: loadingProjects,
      teamMembers: loadingTeamMembers,
      transactions: loadingTransactions,
      clientFeedback: loadingClientFeedback,
      totals: loadingTotals,
    },
    isError,
    error,
    refetchAll,
    refetchClients,
    refetchProjects,
    refetchTeamMembers,
    refetchTransactions,
    refetchClientFeedback,
    refetchDashboardStats,
    setClients,
    setProjects,
    setTeamMembers,
    setTransactions,
    setLeads,
    setCards,
    setPockets,
    setPackages,
    setAddOns,
    setClientFeedback,
  }), [
    clients, projects, teamMembers, transactions, leads, cards, pockets,
    packages, addOns, clientFeedback, calendarEvents, totals,
    isLoading, loadingClients, loadingProjects, loadingTeamMembers, loadingTransactions,
    loadingClientFeedback, loadingTotals, isError, error, refetchAll,
    refetchClients, refetchProjects, refetchTeamMembers, refetchTransactions,
    refetchClientFeedback, refetchDashboardStats,
    setClients, setProjects, setTeamMembers, setTransactions, setLeads,
    setCards, setPockets, setPackages, setAddOns, setClientFeedback,
  ]);

  return (
    <SimplifiedDataContext.Provider value={value}>
      {children}
    </SimplifiedDataContext.Provider>
  );
};

export const useSimplifiedData = () => {
  const ctx = useContext(SimplifiedDataContext);
  if (ctx === undefined) {
    throw new Error('useSimplifiedData must be used within a SimplifiedDataProvider');
  }
  return ctx;
};
