/**
 * Script untuk menjalankan migration drop unused columns ke Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nrzrbgxrmtyscgyhdbke.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yenJiZ3hybXR5c2NneWhkYmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTE0MzY2MiwiZXhwIjoyMDQ0NzE5NjYyfQ.FuDNh1yz9HMTV9LTlPAEA7gQxpRblBW--HTQB3FJgls';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'public' }
});

// Daftar DROP statements yang akan dieksekusi satu per satu
const migrations = [
  // TABEL projects - kolom warisan
  `ALTER TABLE projects DROP COLUMN IF EXISTS add_ons`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS team`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS wedding_day_checklist`,
  // TABEL projects - kolom tidak digunakan
  `ALTER TABLE projects DROP COLUMN IF EXISTS image`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS color`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS transport_details`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS transport_used`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS inventory_items`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS event_details`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS rejection_reason`,
  `ALTER TABLE projects DROP COLUMN IF EXISTS chat_history`,
  // TABEL profiles - kolom tidak digunakan
  `ALTER TABLE profiles DROP COLUMN IF EXISTS billing_templates`,
  `ALTER TABLE profiles DROP COLUMN IF EXISTS receipt_share_template`,
  `ALTER TABLE profiles DROP COLUMN IF EXISTS expense_share_template`,
];

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

// Gunakan Supabase management API via postgres_changes
async function execSQL(sql) {
  // Cara paling langsung: fetch langsung ke PostgREST dengan service_role
  // PostgREST tidak support DDL. Kita perlu pakai pg_meta atau Direct DB.
  // Fallback: gunakan supabase.rpc jika ada fungsi exec_sql
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // Jika rpc exec_sql tidak ada, coba cara lain
    throw error;
  }
  return data;
}

async function runWithPgMeta(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  console.log('🚀 Menjalankan migration: hapus kolom tidak digunakan\n');
  
  let success = 0;
  let failed = 0;
  
  for (const sql of migrations) {
    const colName = sql.match(/DROP COLUMN IF EXISTS (\w+)/)?.[1];
    const tableName = sql.match(/ALTER TABLE (\w+)/)?.[1];
    
    try {
      // Coba via pg_meta API
      const res = await runWithPgMeta(sql);
      if (res.status === 200 || res.status === 204) {
        console.log(`✅ ${tableName}.${colName} → DIHAPUS`);
        success++;
      } else if (res.body.includes('does not exist') || res.body.includes('42703')) {
        console.log(`⏭️  ${tableName}.${colName} → sudah tidak ada (skip)`);
        success++;
      } else {
        console.log(`❌ ${tableName}.${colName} → Error ${res.status}: ${res.body.substring(0,100)}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${tableName}.${colName} → Exception: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== HASIL: ${success} berhasil, ${failed} gagal ===`);
  
  if (failed > 0) {
    console.log('\n⚠️  Jalankan SQL ini manual di Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/nrzrbgxrmtyscgyhdbke/sql/new');
    console.log('\n--- SQL untuk di-copy-paste ---');
    migrations.forEach(s => console.log(s + ';'));
  }
}

main().catch(console.error);
