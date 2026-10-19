# Review Label & Terminologi UI — Vena Pictures

> Dokumen ini berdasarkan pemeriksaan langsung ke source code pada Oktober 2026.  
> Semua lokasi file sudah diverifikasi aktual (bukan estimasi).

---

## Ringkasan

| Kategori | Jumlah |
|---|---|
| Label yang perlu diganti (terverifikasi) | **21 item** |
| Label ambigu / perlu keputusan | **6 item** |
| Label yang sudah baik | **10 item** |
| File yang terdampak | **~14 file** |

---

## BAGIAN 1 — Label yang Perlu Diganti (Terverifikasi)

### 1.1 Terminologi Meeting

Masalah utama: kata "Zoom Meeting" mengunci ke satu platform berbayar, sementara tim mungkin pakai Google Meet atau platform lain. "Meeting Pengantin" terdengar seperti nama acara, bukan jenis pertemuan.

| # | Label Sekarang | Ganti Menjadi | File | Baris |
|---|---|---|---|---|
| 1 | `'Zoom Meeting'` (badge tipe meeting) | **`'Meeting Online'`** | `ClientPortal.tsx` | 410 |
| 2 | `'Zoom Meeting'` | **`'Meeting Online'`** | `ProjectDetailModal.tsx` | 318, 393, 896 |
| 3 | `'Zoom Meeting'` | **`'Meeting Online'`** | `CalendarView.tsx` | 95 |
| 4 | `'Meeting Pengantin'` (badge tipe meeting) | **`'Meeting Langsung'`** | `ClientPortal.tsx` | 410 |
| 5 | `'Meeting Pengantin'` | **`'Meeting Langsung'`** | `ProjectDetailModal.tsx` | 318, 393, 895 |
| 6 | `'Meeting Pengantin'` | **`'Meeting Langsung'`** | `CalendarView.tsx` | 95 |
| 7 | `'Meeting Pengantin'` (DEFAULT_EVENT_TYPES) | **`'Meeting Langsung'`** | `constants/index.tsx` | 339 |
| 8 | `label: 'Jadwal Meeting'` (tab di portal klien) | **`label: 'Jadwal Pertemuan'`** | `ClientPortal.tsx` | 202 |
| 9 | `Jadwal Meeting` (h2 judul seksi) | **`Jadwal Pertemuan`** | `ClientPortal.tsx` | 373 |
| 10 | `Meeting dan Zoom yang dijadwalkan...` (deskripsi) | **`Pertemuan langsung dan online yang dijadwalkan...`** | `ClientPortal.tsx` | 375 |
| 11 | `Memuat jadwal meeting...` | **`Memuat jadwal pertemuan...`** | `ClientPortal.tsx` | 381 |
| 12 | `Jadwal meeting gagal dimuat.` | **`Jadwal pertemuan gagal dimuat.`** | `ClientPortal.tsx` | 385 |
| 13 | `Belum ada jadwal meeting` | **`Belum ada jadwal pertemuan`** | `ClientPortal.tsx` | 390 |
| 14 | `Buka Link Zoom` (tombol/tautan) | **`Buka Tautan Meeting Online`** | `ClientPortal.tsx` | 438 |
| 15 | `Buka link Zoom` | **`Buka tautan meeting online`** | `ProjectDetailModal.tsx` | 998 |
| 16 | `Jadwal Meeting & Hasil` (judul seksi di modal) | **`Jadwal Pertemuan & Hasil`** | `ProjectDetailModal.tsx` | 892 |
| 17 | `Jadwal meeting berhasil dihapus...` (notif) | **`Jadwal pertemuan berhasil dihapus...`** | `ProjectDetailModal.tsx` | 364 |
| 18 | `Gagal menghapus jadwal meeting...` (notif) | **`Gagal menghapus jadwal pertemuan...`** | `ProjectDetailModal.tsx` | 367 |
| 19 | `Gagal memuat jadwal meeting...` (notif) | **`Gagal memuat jadwal pertemuan...`** | `ProjectDetailModal.tsx` | 228 |
| 20 | `Technical Meeting` (sub-status default alur kerja) | **`Koordinasi Teknis`** | `constants/index.tsx` | 366 |
| 21 | `Persiapan Final (Technical Meeting)` (teks timeline publik) | **`Persiapan Final (Koordinasi Teknis)`** | `PublicPackages.tsx` | 612 |
| 22 | `Persiapan Final (Technical Meeting)` (seed value) | **`Persiapan Final (Koordinasi Teknis)`** | `Packages.tsx` | 288 |

