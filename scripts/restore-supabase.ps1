# Restore backup Supabase ke project baru via psql (mengikuti panduan resmi
# Supabase "Restore backup using CLI").
#
# Persiapan: folder backup hasil `scripts/backup-supabase.ps1` yang berisi
# roles.sql, schema.sql, data.sql.
#
# Cara pakai:
#   powershell -ExecutionPolicy Bypass -File scripts\restore-supabase.ps1 -ProjectRef <ref> -PoolerHost aws-0-<region>.pooler.supabase.com
#
# Non-interaktif:
#   $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#   powershell -ExecutionPolicy Bypass -File scripts\restore-supabase.ps1
#
# PENGAMAN: script menolak berjalan bila database tujuan sudah punya tabel di
# schema public (kecuali -Force). Ini mencegah restore tidak sengaja menimpa
# project produksi.

[CmdletBinding()]
param(
    [string]$BackupDir,
    [string]$PoolerHost,
    [int]$Port = 5432,
    [string]$ProjectRef,
    [string]$DbUrl,
    [switch]$Force,
    [switch]$SkipPostSteps,
    [switch]$NoDockerCheck
)

# Catatan: sengaja 'Continue', bukan 'Stop'. Perintah native (docker/psql) menulis
# diagnostik ke stderr; dengan 'Stop' hal itu berubah menjadi terminating error.
# Semua kegagalan di script ini ditangani lewat pemeriksaan exit code + fungsi Fail.
$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$PgImage = 'public.ecr.aws/supabase/postgres:17.11.0.003'
$dbPassword = ''

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "GAGAL: $Message" -ForegroundColor Red
    exit 1
}

function Invoke-Psql {
    param(
        [hashtable]$Target,
        [string[]]$PsqlArgs,
        [string]$WorkDir
    )
    $base = @('run', '--rm', '-e', "PGPASSWORD=$dbPassword")
    if ($WorkDir) { $base += @('-v', "${WorkDir}:/work", '-w', '/work') }
    $base += $PgImage
    $base += @('psql', '-h', $Target.Host, '-p', "$($Target.Port)", '-U', $Target.User, '-d', $Target.Db)
    $base += $PsqlArgs
    & docker @base
    return $LASTEXITCODE
}

# --- 1. Lokasi backup ---
if (-not $BackupDir) {
    $candidates = Get-ChildItem -Path (Join-Path $repoRoot 'backups') -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'supabase-*' -and (Test-Path (Join-Path $_.FullName 'data.sql')) } |
        Sort-Object LastWriteTime -Descending
    if (-not $candidates) { Fail "Tidak ada folder backup berisi data.sql di folder 'backups/'." }
    $BackupDir = $candidates[0].FullName
}

foreach ($required in @('roles.sql', 'schema.sql', 'data.sql')) {
    if (-not (Test-Path (Join-Path $BackupDir $required))) { Fail "File '$required' tidak ditemukan di $BackupDir" }
}

Write-Host ""
Write-Host "=== RESTORE SUPABASE ===" -ForegroundColor Cyan
Write-Host "Sumber backup : $BackupDir"
Write-Host ""

# --- 2. Docker ---
if (-not $NoDockerCheck) {
    $dockerOk = $false
    try {
        $null = docker info --format '{{.ServerVersion}}' 2>$null
        if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
    } catch { }
    if (-not $dockerOk) { Fail "Docker Desktop belum berjalan." }
    Write-Host "[OK] Docker berjalan." -ForegroundColor Green
}

# --- 3. Kredensial tujuan ---
if (-not $DbUrl) { $DbUrl = $env:SUPABASE_DB_URL }

if (-not $DbUrl) {
    if (-not $ProjectRef) { Fail "Tentukan -ProjectRef, atau isi env SUPABASE_DB_URL." }
    if (-not $PoolerHost) { Fail "Tentukan -PoolerHost (mis. aws-0-ap-southeast-1.pooler.supabase.com)." }
    Write-Host ""
    Write-Host "Masukkan database password project TUJUAN (input disembunyikan)."
    $secure = Read-Host -AsSecureString "Database password"
    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
    if ([string]::IsNullOrWhiteSpace($dbPassword)) { Fail "Password kosong." }
    $DbUrl = "postgresql://postgres.$ProjectRef`:$([uri]::EscapeDataString($dbPassword))@$PoolerHost`:$Port/postgres"
}

$m = [regex]::Match($DbUrl, '^postgres(ql)?://(?<user>[^:]+):(?<pwd>[^@]*)@(?<host>[^:/]+):(?<port>\d+)/(?<db>[^?]+)')
if (-not $m.Success) { Fail "Format connection string tidak dikenali." }

$target = @{
    Host     = $m.Groups['host'].Value
    Port     = [int]$m.Groups['port'].Value
    User     = $m.Groups['user'].Value
    Db       = $m.Groups['db'].Value
    Password = [uri]::UnescapeDataString($m.Groups['pwd'].Value)
}
if (-not $dbPassword) { $dbPassword = $target.Password }

Write-Host "Tujuan restore: $($target.User)@$($target.Host):$($target.Port)/$($target.Db)"
Write-Host ""

