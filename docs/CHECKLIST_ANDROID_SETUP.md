# ✅ Checklist Setup Android - Vena Pictures

Gunakan checklist ini untuk memastikan semua langkah setup sudah dilakukan dengan benar.

---

## 📥 FASE 1: Instalasi Software

### A. Node.js dan npm
- [ ] Download Node.js LTS dari https://nodejs.org/
- [ ] Install Node.js (centang "Automatically install necessary tools")
- [ ] Verifikasi instalasi:
  ```powershell
  node -v    # Harus tampil v18.x.x atau lebih baru
  npm -v     # Harus tampil versi npm
  ```

### B. Java Development Kit (JDK)
- [ ] Download JDK 21 dari https://adoptium.net/
- [ ] Install JDK (centang "Set JAVA_HOME variable" dan "Add to PATH")
- [ ] Verifikasi instalasi:
  ```powershell
  java -version    # Harus tampil "openjdk version 21" atau "17"
  ```
- [ ] Cek JAVA_HOME:
  ```powershell
  echo $env:JAVA_HOME    # Harus tampil path ke JDK
  ```

### C. Android Studio
- [ ] Download Android Studio dari https://developer.android.com/studio
- [ ] Install Android Studio dengan "Standard Installation"
- [ ] Pertama kali buka, ikuti Setup Wizard
- [ ] Tunggu download komponen SDK selesai (3-5 GB)

### D. Android SDK
- [ ] Buka Android Studio → File → Settings → Android SDK
- [ ] Tab "SDK Platforms": Install minimal Android 13.0 (API 33)
- [ ] Recommended: Install juga Android 14.0 dan 15.0
- [ ] Tab "SDK Tools": Pastikan terinstall:
  - [ ] Android SDK Build-Tools (latest)
  - [ ] Android SDK Command-line Tools
  - [ ] Android SDK Platform-Tools
- [ ] Catat lokasi Android SDK:
  ```
  Biasanya: C:\Users\PC - SIGAMPANG\AppData\Local\Android\Sdk
  ```

**✅ Status Fase 1:** ___ / 4 item selesai

---

## 📂 FASE 2: Persiapan Project

### A. Clone/Download Project
- [ ] Project sudah ada di:
  ```
  D:\aplikasi 2026 benar\vendor phtotogrpahy 20206\atter
  ```
- [ ] Buka PowerShell di folder project

### B. Install Dependencies
- [ ] Jalankan:
  ```powershell
  npm install
  ```
- [ ] Tunggu hingga selesai (tidak ada error merah)
- [ ] Cek ada folder `node_modules` di project

