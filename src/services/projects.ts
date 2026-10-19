import supabase from '../lib/supabaseClient';
import { Project, AddOn, PaymentStatus, BookingStatus, AssignedTeamMember } from '../types';
import { upsertAssignmentsForProject, listAssignmentsByProject } from './projectTeamAssignments';
import { listChecklistByProject } from './weddingDayChecklist';
import { publicNamePatternsFromSlug } from '../utils/publicRouting';

const PROJECTS = 'projects';
const PROJECT_ADD_ONS = 'project_add_ons';
const ADD_ONS = 'add_ons';
const PACKAGES = 'packages';

export type CreateProjectInput = {
  projectName: string;
  clientName: string;
  clientId: string;
  projectType: string;
  packageName: string;
  packageId?: string;
  date: string; // ISO date
  location: string;
  status: string;
  progress?: number;
  totalCost: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  bookingStatus?: BookingStatus;
  notes?: string;
  accommodation?: string;
  driveLink?: string;
  promoCodeId?: string;
  discountAmount?: number;
  printingCost?: number;
  transportCost?: number;
  completedDigitalItems?: string[];
  dpProofUrl?: string;
  paymentProofs?: { url: string; amount: number; date: string }[];
  addOns: { id: string; name: string; price: number }[];
  additionalPackages?: { id: string; name: string; price: number }[];
  durationSelection?: string;
  unitPrice?: number;
  address?: string;
};

/** Partial project fields for updates (camelCase). Allows any Project optional field. */
export type UpdateProjectInput = Partial<CreateProjectInput> & Partial<Pick<Project,
  | 'deadlineDate' | 'progress' | 'clientDriveLink' | 'finalDriveLink' | 'startTime' | 'endTime'
  | 'printingDetails' | 'customCosts' | 'transportPaid' | 'transportNote' | 'printingCardId' | 'transportCardId'
  | 'shippingDetails' | 'activeSubStatuses' | 'customSubStatuses' | 'confirmedSubStatuses' | 'clientSubStatusNotes'
  | 'subStatusConfirmationSentAt' | 'invoiceSignature' | 'isEditingConfirmedByClient' | 'isPrintingConfirmedByClient'
  | 'isDeliveryConfirmedByClient' | 'durationSelection' | 'statusHistory' | 'address' | 'googleMapsLink' | 'paymentProofs'
>> & { addOns?: { id: string; name: string; price: number }[] };

export function normalizeProject(row: any): Project {
  return {
    id: row.id,
    projectName: row.project_name,
    clientName: row.client_name,
    clientId: row.client_id,
    projectType: row.project_type,
    packageName: row.package_name,
    packageId: row.package_id || '',
    addOns: [],
    additionalPackages: Array.isArray(row.additional_packages) ? row.additional_packages : [],
    date: row.date || '',
    deadlineDate: row.deadline_date || undefined,
    location: row.location || '',
    progress: row.progress ?? 0,
    status: row.status,
    totalCost: Number(row.total_cost || 0),
    amountPaid: Number(row.amount_paid || 0),
    paymentStatus: row.payment_status,
    bookingStatus: row.booking_status || undefined,
    team: [],
    notes: row.notes || undefined,
    accommodation: row.accommodation || undefined,
    driveLink: row.drive_link || undefined,
    clientDriveLink: row.client_drive_link || undefined,
    finalDriveLink: row.final_drive_link || undefined,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    promoCodeId: row.promo_code_id || undefined,
    discountAmount: row.discount_amount || undefined,
    printingDetails: row.printing_details || undefined,
    customCosts: row.custom_costs || undefined,
    printingCost: row.printing_cost || undefined,
    transportCost: row.transport_cost || undefined,
    transportPaid: row.transport_paid || false,
    transportNote: row.transport_note || undefined,
    printingCardId: row.printing_card_id || undefined,
    transportCardId: row.transport_card_id || undefined,
    completedDigitalItems: row.completed_digital_items || [],
    dpProofUrl: row.dp_proof_url || undefined,
    paymentProofs: Array.isArray(row.payment_proofs) ? row.payment_proofs : [],
    shippingDetails: row.shipping_details || undefined,
    activeSubStatuses: row.active_sub_statuses || undefined,
    customSubStatuses: row.custom_sub_statuses || undefined,
    confirmedSubStatuses: row.confirmed_sub_statuses || undefined,
    clientSubStatusNotes: row.client_sub_status_notes || undefined,
    subStatusConfirmationSentAt: row.sub_status_confirmation_sent_at || undefined,
    invoiceSignature: row.invoice_signature || undefined,
    isEditingConfirmedByClient: row.is_editing_confirmed_by_client || false,
    isPrintingConfirmedByClient: row.is_printing_confirmed_by_client || false,
    isDeliveryConfirmedByClient: row.is_delivery_confirmed_by_client || false,
    statusHistory: row.status_history || [],
    address: row.address || undefined,
    googleMapsLink: row.google_maps_link || undefined,
    weddingDayChecklist: [],
    createdAt: row.created_at || (row.status_history && row.status_history.length > 0 ? row.status_history[0]?.timestamp : undefined) || row.date,
    updatedAt: row.updated_at || (row.status_history && row.status_history.length > 0 ? row.status_history[row.status_history.length - 1]?.timestamp : undefined) || row.date,
  } as Project;
}

