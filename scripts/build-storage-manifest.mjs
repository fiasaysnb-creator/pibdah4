// Membuat manifest file Supabase Storage dari metadata tabel storage.objects.
//
// Dipakai sebelum `node scripts/backup-supabase-storage.mjs`, karena daftar file
// hanya bisa diambil dari database (endpoint Storage API bisa sedang dibatasi).
//
// Langkah 1 - ambil metadata dari database (butuh Docker + database password):
//
//   $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
//   npx supabase db dump --db-url $env:SUPABASE_DB_URL `
//     -f backups/_storage-manifest/storage-metadata.sql `
//     --use-copy --data-only -x "public.packages"
//
// Langkah 2 - ubah menjadi CSV manifest:
//
//   node scripts/build-storage-manifest.mjs
//
// Hasil: backups/_storage-manifest/storage-manifest.csv

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const srcArg = process.argv[2] || 'backups/_storage-manifest/storage-metadata.sql';
const outArg = process.argv[3] || 'backups/_storage-manifest/storage-manifest.csv';
const src = resolve(repoRoot, srcArg);
const out = resolve(repoRoot, outArg);

if (!existsSync(src)) {
  console.error(`Dump metadata tidak ditemukan: ${src}`);
  console.error('Jalankan perintah `supabase db dump` pada komentar di atas terlebih dahulu.');
  process.exit(1);
}

const text = readFileSync(src, 'utf8');
const marker = 'COPY "storage"."objects" (';
const start = text.indexOf(marker);

if (start === -1) {
  console.error('Blok COPY "storage"."objects" tidak ditemukan di file dump.');
  process.exit(1);
}

const cols = text
  .slice(start + marker.length, text.indexOf(') FROM stdin;', start))
  .split(',')
  .map((c) => c.trim().replace(/^"|"$/g, ''));

const headerEnd = text.indexOf('\n', start);
const bodyEnd = text.indexOf('\n\\.\n', headerEnd);
const body = text.slice(headerEnd + 1, bodyEnd === -1 ? undefined : bodyEnd);

const unescape = (v) => v.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

const iBucket = cols.indexOf('bucket_id');
const iName = cols.indexOf('name');
const iMeta = cols.indexOf('metadata');
const iCreated = cols.indexOf('created_at');

const rows = body
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const f = line.split('\t');
    let meta = {};
    try { meta = JSON.parse(unescape(f[iMeta] ?? '')); } catch { /* metadata kosong */ }
    return {
      bucket_id: f[iBucket],
      name: f[iName],
      size: Number(meta.size ?? 0),
      mimetype: meta.mimetype ?? '',
      created_at: f[iCreated] ?? '',
    };
  })
  .sort((a, b) => b.size - a.size);

mkdirSync(dirname(out), { recursive: true });

const csv = ['bucket_id,name,bytes,mb,mimetype,created_at'];
for (const r of rows) {
  const name = /[",]/.test(r.name) ? `"${r.name.replace(/"/g, '""')}"` : r.name;
  csv.push([r.bucket_id, name, r.size, (r.size / 1024 / 1024).toFixed(3), r.mimetype, r.created_at].join(','));
}
writeFileSync(out, csv.join('\n'), 'utf8');

const byBucket = {};
for (const r of rows) {
  byBucket[r.bucket_id] ??= { count: 0, bytes: 0 };
  byBucket[r.bucket_id].count += 1;
  byBucket[r.bucket_id].bytes += r.size;
}

const fmt = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`);

console.log(`Manifest : ${out}`);
console.log(`Objek    : ${rows.length} file (${fmt(rows.reduce((s, r) => s + r.size, 0))})`);
for (const [b, v] of Object.entries(byBucket).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${b.padEnd(24)} ${String(v.count).padStart(5)} file  ${fmt(v.bytes).padStart(10)}`);
}
