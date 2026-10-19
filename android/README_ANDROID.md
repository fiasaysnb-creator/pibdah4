# 📱 Android Project - Vena Pictures

Project ini adalah bagian Android dari aplikasi Vena Pictures yang dibangun dengan Capacitor.

## 📋 Informasi Project

- **App Name:** Vena Pictures
- **Package Name:** com.weddfin.app
- **Capacitor Version:** 8.5.0
- **Gradle Version:** 9.0.1
- **Min SDK:** Android 6.0 (API 23)
- **Target SDK:** Android 15 (API 35)
- **Compile SDK:** Android 15 (API 35)

## 🏗️ Struktur Folder

```
android/
├── app/                          # Main application module
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml    # App manifest
│   │   │   ├── assets/                # Web assets (dari dist/)
│   │   │   ├── java/                  # Java/Kotlin source code
│   │   │   └── res/                   # Resources (icons, strings, dll)
│   │   ├── androidTest/               # Instrumented tests
│   │   └── test/                      # Unit tests
│   ├── build.gradle                   # App-level Gradle config
│   └── proguard-rules.pro             # ProGuard rules untuk minify
├── capacitor-cordova-android-plugins/ # Cordova plugin compatibility
├── gradle/                            # Gradle wrapper
├── build.gradle                       # Project-level Gradle config
├── gradle.properties                  # Gradle settings
├── local.properties                   # Local SDK location (not in git)
├── settings.gradle                    # Gradle modules
└── variables.gradle                   # Shared variables

```

## 🚀 Command Line Build

### Build Debug APK
```bash
# Windows PowerShell
.\gradlew.bat assembleDebug

# Linux/Mac
./gradlew assembleDebug
```

**Output:** `app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK
```bash
# Windows PowerShell
.\gradlew.bat assembleRelease

# Linux/Mac
./gradlew assembleRelease
```

**Output:** `app/build/outputs/apk/release/app-release-unsigned.apk`

### Build Android App Bundle (AAB)
```bash
# Windows PowerShell
.\gradlew.bat bundleRelease

# Linux/Mac
./gradlew bundleRelease
```

**Output:** `app/build/outputs/bundle/release/app-release.aab`

### Clean Build
```bash
# Windows PowerShell
.\gradlew.bat clean

# Linux/Mac
./gradlew clean
```

## 🔧 Gradle Tasks Berguna

```bash
# List semua tasks
.\gradlew.bat tasks

# Build dengan info detail
.\gradlew.bat assembleDebug --info

# Build dengan stacktrace (untuk debug error)
.\gradlew.bat assembleDebug --stacktrace

# Cek dependencies
.\gradlew.bat dependencies

# Refresh dependencies (download ulang)
.\gradlew.bat --refresh-dependencies
```

## 📦 Install APK ke Device

### Via ADB
```bash
# List devices
adb devices

# Install APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Install dengan replace app lama
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Uninstall app
adb uninstall com.weddfin.app
```

### Via Android Studio
1. Klik **Run** (▶️) di toolbar
2. Pilih device (connected device atau emulator)
3. App akan otomatis di-install dan di-run

## ⚙️ Konfigurasi

### local.properties
File ini berisi lokasi Android SDK. **TIDAK di-commit ke git**.

Contoh isi:
```properties
sdk.dir=C:\\Users\\PC - SIGAMPANG\\AppData\\Local\\Android\\Sdk
```

Buat file ini jika belum ada:
```powershell
echo "sdk.dir=C:\\Users\\PC - SIGAMPANG\\AppData\\Local\\Android\\Sdk" > local.properties
```

### gradle.properties
Konfigurasi Gradle untuk optimisasi build:
- Memory settings
- Parallel build
- Caching
- AndroidX migration

### variables.gradle
Berisi versi dependencies yang digunakan:
- Android SDK versions
- Library versions
- Plugin versions

## 🔐 Signing APK Release

APK Release harus di-sign sebelum bisa di-install atau di-upload ke Play Store.

### Buat Keystore (Pertama Kali)

```bash
keytool -genkey -v -keystore weddfin-keystore.jks -alias weddfin-release-key -keyalg RSA -keysize 2048 -validity 10000
```

**PENTING:** Simpan file .jks dan password dengan AMAN!

### Sign APK via Gradle

1. Buat file `keystore.properties` di folder `android/`:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=weddfin-release-key
storeFile=D:/weddfin-keystore.jks
```

2. Edit `app/build.gradle`, tambahkan sebelum `android {`:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

3. Di dalam `android { }`, tambahkan:
```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
}
```

4. Di dalam `buildTypes { release { } }`, tambahkan:
```gradle
signingConfig signingConfigs.release
```

5. Build signed APK:
```bash
.\gradlew.bat assembleRelease
```

**Output:** `app/build/outputs/apk/release/app-release.apk` (signed)

### Sign APK via Android Studio

Lihat panduan di `../PANDUAN_BUILD_APK.md` bagian "Build APK Release".

## 🐛 Troubleshooting

### Gradle Sync Failed
```bash
# Clean dan rebuild
.\gradlew.bat clean
.\gradlew.bat assembleDebug --refresh-dependencies
```

### SDK Location Not Found
Buat file `local.properties` dengan lokasi SDK yang benar.

### Out of Memory Error
Edit `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```

### Build Sangat Lambat
1. Enable Gradle daemon: `org.gradle.daemon=true`
2. Enable parallel build: `org.gradle.parallel=true`
3. Enable caching: `org.gradle.caching=true`

### INSTALL_FAILED_UPDATE_INCOMPATIBLE
Uninstall app lama terlebih dahulu:
```bash
adb uninstall com.weddfin.app
```

## 📝 Catatan Penting

1. **Jangan commit:**
   - `local.properties` (berisi lokasi SDK lokal)
   - `keystore.properties` (berisi password signing)
   - `*.keystore` atau `*.jks` (file keystore)
   - `build/` folders
   - `.gradle/` folders

2. **Selalu backup:**
   - File keystore (.jks)
   - Password keystore & key alias
   - Diperlukan untuk update app di Play Store!

3. **Sebelum build release:**
   - Update `versionCode` dan `versionName` di `app/build.gradle`
   - Test di berbagai devices
   - Cek ProGuard rules jika menggunakan minify

4. **Web assets:**
   - Diambil dari folder `dist/` di root project
   - Jalankan `npm run build` dan `npx cap sync android` sebelum build APK
   - Web assets di-copy ke `app/src/main/assets/public/`

## 🔗 Sync dengan Web App

Setiap kali ada perubahan di web app (React/Vite), jalankan:

```bash
# Dari root project (bukan di folder android/)
npm run build
npx cap sync android
```

Ini akan:
1. Build web app ke folder `dist/`
2. Copy assets ke `android/app/src/main/assets/public/`
3. Update Capacitor config
4. Update native plugins

## 📚 Resources

- **Capacitor Android Docs:** https://capacitorjs.com/docs/android
- **Android Developer Guide:** https://developer.android.com/guide
- **Gradle User Guide:** https://docs.gradle.org/current/userguide/userguide.html
- **Panduan Build APK:** `../PANDUAN_BUILD_APK.md`
- **Setup Android Studio:** `../SETUP_ANDROID_STUDIO.md`

---

**Happy Building! 🚀**
