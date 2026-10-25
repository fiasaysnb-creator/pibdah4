import supabase from '../lib/supabaseClient';
import { Package, PhysicalItem, DurationOption, Project } from '../types';
import { canonicalizeStorageAssetUrl, uploadImageDataUrl } from './storage';

const TABLE = 'packages';

function isMissingPackageColumnError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST204' || error?.code === '42703';
}

export function normalizePackage(row: any): Package {
  return normalize(row);
}

function normalize(row: any): Package {
  const legacy = row.duration_options || row.duration_prices; // Support both column names
  let durationOptions: DurationOption[] | undefined = undefined;
  if (legacy) {
    if (Array.isArray(legacy)) {
      durationOptions = legacy as DurationOption[];
    } else if (typeof legacy === 'object') {
      const opts: DurationOption[] = [];
      if (typeof legacy.eightHours === 'number') opts.push({ label: '8 Jam', price: legacy.eightHours, default: true });
      if (typeof legacy.fullDay === 'number') opts.push({ label: 'Full Day', price: legacy.fullDay, default: opts.length === 0 });
      durationOptions = opts.length > 0 ? opts : undefined;
    }
  }

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price || 0),
    category: row.category ?? '',
    region: row.region ?? undefined,
    physicalItems: (row.physical_items ?? []) as PhysicalItem[],
    digitalItems: (row.digital_items ?? []) as string[],
    processingTime: row.processing_time ?? '',
    defaultPrintingCost: row.default_printing_cost ?? undefined,
    defaultTransportCost: row.default_transport_cost ?? undefined,
    photographers: row.photographers ?? undefined,
    videographers: row.videographers ?? undefined,
    coverImage: row.cover_image ? canonicalizeStorageAssetUrl(row.cover_image) : undefined,
    // Store flexible options in the same duration_prices column for backward compatibility
    durationOptions,
  };
}

function denormalize(obj: Partial<Package>): any {
  return {
    ...(obj.name !== undefined ? { name: obj.name } : {}),
    ...(obj.price !== undefined ? { price: obj.price } : {}),
    ...(obj.category !== undefined ? { category: obj.category } : {}),
    ...(obj.region !== undefined ? { region: obj.region } : {}),
    ...(obj.physicalItems !== undefined ? { physical_items: obj.physicalItems } : {}),
    ...(obj.digitalItems !== undefined ? { digital_items: obj.digitalItems } : {}),
    ...(obj.processingTime !== undefined ? { processing_time: obj.processingTime } : {}),
    ...(obj.defaultPrintingCost !== undefined ? { default_printing_cost: obj.defaultPrintingCost } : {}),
    ...(obj.defaultTransportCost !== undefined ? { default_transport_cost: obj.defaultTransportCost } : {}),
    ...(obj.photographers !== undefined ? { photographers: obj.photographers } : {}),
    ...(obj.videographers !== undefined ? { videographers: obj.videographers } : {}),
    ...(obj.coverImage !== undefined ? { cover_image: obj.coverImage } : {}),
    ...(obj.durationOptions !== undefined ? { duration_options: obj.durationOptions } : {}),
  };
}

export async function listPackages(): Promise<Package[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data || []).map(normalize);
}

/** Load only package rows referenced by an invoice, without downloading every cover image. */
export async function listPackagesForInvoice(
  project: Pick<Project, 'packageId' | 'packageName' | 'additionalPackages'>,
): Promise<Package[]> {
  const additional = Array.isArray(project.additionalPackages) ? project.additionalPackages : [];
  const ids = Array.from(new Set([
    project.packageId,
    ...additional.map(item => item?.id),
  ].filter((value): value is string => !!value)));
  const names = Array.from(new Set([
    ...(!project.packageId && project.packageName ? [project.packageName] : []),
    ...additional.filter(item => !item?.id).map(item => item?.name),
  ].filter((value): value is string => !!value)));

  const columns = 'id,name,price,category,physical_items,digital_items,processing_time,default_printing_cost,default_transport_cost,photographers,videographers,duration_options';
  const fetchMatching = async (field: 'id' | 'name', values: string[]) => {
    if (!values.length) return [] as any[];
    const result = await supabase.from(TABLE).select(columns).in(field, values);
    if (isMissingPackageColumnError(result.error)) {
      const fallbackResult = await supabase
        .from(TABLE)
        .select(columns.replace(',duration_options', ',duration_prices'))
        .in(field, values);
      if (fallbackResult.error) throw fallbackResult.error;
      return fallbackResult.data || [];
    }
    if (result.error) throw result.error;
    return result.data || [];
  };

  const [byId, byName] = await Promise.all([
    fetchMatching('id', ids),
    fetchMatching('name', names),
  ]);
  const rows = new Map<string, any>();
  [...byId, ...byName].forEach(row => rows.set(row.id, row));
  return Array.from(rows.values()).map(normalize);
}

export async function createPackage(payload: Omit<Package, 'id' | 'createdAt'>): Promise<Package> {
  if (payload.coverImage?.startsWith('data:image/')) {
    payload = { ...payload, coverImage: await uploadImageDataUrl(payload.coverImage, 'package-covers') };
  }

  // First try verbose payload
  let { data, error } = await supabase
    .from(TABLE)
    .insert([denormalize(payload)])
    .select('*')
    .single();
  if (error) {
    if (!isMissingPackageColumnError(error)) throw error;
    // Fallback only for legacy schemas missing newer package columns.
    // Minimal: name, price, category, processing_time, cover_image
    console.warn('[Supabase][packages.create] verbose insert failed, retrying with minimal payload. Error:', error);
    const minimal: any = {
      name: payload.name,
      price: payload.price,
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.processingTime !== undefined ? { processing_time: payload.processingTime } : {}),
      ...(payload.coverImage !== undefined ? { cover_image: payload.coverImage } : {}),
    };
    const retry = await supabase.from(TABLE).insert([minimal]).select('*').single();
    if (retry.error) throw retry.error;
    data = retry.data;
  }
  return normalize(data);
}

export async function updatePackage(id: string, patch: Partial<Package>): Promise<Package> {
  if (patch.coverImage?.startsWith('data:image/')) {
    patch = { ...patch, coverImage: await uploadImageDataUrl(patch.coverImage, 'package-covers') };
  }

  let { data, error } = await supabase
    .from(TABLE)
    .update(denormalize(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (!isMissingPackageColumnError(error)) throw error;
    console.warn('[Supabase][packages.update] verbose update failed, retrying with minimal payload. Error:', error);
    const minimal: any = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.processingTime !== undefined ? { processing_time: patch.processingTime } : {}),
      ...(patch.coverImage !== undefined ? { cover_image: patch.coverImage } : {}),
    };
    const retry = await supabase
      .from(TABLE)
      .update(minimal)
      .eq('id', id)
      .select('*')
      .single();
    if (retry.error) throw retry.error;
    data = retry.data;
  }
  return normalize(data);
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