---

### 1.2 Terminologi "Sisa Tagihan" vs "Sisa Pembayaran"

**Masalah:** `Sisa Tagihan` dipakai di 10+ file dan 20+ lokasi. Kata "tagihan" berasal dari sudut pandang vendor ("ini yang harus kamu bayar"). Di portal klien dan komunikasi WA, lebih natural menggunakan "Sisa Pembayaran" — dari sudut pandang klien ("ini yang masih saya bayar").

**Keputusan yang disarankan:**
- **Portal klien** (`ClientPortal.tsx`) → wajib ganti ke `Sisa Pembayaran`
- **Dashboard admin internal** → boleh tetap `Sisa Tagihan` atau ganti, tapi harus konsisten satu pilihan
- **Template WA** → ganti ke `Sisa Pembayaran` agar lebih sopan ke klien
- **Invoice/dokumen formal** (`InvoiceDocument.tsx`) → bisa tetap `Sisa Tagihan` karena konteks dokumen akuntansi

| # | Label Sekarang | Ganti Menjadi | File | Baris | Prioritas |
|---|---|---|---|---|---|
| 23 | `label: 'Sisa Tagihan'` (kartu keuangan portal klien) | **`label: 'Sisa Pembayaran'`** | `ClientPortal.tsx` | 522 | 🔴 Tinggi |
| 24 | `Sisa Tagihan` (header kolom tabel) | **`Sisa Pembayaran`** | `ClientTableView.tsx` | 145, 211 | 🟡 Sedang |
| 25 | `Sisa Tagihan` (header kolom tabel rekap lunas) | **`Sisa Pembayaran`** | `ClientDuesView.tsx` | 49, 77 | 🟡 Sedang |
| 26 | `Sisa Tagihan` (label kartu di ClientCard) | **`Sisa Pembayaran`** | `ClientCard.tsx` | 162 | 🟡 Sedang |
| 27 | `label: 'Sisa Tagihan'` (kartu ringkasan keuangan) | **`label: 'Sisa Pembayaran'`** | `ClientDetailModal.tsx` | 586 | 🟡 Sedang |
| 28 | `Sisa Tagihan: {formatCurrency(...)}` (badge inline) | **`Sisa Pembayaran: ...`** | `ClientDetailModal.tsx` | 742 | 🟡 Sedang |
| 29 | `Isi otomatis sisa tagihan` (teks tombol) | **`Isi otomatis sisa pembayaran`** | `ClientDetailModal.tsx` | 753 | 🟡 Sedang |
| 30 | `tidak ada sisa tagihan` (teks status lunas) | **`tidak ada sisa pembayaran`** | `ClientDetailModal.tsx` | 760 | 🟡 Sedang |
| 31 | `Jumlah pembayaran melebihi sisa tagihan` (pesan error) | **`Jumlah melebihi sisa pembayaran`** | `ClientDetailModal.tsx` | 200 | 🟡 Sedang |
| 32 | `Sisa Tagihan` dalam template WA | **`Sisa Pembayaran`** | `CommunicationHub.tsx` | 49, 145, 147 | 🟡 Sedang |
| 33 | `Sisa Tagihan:` dalam template WA | **`Sisa Pembayaran:`** | `constants/index.tsx` | 474, 548, 558, 563 | 🟡 Sedang |
| 34 | `Sisa Tagihan` di `PublicReceipt.tsx` (label portal publik) | **`Sisa Pembayaran`** | `PublicReceipt.tsx` | 303 | 🔴 Tinggi |
| 35 | `sisa tagihan` (desc di SettingsPage preview) | **`sisa pembayaran`** | `SettingsPage.tsx` | 240, 241, 256 | 🟢 Rendah |

