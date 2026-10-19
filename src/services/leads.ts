import supabase from '../lib/supabaseClient';
import { Lead, LeadStatus, ContactChannel } from '../types';

const TABLE = 'leads';

export async function listLeads(options: { limit?: number, offset?: number } = {}): Promise<Lead[]> {
  let query = supabase.from(TABLE).select('*').order('date', { ascending: false }).order('id', { ascending: false });

  if (options.limit !== undefined) {
    const from = options.offset || 0;
    const to = from + options.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeLead);
}

export async function createLead(payload: Omit<Lead, 'id'>): Promise<Lead> {
  const { data, error } = await supabase.from(TABLE).insert([denormalizeLead(payload)]).select('*').single();
  if (error) throw error;
  return normalizeLead(data);
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from(TABLE).update(denormalizeLead(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  return normalizeLead(data);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

function normalizeLeadStatus(status: unknown): LeadStatus {
  const value = typeof status === 'string' ? status.trim() : '';
  switch (value.toLowerCase().replace(/[_-]+/g, ' ')) {
    case 'discussion':
    case 'sedang diskusi':
      return LeadStatus.DISCUSSION;
    case 'follow up':
    case 'followup':
    case 'menunggu follow up':
      return LeadStatus.FOLLOW_UP;
    case 'converted':
    case 'dikonversi':
      return LeadStatus.CONVERTED;
    case 'rejected':
    case 'ditolak':
      return LeadStatus.REJECTED;
    default:
      return value as LeadStatus;
  }
}

export function normalizeLead(row: any): Lead {
  return {
    id: row.id,
    name: row.name,
    contactChannel: row.contact_channel as ContactChannel,
    location: row.location ?? '',
    status: normalizeLeadStatus(row.status),
    date: row.date,
    notes: row.notes ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    address: row.address ?? undefined,
    eventDate: row.event_date ?? undefined,
    createdAt: row.created_at || row.date,
    updatedAt: row.updated_at ?? undefined,
  };
}

function denormalizeLead(obj: Partial<Lead>): any {
  return {
    ...(obj.name !== undefined ? { name: obj.name } : {}),
    ...(obj.contactChannel !== undefined ? { contact_channel: obj.contactChannel } : {}),
    ...(obj.location !== undefined ? { location: obj.location } : {}),
    ...(obj.status !== undefined ? { status: obj.status } : {}),
    ...(obj.date !== undefined ? { date: obj.date } : {}),
    ...(obj.notes !== undefined ? { notes: obj.notes } : {}),
    ...(obj.whatsapp !== undefined ? { whatsapp: obj.whatsapp } : {}),
    ...(obj.address !== undefined ? { address: obj.address } : {}),
    ...(obj.eventDate !== undefined ? { event_date: obj.eventDate } : {}),
  };
}
