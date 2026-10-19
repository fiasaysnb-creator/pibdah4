# Laporan Analisis Label & Terminologi UI — Vena Pictures

**Tanggal Analisis:** Dilakukan terhadap codebase di `d:\honesty\src\`
**Fokus:** Terminologi bisnis, label UI, dan teks yang tampil ke pengguna Indonesia

---

## RINGKASAN EKSEKUTIF

Dari analisis menyeluruh terhadap 100+ file TSX di seluruh `src/features/`, ditemukan **24 label/teks bermasalah** yang perlu diganti, **9 label ambigu**, dan **12 label yang sudah baik**. Masalah utama terbagi menjadi tiga kategori:
1. **Istilah campuran Inggris-Indonesia** yang membingungkan pengguna awam (contoh: *Zoom Meeting*, *On Going*, *Add-ons*)
2. **Inkonsistensi terminologi** untuk konsep yang sama di lokasi berbeda (contoh: *Sisa Tagihan* vs *Sisa Pembayaran* dipakai bergantian)
3. **Terminologi teknis** yang tidak familiar bagi pengantin sebagai pengguna portal publik (contoh: *Moodboard*, *Technical Meeting*)

---

## BAGIAN 1: LABEL YANG PERLU DIGANTI

### 1.1 Terminologi Meeting

| # | Label Saat Ini | Rekomendasi Ganti | File & Baris | Alasan |
|---|---|---|---|---|
| 1 | `Zoom Meeting` | **`Meeting Online`** | `ClientPortal.tsx:410`, `CalendarView.tsx:95`, `ProjectDetailModal.tsx:318,393,897` | "Zoom" adalah merek dagang spesifik. Pengguna mungkin menggunakan Google Meet, Whereby, dll. "Meeting Online" lebih netral dan familiar |
| 2 | `Meeting Pengantin` | **`Meeting Langsung`** | `ClientPortal.tsx:410`, `CalendarView.tsx:95`, `ProjectDetailModal.tsx:318,393,895`, `constants/index.tsx:339` | "Meeting Pengantin" terdengar seperti acara, bukan jenis pertemuan. "Meeting Langsung" lebih jelas kontrasnya dengan Meeting Online |
| 3 | `Jadwal Meeting` (tab di portal) | **`Jadwal Pertemuan`** | `ClientPortal.tsx:202,373` | Kata "meeting" adalah Inggris murni. Di portal yang dilihat klien, lebih sopan memakai Bahasa Indonesia |
| 4 | `Memuat jadwal meeting...` | **`Memuat jadwal pertemuan...`** | `ClientPortal.tsx:381` | Konsisten dengan penggantian no. 3 |
| 5 | `Jadwal meeting gagal dimuat` | **`Jadwal pertemuan gagal dimuat`** | `ClientPortal.tsx:385` | Konsisten dengan penggantian no. 3 |
| 6 | `Belum ada jadwal meeting` | **`Belum ada jadwal pertemuan`** | `ClientPortal.tsx:390` | Konsisten dengan penggantian no. 3 |
| 7 | `Catatan meeting` | **`Catatan Pertemuan`** | `ClientPortal.tsx:446` | Konsisten dengan penggantian no. 3 |
| 8 | `Meeting dan Zoom yang dijadwalkan...` | **`Pertemuan dan meeting online yang dijadwalkan...`** | `ClientPortal.tsx:375` | Deskripsi di bawah judul; perlu disesuaikan |
| 9 | `Buka Link Zoom` | **`Buka Tautan Meeting Online`** | `ClientPortal.tsx:438`, `ProjectDetailModal.tsx:998` | "Link" adalah Inggris, sudah tersedia padanan "Tautan" |
| 10 | `Technical Meeting` (sub-status default) | **`Koordinasi Teknis`** | `constants/index.tsx:367` | Istilah Inggris dalam alur kerja default yang di-seed ke pengguna baru. "Koordinasi Teknis" lebih familiar |
| 11 | `Jadwal Meeting & Hasil` (judul seksi) | **`Jadwal Pertemuan & Hasil`** | `ProjectDetailModal.tsx:892` | Konsistensi dengan penggantian di atas |

---

### 1.2 Terminologi Keuangan — "Tagihan" vs "Pembayaran"

> **Masalah inti:** Kata "tagihan" berarti *hal yang harus dibayar* (dari sudut pandang vendor), sedangkan dari sudut pandang klien lebih natural menggunakan "sisa pembayaran". Saat ini keduanya dipakai bergantian secara tidak konsisten.

| # | Label Saat Ini | Rekomendasi Ganti | File & Baris | Alasan |
|---|---|---|---|---|
| 12 | `Sisa Tagihan` (di portal klien) | **`Sisa Pembayaran`** | `ClientPortal.tsx:522`, `ClientPortal.tsx:605` (label "Sisa"), `ClientDuesView.tsx:49,78`, `ClientTableView.tsx:145,211`, `InvoicePreviewModal.tsx:394`, `InvoiceFormModal.tsx:613`, `InvoiceDocument.tsx:311`, `InvoiceStatsBar.tsx:66`, `PublicReceipt.tsx:303` | Dari perspektif klien yang melihat portal, "berapa yang masih harus saya bayar" lebih intuitif sebagai "Sisa Pembayaran". "Tagihan" berkonotasi tagihan dari pihak luar/perusahaan yang agak formal/kaku |
| 13 | `Rekap Pengantin Belum Lunas` | **`Pengantin dengan Sisa Pembayaran`** | `ClientDuesView.tsx:25` | "Rekap" membingungkan, dan "Belum Lunas" negatif. "Pengantin dengan Sisa Pembayaran" lebih deskriptif dan netral |
| 14 | `Rekap Tagihan Detil` (judul template WA) | **`Rincian Tagihan`** | `constants/index.tsx:562`, `CommunicationHub.tsx:135` | "Detil" adalah ejaan lama/salah (seharusnya "detail"). "Rincian Tagihan" lebih tepat secara ejaan dan makna |
| 15 | `Pengingat Tagihan Ramah` (judul template WA) | **`Pengingat Pembayaran Ramah`** | `constants/index.tsx:586` | Konsisten dengan penggunaan "pembayaran" dari perspektif klien |
| 16 | `Total Package` (sebagai label keuangan) | **`Harga Total`** atau **`Total Biaya Paket`** | `ClientPortal.tsx:520`, `ClientDuesView.tsx:76`, `ClientTableView.tsx:210`, `ClientDetailModal.tsx:574` | "Package" adalah kata Inggris. Di kolom keuangan, lebih clear pakai "Harga Total" atau "Total Biaya Paket" |
| 17 | `Sisa Tagihan (Balance Due)` | **`Sisa Pembayaran`** | `InvoicePreviewModal.tsx:394` | Redundan menampilkan Inggris dalam tanda kurung. Cukup "Sisa Pembayaran" saja |

---

### 1.3 Terminologi Teknis Lainnya

| # | Label Saat Ini | Rekomendasi Ganti | File & Baris | Alasan |
|---|---|---|---|---|
| 18 | `On Going` (label status progres) | **`Sedang Dikerjakan`** | `ClientPortal.tsx:552` | "On Going" adalah dua kata bahasa Inggris yang muncul di portal klien. Tidak familier bagi semua pengguna |
| 19 | `Add-ons` (dalam ringkasan biaya portal) | **`Layanan Tambahan`** | `ClientPortal.tsx:583` | "Add-ons" adalah jargon teknis. "Layanan Tambahan" lebih deskriptif untuk klien |
| 20 | `Moodboard / Brief` (label file) | **`Referensi Acara / Brief`** | `ClientPortal.tsx:885`, `FreelancerPortal.tsx:691`, `ProjectDetailModal.tsx:1393` | "Moodboard" tidak dimengerti semua klien. "Referensi Acara" lebih deskriptif. *Catatan: "Brief" bisa dipertahankan karena sudah common di industri pernikahan* |
| 21 | `Sinkronisasi Cloud Vena Pictures` | **`Tersimpan di Cloud Vena Pictures`** | `ClientPortal.tsx:977` | "Sinkronisasi" terdengar teknis. "Tersimpan di Cloud" lebih mudah dipahami |
| 22 | `Tagihan & Invoice` (label menu sidebar) | **`Invoice & Tagihan`** | `Sidebar.tsx:104` | Tidak perlu dua kata bersinonim. Pilih satu: "Invoice" untuk konsistensi atau "Tagihan" saja. Jika ingin keduanya, urutkan yang lebih umum dulu ("Invoice" sudah universal) |
| 23 | `Booking Jadwal` (label menu nav) | **`Booking`** atau **`Data Booking`** | `constants/index.tsx:265` | Redundan. "Jadwal" sudah terimplikasi dari "Booking". Di BottomNavBar sudah benar pakai "Booking" saja |
| 24 | `Kwitansi` (teks tombol di portal klien) | **`Tanda Terima`** | `ClientPortal.tsx:1047` | "Kwitansi" adalah ejaan lama. Di tempat lain di file yang sama (`ClientPortal.tsx:1282,1336`) sudah menggunakan "Tanda Terima". Perlu dikonsistensikan |

---

## BAGIAN 2: LABEL YANG AMBIGU / PERLU DISKUSI

| # | Label | Lokasi | Catatan / Pertanyaan |
|---|---|---|---|
| A | `Total Package` | Di mana-mana | Apakah kata "Package" ingin dipertahankan sebagai brand language? Di industri pernikahan Indonesia kata "paket" sudah umum, tapi "package" juga sering dipakai vendor profesional. **Rekomendasi:** Tetapkan satu pilihan konsisten |
| B | `Invoice` | Portal klien, menu sidebar | Apakah ingin tetap "Invoice" (inggris) atau "Faktur"? Invoice lebih umum dipakai di industri, tapi tidak semua klien familiar. **Rekomendasi:** Pertahankan "Invoice" karena sudah industry-standard |
| C | `DP Terbayar` (status pembayaran) | `ClientDetailModal.tsx:404` | "DP" adalah singkatan dari Down Payment (Inggris). Bisa diganti "Uang Muka Diterima". **Perlu keputusan owner** |
| D | `Moodboard` | `ProjectDetailModal.tsx:1393`, `ProjectForm.tsx:181` | Di tampilan internal (untuk tim), "Moodboard" ok. Di portal klien perlu diganti (sudah ada di no. 20) |
| E | `Jadwal Wedding` (label menu kalender) | `constants/index.tsx:265` | "Wedding" bisa diganti "Acara" atau "Pernikahan". Tapi "Jadwal Wedding" mungkin sudah jadi brand language |
| F | `Voucher` (menu nav) | `constants/index.tsx:271` | Di beberapa bagian disebut "Kode Promo". Perlu dikonsistensikan: pilih salah satu |
| G | `Dashboard` | `constants/index.tsx:263` | Label Inggris di menu. Bisa dipertahankan karena sudah universal |
| H | `Tanda Terima` vs `Kwitansi` | File berbeda | Di `ClientPortal.tsx:1282,1336` sudah "Tanda Terima"; di `ClientPortal.tsx:1047` masih "Kwitansi" — **perlu dikonsistensikan ke "Tanda Terima"** |
| I | `Feedback` vs `Testimoni` | `ClientPortal.tsx` | Di judul tab: "Testimoni" ✓. Di kode internal masih banyak `feedback`. Tidak masalah selama yang tampil ke user adalah "Testimoni" |

---

## BAGIAN 3: LABEL YANG SUDAH BAIK

Label-label berikut sudah tepat dan tidak perlu diganti:

| Label | Lokasi | Keterangan |
|---|---|---|
| `Acara Saya` | `ClientPortal.tsx:202` | ✅ Natural, dari perspektif klien |
| `Keuangan` | `ClientPortal.tsx:204` | ✅ Jelas dan ringkas |
| `Beranda` | `ClientPortal.tsx:201` | ✅ Tepat untuk tab utama portal |
| `Terbayar` | `ClientPortal.tsx:521,602` | ✅ Jelas dan ringkas |
| `Progres Acara` | `ClientPortal.tsx:536` | ✅ Lebih baik dari "Progress" |
| `Progres Pembayaran` | `ClientPortal.tsx:1016` | ✅ Sudah menggunakan ejaan Indonesia |
| `Riwayat Pembayaran` | `ClientPortal.tsx:1029` | ✅ Lebih jelas dari "Transaction History" |
| `Acara Mendatang` | `ClientPortal.tsx` | ✅ Jelas dan natural |
| `Belum ada pembayaran tercatat` | `ClientPortal.tsx` | ✅ Pesan kosong yang informatif |
| `Calon Pengantin` | `constants/index.tsx`, Sidebar | ✅ Tepat untuk konteks bisnis wedding |
| `Data Pengantin` | `ClientsPage`, Sidebar | ✅ Jelas sebagai menu utama |
| `Tim / Vendor` | Sidebar, TeamPage | ✅ Tepat, mencakup dua jenis anggota tim |

---

## BAGIAN 4: RINGKASAN PRIORITAS PERUBAHAN

### Prioritas Tinggi (Tampil di Portal Klien / Publik)
Perubahan ini langsung dilihat oleh pengantin sebagai end user:

1. **`Zoom Meeting` → `Meeting Online`** — 4 file, 6 lokasi
2. **`Sisa Tagihan` → `Sisa Pembayaran`** (di portal klien) — 9 file, 12+ lokasi
3. **`On Going` → `Sedang Dikerjakan`** — 1 file, 1 lokasi
4. **`Kwitansi` → `Tanda Terima`** — 1 file, 1 lokasi (ada inkonsistensi)
5. **`Add-ons` → `Layanan Tambahan`** — 1 file, 1 lokasi
6. **`Buka Link Zoom` → `Buka Tautan Meeting Online`** — 2 file, 2 lokasi

### Prioritas Sedang (Tampil di Dashboard Internal / Admin)
7. **`Meeting Pengantin` → `Meeting Langsung`** — 5 file
8. **`Jadwal Meeting` → `Jadwal Pertemuan`** — 2 file
9. **`Technical Meeting` → `Koordinasi Teknis`** — 2 file
10. **`Moodboard / Brief` → `Referensi Acara / Brief`** — 3 file
11. **`Rekap Tagihan Detil` → `Rincian Tagihan`** — 2 file

### Prioritas Rendah (Kosmetik / Konsistensi)
12. **`Sinkronisasi Cloud Vena Pictures` → `Tersimpan di Cloud Vena Pictures`** — 1 file
13. **`Booking Jadwal` → `Booking`** — 1 file (nav)
14. **`Rekap Pengantin Belum Lunas` → `Pengantin dengan Sisa Pembayaran`** — 1 file
15. **`Tagihan & Invoice` → `Invoice`** — 1 file (sidebar)

---

## BAGIAN 5: DETAIL LOKASI FILE UNTUK IMPLEMENTASI

### `ClientPortal.tsx` — `d:\honesty\src\features\clients\components\ClientPortal.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 202 | `label: 'Jadwal Meeting'` | `label: 'Jadwal Pertemuan'` |
| 373 | `Jadwal Meeting` (h2) | `Jadwal Pertemuan` |
| 375 | `Meeting dan Zoom yang dijadwalkan...` | `Pertemuan dan meeting online yang dijadwalkan...` |
| 381 | `Memuat jadwal meeting...` | `Memuat jadwal pertemuan...` |
| 385 | `Jadwal meeting gagal dimuat.` | `Jadwal pertemuan gagal dimuat.` |
| 390 | `Belum ada jadwal meeting` | `Belum ada jadwal pertemuan` |
| 410 | `'Zoom Meeting'` | `'Meeting Online'` |
| 410 | `'Meeting Pengantin'` | `'Meeting Langsung'` |
| 438 | `Buka Link Zoom` | `Buka Tautan Meeting Online` |
| 446 | `Catatan meeting` | `Catatan Pertemuan` |
| 520 | `label: 'Total Package'` | `label: 'Harga Total'` |
| 522 | `label: 'Sisa Tagihan'` | `label: 'Sisa Pembayaran'` |
| 552 | `'On Going'` | `'Sedang Dikerjakan'` |
| 583 | `Add-ons` | `Layanan Tambahan` |
| 602 | label "Sisa" (di card kecil) | `Sisa Pembayaran` |
| 885 | `label: 'Moodboard / Brief'` | `label: 'Referensi Acara / Brief'` |
| 977 | `Sinkronisasi Cloud Vena Pictures` | `Tersimpan di Cloud Vena Pictures` |
| 1047 | `Kwitansi` (tombol) | `Tanda Terima` |