# --- 4. Pre-flight: database tujuan harus kosong ---
Write-Host "-> Memeriksa kondisi database tujuan..." -ForegroundColor Yellow
$checkSql = "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
$existing = & docker run --rm -e "PGPASSWORD=$dbPassword" $PgImage psql -h $target.Host -p "$($target.Port)" -U $target.User -d $target.Db -t -A -c $checkSql 2>&1

if ($LASTEXITCODE -ne 0) {
    $existing | ForEach-Object { Write-Host "   $_" }
    Fail "Tidak bisa terhubung ke database tujuan. Periksa password / host pooler / region."
}

$tableCount = 0
[void][int]::TryParse((($existing | Select-Object -Last 1) -as [string]).Trim(), [ref]$tableCount)
Write-Host "   tabel di schema public saat ini: $tableCount"

if ($tableCount -gt 0 -and -not $Force) {
    Write-Host ""
    Write-Host "Database tujuan SUDAH BERISI DATA ($tableCount tabel)." -ForegroundColor Yellow
    Write-Host "Restore dibatalkan untuk mencegah penimpaan data." -ForegroundColor Yellow
    Write-Host "Bila memang ingin menimpa (mis. mengulang restore yang gagal), jalankan ulang dengan -Force." -ForegroundColor Yellow
    exit 1
}

# --- 5. Restore ---
Write-Host ""
Write-Host "-> Menjalankan restore (roles.sql + schema.sql + data.sql)..." -ForegroundColor Yellow
$restoreArgs = @(
    '--single-transaction',
    '--variable', 'ON_ERROR_STOP=1',
    '--file', 'roles.sql',
    '--file', 'schema.sql',
    '--command', 'SET session_replication_role = replica',
    '--file', 'data.sql'
)
$sw = [Diagnostics.Stopwatch]::StartNew()
$code = Invoke-Psql -Target $target -PsqlArgs $restoreArgs -WorkDir $BackupDir
$sw.Stop()

if ($code -ne 0) { Fail "Restore gagal (exit code $code). Seluruh transaksi dibatalkan, database tujuan tidak berubah." }
Write-Host ("   restore selesai dalam {0:n1}s" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green

# --- 6. Langkah pasca-restore ---
if (-not $SkipPostSteps) {
    Write-Host ""
    Write-Host "-> Langkah pasca-restore..." -ForegroundColor Yellow

    # 6a. Storage buckets (schema storage tidak ikut ter-dump)
    $bucketsDir = Join-Path $repoRoot 'supabase\migrations\sql'
    if (Test-Path (Join-Path $bucketsDir '06_create_storage_buckets.sql')) {
        Write-Host "   - membuat bucket storage (dp-proofs, gallery-images)"
        $c = Invoke-Psql -Target $target -PsqlArgs @('--variable', 'ON_ERROR_STOP=1', '--file', '06_create_storage_buckets.sql') -WorkDir $bucketsDir
        if ($c -ne 0) { Write-Host "     PERINGATAN: pembuatan bucket gagal (exit $c)." -ForegroundColor Yellow }
    }

    # 6b. Publication Realtime untuk tabel aplikasi
    $migDir = Join-Path $repoRoot 'supabase\migrations'
    if (Test-Path (Join-Path $migDir '20261006101500_enable_app_realtime_tables.sql')) {
        Write-Host "   - menyiapkan publication Realtime untuk tabel aplikasi"
        $c = Invoke-Psql -Target $target -PsqlArgs @('--variable', 'ON_ERROR_STOP=1', '--file', '20261006101500_enable_app_realtime_tables.sql') -WorkDir $migDir
        if ($c -ne 0) { Write-Host "     PERINGATAN: penyiapan publication gagal (exit $c)." -ForegroundColor Yellow }
    }
}

# --- 7. Verifikasi ---
Write-Host ""
Write-Host "=== VERIFIKASI JUMLAH BARIS ===" -ForegroundColor Cyan
$verifySql = @"
select 'profiles' as tabel, count(*) from public.profiles
union all select 'clients', count(*) from public.clients
union all select 'projects', count(*) from public.projects
union all select 'leads', count(*) from public.leads
union all select 'transactions', count(*) from public.transactions
union all select 'team_members', count(*) from public.team_members
union all select 'packages', count(*) from public.packages
union all select 'galleries', count(*) from public.galleries
union all select 'notifications', count(*) from public.notifications
union all select 'auth.users', count(*) from auth.users
union all select 'storage.buckets', count(*) from storage.buckets
order by 1;
"@
[void](Invoke-Psql -Target $target -PsqlArgs @('-c', $verifySql))

Write-Host ""
Write-Host "Restore selesai." -ForegroundColor Green
Write-Host "Langkah manual yang masih harus dilakukan:" -ForegroundColor Yellow
Write-Host "  1. Isi .env dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dari project baru."
Write-Host "  2. Pindahkan file media: jalankan scripts/build-storage-manifest.mjs lalu"
Write-Host "     scripts/backup-supabase-storage.mjs pada project LAMA, lalu upload ke project baru."
Write-Host "  3. Cek Dashboard project baru -> Database -> Publications, pastikan tabel Realtime aktif."
