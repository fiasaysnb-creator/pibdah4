# ========================================
# Setup Android Project - Vena Pictures
# ========================================
# Script ini membantu setup project Android
# dan mempersiapkan build APK
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Setup Android Project - Vena Pictures" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Fungsi untuk cek apakah command ada
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# 1. Cek Node.js
Write-Host "[1/7] Checking Node.js..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node -v
    Write-Host "  ✓ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js not found!" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Cek npm
Write-Host "[2/7] Checking npm..." -ForegroundColor Yellow
if (Test-Command "npm") {
    $npmVersion = npm -v
    Write-Host "  ✓ npm found: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ npm not found!" -ForegroundColor Red
    exit 1
}

# 3. Cek Java
Write-Host "[3/7] Checking Java..." -ForegroundColor Yellow
if (Test-Command "java") {
    $javaVersion = java -version 2>&1 | Select-String "version" | ForEach-Object { $_.Line }
    Write-Host "  ✓ Java found: $javaVersion" -ForegroundColor Green
    
    # Cek versi Java
    $javaVersionNumber = java -version 2>&1 | Select-String "version" | ForEach-Object { $_.Line } | Select-String -Pattern '\d+' | ForEach-Object { $_.Matches[0].Value }
    if ($javaVersionNumber -lt 17) {
        Write-Host "  ⚠ Warning: Java 17 or higher recommended. You have Java $javaVersionNumber" -ForegroundColor Yellow
        Write-Host "  Download from: https://adoptium.net/" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ Java not found!" -ForegroundColor Red
    Write-Host "  Please install Java 17 or 21 from https://adoptium.net/" -ForegroundColor Red
    exit 1
}

# 4. Cek Android SDK
Write-Host "[4/7] Checking Android SDK..." -ForegroundColor Yellow
$sdkLocations = @(
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:ANDROID_HOME",
    "$env:ANDROID_SDK_ROOT"
)

$sdkFound = $false
$sdkPath = ""

foreach ($location in $sdkLocations) {
    if ($location -and (Test-Path $location)) {
        $sdkPath = $location
        $sdkFound = $true
        break
    }
}

if ($sdkFound) {
    Write-Host "  ✓ Android SDK found: $sdkPath" -ForegroundColor Green
    
    # Buat local.properties
    $localPropsPath = "android\local.properties"
    $sdkPathEscaped = $sdkPath -replace '\\', '\\'
    
    if (Test-Path $localPropsPath) {
        Write-Host "  ℹ local.properties already exists" -ForegroundColor Cyan
    } else {
        Write-Host "  Creating local.properties..." -ForegroundColor Yellow
        "sdk.dir=$sdkPathEscaped" | Out-File -FilePath $localPropsPath -Encoding ASCII
        Write-Host "  ✓ local.properties created" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ Android SDK not found!" -ForegroundColor Red
    Write-Host "  Please install Android Studio and setup SDK" -ForegroundColor Red
    Write-Host "  See SETUP_ANDROID_STUDIO.md for details" -ForegroundColor Yellow
    
    # Tanya user untuk manual input
    Write-Host ""
    $manualSdk = Read-Host "  Enter Android SDK path manually (or press Enter to skip)"
    if ($manualSdk) {
        $sdkPathEscaped = $manualSdk -replace '\\', '\\'
        "sdk.dir=$sdkPathEscaped" | Out-File -FilePath "android\local.properties" -Encoding ASCII
        Write-Host "  ✓ local.properties created with manual path" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Skipping SDK setup. You'll need to configure this later." -ForegroundColor Yellow
    }
}

# 5. Install dependencies
Write-Host "[5/7] Installing npm dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ℹ node_modules already exists, skipping..." -ForegroundColor Cyan
} else {
    Write-Host "  Running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  ✗ npm install failed!" -ForegroundColor Red
        exit 1
    }
}

# 6. Build web app
Write-Host "[6/7] Building web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Web app built successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Build failed!" -ForegroundColor Red
    exit 1
}

# 7. Sync to Android
Write-Host "[7/7] Syncing to Android platform..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Android platform synced" -ForegroundColor Green
} else {
    Write-Host "  ✗ Sync failed!" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Setup Complete! ✓" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Android Studio:" -ForegroundColor White
Write-Host "     npx cap open android" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Wait for Gradle sync to complete" -ForegroundColor White
Write-Host ""
Write-Host "  3. Build APK:" -ForegroundColor White
Write-Host "     Build > Build Bundle(s) / APK(s) > Build APK(s)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or build via command line:" -ForegroundColor Yellow
Write-Host "  cd android" -ForegroundColor Cyan
Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed guide, see:" -ForegroundColor Yellow
Write-Host "  - SETUP_ANDROID_STUDIO.md" -ForegroundColor Cyan
Write-Host "  - PANDUAN_BUILD_APK.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