export async function listProjects(options: { limit?: number; offset?: number } = {}): Promise<Project[]> {
  const limit = Math.min(100, options.limit || 50); // Default 50, max 100
  const offset = options.offset || 0;

  const { data, error } = await supabase
    .from(PROJECTS)
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []).map(normalizeProject);
}

export async function listProjectsPaginated(
  page: number = 1,
  limit: number = 20,
  searchQuery?: string,
  filters?: {
    status?: string;
    clientId?: string;
    projectType?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<{
  projects: Project[];
  total: number;
  hasMore: boolean;
}> {
  const offset = (page - 1) * limit;

  // Build query with search and filters
  let query = supabase.from(PROJECTS).select('*', { count: 'exact' });
  let countQuery = supabase.from(PROJECTS).select('*', { count: 'exact', head: true });

  // Apply search
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    query = query.or(`project_name.ilike.${searchTerm},client_name.ilike.${searchTerm},location.ilike.${searchTerm}`);
    countQuery = countQuery.or(`project_name.ilike.${searchTerm},client_name.ilike.${searchTerm},location.ilike.${searchTerm}`);
  }

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
    countQuery = countQuery.eq('status', filters.status);
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
    countQuery = countQuery.eq('client_id', filters.clientId);
  }

  if (filters?.projectType) {
    query = query.eq('project_type', filters.projectType);
    countQuery = countQuery.eq('project_type', filters.projectType);
  }

  if (filters?.dateFrom) {
    query = query.gte('date', filters.dateFrom);
    countQuery = countQuery.gte('date', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('date', filters.dateTo);
    countQuery = countQuery.lte('date', filters.dateTo);
  }

  // Get total count
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  // Get paginated data
  const { data, error } = await query
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const projects = (data || []).map(normalizeProject);
  const total = count || 0;

  return {
    projects,
    total,
    hasMore: (page * limit) < total
  };
}

async function linkProjectAddOns(projectId: string, addOns: Array<{ id?: string; name: string; price?: number }>) {
  const validAddOns = (addOns || []).filter(a => a && a.name && a.name.trim());
  if (validAddOns.length === 0) return;

  const addOnNames = Array.from(new Set(validAddOns.map(a => a.name.trim())));
  const { data: addOnRows, error: addOnErr } = await supabase
    .from(ADD_ONS)
    .select('id, name')
    .in('name', addOnNames);
  if (addOnErr) throw addOnErr;

  const addOnIdByName: Record<string, string> = Object.fromEntries((addOnRows || []).map(r => [r.name, r.id]));

  // Check if any add-on or custom item doesn't exist in ADD_ONS table
  const missing = validAddOns.filter(a => !addOnIdByName[a.name.trim()]);
  if (missing.length > 0) {
    try {
      const distinctMissing = Array.from(new Set(missing.map(m => m.name.trim()))).map(name => {
        const item = missing.find(m => m.name.trim() === name);
        return {
          name,
          price: Number(item?.price ?? 0),
        };
      });
      const { data: createdRows, error: createErr } = await supabase
        .from(ADD_ONS)
        .insert(distinctMissing)
        .select('id, name');
      if (!createErr && createdRows) {
        createdRows.forEach(r => {
          addOnIdByName[r.name] = r.id;
        });
      }
    } catch (e) {
      console.warn('Failed to auto-create custom add-on in ADD_ONS table:', e);
    }
  }

  const uniqueAddOnIds = Array.from(new Set(
    validAddOns
      .map(a => addOnIdByName[a.name.trim()])
      .filter(Boolean)
  ));

  const toInsert = uniqueAddOnIds.map(add_on_id => ({ project_id: projectId, add_on_id }));

  if (toInsert.length > 0) {
    const { error: linkErr } = await supabase.from(PROJECT_ADD_ONS).insert(toInsert);
    if (linkErr) throw linkErr;
  }
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
  // Resolve package id if packageName provided, preserving explicitly provided packageId if not matched
  let packageId: string | undefined = input.packageId;
  const isUuid = (v?: string) => !!v && /^[0-9a-fA-F-]{36}$/.test(v);
  if (input.packageName && !isUuid(packageId)) {
    const { data: pkg, error: pkgErr } = await supabase
      .from(PACKAGES)
      .select('id')
      .eq('name', input.packageName)
      .maybeSingle();
    if (!pkgErr && pkg?.id) {
      packageId = pkg.id;
    }
  }
  const promoCodeId = input.promoCodeId && isUuid(input.promoCodeId) ? input.promoCodeId : undefined;
  const validClientId = isUuid(input.clientId) ? input.clientId : null;
  const validPackageId = isUuid(packageId) ? packageId : null;

  const payload: Record<string, unknown> = {
    ...(input.projectName !== undefined ? { project_name: input.projectName } : {}),
    ...(input.clientName !== undefined ? { client_name: input.clientName } : {}),
    ...(input.clientId !== undefined ? { client_id: validClientId } : {}),
    ...(input.projectType !== undefined ? { project_type: input.projectType } : {}),
    ...(input.packageName !== undefined ? { package_name: input.packageName } : {}),
    ...(packageId !== undefined ? { package_id: validPackageId } : {}),
    ...(input.additionalPackages !== undefined ? { additional_packages: input.additionalPackages } : {}),
    ...(input.date !== undefined ? { date: input.date || null } : {}),
    ...(input.deadlineDate !== undefined ? { deadline_date: input.deadlineDate || null } : {}),
    ...(input.location !== undefined ? { location: input.location ?? '' } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.progress !== undefined ? { progress: input.progress } : {}),
    ...(input.totalCost !== undefined ? { total_cost: input.totalCost } : {}),
    ...(input.amountPaid !== undefined ? { amount_paid: input.amountPaid } : {}),
    ...(input.paymentStatus !== undefined ? { payment_status: input.paymentStatus } : {}),
    ...(input.bookingStatus !== undefined ? { booking_status: input.bookingStatus } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    ...(input.accommodation !== undefined ? { accommodation: input.accommodation || null } : {}),
    ...(input.driveLink !== undefined ? { drive_link: input.driveLink || null } : {}),
    ...(input.clientDriveLink !== undefined ? { client_drive_link: input.clientDriveLink || null } : {}),
    ...(input.finalDriveLink !== undefined ? { final_drive_link: input.finalDriveLink || null } : {}),
    ...(input.startTime !== undefined ? { start_time: input.startTime || null } : {}),
    ...(input.endTime !== undefined ? { end_time: input.endTime || null } : {}),
    ...(input.discountAmount !== undefined ? { discount_amount: input.discountAmount } : {}),
    ...(input.printingDetails !== undefined ? { printing_details: input.printingDetails } : {}),
    ...(input.customCosts !== undefined ? { custom_costs: input.customCosts } : {}),
    ...(input.printingCost !== undefined ? { printing_cost: input.printingCost } : {}),
    ...(input.transportCost !== undefined ? { transport_cost: input.transportCost } : {}),
    ...(input.transportPaid !== undefined ? { transport_paid: input.transportPaid } : {}),
    ...(input.transportNote !== undefined ? { transport_note: input.transportNote || null } : {}),
    ...(input.printingCardId !== undefined ? { printing_card_id: input.printingCardId || null } : {}),
    ...(input.transportCardId !== undefined ? { transport_card_id: input.transportCardId || null } : {}),
    ...(input.completedDigitalItems !== undefined ? { completed_digital_items: input.completedDigitalItems } : {}),
    ...(input.dpProofUrl !== undefined ? { dp_proof_url: input.dpProofUrl || null } : {}),
    ...(input.paymentProofs !== undefined ? { payment_proofs: input.paymentProofs } : {}),
    ...(promoCodeId !== undefined ? { promo_code_id: promoCodeId || null } : {}),
    ...(input.shippingDetails !== undefined ? { shipping_details: input.shippingDetails || null } : {}),
    ...(input.activeSubStatuses !== undefined ? { active_sub_statuses: input.activeSubStatuses } : {}),
    ...(input.customSubStatuses !== undefined ? { custom_sub_statuses: input.customSubStatuses } : {}),
    ...(input.confirmedSubStatuses !== undefined ? { confirmed_sub_statuses: input.confirmedSubStatuses } : {}),
    ...(input.clientSubStatusNotes !== undefined ? { client_sub_status_notes: input.clientSubStatusNotes } : {}),
    ...(input.subStatusConfirmationSentAt !== undefined ? { sub_status_confirmation_sent_at: input.subStatusConfirmationSentAt } : {}),
    ...(input.invoiceSignature !== undefined ? { invoice_signature: input.invoiceSignature || null } : {}),
    ...(input.isEditingConfirmedByClient !== undefined ? { is_editing_confirmed_by_client: input.isEditingConfirmedByClient } : {}),
    ...(input.isPrintingConfirmedByClient !== undefined ? { is_printing_confirmed_by_client: input.isPrintingConfirmedByClient } : {}),
    ...(input.isDeliveryConfirmedByClient !== undefined ? { is_delivery_confirmed_by_client: input.isDeliveryConfirmedByClient } : {}),
    ...(input.durationSelection !== undefined && input.durationSelection !== '' ? { duration_selection: input.durationSelection } : {}),
    ...(input as any).unitPrice !== undefined && (input as any).unitPrice !== null && !Number.isNaN(Number((input as any).unitPrice)) ? { unit_price: (input as any).unitPrice } : {},
    ...(input.statusHistory !== undefined ? { status_history: input.statusHistory } : {}),
    ...(input.address !== undefined ? { address: input.address || null } : {}),
    ...(input.googleMapsLink !== undefined ? { google_maps_link: input.googleMapsLink || null } : {}),
  };

  // map duration/unit price if provided
  if ((input as any).durationSelection !== undefined && (input as any).durationSelection !== '') {
    payload.duration_selection = (input as any).durationSelection;
  }
  if ((input as any).unitPrice !== undefined && (input as any).unitPrice !== null && !Number.isNaN(Number((input as any).unitPrice))) {
    payload.unit_price = (input as any).unitPrice;
  }

  const updateResult = Object.keys(payload).length > 0
    ? await supabase.from(PROJECTS).update(payload).eq('id', projectId).select('*').single()
    : await supabase.from(PROJECTS).select('*').eq('id', projectId).single();
  const { data, error: updateError } = updateResult;
  if (updateError) throw updateError;

  // Sync add-ons
  if (input.addOns) {
    // delete existing links
    const { error: delErr } = await supabase.from(PROJECT_ADD_ONS).delete().eq('project_id', projectId);
    if (delErr) throw delErr;
    await linkProjectAddOns(projectId, input.addOns);
  }

  // The update response already contains the saved row; avoid an extra read.
  const normalized = normalizeProject(data);
  if (input.addOns) {
    normalized.addOns = input.addOns.map(a => ({
      id: a.id || '',
      name: a.name,
      price: Number(a.price || 0),
    }));
  }
  return normalized;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    // delete joins first to avoid FK issues
    await supabase.from(PROJECT_ADD_ONS).delete().eq('project_id', projectId);
    const { error } = await supabase.from(PROJECTS).delete().eq('id', projectId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  // Resolve package_id by package name (optional)
  // Sanitize promo code id: UI may pass local id, ensure UUID or null
  const isUuid = (v?: string) => !!v && /^[0-9a-fA-F-]{36}$/.test(v);
  const promoCodeId = isUuid(input.promoCodeId as any) ? (input.promoCodeId as any) : null;
  let packageId: string | null = isUuid(input.packageId) ? input.packageId! : null;
  if (input.packageName && !packageId) {
    const { data: pkg, error: packageError } = await supabase
      .from(PACKAGES)
      .select('id')
      .eq('name', input.packageName)
      .maybeSingle();
    if (packageError) throw packageError;
    packageId = pkg?.id ?? null;
  }

  // Build insert row and only include optional columns when provided to avoid PostgREST errors
  const insertRow: any = {
    project_name: input.projectName,
    client_name: input.clientName,
    client_id: input.clientId,
    project_type: input.projectType,
    package_name: input.packageName,
    package_id: packageId,
    additional_packages: input.additionalPackages ?? [],
    date: input.date || null,
    deadline_date: (input as any).deadlineDate ?? null,
    location: input.location,
    progress: (input as any).progress ?? 0,
    status: input.status,
    total_cost: input.totalCost,
    amount_paid: input.amountPaid,
    payment_status: input.paymentStatus,
    booking_status: input.bookingStatus ?? null,
    notes: input.notes ?? null,
    accommodation: input.accommodation ?? null,
    drive_link: input.driveLink ?? null,
    client_drive_link: (input as any).clientDriveLink ?? null,
    final_drive_link: (input as any).finalDriveLink ?? null,
    start_time: (input as any).startTime ?? null,
    end_time: (input as any).endTime ?? null,
    promo_code_id: promoCodeId,
    discount_amount: input.discountAmount ?? null,
    printing_details: (input as any).printingDetails ?? null,
    custom_costs: (input as any).customCosts ?? null,
    printing_cost: input.printingCost ?? null,
    transport_cost: input.transportCost ?? null,
    transport_paid: (input as any).transportPaid ?? false,
    transport_note: (input as any).transportNote ?? null,
    printing_card_id: (input as any).printingCardId ?? null,
    transport_card_id: (input as any).transportCardId ?? null,
    dp_proof_url: input.dpProofUrl ?? null,
    completed_digital_items: input.completedDigitalItems ?? [],
    shipping_details: (input as any).shippingDetails ?? null,
    status_history: (input as any).statusHistory ?? [],
    address: input.address ?? null,
  } as any;

  // Only add duration/unit price if explicitly provided by the caller
  if ((input as any).durationSelection !== undefined && (input as any).durationSelection !== '') insertRow.duration_selection = (input as any).durationSelection;
  if ((input as any).unitPrice !== undefined && (input as any).unitPrice !== null && !Number.isNaN(Number((input as any).unitPrice))) insertRow.unit_price = (input as any).unitPrice;

  // Insert project
  const { data: inserted, error } = await supabase
    .from(PROJECTS)
    .insert([insertRow])
    .select('*')
    .single();
  if (error) throw error;

  const projectId = inserted.id as string;

  // Map add-ons by name to IDs, then insert into project_add_ons
  if (input.addOns && input.addOns.length > 0) {
    await linkProjectAddOns(projectId, input.addOns);
  }

  return normalizeProject(inserted);
}

// Enhanced function to create project with all related data in a single transaction
export async function createProjectWithRelations(input: CreateProjectInput & {
  team?: Array<{
    memberId: string;
    name: string;
    role: string;
    fee: number;

    subJob?: string;
  }>;
  activeSubStatuses?: string[];
  customSubStatuses?: Array<{ name: string; note: string }>;
}): Promise<Project> {
  // First create the project
  const project = await createProject(input);

  // Then handle team assignments if provided
  if (input.team && input.team.length > 0) {
    const assignments = input.team.map(t => ({
      memberId: t.memberId,
      name: t.name,
      role: t.role,
      fee: t.fee,

      subJob: t.subJob,
    }));

    await upsertAssignmentsForProject(project.id, assignments);
  }

  // Update project with sub-statuses if provided
  if (input.activeSubStatuses || input.customSubStatuses) {
    const updateData: any = {};
    if (input.activeSubStatuses) updateData.activeSubStatuses = input.activeSubStatuses;
    if (input.customSubStatuses) updateData.customSubStatuses = input.customSubStatuses;

    if (Object.keys(updateData).length > 0) {
      await updateProject(project.id, updateData);
    }
  }

  // Return the complete project
  const { data, error } = await supabase.from(PROJECTS).select('*').eq('id', project.id).single();
  if (error) throw error;

  const completeProject = normalizeProject(data);

  // Fetch and attach team data
  if (input.team && input.team.length > 0) {
    // `projectTeamAssignments` is statically imported at the top of this file.
    // Use the already-imported `listAssignmentsByProject` to avoid dynamic/static import
    // conflicts that prevent Rollup from code-splitting.
    completeProject.team = await listAssignmentsByProject(project.id);
  }

  // Fetch and attach checklist data
  try {
    completeProject.weddingDayChecklist = await listChecklistByProject(project.id);
  } catch (e) {
    console.warn('Failed to fetch wedding day checklist:', e);
  }

  return completeProject;
}

// Enhanced function to update project with all related data and re-fetch freshest state
export async function updateProjectWithRelations(
  projectId: string,
  input: UpdateProjectInput & {
    team?: AssignedTeamMember[];
  }
): Promise<Project> {
  // 1. Update project row and add-ons
  await updateProject(projectId, input);

  // 2. Diff and update team assignments if provided
  if (input.team !== undefined) {
    await upsertAssignmentsForProject(projectId, input.team);
  }

  // 3. Re-fetch fresh, complete project from DB
  const fresh = await getProjectWithRelations(projectId);
  if (!fresh) {
    throw new Error(`Acara Pernikahan ${projectId} tidak ditemukan setelah update.`);
  }
  return fresh;
}

export async function listProjectsByClientId(clientId: string): Promise<Project[]> {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from(PROJECTS)
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });
  if (error) {
    console.warn('[listProjectsByClientId] error:', error);
    return [];
  }
  return (data || []).map(row => normalizeProject(row));
}

// Enhanced function to get project with all related data
export async function getProjectWithRelations(
  projectId: string,
  options: { includeChecklist?: boolean } = {},
): Promise<Project | null> {
  let data: any = null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    const result = await supabase.from(PROJECTS).select('*').eq('id', projectId).maybeSingle();
    if (result.error) throw result.error;
    data = result.data;
  }

  if (!data) {
    const patterns = publicNamePatternsFromSlug(projectId);
    let resolvedProjects: any[] | null = null;
    if (patterns === null) {
      const { data: matchingProjects, error: nameError } = await supabase
        .from(PROJECTS)
        .select('*')
        .eq('project_name', projectId)
        .limit(2);
      if (nameError) throw nameError;
      resolvedProjects = matchingProjects;
    } else {
      if (patterns.length === 0) return null;
      const matches = new Map<string, any>();
      for (const pattern of patterns) {
        const { data: candidates, error: patternError } = await supabase
          .from(PROJECTS)
          .select('*')
          .ilike('project_name', pattern)
          .limit(2);
        if (patternError) throw patternError;
        for (const candidate of candidates || []) matches.set(candidate.id, candidate);
        if (matches.size > 1) return null;
      }
      resolvedProjects = [...matches.values()];
    }
    if (!resolvedProjects?.length) {
      const clientPatterns = patterns ?? [projectId];
      const clientMatches = new Map<string, any>();
      for (const pattern of clientPatterns) {
        const query = supabase.from(PROJECTS).select('*');
        const { data: candidates, error: clientPatternError } = patterns === null
          ? await query.eq('client_name', pattern).limit(2)
          : await query.ilike('client_name', pattern).limit(2);
        if (clientPatternError) throw clientPatternError;
        for (const candidate of candidates || []) clientMatches.set(candidate.id, candidate);
        if (clientMatches.size > 1) return null;
      }
      resolvedProjects = [...clientMatches.values()];
    }
    if (resolvedProjects?.length !== 1) return null;
    data = resolvedProjects[0];
    projectId = data.id;
  }
  if (!data) return null;

  const project = normalizeProject(data);

  // Fetch related data in parallel
  try {
    const [team, checklist, addOnsResult] = await Promise.all([
      listAssignmentsByProject(projectId).catch((e: Error): any[] => {
        console.warn('Failed to fetch team assignments:', e);
        return [];
      }),
      options.includeChecklist === false
        ? Promise.resolve([])
        : listChecklistByProject(projectId).catch((e: Error): any[] => {
            console.warn('Failed to fetch wedding day checklist:', e);
            return [];
          }),
      (async (): Promise<any[]> => {
        try {
          const { data: addOnData, error: addOnError } = await supabase
            .from(PROJECT_ADD_ONS)
            .select(`
              add_ons (
                id,
                name,
                price
              )
            `)
            .eq('project_id', projectId);
          if (addOnError || !addOnData) return [];
          return addOnData.map((item: any) => item.add_ons).filter(Boolean);
        } catch (e) {
          console.warn('Failed to fetch add-ons:', e);
          return [];
        }
      })()
    ]);

    project.team = team;
    project.weddingDayChecklist = checklist;
    project.addOns = addOnsResult;
  } catch (e) {
    console.error('Unexpected error fetching project relations:', e);
  }

  return project;
}


