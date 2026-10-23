/**
 * Verifikasi post-migration: cek kolom yang tersisa di tabel projects & profiles
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nrzrbgxrmtyscgyhdbke.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yenJiZ3hybXR5c2NneWhkYmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTE0MzY2MiwiZXhwIjoyMDQ0NzE5NjYyfQ.FuDNh1yz9HMTV9LTlPAEA7gQxpRblBW--HTQB3FJgls';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // Coba baca 1 baris dari projects untuk lihat kolom yang ada
  const { data: proj, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .limit(1);
  
  if (projErr) {
    console.error('Error membaca projects:', projErr.message);
  } else {
    const cols = proj && proj.length > 0 ? Object.keys(proj[0]) : [];
    console.log(`\n📋 Kolom projects yang TERSISA (${cols.length} kolom):`);
    cols.forEach(c => console.log('  ✓', c));
    
    // Pastikan kolom yang dihapus sudah tidak ada
    const deleted = ['add_ons','team','wedding_day_checklist','image','color',
      'transport_details','transport_used','inventory_items','event_details',
      'rejection_reason','chat_history'];
    console.log('\n🗑️  Verifikasi kolom yang dihapus:');
    deleted.forEach(c => {
      console.log('  ', cols.includes(c) ? `❌ MASIH ADA: ${c}` : `✅ Berhasil dihapus: ${c}`);
    });
  }

  // Coba baca 1 baris dari profiles
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (profErr) {
    console.error('Error membaca profiles:', profErr.message);
  } else {
    const cols = prof && prof.length > 0 ? Object.keys(prof[0]) : [];
    const deletedProf = ['billing_templates','receipt_share_template','expense_share_template'];
    console.log('\n📋 Kolom profiles - verifikasi:');
    deletedProf.forEach(c => {
      console.log('  ', cols.includes(c) ? `❌ MASIH ADA: ${c}` : `✅ Berhasil dihapus: ${c}`);
    });
    console.log('  Total kolom profiles tersisa:', cols.length);
  }
}

main().catch(console.error);
