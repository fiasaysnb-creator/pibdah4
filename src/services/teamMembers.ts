import supabase from '../lib/supabaseClient';
import { canonicalizeStorageAssetUrls, compressImage } from './storage';
import { TeamMember, PerformanceNote } from '../types';
import { publicNamePatternsFromSlug } from '../utils/publicRouting';

const TABLE = 'team_members';

export function normalizeTeamMember(row: any): TeamMember {
  return normalize(row);
}

function normalize(row: any): TeamMember {
  row = canonicalizeStorageAssetUrls(row);
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url ?? undefined,
    standardFee: Number(row.standard_fee || 0),
    noRek: row.no_rek ?? undefined,
    bankName: row.bank_name ?? undefined,
    specialization: row.specialization ?? undefined,
    location: row.location ?? undefined,
    emergencyContact: row.emergency_contact ?? undefined,

    rating: Number(row.rating || 0),
    performanceNotes: (row.performance_notes ?? []) as PerformanceNote[],
    portalAccessId: row.portal_access_id,
    category: row.category || 'Tim',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function denormalize(obj: Partial<TeamMember>): any {
  return {
    ...(obj.name !== undefined ? { name: obj.name } : {}),
    ...(obj.role !== undefined ? { role: obj.role } : {}),
    ...(obj.email !== undefined ? { email: obj.email } : {}),
    ...(obj.phone !== undefined ? { phone: obj.phone } : {}),
    ...(obj.avatarUrl !== undefined ? { avatar_url: obj.avatarUrl } : {}),
    ...(obj.standardFee !== undefined ? { standard_fee: obj.standardFee } : {}),
    ...(obj.noRek !== undefined ? { no_rek: obj.noRek } : {}),
    ...(obj.bankName !== undefined ? { bank_name: obj.bankName } : {}),
    ...(obj.specialization !== undefined ? { specialization: obj.specialization } : {}),
    ...(obj.location !== undefined ? { location: obj.location } : {}),
    ...(obj.emergencyContact !== undefined ? { emergency_contact: obj.emergencyContact } : {}),

    ...(obj.rating !== undefined ? { rating: obj.rating } : {}),
    // ...(obj.performanceNotes !== undefined ? { performance_notes: obj.performanceNotes } : {}),
    ...(obj.portalAccessId !== undefined ? { portal_access_id: obj.portalAccessId } : {}),
    ...(obj.category !== undefined ? { category: obj.category } : {}),
  };
}

export async function uploadTeamMemberAvatar(file: File): Promise<string> {
  const processedFile = await compressImage(file, 1000, 0.8, 200 * 1024);
  const extension = processedFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `team-members/avatars/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from('gallery-images')
    .upload(path, processedFile, { contentType: processedFile.type, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('gallery-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function listTeamMembers(options: { limit?: number; offset?: number } = {}): Promise<TeamMember[]> {
  const limit = Math.min(100, options.limit || 50); // Default 50, max 100
  const offset = options.offset || 0;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []).map(normalize);
}

export async function listTeamMembersPaginated(page: number = 1, limit: number = 20): Promise<{
  teamMembers: TeamMember[];
  total: number;
  hasMore: boolean;
}> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;

  // Get paginated data
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const teamMembers = (data || []).map(normalize);
  const total = count || 0;

  return {
    teamMembers,
    total,
    hasMore: (page * limit) < total
  };
}

export async function createTeamMember(payload: Omit<TeamMember, 'id'>): Promise<TeamMember> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([denormalize(payload)])
    .select('*')
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateTeamMember(id: string, patch: Partial<TeamMember>): Promise<TeamMember> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(denormalize(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data ? normalize(data) : null;
}

export async function getTeamMemberByPortalAccessId(accessId: string): Promise<TeamMember | null> {
  if (!accessId || !accessId.trim()) return null;
  const cleanId = accessId.trim();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('portal_access_id', cleanId)
    .maybeSingle();
  if (data) return normalize(data);
  if (error) console.warn('[getTeamMemberByPortalAccessId] portal_access_id lookup failed:', error);

  const { data: byId } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', cleanId)
    .maybeSingle();
  if (byId) return normalize(byId);

  const patterns = publicNamePatternsFromSlug(cleanId);
  if (patterns === null) {
    const { data: byName, error: nameError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('name', cleanId)
      .limit(2);
    return nameError || byName?.length !== 1 ? null : normalize(byName[0]);
  }
  if (patterns.length === 0) return null;

  const matches = new Map<string, any>();
  for (const pattern of patterns) {
    const { data: candidates, error: patternError } = await supabase
      .from(TABLE)
      .select('*')
      .ilike('name', pattern)
      .limit(2);
    if (patternError) return null;
    for (const candidate of candidates || []) matches.set(candidate.id, candidate);
    if (matches.size > 1) return null;
  }
  return matches.size === 1 ? normalize([...matches.values()][0]) : null;
}

export const teamMemberService = {
  list: listTeamMembers,
  get: getTeamMember,
  getByPortalAccessId: getTeamMemberByPortalAccessId,
  add: createTeamMember,
  create: createTeamMember,
  update: updateTeamMember,
  delete: deleteTeamMember,
};