// Enhanced function to list projects with all related data
export async function listProjectsWithRelations(options: { limit?: number; offset?: number } = {}): Promise<Project[]> {
  const limit = options.limit;
  const offset = options.offset || 0;

  let query = supabase.from(PROJECTS).select('*').order('date', { ascending: false }).order('id', { ascending: false });

  if (limit !== undefined) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  const projects = (data || []).map(normalizeProject);
  const projectIds = projects.map(p => p.id);

  if (projectIds.length === 0) return [];

  // Fetch team assignments for these projects
  try {
    const { data: teamData, error: teamError } = await supabase
      .from('project_team_assignments')
      .select('*')
      .in('project_id', projectIds);

    if (!teamError && teamData) {
      const teamByProject = teamData.reduce((acc, row) => {
        if (!acc[row.project_id]) acc[row.project_id] = [];
        acc[row.project_id].push({
          memberId: row.member_id,
          name: row.member_name,
          role: row.member_role,
          fee: Number(row.fee || 0),

          subJob: row.sub_job || undefined,
        });
        return acc;
      }, {} as Record<string, any[]>);

      projects.forEach(project => {
        project.team = teamByProject[project.id] || [];
      });
    }
  } catch (e) {
    console.warn('Failed to fetch team assignments:', e);
  }

  // Fetch add-ons for these projects
  try {
    const { data: addOnData, error: addOnError } = await supabase
      .from(PROJECT_ADD_ONS)
      .select(`
        project_id,
        add_ons (
          id,
          name,
          price
        )
      `)
      .in('project_id', projectIds);

    if (!addOnError && addOnData) {
      const addOnsByProject = addOnData.reduce((acc, item) => {
        if (!acc[item.project_id]) acc[item.project_id] = [];
        if (item.add_ons) acc[item.project_id].push(item.add_ons);
        return acc;
      }, {} as Record<string, any[]>);

      projects.forEach(project => {
        project.addOns = addOnsByProject[project.id] || [];
      });
    }
  } catch (e) {
    console.warn('Failed to fetch add-ons:', e);
  }

  return projects;
}

