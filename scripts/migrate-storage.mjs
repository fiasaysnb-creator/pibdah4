/**
 * Script migrasi file Storage dari Supabase lama ke Supabase baru
 * Download via authenticated Supabase client (old) → Upload ke project baru
 *
 * Jalankan: node scripts/migrate-storage.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =====================
// KONFIGURASI
// =====================
const OLD_SUPABASE_URL = 'https://xqdmcggaixzitoaxcgyh.supabase.co';
const OLD_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZG1jZ2dhaXh6aXRvYXhjZ3loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUyNTg2OCwiZXhwIjoyMTA3MTAxODY4fQ.kcmC4mBWjOvtm3_w8Uf05qjI7lUFeCVg7slgI5PTP4I';

const NEW_SUPABASE_URL = 'https://nrzrbgxrmtyscgyhdbke.supabase.co';
const NEW_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yenJiZ3hybXR5c2NneWhkYmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjc0Njg5OSwiZXhwIjoyMTA4MzIyODk5fQ.oG_UlImk2owk16QDBmclMgFb8I_eNi3E4l7ckvWv7mE';

const MANIFEST_PATH = join(
  __dirname,
  '../backups/_storage-manifest/storage-manifest.csv'
);

// Delay antar upload (ms) — hindari rate limit
const DELAY_MS = 300;

// =====================
// SETUP CLIENT
// =====================
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// =====================
// BACA MANIFEST CSV
// =====================
function parseManifest(csvPath) {
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',');
  const bucketIdx = header.indexOf('bucket_id');
  const nameIdx = header.indexOf('name');
  const mimeIdx = header.indexOf('mimetype');

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      bucket: cols[bucketIdx].trim(),
      name: cols[nameIdx].trim(),
      mimetype: cols[mimeIdx].trim(),
    };
  });
}

// =====================
// HELPER
// =====================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// =====================
// MAIN MIGRATION
// =====================
async function migrateStorage() {
  console.log('🚀 Memulai migrasi Storage (authenticated)...\n');

  // Baca file manifest
  let files;
  try {
    files = parseManifest(MANIFEST_PATH);
    console.log(`📋 Total file ditemukan: ${files.length}\n`);
  } catch (err) {
    console.error('❌ Gagal membaca manifest:', err.message);
    process.exit(1);
  }

  let success = 0;
  let failed = 0;
  const failedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const { bucket, name, mimetype } = files[i];
    const label = `[${i + 1}/${files.length}] ${bucket}/${name}`;

    try {
      // 1. Download dari Supabase lama via authenticated client
      const { data: fileData, error: downloadError } = await oldSupabase.storage
        .from(bucket)
        .download(name);

      if (downloadError) {
        throw new Error(`Download error: ${downloadError.message}`);
      }
      if (!fileData) {
        throw new Error('File data kosong / null');
      }

      // 2. Convert Blob → ArrayBuffer → Uint8Array
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // 3. Upload ke project baru (upsert: timpa jika sudah ada)
      const { error: uploadError } = await newSupabase.storage
        .from(bucket)
        .upload(name, bytes, {
          contentType: mimetype || fileData.type || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`);
      }

      console.log(`  ✅ ${label}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${label} — ${err.message}`);
      failed++;
      failedFiles.push({ bucket, name, error: err.message });
    }

    // Delay antar request
    if (i < files.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // =====================
  // LAPORAN AKHIR
  // =====================
  console.log('\n' + '='.repeat(60));
  console.log('📊 LAPORAN MIGRASI STORAGE');
  console.log('='.repeat(60));
  console.log(`  ✅ Berhasil  : ${success}`);
  console.log(`  ❌ Gagal     : ${failed}`);
  console.log(`  📁 Total     : ${files.length}`);

  if (failedFiles.length > 0) {
    console.log('\n❌ File yang gagal:');
    failedFiles.forEach(({ bucket, name, error }) => {
      console.log(`   - ${bucket}/${name}: ${error}`);
    });
  }

  if (failed === 0) {
    console.log('\n🎉 Semua file berhasil dimigrasikan!');
  } else {
    console.log(`\n⚠️  ${failed} file gagal. Cek error di atas.`);
  }
}

migrateStorage().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
