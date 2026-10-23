import supabase from '../lib/supabaseClient';
import { TeamPaymentRecord } from '../types';
import { uploadImageDataUrl } from './storage';

const TABLE = 'team_payment_records';

function fromRow(row: any): TeamPaymentRecord {
  return {
    id: row.id,
    recordNumber: row.record_number,
    teamMemberId: row.team_member_id,
    date: row.date,
    projectPaymentIds: Array.isArray(row.project_payment_ids) ? row.project_payment_ids : [],
    totalAmount: Number(row.total_amount || 0),
    vendorSignature: row.vendor_signature || undefined,
    createdAt: row.created_at || row.date,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toRow(input: Partial<TeamPaymentRecord>): any {
  return {
    ...(input.recordNumber !== undefined ? { record_number: input.recordNumber } : {}),
    ...(input.teamMemberId !== undefined ? { team_member_id: input.teamMemberId } : {}),
    ...(input.date !== undefined ? { date: input.date } : {}),
    ...(input.projectPaymentIds !== undefined ? { project_payment_ids: input.projectPaymentIds } : {}),
    ...(input.totalAmount !== undefined ? { total_amount: input.totalAmount } : {}),
    ...(input.vendorSignature !== undefined ? { vendor_signature: input.vendorSignature } : {}),
  };
}

export async function listTeamPaymentRecords(): Promise<TeamPaymentRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createTeamPaymentRecord(payload: Omit<TeamPaymentRecord, 'id'>): Promise<TeamPaymentRecord> {
  if (payload.vendorSignature?.startsWith('data:image/')) {
    payload = {
      ...payload,
      vendorSignature: await uploadImageDataUrl(payload.vendorSignature, 'team-payment-signatures'),
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(toRow(payload))
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTeamPaymentRecord(id: string, patch: Partial<TeamPaymentRecord>): Promise<TeamPaymentRecord> {
  if (patch.vendorSignature?.startsWith('data:image/')) {
    patch = {
      ...patch,
      vendorSignature: await uploadImageDataUrl(patch.vendorSignature, 'team-payment-signatures'),
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(toRow(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTeamPaymentRecord(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
