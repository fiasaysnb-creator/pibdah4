/**
 * Script audit kolom yang tidak digunakan di database Supabase.
 * Membandingkan kolom yang ada di DB vs yang digunakan di src/
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nrzrbgxrmtyscgyhdbke.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yenJiZ3hybXR5c2NneWhkYmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTE0MzY2MiwiZXhwIjoyMDQ0NzE5NjYyfQ.FuDNh1yz9HMTV9LTlPAEA7gQxpRblBW--HTQB3FJgls';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getTableColumns(tableName) {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `
  });
  if (error) {
    // Fallback: query langsung
    const res = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);
    return res.data || [];
  }
  return data || [];
}

// Kolom yang DIGUNAKAN di kode (berdasarkan analisis normalizeProject)
const USED_PROJECT_COLUMNS = new Set([
  'id', 'project_name', 'client_name', 'client_id', 'project_type',
  'package_name', 'package_id', 'additional_packages', 'date', 'deadline_date',
  'location', 'progress', 'status', 'total_cost', 'amount_paid', 'payment_status',
  'booking_status', 'notes', 'accommodation', 'drive_link', 'client_drive_link',
  'final_drive_link', 'start_time', 'end_time', 'promo_code_id', 'discount_amount',
  'printing_details', 'custom_costs', 'printing_cost', 'transport_cost', 'transport_paid',
  'transport_note', 'printing_card_id', 'transport_card_id', 'completed_digital_items',
  'dp_proof_url', 'payment_proofs', 'shipping_details', 'active_sub_statuses',
  'custom_sub_statuses', 'confirmed_sub_statuses', 'client_sub_status_notes',
  'sub_status_confirmation_sent_at', 'invoice_signature', 'is_editing_confirmed_by_client',
  'is_printing_confirmed_by_client', 'is_delivery_confirmed_by_client', 'status_history',
  'address', 'google_maps_link', 'created_at', 'updated_at', 'duration_selection', 'unit_price'
]);

// Kolom yang ada di schema tapi TIDAK digunakan di kode
const UNUSED_CANDIDATES = {
  projects: [
    'add_ons',         // digantikan tabel project_add_ons (relasi terpisah)
    'team',            // digantikan tabel project_team_assignments  
    'image',           // tidak ada di normalizeProject
    'color',           // tidak ada di normalizeProject
    'transport_details', // tidak ada di normalizeProject
    'transport_used',  // tidak ada di normalizeProject
    'wedding_day_checklist', // digantikan tabel wedding_day_checklists
    'inventory_items', // tidak ada di normalizeProject
    'event_details',   // tidak ada di normalizeProject
    'rejection_reason', // tidak ada di normalizeProject
    'chat_history',    // tidak ada di normalizeProject
  ]
};

async function checkRowsWithNonNullValue(tableName, columnName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .not(columnName, 'is', null);
    if (error) return { count: null, error: error.message };
    return { count: count || 0, error: null };
  } catch(e) {
    return { count: null, error: String(e) };
  }
}

async function checkJSONBNotEmpty(tableName, columnName) {
  try {
    // Cek apakah ada baris dengan nilai non-empty JSONB
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .not(columnName, 'eq', '[]')
      .not(columnName, 'eq', '{}')
      .not(columnName, 'is', null)
      .limit(1);
    if (error) return { hasData: null, error: error.message };
    return { hasData: (data || []).length > 0, error: null };
  } catch(e) {
    return { hasData: null, error: String(e) };
  }
}

async function main() {
  console.log('=== AUDIT KOLOM TIDAK DIGUNAKAN ===\n');
  
  console.log('📋 TABEL: projects');
  console.log('Kandidat kolom yang bisa dihapus:\n');
  
  for (const col of UNUSED_CANDIDATES.projects) {
    const { count, error } = await checkRowsWithNonNullValue('projects', col);
    const { hasData } = await checkJSONBNotEmpty('projects', col);
    
    const dataStatus = error 
      ? `❓ Error: ${error}` 
      : (count === 0 
        ? '✅ KOSONG (aman dihapus)' 
        : (hasData ? `⚠️  ADA DATA (${count} baris non-null, ada yg non-empty)` : `ℹ️  ${count} baris non-null (tapi semua kosong/[]/{})`)
        );
    
    console.log(`  • ${col}: ${dataStatus}`);
  }
  
  // Cek tabel lain  
  console.log('\n📋 TABEL LAIN - Cek tabel tidak digunakan:');
  
  // Cek tabel audit_logs
  const { count: auditCount } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true }).limit(0);
  console.log(`  • audit_logs: ${auditCount !== null ? auditCount + ' baris' : 'tidak bisa dibaca'}`);
  
  // Cek calendar_events
  const { count: calCount, error: calErr } = await supabase.from('calendar_events').select('id', { count: 'exact', head: true }).limit(0);
  console.log(`  • calendar_events: ${calErr ? 'Error: ' + calErr.message : calCount + ' baris'}`);
  
  // inventory_items table
  const { count: invCount, error: invErr } = await supabase.from('inventory_items').select('id', { count: 'exact', head: true }).limit(0);
  console.log(`  • inventory_items (tabel): ${invErr ? 'Tidak ada / Error: ' + invErr.message : invCount + ' baris'}`);
  
  console.log('\n=== REKOMENDASI MIGRATION ===');
  console.log(`
-- Kolom JSONB warisan di tabel projects yang sudah digantikan oleh tabel relasi terpisah:
-- 1. add_ons      → digantikan project_add_ons (relasi M:N)
-- 2. team         → digantikan project_team_assignments
-- 3. wedding_day_checklist → digantikan wedding_day_checklists

-- Kolom yang tidak pernah digunakan di kode:
-- 4. image, color (tidak ada di normalizeProject)
-- 5. transport_details, transport_used (tidak ada di normalizeProject)
-- 6. inventory_items, event_details (tidak ada di normalizeProject)  
-- 7. rejection_reason, chat_history (tidak ada di normalizeProject)
  `);
}

main().catch(console.error);
