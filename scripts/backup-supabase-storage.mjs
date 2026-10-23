// Backup file media Supabase Storage ke folder lokal.
//
// Berbeda dari `supabase db dump`, script ini mengunduh FILE fisik (gambar, PDF)
// dari bucket Storage. Wajib dijalankan saat project TIDAK sedang dibatasi
// (kalau kuota egress habis, endpoint /storage/v1 akan membalas HTTP 402).
//
// Prasyarat:
//   1. Manifest file: backups/_storage-manifest/storage-manifest.csv
//      (dibuat dari metadata storage.objects - lihat scripts/backup-supabase.ps1)
//   2. Service role key project (Dashboard -> Project Settings -> API).
//
// Cara pakai:
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
//   node scripts/backup-supabase-storage.mjs
//
// Opsi:
//   --manifest <path>   path manifest CSV (default di atas)
//   --out <dir>         folder tujuan (default backups/media-<timestamp>)
//
// Script aman diulang: file yang sudah lengkap akan dilewati (resume).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repoRoot);

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const envText = readFileSync(join(repoRoot, '.env'), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);

const baseUrl = env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const manifestPath = resolve(repoRoot, flag('--manifest', 'backups/_storage-manifest/storage-manifest.csv'));
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const outDir = resolve(repoRoot, flag('--out', `backups/media-${stamp}`));

if (!baseUrl) { console.error('VITE_SUPABASE_URL tidak ditemukan di .env'); process.exit(1); }
if (!serviceKey) { console.error('Set dulu env SUPABASE_SERVICE_ROLE_KEY (service role key project).'); process.exit(1); }
if (!existsSync(manifestPath)) { console.error(`Manifest tidak ditemukan: ${manifestPath}`); process.exit(1); }

// --- Baca manifest ---
const csvLines = readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = csvLines.shift().split(',');
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const objects = csvLines.map((line) => {
  const f = parseCsvLine(line);
  return { bucket: f[idx.bucket_id], name: f[idx.name], bytes: Number(f[idx.bytes]) };
});

const fmt = (n) => (n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`);
const totalBytes = objects.reduce((s, o) => s + o.bytes, 0);

console.log(`Manifest     : ${manifestPath}`);
console.log(`Objek        : ${objects.length} file (${fmt(totalBytes)})`);
console.log(`Tujuan       : ${outDir}`);
console.log('');

mkdirSync(outDir, { recursive: true });

const results = [];
let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [i, obj] of objects.entries()) {
  const target = join(outDir, obj.bucket, obj.name);
  const label = `[${i + 1}/${objects.length}] ${obj.bucket}/${obj.name}`;

  if (existsSync(target) && statSync(target).size === obj.bytes) {
    skipped += 1;
    results.push({ ...obj, status: 'skipped', savedBytes: obj.bytes });
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });

  const url = `${baseUrl}/storage/v1/object/${obj.bucket}/${obj.name.split('/').map(encodeURIComponent).join('/')}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!res.ok) {
      failed += 1;
      const body = (await res.text()).slice(0, 160);
      console.log(`  GAGAL  ${label} -> HTTP ${res.status} ${body}`);
      results.push({ ...obj, status: `failed:${res.status}`, savedBytes: 0 });
      continue;
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
    const saved = statSync(target).size;
    if (saved !== obj.bytes) {
      failed += 1;
      console.log(`  GAGAL  ${label} -> ukuran tidak cocok (${saved} != ${obj.bytes})`);
      results.push({ ...obj, status: 'failed:size-mismatch', savedBytes: saved });
      continue;
    }
    downloaded += 1;
    console.log(`  OK     ${label} (${fmt(saved)})`);
    results.push({ ...obj, status: 'ok', savedBytes: saved });
  } catch (err) {
    failed += 1;
    console.log(`  GAGAL  ${label} -> ${err.message}`);
    results.push({ ...obj, status: `failed:${err.message}`, savedBytes: 0 });
  }
}

const report = ['bucket_id,name,bytes,status'];
for (const r of results) {
  const name = /[",]/.test(r.name) ? `"${r.name.replace(/"/g, '""')}"` : r.name;
  report.push([r.bucket, name, r.bytes, r.status].join(','));
}
writeFileSync(join(outDir, '_verify.csv'), report.join('\n'), 'utf8');

console.log('');
console.log('=== RINGKASAN MEDIA ===');
console.log(`  diunduh : ${downloaded}`);
console.log(`  dilewati: ${skipped}`);
console.log(`  gagal   : ${failed}`);
console.log(`  laporan : ${join(outDir, '_verify.csv')}`);
if (failed > 0) {
  console.log('');
  console.log('Ada file gagal. Jika errornya HTTP 402 (exceed_egress_quota), jalankan ulang');
  console.log('script ini setelah project dipulihkan / kuota egress direset.');
}
