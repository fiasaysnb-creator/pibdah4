import supabase from '../lib/supabaseClient';
import { Contract } from '../types';
import { canonicalizeStorageAssetUrls, uploadImageDataUrl } from './storage';

const CONTRACTS = 'contracts';

function normalizeContract(row: any): Contract {
  row = canonicalizeStorageAssetUrls(row);
  return {
    id: row.id,
    contractNumber: row.contract_number,
    clientId: row.client_id,
    projectId: row.project_id,
    signingDate: row.signing_date,
    signingLocation: row.signing_location || '',
    clientName1: row.client_name1,
    clientAddress1: row.client_address1 || '',
    clientPhone1: row.client_phone1 || '',
    clientName2: row.client_name2 || undefined,
    clientAddress2: row.client_address2 || undefined,
    clientPhone2: row.client_phone2 || undefined,
    shootingDuration: row.shooting_duration || '',
    guaranteedPhotos: row.guaranteed_photos || '',
    albumDetails: row.album_details || '',
    digitalFilesFormat: row.digital_files_format || 'JPG High-Resolution',
    otherItems: row.other_items || '',
    personnelCount: row.personnel_count || '',
    deliveryTimeframe: row.delivery_timeframe || '',
    dpDate: row.dp_date || '',
    finalPaymentDate: row.final_payment_date || '',
    cancellationPolicy: row.cancellation_policy || '',
    jurisdiction: row.jurisdiction || '',
    vendorSignature: row.vendor_signature || undefined,
    clientSignature: row.client_signature || undefined,
    includeMeterai: row.include_meterai ?? false,
    meteraiPlacement: (row.meterai_placement as any) || 'client',
    createdAt: row.created_at,
  };
}

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from(CONTRACTS)
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeContract);
}

export async function createContract(contract: Omit<Contract, 'id' | 'createdAt'>): Promise<Contract> {
  if (contract.vendorSignature?.startsWith('data:image/')) {
    contract = {
      ...contract,
      vendorSignature: await uploadImageDataUrl(contract.vendorSignature, 'contract-signatures'),
    };
  }

  const insertRow = {
    contract_number: contract.contractNumber,
    client_id: contract.clientId,
    project_id: contract.projectId,
    signing_date: contract.signingDate,
    signing_location: contract.signingLocation,
    client_name1: contract.clientName1,
    client_address1: contract.clientAddress1,
    client_phone1: contract.clientPhone1,
    client_name2: contract.clientName2,
    client_address2: contract.clientAddress2,
    client_phone2: contract.clientPhone2,
    shooting_duration: contract.shootingDuration,
    guaranteed_photos: contract.guaranteedPhotos,
    album_details: contract.albumDetails,
    digital_files_format: contract.digitalFilesFormat,
    other_items: contract.otherItems,
    personnel_count: contract.personnelCount,
    delivery_timeframe: contract.deliveryTimeframe,
    dp_date: contract.dpDate,
    final_payment_date: contract.finalPaymentDate,
    cancellation_policy: contract.cancellationPolicy,
    jurisdiction: contract.jurisdiction,
    vendor_signature: contract.vendorSignature,
    client_signature: contract.clientSignature,
    include_meterai: contract.includeMeterai ?? false,
    meterai_placement: contract.meteraiPlacement || 'client',
  };

  const { data, error } = await supabase
    .from(CONTRACTS)
    .insert([insertRow])
    .select('*')
    .single();

  if (error) throw error;
  return normalizeContract(data);
}

export async function updateContract(id: string, patch: Partial<Contract>): Promise<Contract> {
  if (patch.vendorSignature?.startsWith('data:image/')) {
    patch = {
      ...patch,
      vendorSignature: await uploadImageDataUrl(patch.vendorSignature, 'contract-signatures'),
    };
  }

  const updateRow: any = {};
  if (patch.contractNumber !== undefined) updateRow.contract_number = patch.contractNumber;
  if (patch.clientId !== undefined) updateRow.client_id = patch.clientId;
  if (patch.projectId !== undefined) updateRow.project_id = patch.projectId;
  if (patch.signingDate !== undefined) updateRow.signing_date = patch.signingDate;
  if (patch.signingLocation !== undefined) updateRow.signing_location = patch.signingLocation;
  if (patch.clientName1 !== undefined) updateRow.client_name1 = patch.clientName1;
  if (patch.clientAddress1 !== undefined) updateRow.client_address1 = patch.clientAddress1;
  if (patch.clientPhone1 !== undefined) updateRow.client_phone1 = patch.clientPhone1;
  if (patch.clientName2 !== undefined) updateRow.client_name2 = patch.clientName2;
  if (patch.clientAddress2 !== undefined) updateRow.client_address2 = patch.clientAddress2;
  if (patch.clientPhone2 !== undefined) updateRow.client_phone2 = patch.clientPhone2;
  if (patch.shootingDuration !== undefined) updateRow.shooting_duration = patch.shootingDuration;
  if (patch.guaranteedPhotos !== undefined) updateRow.guaranteed_photos = patch.guaranteedPhotos;
  if (patch.albumDetails !== undefined) updateRow.album_details = patch.albumDetails;
  if (patch.digitalFilesFormat !== undefined) updateRow.digital_files_format = patch.digitalFilesFormat;
  if (patch.otherItems !== undefined) updateRow.other_items = patch.otherItems;
  if (patch.personnelCount !== undefined) updateRow.personnel_count = patch.personnelCount;
  if (patch.deliveryTimeframe !== undefined) updateRow.delivery_timeframe = patch.deliveryTimeframe;
  if (patch.dpDate !== undefined) updateRow.dp_date = patch.dpDate;
  if (patch.finalPaymentDate !== undefined) updateRow.final_payment_date = patch.finalPaymentDate;
  if (patch.cancellationPolicy !== undefined) updateRow.cancellation_policy = patch.cancellationPolicy;
  if (patch.jurisdiction !== undefined) updateRow.jurisdiction = patch.jurisdiction;
  if (patch.vendorSignature !== undefined) updateRow.vendor_signature = patch.vendorSignature;
  if (patch.clientSignature !== undefined) updateRow.client_signature = patch.clientSignature;
  if (patch.includeMeterai !== undefined) updateRow.include_meterai = patch.includeMeterai;
  if (patch.meteraiPlacement !== undefined) updateRow.meterai_placement = patch.meteraiPlacement;

  const { data, error } = await supabase
    .from(CONTRACTS)
    .update(updateRow)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from(CONTRACTS)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from(CONTRACTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeContract(data) : null;
}

export async function getContractByProject(projectId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from(CONTRACTS)
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeContract(data) : null;
}
