import { Client, Project, Transaction, Lead, TeamMember, TeamProjectPayment, TeamPaymentRecord, PromoCode } from '../types';

/**
 * Safely parse date string to timestamp number.
 * Returns 0 if invalid or undefined.
 */
export function parseTimestamp(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Compare two items by date/timestamp descending, then by id descending as tiebreaker.
 */
export function compareTimestampsDesc(
  dateA?: string | null,
  dateB?: string | null,
  idA?: string,
  idB?: string
): number {
  const timeA = parseTimestamp(dateA);
  const timeB = parseTimestamp(dateB);

  if (timeB !== timeA) {
    return timeB - timeA;
  }

  // Tiebreaker by ID DESC
  if (idA && idB) {
    return idB.localeCompare(idA);
  }
  return 0;
}

/**
 * Compare two items by date/timestamp ascending, then by id ascending as tiebreaker.
 */
export function compareTimestampsAsc(
  dateA?: string | null,
  dateB?: string | null,
  idA?: string,
  idB?: string
): number {
  const timeA = parseTimestamp(dateA);
  const timeB = parseTimestamp(dateB);

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  if (idA && idB) {
    return idA.localeCompare(idB);
  }
  return 0;
}

/**
 * CLIENT SORTING
 * Default: Terbaru Dibuat (ORDER BY created_at DESC, id DESC)
 */
export type ClientSortOption = 'created_desc' | 'updated_desc' | 'name_asc';

export function sortClients(clients: Client[], sortBy: ClientSortOption = 'created_desc'): Client[] {
  return [...clients].sort((a, b) => {
    if (sortBy === 'updated_desc') {
      const dateA = a.updatedAt || a.createdAt || a.since;
      const dateB = b.updatedAt || b.createdAt || b.since;
      return compareTimestampsDesc(dateA, dateB, a.id, b.id);
    }
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    }
    // Default: created_desc
    const dateA = a.createdAt || a.since;
    const dateB = b.createdAt || b.since;
    return compareTimestampsDesc(dateA, dateB, a.id, b.id);
  });
}

/**
 * PROJECT SORTING
 * Default: Terbaru Dibuat (ORDER BY created_at DESC, id DESC)
 */
export type ProjectSortOption = 'created_desc' | 'event_asc' | 'event_desc' | 'updated_desc';

export function sortProjects(projects: Project[], sortBy: ProjectSortOption = 'created_desc'): Project[] {
  return [...projects].sort((a, b) => {
    if (sortBy === 'event_asc') {
      // Acara Terdekat
      return compareTimestampsAsc(a.date, b.date, a.id, b.id);
    }
    if (sortBy === 'event_desc') {
      // Acara Terjauh / Terlama
      return compareTimestampsDesc(a.date, b.date, a.id, b.id);
    }
    if (sortBy === 'updated_desc') {
      // Terakhir Diupdate
      const dateA = a.updatedAt || a.createdAt || (a.statusHistory && a.statusHistory.length > 0 ? a.statusHistory[a.statusHistory.length - 1].timestamp : a.date);
      const dateB = b.updatedAt || b.createdAt || (b.statusHistory && b.statusHistory.length > 0 ? b.statusHistory[b.statusHistory.length - 1].timestamp : b.date);
      return compareTimestampsDesc(dateA, dateB, a.id, b.id);
    }
    // Default: Terbaru Dibuat (created_desc)
    const dateA = a.createdAt || (a.statusHistory && a.statusHistory.length > 0 ? a.statusHistory[0].timestamp : undefined) || a.date;
    const dateB = b.createdAt || (b.statusHistory && b.statusHistory.length > 0 ? b.statusHistory[0].timestamp : undefined) || b.date;
    return compareTimestampsDesc(dateA, dateB, a.id, b.id);
  });
}

/**
 * BOOKING SORTING
 * Modes:
 * - 'created_desc': Terbaru Dibuat (default)
 * - 'event_asc': Tanggal Acara (Acara Terdekat)
 */
export type BookingSortOption = 'created_desc' | 'event_asc';

export function sortBookings<T extends { lead?: { date?: string; createdAt?: string }; project: Project }>(
  bookings: T[],
  sortBy: BookingSortOption = 'created_desc'
): T[] {
  return [...bookings].sort((a, b) => {
    if (sortBy === 'event_asc') {
      // ORDER BY project.date ASC
      return compareTimestampsAsc(a.project.date, b.project.date, a.project.id, b.project.id);
    }
    // Default: Terbaru Dibuat (ORDER BY created_at DESC, id DESC)
    const dateA = a.project.createdAt || (a.project.statusHistory?.[0]?.timestamp) || a.lead?.createdAt || a.lead?.date || a.project.date;
    const dateB = b.project.createdAt || (b.project.statusHistory?.[0]?.timestamp) || b.lead?.createdAt || b.lead?.date || b.project.date;
    return compareTimestampsDesc(dateA, dateB, a.project.id, b.project.id);
  });
}

/**
 * TRANSACTION SORTING
 * Requirement: ORDER BY transaction_date DESC, created_at DESC, id DESC
 */
export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    // 1. Primary business date: date (transaction_date) DESC
    const timeA = parseTimestamp(a.date);
    const timeB = parseTimestamp(b.date);
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // 2. Secondary: created_at DESC
    const createTimeA = parseTimestamp(a.createdAt);
    const createTimeB = parseTimestamp(b.createdAt);
    if (createTimeB !== createTimeA) {
      return createTimeB - createTimeA;
    }

    // 3. Tiebreaker: id DESC
    return (b.id || '').localeCompare(a.id || '');
  });
}

/**
 * LEAD SORTING
 * Default: ORDER BY created_at DESC, date DESC, id DESC
 */
export function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const dateA = a.createdAt || a.date;
    const dateB = b.createdAt || b.date;
    return compareTimestampsDesc(dateA, dateB, a.id, b.id);
  });
}

/**
 * TEAM MEMBER SORTING
 * Default: ORDER BY created_at DESC, id DESC
 */
export function sortTeamMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.createdAt || b.createdAt) {
      return compareTimestampsDesc(a.createdAt, b.createdAt, a.id, b.id);
    }
    return (b.id || '').localeCompare(a.id || '');
  });
}

/**
 * TEAM PAYMENT SORTING
 * Default: ORDER BY payment_date DESC, id DESC
 */
export function sortTeamPayments(payments: TeamProjectPayment[]): TeamProjectPayment[] {
  return [...payments].sort((a, b) => {
    return compareTimestampsDesc(a.date, b.date, a.id, b.id);
  });
}

/**
 * TEAM PAYMENT RECORD SORTING
 * Default: ORDER BY date DESC, id DESC
 */
export function sortTeamPaymentRecords(records: TeamPaymentRecord[]): TeamPaymentRecord[] {
  return [...records].sort((a, b) => {
    return compareTimestampsDesc(a.date, b.date, a.id, b.id);
  });
}

/**
 * PROMO CODE SORTING
 * Default: ORDER BY created_at DESC, id DESC
 */
export function sortPromoCodes(codes: PromoCode[]): PromoCode[] {
  return [...codes].sort((a, b) => {
    return compareTimestampsDesc(a.createdAt, b.createdAt, a.id, b.id);
  });
}
