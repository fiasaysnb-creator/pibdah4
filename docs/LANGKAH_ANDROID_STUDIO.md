# 📱 Langkah-langkah Build APK di Android Studio

## ✅ Status: Android Studio sudah dibuka!

Project Android sudah dibuka di Android Studio. Ikuti langkah-langkah berikut:

---

## 🎯 LANGKAH 1: Tunggu Gradle Sync Selesai

Setelah Android Studio terbuka, di bagian bawah Anda akan melihat:

```
⏳ Gradle sync in progress...
```

**PENTING:** Tunggu hingga selesai! Ini bisa memakan waktu 2-10 menit pertama kali.

Status selesai akan menampilkan:
```
✅ Gradle sync finished in X s
```

### Jika ada masalah:
- Klik icon 🐘 (Sync Project with Gradle Files) di toolbar atas
- Atau: File > Sync Project with Gradle Files

---

## 🎯 LANGKAH 2: Pastikan Build Variant = Release atau Debug

Di panel kiri, lihat "Build Variants":
- Jika tidak terlihat, buka: View > Tool Windows > Build Variants
- Pilih **release** untuk APK produksi
- Pilih **debug** untuk APK testing (lebih cepat)

---

## 🎯 LANGKAH 3: Build APK

### Untuk APK Debug (Testing - TERCEPAT):

1. Klik menu: **Build**
2. Pilih: **Build Bundle(s) / APK(s)**
3. Klik: **Build APK(s)**

   ```
   Build
   └── Build Bundle(s) / APK(s)
       └── Build APK(s)  ← Klik ini
   ```

4. Tunggu proses build (2-5 menit pertama kali)

5. Setelah selesai, akan muncul notifikasi hijau di kanan bawah:
   ```
   ✅ APK(s) generated successfully for 1 module:
      Module 'app': locate or analyze the APK
   ```

6. **Klik "locate"** untuk membuka folder APK

---

### Untuk APK Release (Produksi - Perlu Signing):

1. Klik menu: **Build**
2. Pilih: **Generate Signed Bundle / APK**

   ```
   Build
   └── Generate Signed Bundle / APK...  ← Klik ini
   ```

3. Pilih **APK** → Klik **Next**

4. **Buat Keystore Baru** (jika belum punya):
   
   a. Klik **Create new...** di bagian "Key store path"
   
   b. Isi form berikut:
   ```
   Key store path:     D:\weddfin-release-key.jks
   Password:           [Buat password kuat, SIMPAN BAIK-BAIK!]
   Confirm:            [Ketik ulang password]
   
   Alias:              weddfin-key
   Password:           [Buat password, SIMPAN BAIK-BAIK!]
   Confirm:            [Ketik ulang password]
   Validity (years):   25
   
   Certificate:
   First and Last Name:    [Nama Anda]
   Organization Unit:      Photography
   Organization:           Vena Pictures
   City or Locality:       [Kota Anda]
   State or Province:      [Provinsi Anda]
   Country Code:           ID
   ```
   
   c. Klik **OK**
   
   ⚠️ **SANGAT PENTING:** 
   - Backup file `.jks` dan password ke tempat aman!
   - Tanpa ini, Anda tidak bisa update app di masa depan!

5. Setelah keystore dibuat, pilih:
   - Build Variants: **release**
   - Signature Versions: ✅ V1 dan ✅ V2

6. Klik **Finish**

7. Tunggu proses build selesai

8. APK akan tersimpan di: `android/app/release/app-release.apk`

---

## 📂 Lokasi File APK

### APK Debug:
```
D:\aplikasi 2026 benar\vendor phtotogrpahy 20206\atter\android\app\build\outputs\apk\debug\app-debug.apk
```

### APK Release (Signed):
```
D:\aplikasi 2026 benar\vendor phtotogrpahy 20206\atter\android\app\release\app-release.apk
```

---

## 📱 Cara Install APK ke HP Android

### Opsi 1: Via USB Cable (ADB)

1. **Aktifkan USB Debugging di HP:**
   - Buka Settings → About Phone
   - Tap "Build Number" 7 kali (akan muncul "You are now a developer")
   - Kembali ke Settings → Developer Options
   - Aktifkan "USB Debugging"

2. **Hubungkan HP ke komputer via USB**