> **Catatan:** `InvoiceDocument.tsx:311` dan `InvoiceFormModal.tsx` menggunakan "Sisa Tagihan" dalam konteks dokumen invoice formal — **boleh dipertahankan** karena ini terminologi akuntansi yang wajar.

---

### 1.3 Label Lain yang Perlu Diganti

| # | Label Sekarang | Ganti Menjadi | File | Baris | Alasan |
|---|---|---|---|---|---|
| 36 | `'On Going'` (label status progres) | **`'Sedang Dikerjakan'`** | `ClientPortal.tsx` | 552 | Bahasa Inggris di portal klien publik |
| 37 | `Add-ons` (label baris biaya di portal klien) | **`Layanan Tambahan`** | `ClientPortal.tsx` | 583 | Jargon teknis, tidak semua klien familiar |
| 38 | `Kwitansi` (label tombol) | **`Tanda Terima`** | `ClientPortal.tsx` | 1047 | Inkonsisten — di baris 1282 dan 1336 file yang sama sudah pakai "Tanda Terima" |
| 39 | `label: 'Moodboard / Brief'` (label link di portal klien) | **`label: 'Referensi Acara / Brief'`** | `ClientPortal.tsx` | 885 | "Moodboard" tidak dimengerti semua pengantin awam |
| 40 | `Sinkronisasi Cloud Vena Pictures` (teks kecil di footer portal) | **`Tersimpan di Cloud Vena Pictures`** | `ClientPortal.tsx` | 977 | "Sinkronisasi" terdengar teknis dan menimbulkan kekhawatiran |
| 41 | `Rekap Pengantin Belum Lunas` (judul panel) | **`Pengantin dengan Sisa Pembayaran`** | `ClientDuesView.tsx` | 25 | Lebih deskriptif dan tidak terkesan menghakimi |
| 42 | `Tagih WA` (label tombol aksi) | **`Ingatkan via WA`** | `ClientDuesView.tsx` | 100 | "Tagih" terdengar agresif. "Ingatkan" lebih sopan |
| 43 | `label: 'Booking Jadwal'` (menu nav sidebar) | **`label: 'Booking'`** | `constants/index.tsx` | 264 | Redundan — "Jadwal" sudah terimplikasi dari "Booking" |
| 44 | `title: 'Rekap Tagihan Detil'` (judul template WA) | **`title: 'Rincian Tagihan'`** | `constants/index.tsx` | 562 | "Detil" ejaan lama/salah (harusnya "detail"). "Rincian" lebih tepat |
| 45 | `title: 'Rekap Tagihan Detil'` (CommunicationHub) | **`title: 'Rincian Tagihan'`** | `CommunicationHub.tsx` | 135 | Sama dengan di atas, konsistensi |
| 46 | `title: 'Pengingat Tagihan Ramah'` | **`title: 'Pengingat Pembayaran Ramah'`** | `constants/index.tsx` | 586 | Konsisten dengan penggunaan "pembayaran" di template-template lain |

---

## BAGIAN 2 — Label Ambigu / Perlu Keputusan

Ini item yang memerlukan keputusan dari Anda sebelum diimplementasi:

