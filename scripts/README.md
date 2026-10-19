# Scripts Backup Database

Kumpulan script untuk backup dan maintenance database Supabase.

## 📁 File Scripts

### `compress-existing-images.mjs` (Supabase Storage)
Recompress existing JPEG, PNG, and WebP objects in place. The default target is 100 KB per image and the default bucket is `gallery-images`. Object paths remain unchanged, so existing database URLs continue to work. GIFs, SVGs, and unsupported formats are skipped.

The script runs in dry-run mode unless `--apply` is passed. Apply mode writes a timestamped copy of each original under `backups/storage-image-originals/` before replacing it. Keep the service-role key private and do not commit it.

```powershell
$env:VITE_SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"

# Dry run only; it downloads and measures candidates without changing storage.
npm run compress:storage-images

# Apply only after reviewing the dry-run output.
npm run compress:storage-images -- --apply

# To include payment proofs, review first and then explicitly apply.
npm run compress:storage-images -- --bucket all
npm run compress:storage-images -- --bucket all --apply
```

Use `--max-size-kb 100`, `--max-dimension 1600`, or `--backup-dir <path>` to adjust the run. The script processes objects one at a time and reports any files that remain over target. It does not rewrite base64 images embedded directly in database JSON/text fields.

### `backup-to-sql.js` ⭐⭐ (RECOMMENDED - All-in-One)
Script terbaik: Backup database dan langsung konversi ke format SQL.

**Cara Pakai:**
```bash
node scripts/backup-to-sql.js
```

**Output:**
- Folder: `backups/backup-[timestamp]/`
- File `database_backup.sql` (siap import ke PostgreSQL)
- File JSON untuk setiap tabel
- File `_summary.json` dengan ringkasan backup

**Fitur:**
- ✅ Backup + konversi SQL dalam 1 langkah
- ✅ File SQL siap pakai untuk restore
- ✅ Tetap menyimpan JSON sebagai backup
- ✅ Progress indicator
- ✅ Error handling

### `backup-all-tables.js` ⭐ (JSON Only)
Script untuk backup dalam format JSON saja.

**Cara Pakai:**
```bash
node scripts/backup-all-tables.js
```

**Output:**
- Folder: `backups/backup-[timestamp]/`
- File JSON untuk setiap tabel
- File `_summary.json` dengan ringkasan backup
- File `backup_info.sql` dengan informasi backup

**Fitur:**
- ✅ Auto-detect tabel yang ada
- ✅ Progress indicator
- ✅ Error handling
- ✅ Summary report
- ✅ Rate limiting protection

### `json-to-sql.js` (Konversi Manual)
Konversi backup JSON yang sudah ada ke format SQL.

**Cara Pakai:**
```bash
node scripts/json-to-sql.js
```

**Fungsi:**
- Mencari backup terbaru di folder `backups/`
- Konversi semua file JSON ke SQL
- Menghasilkan file `database_backup.sql`

### `backup-database.js`
Script backup dengan daftar tabel predefined (termasuk tabel yang mungkin belum ada).

**Cara Pakai:**
```bash
node scripts/backup-database.js
```

**Perbedaan dengan backup-all-tables.js:**
- Mencoba backup tabel yang mungkin belum dibuat
- Menampilkan error untuk tabel yang tidak ditemukan
- Berguna untuk development/testing

## 🚀 Quick Start

1. Pastikan dependencies terinstall:
```bash
npm install
```

2. Jalankan backup (langsung ke SQL):
```bash
node scripts/backup-to-sql.js
```

3. Atau backup JSON saja:
```bash
node scripts/backup-all-tables.js
```

4. Konversi JSON ke SQL (jika perlu):
```bash
node scripts/json-to-sql.js
```

5. Cek hasil backup:
```bash
ls -la backups/backup-*/
```

## 📊 Hasil Backup Terakhir

**Tanggal**: 1 Maret 2026, 21:00 WIB
**Status**: ✅ Berhasil 100%
**Tabel**: 9 tabel
**Total Data**: 36 baris

| Tabel | Baris |
|-------|-------|
| profiles | 1 |
| clients | 1 |
| projects | 1 |
| team_members | 3 |
| leads | 9 |
| calendar_events | 0 |
| packages | 10 |
| promo_codes | 1 |
| notifications | 10 |

## 🔄 Restore Database

Lihat dokumentasi lengkap di: [docs/SUPABASE_BACKUP_GUIDE.md](../docs/SUPABASE_BACKUP_GUIDE.md)

## ⚙️ Konfigurasi

Script menggunakan environment variables dari `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Untuk restore, Anda mungkin perlu Service Role Key dari Supabase Dashboard.

## 📅 Backup Otomatis

### Windows Task Scheduler

1. Buka Task Scheduler
2. Create Basic Task
3. Trigger: Daily, 2:00 AM
4. Action: 
   - Program: `node`
   - Arguments: `scripts/backup-all-tables.js`
   - Start in: `[path-to-project]`

### Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Tambahkan (backup setiap hari jam 2 pagi)
0 2 * * * cd /path/to/project && node scripts/backup-all-tables.js
```

## 🛠️ Troubleshooting

### Error: Cannot find module '@supabase/supabase-js'
```bash
npm install @supabase/supabase-js
```

### Error: ENOENT: no such file or directory
Pastikan menjalankan script dari root project:
```bash
cd /path/to/project
node scripts/backup-all-tables.js
```

### Backup terlalu lambat
- Script sudah include delay 100ms antar tabel
- Untuk database besar, pertimbangkan backup per tabel

### Error: Rate limit exceeded
- Gunakan Service Role Key (limit lebih tinggi)
- Tambahkan delay lebih lama di script

## 📚 Dokumentasi Lengkap

Lihat: [docs/SUPABASE_BACKUP_GUIDE.md](../docs/SUPABASE_BACKUP_GUIDE.md)

## 🔐 Keamanan

⚠️ **PENTING**: 
- Jangan commit file backup ke Git
- Folder `backups/` sudah ditambahkan ke `.gitignore`
- Simpan backup di tempat aman
- Gunakan Service Role Key hanya untuk restore, jangan commit ke Git

## 📝 Notes

- Backup dalam format JSON (mudah dibaca dan di-parse)
- Setiap backup punya timestamp unik
- Summary file berisi metadata lengkap
- Script kompatibel dengan Node.js 16+

---

**Maintainer**: Vena Pictures Team
**Last Updated**: 1 Maret 2026