### `ClientDuesView.tsx` — `d:\honesty\src\features\clients\components\ClientDuesView.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 25 | `Rekap Pengantin Belum Lunas` | `Pengantin dengan Sisa Pembayaran` |
| 49 | `Sisa Tagihan` | `Sisa Pembayaran` |
| 76 | `Total Package` | `Harga Total` |
| 78 | `Sisa Tagihan` | `Sisa Pembayaran` |
| 100 | `Tagih WA` | `Ingatkan WA` |

### `CalendarView.tsx` — `d:\honesty\src\features\projects\components\CalendarView.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 95 | `'Zoom Meeting'` | `'Meeting Online'` |
| 95 | `'Meeting Pengantin'` | `'Meeting Langsung'` |

### `ProjectDetailModal.tsx` — `d:\honesty\src\features\projects\components\ProjectDetailModal.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 318 | `'Zoom Meeting'` | `'Meeting Online'` |
| 318 | `'Meeting Pengantin'` | `'Meeting Langsung'` |
| 393 | `'Zoom Meeting'` | `'Meeting Online'` |
| 893 | `kind: 'zoom', title: 'Zoom Meeting'` | `title: 'Meeting Online'` |
| 895 | `kind: 'regular', title: 'Meeting Pengantin'` | `title: 'Meeting Langsung'` |
| 892 | `Jadwal Meeting & Hasil` | `Jadwal Pertemuan & Hasil` |
| 998 | `Buka link Zoom` | `Buka tautan meeting online` |

