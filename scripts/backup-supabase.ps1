# Backup penuh database Supabase project Vena Pictures via Supabase CLI.
#
# Menghasilkan (mengikuti panduan resmi Supabase "Backup and Restore using the CLI"):
#   roles.sql   -> cluster roles        (--role-only)
#   schema.sql  -> struktur database
#   data.sql    -> seluruh data         (--use-copy --data-only, semua schema termasuk auth)
#
# Prasyarat:
#   1. Docker Desktop harus berstatus running (pg_dump dijalankan di dalam container).
#   2. Database password project (Dashboard -> Project Settings -> Database -> Reset database password).
#
# Cara pakai (paling aman, password tidak ditulis ke file):
#   powershell -ExecutionPolicy Bypass -File scripts\backup-supabase.ps1
#
# Atau non-interaktif lewat environment variable:
#   $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
#   powershell -ExecutionPolicy Bypass -File scripts\backup-supabase.ps1
#
# Catatan: kredensial connection string HARUS percent-encoded bila mengandung karakter khusus.

[CmdletBinding()]
param(
    [string]$ProjectRef = 'xqdmcggaixzitoaxcgyh',
    [string]$PoolerHost = 'aws-0-ap-southeast-1.pooler.supabase.com',
    [int]$Port = 5432,
    [string]$OutRoot = 'backups',
    [string]$DbUrl,
    [switch]$SkipZip,
    [switch]$NoDockerCheck
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "GAGAL: $Message" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== BACKUP SUPABASE ===" -ForegroundColor Cyan
Write-Host "Project ref : $ProjectRef"
Write-Host "Pooler      : $PoolerHost`:$Port"
Write-Host ""

# --- 1. Prasyarat: Docker ---
if (-not $NoDockerCheck) {
    $dockerOk = $false
    try {
        $null = docker info --format '{{.ServerVersion}}' 2>$null
        if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
    } catch { }

    if (-not $dockerOk) {
        Fail "Docker Desktop belum berjalan. Jalankan Docker Desktop, tunggu sampai status 'running', lalu ulangi perintah ini."
    }
    Write-Host "[OK] Docker berjalan." -ForegroundColor Green
}

# --- 2. Kredensial ---
if (-not $DbUrl) { $DbUrl = $env:SUPABASE_DB_URL }

if (-not $DbUrl) {
    Write-Host ""
    Write-Host "Masukkan database password project (input disembunyikan)."
    Write-Host "Password diambil dari: Dashboard -> Project Settings -> Database." -ForegroundColor DarkGray
    $secure = Read-Host -AsSecureString "Database password"
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
    if ([string]::IsNullOrWhiteSpace($plain)) { Fail "Password kosong." }

    $enc = [uri]::EscapeDataString($plain)
    $DbUrl = "postgresql://postgres.$ProjectRef`:$enc@$PoolerHost`:$Port/postgres"
    Remove-Variable secure, plain, enc -ErrorAction SilentlyContinue
}

# --- 3. Folder output ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $repoRoot (Join-Path $OutRoot "supabase-$ProjectRef-$stamp")
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Write-Host "[OK] Folder backup: $outDir" -ForegroundColor Green
Write-Host ""

# --- 4. Jalankan dump ---
function Invoke-Dump([string]$Label, [string[]]$ExtraArgs) {
    Write-Host "-> $Label ..." -ForegroundColor Yellow
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $dumpArgs = @('supabase', 'db', 'dump', '--db-url', $DbUrl, '-f', (Join-Path $outDir $Label)) + $ExtraArgs
    & npx @dumpArgs
    if ($LASTEXITCODE -ne 0) { Fail "dump '$Label' gagal (exit code $LASTEXITCODE)." }
    $sw.Stop()
    $size = (Get-Item (Join-Path $outDir $Label)).Length
    Write-Host ("   selesai dalam {0:n1}s, ukuran {1:n1} KB" -f $sw.Elapsed.TotalSeconds, ($size / 1KB)) -ForegroundColor Green
}

Invoke-Dump 'roles.sql'  @('--role-only')
Invoke-Dump 'schema.sql' @()
Invoke-Dump 'data.sql'   @('--use-copy', '--data-only', '-x', 'storage.buckets,storage.objects')

# --- 5. Manifest ---
$files = Get-ChildItem -Path $outDir -File | Where-Object { $_.Name -ne '_manifest.txt' }
$manifest = @()
$manifest += "Supabase backup"
$manifest += "Project ref : $ProjectRef"
$manifest += "Dibuat      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
$manifest += "Pooler      : $PoolerHost`:$Port"
$manifest += ""
$manifest += "Isi backup ini:"
foreach ($f in $files) { $manifest += ("  {0,-12} {1,10:n1} KB" -f $f.Name, ($f.Length / 1KB)) }
$manifest += ""
$manifest += "TIDAK termasuk di dalam backup ini:"
$manifest += "  - file gambar/dokumen di Supabase Storage (bucket gallery-images, dll)"
$manifest += "  - secret Edge Functions"
$manifest += "  - konfigurasi project (auth providers, API keys, custom domain)"
$manifest | Set-Content -Path (Join-Path $outDir '_manifest.txt') -Encoding UTF8

Write-Host ""
Write-Host "=== RINGKASAN ===" -ForegroundColor Cyan
foreach ($f in $files) {
    $lines = 0
    if ($f.Extension -eq '.sql') { $lines = @(Get-Content $f.FullName).Count }
    Write-Host ("  {0,-12} {1,10:n1} KB  {2} baris" -f $f.Name, ($f.Length / 1KB), $lines)
}

# --- 6. Verifikasi kewajaran ---
$dataFile = Join-Path $outDir 'data.sql'
if ((Get-Item $dataFile).Length -lt 1KB) {
    Write-Host ""
    Write-Host "PERINGATAN: data.sql sangat kecil. Periksa apakah password benar dan database memang berisi data." -ForegroundColor Yellow
}

# --- 7. Arsip ---
if (-not $SkipZip) {
    $zip = "$outDir.zip"
    Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zip -Force
    Write-Host ""
    Write-Host "[OK] Arsip: $zip" -ForegroundColor Green
}

Write-Host ""
Write-Host "Backup selesai." -ForegroundColor Green
Write-Host "PENTING: folder 'backups/' sudah ada di .gitignore - jangan commit file backup ke Git." -ForegroundColor DarkGray