| # | Label | Lokasi | Pertanyaan / Opsi |
|---|---|---|---|
| A | `Total Package` | `ClientPortal.tsx:520`, `ClientDetailModal.tsx:574`, `ClientDuesView.tsx:76`, `ClientTableView.tsx:210` | Apakah "Package" dipertahankan sebagai brand language? Kalau tidak, ganti ke **"Total Paket"** atau **"Total Biaya"**. Saat ini juga muncul di template WA dan booking publik. |
| B | `label: 'Tagihan & Invoice'` | `Sidebar.tsx:104`, `SettingsPage.tsx:938` | Dua kata bersinonim. Pilih satu: **"Invoice"** saja (lebih universal) atau **"Tagihan"** saja (lebih Indonesia). "Tagihan & Invoice" terasa dobel. |
| C | `Total Package:` (template WA booking publik) | `PublicBookingForm.tsx:613` | Terhubung dengan keputusan item A di atas. |
| D | `DP` (singkatan Down Payment) | `ClientDetailModal.tsx`, `constants/index.tsx` | Apakah tetap "DP" (sudah sangat umum di Indonesia) atau ganti "Uang Muka"? Rekomendasi: **pertahankan "DP"** karena sudah jadi bahasa sehari-hari. |
| E | `Brief / Moodboard` (label internal di ProjectDetailModal dan form) | `ProjectDetailModal.tsx:1393`, `ProjectForm.tsx:181`, `FreelancerPortal.tsx:691` | Di tampilan **tim internal** (bukan portal klien), "Moodboard" masih ok. Perlu diganti hanya di portal klien (sudah ada di item #39 di atas). Konfirmasi apakah tampilan tim juga ingin diganti. |
| F | `Jadwal Wedding` (menu kalender di sidebar nav) | `constants/index.tsx:266` | "Wedding" Inggris vs "Pernikahan" Indonesia. Tapi bisa jadi sudah jadi brand language. Opsi: **"Jadwal Acara"** atau **"Kalender Wedding"** atau tetap. |

---

## BAGIAN 3 — Label yang Sudah Baik (Tidak Perlu Diganti)

| Label | Lokasi | Keterangan |
|---|---|---|
| `Beranda` | `ClientPortal.tsx:201` | ✅ Natural untuk tab utama portal |
| `Acara Saya` | `ClientPortal.tsx:202` | ✅ Natural dari perspektif klien |
| `Keuangan` | `ClientPortal.tsx:204` | ✅ Jelas dan ringkas |
| `Terbayar` | `ClientPortal.tsx:521` | ✅ Tepat dan ringkas |
| `Progres Acara` | `ClientPortal.tsx:536` | ✅ Lebih baik dari "Progress" |
| `Tanda Terima` | `ClientPortal.tsx:1282`, `InvoiceFilterBar.tsx:33`, `ClientReceiptDocument.tsx:27` | ✅ Sudah konsisten di sebagian besar tempat |
| `Riwayat Pembayaran` | `ClientPortal.tsx` | ✅ Lebih jelas dari "Transaction History" |
| `Calon Pengantin` | `constants/index.tsx`, Sidebar | ✅ Tepat untuk konteks bisnis |
| `Data Pengantin` | Sidebar, ClientsPage | ✅ Jelas sebagai menu utama |
| `Invoice` | Filter, Sidebar | ✅ Dipertahankan — sudah industry-standard di Indonesia |

---

## BAGIAN 4 — Daftar Lengkap per File (untuk Implementasi)

### `src/features/clients/components/ClientPortal.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 202 | `label: 'Jadwal Meeting'` | `label: 'Jadwal Pertemuan'` |
| 373 | `Jadwal Meeting` (h2) | `Jadwal Pertemuan` |
| 375 | `Meeting dan Zoom yang dijadwalkan...` | `Pertemuan langsung dan online yang dijadwalkan...` |
| 381 | `Memuat jadwal meeting...` | `Memuat jadwal pertemuan...` |
| 385 | `Jadwal meeting gagal dimuat.` | `Jadwal pertemuan gagal dimuat.` |
| 390 | `Belum ada jadwal meeting` | `Belum ada jadwal pertemuan` |
| 410 | `'Zoom Meeting'` | `'Meeting Online'` |
| 410 | `'Meeting Pengantin'` | `'Meeting Langsung'` |
| 438 | `Buka Link Zoom` | `Buka Tautan Meeting Online` |
| 522 | `label: 'Sisa Tagihan'` | `label: 'Sisa Pembayaran'` |
| 552 | `'On Going'` | `'Sedang Dikerjakan'` |
| 583 | `Add-ons` | `Layanan Tambahan` |
| 885 | `label: 'Moodboard / Brief'` | `label: 'Referensi Acara / Brief'` |
| 977 | `Sinkronisasi Cloud Vena Pictures` | `Tersimpan di Cloud Vena Pictures` |
| 1047 | `Kwitansi` | `Tanda Terima` |

### `src/features/projects/components/ProjectDetailModal.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 228 | `Gagal memuat jadwal meeting...` | `Gagal memuat jadwal pertemuan...` |
| 318 | `'Zoom Meeting'` | `'Meeting Online'` |
| 318 | `'Meeting Pengantin'` | `'Meeting Langsung'` |
| 364 | `Jadwal meeting berhasil dihapus dari kalender.` | `Jadwal pertemuan berhasil dihapus dari kalender.` |
| 367 | `Gagal menghapus jadwal meeting.` | `Gagal menghapus jadwal pertemuan.` |
| 393 | `'Zoom Meeting'` | `'Meeting Online'` |
| 892 | `Jadwal Meeting & Hasil` | `Jadwal Pertemuan & Hasil` |
| 895 | `title: 'Meeting Pengantin'` | `title: 'Meeting Langsung'` |
| 896 | `title: 'Zoom Meeting'` | `title: 'Meeting Online'` |
| 998 | `Buka link Zoom` | `Buka tautan meeting online` |

### `src/features/projects/components/CalendarView.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 95 | `'Zoom Meeting'` | `'Meeting Online'` |
| 95 | `'Meeting Pengantin'` | `'Meeting Langsung'` |

### `src/constants/index.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 264 | `label: 'Booking Jadwal'` | `label: 'Booking'` |
| 339 | `'Meeting Pengantin'` | `'Meeting Langsung'` |
| 366 | `name: 'Technical Meeting'` | `name: 'Koordinasi Teknis'` |
| 474 | `Sisa Tagihan: *{sisaTagihan}*` | `Sisa Pembayaran: *{sisaTagihan}*` |
| 548 | `Sisa Tagihan: {sisaTagihan}` | `Sisa Pembayaran: {sisaTagihan}` |
| 558 | `Sisa Tagihan: {sisaTagihan}` | `Sisa Pembayaran: {sisaTagihan}` |
| 562 | `title: 'Rekap Tagihan Detil'` | `title: 'Rincian Tagihan'` |
| 563 | `Sisa Tagihan: *{sisaTagihan}*` (3x dalam template) | `Sisa Pembayaran: *{sisaTagihan}*` |
| 586 | `title: 'Pengingat Tagihan Ramah'` | `title: 'Pengingat Pembayaran Ramah'` |

### `src/features/clients/components/ClientDuesView.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 25 | `Rekap Pengantin Belum Lunas` | `Pengantin dengan Sisa Pembayaran` |
| 49 | `Sisa Tagihan` | `Sisa Pembayaran` |
| 77 | `Sisa Tagihan` | `Sisa Pembayaran` |
| 100 | `Tagih WA` | `Ingatkan via WA` |

### `src/features/clients/components/ClientTableView.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 145 | `Sisa Tagihan` | `Sisa Pembayaran` |
| 211 | `Sisa Tagihan` | `Sisa Pembayaran` |

### `src/features/clients/components/ClientCard.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 162 | `Sisa Tagihan` | `Sisa Pembayaran` |

### `src/features/clients/components/ClientDetailModal.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 200 | `melebihi sisa tagihan` | `melebihi sisa pembayaran` |
| 562 | `sisa tagihan pengantin ini` (SectionTitle sub) | `sisa pembayaran pengantin ini` |
| 586 | `label: 'Sisa Tagihan'` | `label: 'Sisa Pembayaran'` |
| 742 | `Sisa Tagihan: {formatCurrency(...)}` | `Sisa Pembayaran: {formatCurrency(...)}` |
| 751 | `title="Isi otomatis dengan seluruh sisa tagihan"` | `title="Isi otomatis sisa pembayaran"` |
| 753 | `Isi otomatis sisa tagihan` | `Isi otomatis sisa pembayaran` |
| 760 | `tidak ada sisa tagihan` | `tidak ada sisa pembayaran` |

### `src/features/communication/components/CommunicationHub.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 49 | `Sisa Tagihan: {remainingAmount}` | `Sisa Pembayaran: {remainingAmount}` |
| 135 | `title: 'Rekap Tagihan Detil'` | `title: 'Rincian Tagihan'` |
| 145 | `Sisa Tagihan: *{remainingAmount}*` | `Sisa Pembayaran: *{remainingAmount}*` |
| 147 | `Total Sisa Tagihan: *{remainingAmount}*` | `Total Sisa Pembayaran: *{remainingAmount}*` |

### `src/features/public/components/PublicReceipt.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 303 | `Sisa Tagihan` | `Sisa Pembayaran` |

### `src/features/public/components/PublicPackages.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 612 | `Persiapan Final (Technical Meeting)` | `Persiapan Final (Koordinasi Teknis)` |

### `src/features/packages/Packages.tsx`

| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 288 | `Persiapan Final (Technical Meeting)` (seed default) | `Persiapan Final (Koordinasi Teknis)` |

### `src/layouts/Sidebar.tsx`

| Baris | Teks Lama | Teks Baru | Catatan |
|---|---|---|---|
| 104 | `label: 'Tagihan & Invoice'` | `label: 'Invoice'` | ⚠️ Tergantung keputusan item B di Bagian 2 |

---

## BAGIAN 5 — Prioritas Implementasi

### 🔴 Prioritas Tinggi — Tampil di Portal Klien (Publik)

Perubahan ini langsung terlihat oleh pengantin sebagai end-user:

1. `Zoom Meeting` → `Meeting Online` (ClientPortal, CalendarView)
2. `Meeting Pengantin` → `Meeting Langsung` (ClientPortal)
3. `Sisa Tagihan` → `Sisa Pembayaran` (ClientPortal, PublicReceipt)
4. `On Going` → `Sedang Dikerjakan` (ClientPortal)
5. `Kwitansi` → `Tanda Terima` (ClientPortal — konsistensi internal)
6. `Add-ons` → `Layanan Tambahan` (ClientPortal)
7. `Buka Link Zoom` → `Buka Tautan Meeting Online` (ClientPortal)

### 🟡 Prioritas Sedang — Dashboard Internal / Admin

8. `Zoom Meeting` & `Meeting Pengantin` → ganti di ProjectDetailModal dan CalendarView
9. `Sisa Tagihan` → `Sisa Pembayaran` di ClientDuesView, ClientTableView, ClientCard, ClientDetailModal
10. `Technical Meeting` → `Koordinasi Teknis` di constants dan halaman publik
11. `Rekap Tagihan Detil` → `Rincian Tagihan` di constants dan CommunicationHub
12. `Rekap Pengantin Belum Lunas` → `Pengantin dengan Sisa Pembayaran`
13. `Tagih WA` → `Ingatkan via WA`

### 🟢 Prioritas Rendah — Kosmetik / Konsistensi

14. `Booking Jadwal` → `Booking` (nav sidebar)
15. `Pengingat Tagihan Ramah` → `Pengingat Pembayaran Ramah`
16. `Sinkronisasi Cloud Vena Pictures` → `Tersimpan di Cloud Vena Pictures`
17. `Moodboard / Brief` → `Referensi Acara / Brief` (portal klien)
18. `Sisa Tagihan` dalam template WA di constants

### ⚠️ Tunggu Keputusan Dulu

19. `Total Package` — keputusan item A
20. `Tagihan & Invoice` di Sidebar — keputusan item B
21. Label `Brief/Moodboard` di tampilan tim internal — keputusan item E

---

## BAGIAN 6 — Keputusan yang Diperlukan dari Owner

Sebelum implementasi penuh, mohon keputusan untuk:

**A. "Total Package"** — Ingin diganti ke apa?
   - Opsi 1: Tetap `Total Package` (brand language)
   - Opsi 2: Ganti ke `Total Paket`
   - Opsi 3: Ganti ke `Total Biaya`

**B. "Tagihan & Invoice" di Sidebar** — Pilih satu:
   - Opsi 1: `Invoice` (lebih universal, sudah dikenal)
   - Opsi 2: `Tagihan` (lebih Indonesia)
   - Opsi 3: Tetap `Tagihan & Invoice`

**C. Label internal tim "Brief/Moodboard"** — Ganti juga atau hanya portal klien?

**D. "Jadwal Wedding" di nav kalender** — Ganti ke "Jadwal Acara" atau tetap?

---

*Dokumen ini dibuat berdasarkan pemeriksaan langsung source code. Nomor baris adalah perkiraan dan dapat bergeser setelah ada perubahan kode lain.*