### `constants/index.tsx` — `d:\honesty\src\constants\index.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 265 | `label: 'Booking Jadwal'` | `label: 'Booking'` |
| 339 | `'Meeting Pengantin'` dalam DEFAULT_EVENT_TYPES | `'Meeting Langsung'` |
| 367 | `name: 'Technical Meeting'` | `name: 'Koordinasi Teknis'` |
| 562 | `title: 'Rekap Tagihan Detil'` | `title: 'Rincian Tagihan'` |
| 586 | `title: 'Pengingat Tagihan Ramah'` | `title: 'Pengingat Pembayaran Ramah'` |

### `Sidebar.tsx` — `d:\honesty\src\layouts\Sidebar.tsx`
| Baris | Teks Lama | Teks Baru |
|---|---|---|
| 104 | `label: 'Tagihan & Invoice'` | `label: 'Invoice'` |

---

## KESIMPULAN

Codebase ini sudah cukup baik dalam menggunakan Bahasa Indonesia untuk sebagian besar label. Permasalahan utama yang ditemukan adalah:

1. **Kata "Meeting"** dipakai secara konsisten di seluruh aplikasi tanpa terjemahan, sementara aplikasi ini menargetkan pasangan pengantin awam. Solusi terbaik: ganti "Zoom Meeting" → "Meeting Online" dan "Meeting Pengantin" → "Meeting Langsung" di semua titik.

2. **Inkonsistensi "Sisa Tagihan" vs "Sisa Pembayaran"** — keduanya dipakai di file berbeda. Untuk portal klien, gunakan "Sisa Pembayaran". Untuk dashboard internal admin, keduanya bisa diterima tapi sebaiknya dipilih satu yang konsisten.

3. **Beberapa label Inggris tersisa** (`On Going`, `Add-ons`, `Moodboard`) perlu diganti karena muncul di tampilan portal publik yang dilihat klien.

Total perubahan yang disarankan: **~40 teks** di **~12 file** berbeda, sebagian besar perubahan sederhana (string replacement).
