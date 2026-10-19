# ========================================
# Build APK Script - Vena Pictures
# ========================================
# Script untuk build APK Debug atau Release
# ========================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$BuildType = "debug"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Build APK - Vena Pictures" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cek apakah di root project
if (-not (Test-Path "capacitor.config.ts")) {
    Write-Host "Error: Please run this script from project root!" -ForegroundColor Red
    exit 1
}

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

# Cek prasyarat
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
$allGood = $true

if (-not (Test-Command "node")) {
    Write-Host "  ✗ Node.js not found!" -ForegroundColor Red
    $allGood = $false
} else {
    Write-Host "  ✓ Node.js found" -ForegroundColor Green
}

if (-not (Test-Command "npm")) {
    Write-Host "  ✗ npm not found!" -ForegroundColor Red
    $allGood = $false
} else {
    Write-Host "  ✓ npm found" -ForegroundColor Green
}

if (-not (Test-Command "java")) {
    Write-Host "  ✗ Java not found!" -ForegroundColor Red
    $allGood = $false
} else {
    Write-Host "  ✓ Java found" -ForegroundColor Green
}

if (-not (Test-Path "android\local.properties")) {
    Write-Host "  ✗ android\local.properties not found!" -ForegroundColor Red
    Write-Host "    Run setup-android.ps1 first" -ForegroundColor Yellow
    $allGood = $false
} else {
    Write-Host "  ✓ local.properties found" -ForegroundColor Green
}

if (-not $allGood) {
    Write-Host ""
    Write-Host "Please fix the issues above and try again." -ForegroundColor Red
    Write-Host "Run: .\setup-android.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Build web app
Write-Host "[1/3] Building web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Web build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Web build complete" -ForegroundColor Green
Write-Host ""

# Sync to Android
Write-Host "[2/3] Syncing to Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Sync failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Sync complete" -ForegroundColor Green
Write-Host ""

# Build APK
Write-Host "[3/3] Building APK ($BuildType)..." -ForegroundColor Yellow
Write-Host ""

Set-Location android

if ($BuildType -eq "debug") {
    Write-Host "Building debug APK..." -ForegroundColor Cyan
    .\gradlew.bat assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   APK Debug Built Successfully! ✓" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK Location:" -ForegroundColor Yellow
        $apkPath = Resolve-Path "app\build\outputs\apk\debug\app-debug.apk"
        Write-Host "  $apkPath" -ForegroundColor Cyan
        Write-Host ""
        
        # Cek ukuran file
        if (Test-Path $apkPath) {
            $fileSize = (Get-Item $apkPath).Length / 1MB
            Write-Host "APK Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
            Write-Host ""
            
            # Tanya user apakah mau install ke device
            if (Test-Command "adb") {
                $devices = adb devices | Select-String -Pattern "device$"
                if ($devices.Count -gt 0) {
                    Write-Host "Android device detected!" -ForegroundColor Green
                    $install = Read-Host "Install to device now? (y/n)"
                    if ($install -eq "y") {
                        Write-Host "Installing..." -ForegroundColor Yellow
                        adb install -r $apkPath
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "  ✓ Installed successfully!" -ForegroundColor Green
                        } else {
                            Write-Host "  ✗ Installation failed" -ForegroundColor Red
                        }
                    }
                }
            }
        }
    } else {
        Write-Host ""
        Write-Host "✗ Build failed! Check errors above." -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
} elseif ($BuildType -eq "release") {
    Write-Host "Building release APK..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠ Note: Release APK must be signed to be installable" -ForegroundColor Yellow
    Write-Host "   Use Android Studio for signed build, or setup keystore" -ForegroundColor Yellow
    Write-Host ""
    
    .\gradlew.bat assembleRelease
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   APK Release Built Successfully! ✓" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        # Cek apakah signed atau unsigned
        $signedPath = "app\build\outputs\apk\release\app-release.apk"
        $unsignedPath = "app\build\outputs\apk\release\app-release-unsigned.apk"
        
        if (Test-Path $signedPath) {
            $apkPath = Resolve-Path $signedPath
            Write-Host "APK Location (SIGNED):" -ForegroundColor Yellow
            Write-Host "  $apkPath" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "✓ This APK is ready to install and distribute" -ForegroundColor Green
            
            $fileSize = (Get-Item $apkPath).Length / 1MB
            Write-Host "APK Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
            
        } elseif (Test-Path $unsignedPath) {
            $apkPath = Resolve-Path $unsignedPath
            Write-Host "APK Location (UNSIGNED):" -ForegroundColor Yellow
            Write-Host "  $apkPath" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "⚠ This APK is NOT signed and cannot be installed" -ForegroundColor Yellow
            Write-Host "   Use Android Studio to generate signed APK:" -ForegroundColor Yellow
            Write-Host "   Build > Generate Signed Bundle / APK" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "   See PANDUAN_BUILD_APK.md for details" -ForegroundColor Yellow
            
            $fileSize = (Get-Item $apkPath).Length / 1MB
            Write-Host ""
            Write-Host "APK Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "✗ Build failed! Check errors above." -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
if ($BuildType -eq "debug") {
    Write-Host "  • Test APK on Android device" -ForegroundColor White
    Write-Host "  • Install via: adb install -r <apk-path>" -ForegroundColor Cyan
    Write-Host "  • Or transfer to phone and install manually" -ForegroundColor Cyan
} else {
    Write-Host "  • Sign APK via Android Studio if not signed" -ForegroundColor White
    Write-Host "  • Test on multiple devices" -ForegroundColor White
    Write-Host "  • Prepare for distribution or Play Store" -ForegroundColor White
}
Write-Host ""
Write-Host "Build another APK:" -ForegroundColor Yellow
Write-Host "  .\build-apk.ps1 -BuildType debug" -ForegroundColor Cyan
Write-Host "  .\build-apk.ps1 -BuildType release" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