### C. Konfigurasi Environment
- [ ] File `.env` sudah ada dan berisi:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`

### D. Build Web App
- [ ] Jalankan:
  ```powershell
  npm run build
  ```
- [ ] Cek ada folder `dist` di project
- [ ] Build berhasil tanpa error

### E. Sync ke Android Platform
- [ ] Jalankan:
  ```powershell
  npx cap sync android
  ```
- [ ] Output menunjukkan "Copying web assets" dan "copy android"
- [ ] Tidak ada error

**✅ Status Fase 2:** ___ / 5 item selesai

---

## ⚙️ FASE 3: Konfigurasi Android

### A. Buat File local.properties
- [ ] Masuk ke folder android:
  ```powershell
  cd android
  ```
- [ ] Buat file local.properties (ganti path SDK sesuai PC Anda):
  ```powershell
  echo "sdk.dir=C:\\Users\\PC - SIGAMPANG\\AppData\\Local\\Android\\Sdk" > local.properties
  ```
- [ ] Cek file sudah dibuat:
  ```powershell
  cat local.properties
  ```
- [ ] Kembali ke root project:
  ```powershell
  cd ..
  ```

### B. (Opsional) Optimasi Gradle
- [ ] Edit file `android\gradle.properties`
- [ ] Pastikan ada baris berikut (sudah ada di file default):
  ```properties
  org.gradle.daemon=true
  org.gradle.parallel=true
  org.gradle.jvmargs=-Xmx4096m
  ```

**✅ Status Fase 3:** ___ / 2 item selesai

---

## 🏗️ FASE 4: Buka di Android Studio

### A. Buka Project
- [ ] Jalankan dari root project:
  ```powershell
  npx cap open android
  ```
  **ATAU** buka manual:
  - [ ] Buka Android Studio
  - [ ] File → Open
  - [ ] Pilih folder: `D:\aplikasi 2026 benar\vendor phtotogrpahy 20206\atter\android`
  - [ ] Klik OK

### B. Gradle Sync
- [ ] Tunggu Android Studio melakukan Gradle Sync otomatis
- [ ] Lihat progress di bagian bawah: "Gradle sync started..."
- [ ] Tunggu hingga muncul "Gradle sync finished" (3-15 menit pertama kali)
- [ ] Tidak ada error merah di panel Build

### C. Troubleshooting Gradle Sync (jika ada masalah)
Jika Gradle sync gagal:
- [ ] Klik icon 🐘 (Sync Project with Gradle Files)
- [ ] File → Invalidate Caches → Invalidate and Restart
- [ ] Cek koneksi internet (Gradle perlu download dependencies)
- [ ] Cek file local.properties sudah benar

**✅ Status Fase 4:** ___ / 3 item selesai

---

## 📱 FASE 5: Build APK Debug (Testing)

### A. Via Android Studio (Recommended untuk Pemula)
- [ ] Pastikan Gradle sync sudah selesai tanpa error
- [ ] Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- [ ] Tunggu proses build (5-10 menit pertama kali)
- [ ] Panel Build menunjukkan progress
- [ ] Setelah selesai, muncul notifikasi "APK(s) generated successfully"
- [ ] Klik "locate" untuk buka folder APK
- [ ] File APK ada di:
  ```
  android\app\build\outputs\apk\debug\app-debug.apk
  ```

### B. Via Command Line (Alternative)
- [ ] Dari root project, jalankan:
  ```powershell
  .\build-apk.ps1 -BuildType debug
  ```
  **ATAU** manual:
  ```powershell
  cd android
  .\gradlew.bat assembleDebug
  cd ..
  ```
- [ ] Build selesai tanpa error
- [ ] File APK ada di lokasi yang sama

### C. Verifikasi APK
- [ ] File `app-debug.apk` ada
- [ ] Ukuran file ~5-15 MB (normal)
- [ ] Nama file lengkap: `app-debug.apk`

**✅ Status Fase 5:** ___ / 1 metode selesai (A atau B)

---

## 📲 FASE 6: Install APK ke Device

### A. Persiapan Device Android
- [ ] Aktifkan Developer Options:
  - [ ] Settings → About Phone
  - [ ] Tap "Build Number" 7 kali
  - [ ] Muncul "You are now a developer"
- [ ] Aktifkan USB Debugging:
  - [ ] Settings → Developer Options
  - [ ] Enable "USB Debugging"
- [ ] Hubungkan HP ke PC via USB

### B. Install via ADB (jika punya kabel USB)
- [ ] Verifikasi device terdeteksi:
  ```powershell
  adb devices
  ```
  Harus muncul device dengan status "device"
- [ ] Install APK:
  ```powershell
  adb install -r android\app\build\outputs\apk\debug\app-debug.apk
  ```
- [ ] Instalasi berhasil (muncul "Success")
- [ ] App muncul di app drawer HP

### C. Install via Transfer File (Alternative)
- [ ] Copy file `app-debug.apk` ke HP (via USB/Bluetooth/sharing)
- [ ] Buka File Manager di HP
- [ ] Tap file APK
- [ ] Jika diminta, izinkan "Install from Unknown Sources"
- [ ] Tap "Install"
- [ ] Instalasi selesai
- [ ] App muncul di app drawer HP

### D. Test Aplikasi
- [ ] Buka aplikasi Vena Pictures di HP
- [ ] Aplikasi terbuka tanpa crash
- [ ] Fitur-fitur berfungsi normal
- [ ] Koneksi ke backend (Supabase) berfungsi

**✅ Status Fase 6:** ___ / 1 metode install selesai (B atau C)

---

## 🎉 SELESAI! Next Steps

Jika semua checklist di atas sudah ✅, selamat! Anda sudah berhasil setup dan build APK.

### Untuk Development Selanjutnya:

**Setiap kali ada perubahan di web app:**
```powershell
npm run build
npx cap sync android
```

**Build APK lagi:**
```powershell
.\build-apk.ps1 -BuildType debug
```

**Buka di Android Studio:**
```powershell
npx cap open android
```

---

## 🏆 Bonus: Build APK Release (untuk Produksi)

Jika sudah siap untuk produksi/distribusi:

- [ ] Baca panduan lengkap di **PANDUAN_BUILD_APK.md**
- [ ] Buat keystore untuk signing:
  - [ ] Android Studio → Build → Generate Signed Bundle / APK
  - [ ] Pilih APK → Create new keystore
  - [ ] Isi form dan **SIMPAN PASSWORD BAIK-BAIK!**
- [ ] Build APK Release signed
- [ ] Backup file keystore (.jks) ke tempat aman
- [ ] APK siap didistribusikan atau diupload ke Play Store

---

## 📊 Ringkasan Progress

```
FASE 1: Instalasi Software        [ ] Selesai
FASE 2: Persiapan Project         [ ] Selesai
FASE 3: Konfigurasi Android       [ ] Selesai
FASE 4: Buka di Android Studio    [ ] Selesai
FASE 5: Build APK Debug           [ ] Selesai
FASE 6: Install APK ke Device     [ ] Selesai

Total Progress: ___ / 6 fase selesai
```

---

## 🆘 Bantuan

Jika ada masalah di salah satu fase:

1. **Cek troubleshooting** di PANDUAN_BUILD_APK.md
2. **Baca detail langkah** di SETUP_ANDROID_STUDIO.md
3. **Jalankan dengan verbose** untuk lihat detail error
4. **Lihat log** di Android Studio panel Build

---

## 📚 Referensi Panduan

- **Quick Start:** `QUICK_START_ANDROID.md`
- **Setup Lengkap:** `SETUP_ANDROID_STUDIO.md`
- **Build APK Detail:** `PANDUAN_BUILD_APK.md`
- **Android Project:** `android\README_ANDROID.md`
- **Ringkasan:** `README_ANDROID_SETUP.md`

---

**✨ Simpan checklist ini dan centang saat Anda melakukan setiap langkah!**

**Estimasi Total Waktu:** 45-90 menit (tergantung kecepatan internet & spesifikasi PC)
