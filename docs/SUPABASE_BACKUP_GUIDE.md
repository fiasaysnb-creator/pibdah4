# Panduan Backup Database Supabase

Dokumentasi lengkap untuk backup dan restore database Supabase project Vena Pictures.

## 📋 Ringkasan

Project ini memiliki 2 script backup otomatis:
- `scripts/backup-database.js` - Backup dengan daftar tabel predefined
- `scripts/backup-all-tables.js` - Backup semua tabel yang terdeteksi (recommended)

## 🚀 Cara Menggunakan

### Backup Database

Jalankan perintah berikut di terminal:

```bash
node scripts/backup-all-tables.js
```

Script akan:
1. Mengunduh semua data dari setiap tabel
2. Menyimpan dalam format JSON
3. Membuat summary backup
4. Menyimpan di folder `backups/backup-[timestamp]/`

### Lokasi File Backup

Semua backup tersimpan di:
```
backups/
  └── backup-2026-03-01T14-00-41/
      ├── _summary.json          # Ringkasan backup
      ├── backup_info.sql        # Info backup (format SQL comment)
      ├── profiles.json          # Data tabel profiles
      ├── clients.json           # Data tabel clients
      ├── projects.json          # Data tabel projects
      ├── team_members.json      # Data tabel team_members
      ├── leads.json             # Data tabel leads
      ├── calendar_events.json   # Data tabel calendar_events
      ├── packages.json          # Data tabel packages
      ├── promo_codes.json       # Data tabel promo_codes
      └── notifications.json     # Data tabel notifications
```

## 📊 Tabel yang Di-backup

Berdasarkan backup terakhir (1 Maret 2026):

| Tabel | Jumlah Baris | Status |
|-------|--------------|--------|
| profiles | 1 | ✅ |
| clients | 1 | ✅ |
| projects | 1 | ✅ |
| team_members | 3 | ✅ |
| leads | 9 | ✅ |
| calendar_events | 0 | ✅ |
| packages | 10 | ✅ |
| promo_codes | 1 | ✅ |
| notifications | 10 | ✅ |

**Total: 9 tabel, 36 baris data**

## 🔄 Restore Database

### Metode 1: Manual via Supabase Dashboard

1. Buka [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Buka **Table Editor**
4. Untuk setiap tabel:
   - Buka file JSON backup
   - Insert data secara manual atau via SQL Editor

### Metode 2: Via SQL Editor (Bulk Insert)

1. Buka **SQL Editor** di Supabase Dashboard
2. Untuk setiap tabel, buat query INSERT:

```sql
-- Contoh restore tabel packages
INSERT INTO packages (id, name, description, price, features, created_at)
VALUES 
  ('uuid-1', 'Basic Package', 'Description', 1000000, '["feature1"]', '2024-01-01'),
  ('uuid-2', 'Premium Package', 'Description', 2000000, '["feature1", "feature2"]', '2024-01-01');
```

### Metode 3: Via Script (Recommended untuk Development)

Buat script restore:

```javascript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY); // Gunakan service key!

async function restoreTable(tableName, data) {
  const { error } = await supabase
    .from(tableName)
    .insert(data);
  
  if (error) console.error(`Error restoring ${tableName}:`, error);
  else console.log(`✅ Restored ${tableName}: ${data.length} rows`);
}

// Baca dan restore setiap file
const backupDir = './backups/backup-2026-03-01T14-00-41';
const tables = ['profiles', 'clients', 'projects', /* ... */];

for (const table of tables) {
  const data = JSON.parse(fs.readFileSync(`${backupDir}/${table}.json`));
  await restoreTable(table, data);
}
```

## 🔐 Backup dengan Supabase CLI (Format SQL)

Jika Anda memiliki database password, gunakan Supabase CLI:

### Setup

```bash
# Link project
npx supabase link --project-ref dvpzxkrfomvrvndgsshk

# Login (jika belum)
npx supabase login
```

### Dump Database (Memerlukan Docker)

```bash
# Dump seluruh database (struktur + data)
npx supabase db dump --linked -f backup.sql

# Dump hanya data
npx supabase db dump --linked --data-only -f backup-data.sql

# Dump hanya struktur
npx supabase db dump --linked --schema-only -f backup-schema.sql

# Dump tabel tertentu
npx supabase db dump --linked -s public -f backup-public.sql
```

### Dump via Connection String

Jika Anda punya database password:

```bash
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.dvpzxkrfomvrvndgsshk.supabase.co:5432/postgres" -f backup.sql
```

## 📅 Jadwal Backup Otomatis

### Menggunakan Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Tambahkan (backup setiap hari jam 2 pagi)
0 2 * * * cd /path/to/project && node scripts/backup-all-tables.js
```

### Menggunakan Task Scheduler (Windows)

1. Buka **Task Scheduler**
2. Create Basic Task
3. Trigger: Daily, 2:00 AM
4. Action: Start a program
   - Program: `node`
   - Arguments: `scripts/backup-all-tables.js`
   - Start in: `D:\weddfinpoto`

### Menggunakan GitHub Actions

Buat file `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Setiap hari jam 2 pagi UTC
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/backup-all-tables.js
      - uses: actions/upload-artifact@v3
        with:
          name: database-backup
          path: backups/
          retention-days: 30
```

## 🔍 Melihat Isi Backup

### Via Command Line

```bash
# Lihat summary
cat backups/backup-2026-03-01T14-00-41/_summary.json

# Lihat data tabel tertentu
cat backups/backup-2026-03-01T14-00-41/clients.json

# Count baris
cat backups/backup-2026-03-01T14-00-41/leads.json | grep -c "id"
```

### Via Node.js

```javascript
const fs = require('fs');

// Baca summary
const summary = JSON.parse(fs.readFileSync('backups/backup-2026-03-01T14-00-41/_summary.json'));
console.log(summary);

// Baca data tabel
const clients = JSON.parse(fs.readFileSync('backups/backup-2026-03-01T14-00-41/clients.json'));
console.log(clients);
```

## ⚠️ Catatan Penting

1. **Keamanan**: Jangan commit file backup ke Git jika berisi data sensitif
   - Tambahkan `backups/` ke `.gitignore`

2. **Storage**: Backup JSON bisa besar untuk tabel dengan banyak data
   - Pertimbangkan kompresi: `tar -czf backup.tar.gz backups/`

3. **Service Key**: Untuk restore, Anda mungkin perlu Supabase Service Role Key (bukan Anon Key)
   - Dapatkan dari Dashboard → Settings → API

4. **Rate Limiting**: Script menambahkan delay 100ms antar tabel untuk menghindari rate limit

5. **Relasi**: Backup JSON tidak menyimpan foreign key constraints
   - Restore harus dilakukan dalam urutan yang benar (parent tables dulu)

## 🛠️ Troubleshooting

### Error: "Could not find the table"
- Tabel belum dibuat di database
- Periksa nama tabel di Supabase Dashboard

### Error: "Rate limit exceeded"
- Tambahkan delay lebih lama di script
- Gunakan Service Role Key untuk limit lebih tinggi

### Error: "Row level security"
- Gunakan Service Role Key untuk bypass RLS
- Atau disable RLS sementara saat restore

### Backup terlalu lambat
- Gunakan `--data-only` flag di CLI
- Atau backup per tabel secara parallel

## 📚 Referensi

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Backup Guide](https://supabase.com/docs/guides/platform/backups)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)

---

**Last Updated**: 1 Maret 2026
**Project**: Vena Pictures Dashboard
**Database**: dvpzxkrfomvrvndgsshk.supabase.co