3. **Di Android Studio:**
   - Klik ▶️ (Run) di toolbar atas
   - Pilih HP Anda dari daftar devices
   - App akan otomatis terinstall dan terbuka

### Opsi 2: Via File Transfer (Manual)

1. Copy file APK ke HP Anda:
   - Via USB: Copy file APK ke folder Download di HP
   - Via WhatsApp: Kirim file ke diri sendiri
   - Via Google Drive/Dropbox: Upload lalu download di HP

2. **Di HP Android:**
   - Buka File Manager
   - Cari file `app-debug.apk` atau `app-release.apk`
   - Tap file APK
   - Jika muncul warning "Install from Unknown Sources":
     - Tap Settings
     - Aktifkan "Allow from this source"
     - Kembali dan tap Install
   - Tap **Install**
   - Tunggu hingga selesai
   - Tap **Open** untuk membuka app

---

## 🐛 Troubleshooting

### ❌ Problem: "SDK location not found"

**Solusi:**
1. Di Android Studio, buka: File > Project Structure
2. Tab SDK Location
3. Pastikan Android SDK Location terisi, contoh:
   ```
   C:\Users\PC - SIGAMPANG\AppData\Local\Android\Sdk
   ```
4. Jika kosong, klik "Edit" dan install Android SDK

### ❌ Problem: "Gradle sync failed"

**Solusi:**
1. Klik: File > Invalidate Caches and Restart
2. Pilih "Invalidate and Restart"
3. Tunggu Android Studio restart
4. Tunggu Gradle sync otomatis

### ❌ Problem: "Execution failed for task ':app:mergeDebugResources'"

**Solusi:**
1. Klik: Build > Clean Project
2. Tunggu selesai
3. Klik: Build > Rebuild Project

### ❌ Problem: APK tidak bisa diinstall di HP

**Solusi:**
- Pastikan "Install from Unknown Sources" aktif
- Untuk Android 8+, izin ini per-aplikasi (File Manager/Browser)
- Hapus versi app lama jika ada
- Untuk release APK, pastikan sudah di-sign dengan keystore

---

## ✅ Checklist Lengkap

**Persiapan:**
- [x] Android Studio sudah terbuka
- [ ] Gradle sync selesai (tunggu notifikasi hijau)
- [ ] Build Variant dipilih (debug atau release)

**Build APK Debug:**
- [ ] Klik Build > Build Bundle(s) / APK(s) > Build APK(s)
- [ ] Tunggu build selesai (2-5 menit)
- [ ] Klik "locate" untuk buka folder APK
- [ ] Copy APK ke HP

**Build APK Release:**
- [ ] Klik Build > Generate Signed Bundle / APK
- [ ] Pilih APK → Next
- [ ] Buat/pilih keystore
- [ ] Backup keystore dan password (PENTING!)
- [ ] Pilih release variant
- [ ] Klik Finish
- [ ] Tunggu build selesai
- [ ] Copy APK ke HP

**Install di HP:**
- [ ] Copy APK ke HP
- [ ] Aktifkan "Install from Unknown Sources"
- [ ] Tap APK dan install
- [ ] Buka aplikasi

---

## 💡 Tips Penting

### 🚀 Tips Build Cepat:
- Gunakan **debug variant** untuk testing (tidak perlu signing)
- Gunakan **release variant** untuk produksi/distribusi
- First build akan lama (5-10 menit), build berikutnya lebih cepat

### 🔐 Tips Keamanan:
- **BACKUP KEYSTORE (.jks)** dan password ke:
  - Google Drive (private)
  - USB Flash Drive
  - Password Manager
- Jangan pernah share keystore ke orang lain
- Tanpa keystore, Anda tidak bisa update app!

### 📱 Tips Testing:
- Test APK debug dulu sebelum build release
- Test di beberapa HP Android dengan versi berbeda
- Cek semua fitur bekerja dengan baik

---

## 🎉 Selamat!

Jika sudah berhasil build dan install APK, aplikasi **Vena Pictures** Anda sudah siap digunakan!

**Aplikasi Info:**
- 📱 App: Vena Pictures
- 📦 Package: com.weddfin.app
- 🌐 Server: https://keuanganvendor.netlify.app
- 🤖 Min Android: 6.0 (API 23)
- 🎯 Target Android: 15 (API 35)

---

**🆘 Butuh bantuan?**
Jika ada error atau masalah, screenshot error message dan tanyakan!
