import { useQuery } from '@tanstack/react-query';
import { listClients } from '../services/clients';
import { listProjectsWithRelations, listProjectPackageIds } from '../services/projects';
import { listTransactions } from '../services/transactions';
import { listTeamMembers } from '../services/teamMembers';
import { listLeads } from '../services/leads';
import { listCards, normalizeCard } from '../services/cards';
import { listPockets } from '../services/pockets';
import { listPackages } from '../services/packages';
import { listAddOns } from '../services/addOns';
import { listCalendarEvents } from '../services/calendarEvents';
import { listPromoCodes } from '../services/promoCodes';
import { getProfile, getPublicProfile } from '../services/profile';
import { listAllTeamPayments } from '../services/teamProjectPayments';
import { listTeamPaymentRecords } from '../services/teamPaymentRecords';
import { listNotifications } from '../services/notifications';

// Limit default fetches to 100 for performance
const DEFAULT_LIMIT = 100;
const REALTIME_STALE_TIME = 5 * 60 * 1000;

/**
 * `refetchOnWindowFocus` sengaja tidak lagi di-set per query. Data domain
 * dijaga tetap segar oleh subscription Realtime Supabase
 * (lihat SimplifiedDataContext), jadi memuat ulang seluruh dataset setiap kali
 * tab fokus hanya menambah round-trip dan payload besar tanpa nilai tambah.
 * Default global ada di main.tsx.
 */
export interface DomainQueryOptions {
  /**
   * `false` untuk halaman publik ringan: query tidak dikirim sama sekali
   * sampai halaman yang memang membutuhkannya mount.
   */
  enabled?: boolean;
  /** Return only the profile fields required by public forms/documents. */
  publicData?: boolean;
}

export const useClientsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['clients'],
    queryFn: () => listClients({ limit: DEFAULT_LIMIT }),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useProjectsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjectsWithRelations({ limit: DEFAULT_LIMIT }),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

/**
 * Lencana "Paling Populer" di halaman publik hanya butuh id paket terbanyak,
 * jadi tidak perlu ikut memuat seluruh kolom dan relasi proyek.
 */
export const useProjectPackageIdsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['projectPackageIds'],
    queryFn: () => listProjectPackageIds(),
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled !== false,
});

export const useTransactionsQuery = (options: DomainQueryOptions = {}) => useQuery({    queryKey: ['transactions'],
    queryFn: () => listTransactions({ limit: DEFAULT_LIMIT }),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useTeamMembersQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => listTeamMembers({ limit: DEFAULT_LIMIT }),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useLeadsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['leads'],
    queryFn: () => listLeads({ limit: DEFAULT_LIMIT }),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useCardsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['cards'],
    queryFn: () => listCards().then(res => res.map(normalizeCard)),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const usePocketsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['pockets'],
    queryFn: () => listPockets(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

// Gambar paket baru disimpan sebagai URL Storage; cache 5 menit mengurangi
// unduhan berulang saat navigasi, sedangkan Realtime tetap memasukkan update.
export const usePackagesQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['packages'],
    queryFn: () => listPackages(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useAddOnsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['addOns'],
    queryFn: () => listAddOns(),
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled !== false,
});

export const useCalendarEventsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => listCalendarEvents(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

// ─── Auxiliary domain queries ────────────────────────────────────────────
// Migrated from useAuxiliaryData's useEffect+useState pattern.
// React Query is the single source of truth for these too.

export const usePromoCodesQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['promoCodes'],
    queryFn: () => listPromoCodes(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useProfileQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: options.publicData ? ['publicProfile'] : ['profile'],
    queryFn: () => options.publicData ? getPublicProfile() : getProfile(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useTeamProjectPaymentsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['teamProjectPayments'],
    queryFn: () => listAllTeamPayments(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useTeamPaymentRecordsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['teamPaymentRecords'],
    queryFn: () => listTeamPaymentRecords(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});

export const useNotificationsQuery = (options: DomainQueryOptions = {}) => useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(),
    staleTime: REALTIME_STALE_TIME,
    enabled: options.enabled !== false,
});