/**
 * Hanya id paket dari proyek terbaru, untuk lencana "Paling Populer" di halaman
 * publik. Jauh lebih ringan daripada memuat seluruh kolom + relasi proyek.
 */
export async function listProjectPackageIds(limit = 5000): Promise<string[]> {
  const { data, error } = await supabase
    .from(PROJECTS)
    .select('package_id')
    .order('date', { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;
  return (data || []).map(row => row.package_id).filter((id: string | null) => Boolean(id));
}

// Utility function to validate project data before persistence
export function validateProjectData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.projectName || data.projectName.trim() === '') {
    errors.push('Nama acara tidak boleh kosong');
  }

  if (!data.clientName || data.clientName.trim() === '') {
    errors.push('Nama pengantin tidak boleh kosong');
  }

  if (!data.clientId || data.clientId.trim() === '') {
    errors.push('ID pengantin tidak boleh kosong');
  }

  if (!data.date || !data.date.match(/^\d{4}-\d{2}-\d{2}/)) {
    errors.push('Tanggal Acara Pernikahan tidak valid');
  }

  if (!data.status || data.status.trim() === '') {
    errors.push('Status acara tidak boleh kosong');
  }

  if (data.deadlineDate && !data.deadlineDate.match(/^\d{4}-\d{2}-\d{2}/)) {
    errors.push('Tanggal deadline tidak valid');
  }

  if (data.totalCost !== undefined && (isNaN(data.totalCost) || data.totalCost < 0)) {
    errors.push('Total biaya harus berupa angka positif');
  }

  if (data.amountPaid !== undefined && (isNaN(data.amountPaid) || data.amountPaid < 0)) {
    errors.push('Jumlah yang dibayar harus berupa angka positif');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Utility function to sanitize project data
export function sanitizeProjectData(data: any): any {
  return {
    ...data,
    projectName: data.projectName?.trim() || '',
    clientName: data.clientName?.trim() || '',
    location: data.location?.trim() || '',
    notes: data.notes?.trim() || undefined,
    driveLink: data.driveLink?.trim() || undefined,
    clientDriveLink: data.clientDriveLink?.trim() || undefined,
    finalDriveLink: data.finalDriveLink?.trim() || undefined,
    shippingDetails: data.shippingDetails?.trim() || undefined,
    totalCost: data.totalCost ? Number(data.totalCost) : 0,
    amountPaid: data.amountPaid ? Number(data.amountPaid) : 0,
    printingCost: data.printingCost ? Number(data.printingCost) : 0,
    transportCost: data.transportCost ? Number(data.transportCost) : 0,
    transportPaid: Boolean((data as any).transportPaid),
    transportNote: (data as any).transportNote ? String((data as any).transportNote).trim() : undefined,
    printingCardId: (data as any).printingCardId || undefined,
    transportCardId: (data as any).transportCardId || undefined,
    activeSubStatuses: Array.isArray(data.activeSubStatuses) ? data.activeSubStatuses : [],
    customSubStatuses: Array.isArray(data.customSubStatuses) ? data.customSubStatuses : [],
    completedDigitalItems: Array.isArray(data.completedDigitalItems) ? data.completedDigitalItems : [],
    printingDetails: Array.isArray(data.printingDetails) ? data.printingDetails : (Array.isArray((data as any).printing_details) ? (data as any).printing_details : []),
    team: Array.isArray(data.team) ? data.team : [],
    isEditingConfirmedByClient: Boolean(data.isEditingConfirmedByClient),
    isPrintingConfirmedByClient: Boolean(data.isPrintingConfirmedByClient),
    isDeliveryConfirmedByClient: Boolean(data.isDeliveryConfirmedByClient),
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
  };
}

export async function getProjectsSummary(): Promise<{ totalCount: number; totalRevenue: number; totalAmountPaid: number }> {
  const { data, count, error } = await supabase
    .from(PROJECTS)
    .select('total_cost, amount_paid', { count: 'exact' });

  if (error) throw error;

  let totalRevenue = 0;
  let totalAmountPaid = 0;
  (data || []).forEach(row => {
    totalRevenue += Number(row.total_cost || 0);
    totalAmountPaid += Number(row.amount_paid || 0);
  });

  return { totalCount: count || 0, totalRevenue, totalAmountPaid };
}

export const projectService = {
  list: listProjects,
  get: async (id: string) => {
    const { data, error } = await supabase.from(PROJECTS).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeProject(data) : null;
  },
  add: createProject,
  create: createProject,
  update: updateProject,
  delete: deleteProject,
};
