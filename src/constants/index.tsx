
import { ViewType, TransactionType, PaymentStatus, PocketType, ClientStatus, LeadStatus, ContactChannel, CardType, PerformanceNoteType, SatisfactionLevel, Notification, SocialMediaPost, PostType, PostStatus, PromoCode, ClientType, ProjectStatusConfig, VendorData, BookingStatus, ChatTemplate } from '../types';
import type { User } from '../types';

// --- UTILITY FUNCTIONS ---
export const cleanPhoneNumber = (phone: string | undefined) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Remove all non-numeric characters
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
};

// Status efektif lead: dianggap 'Dikonversi' bila statusnya memang Dikonversi ATAU
// catatannya masih menyimpan jejak konversi (baris yang diawali "Dikonversi ...").
// Status bisa tertimpa saat kartu dipindah antar kolom di Kanban, sedangkan catatan
// konversi tidak — karena itu catatan dipakai sebagai sumber kedua agar data
// konversi tidak hilang.
export const resolveLeadStatus = (lead: { status: LeadStatus; notes?: string | null }): LeadStatus => {
    if (lead.status === LeadStatus.CONVERTED) return LeadStatus.CONVERTED;
    return /(^|\n)\s*dikonversi\b/i.test(lead.notes || '') ? LeadStatus.CONVERTED : lead.status;
};

export const lightenColor = (hex: string, percent: number): string => {
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    let [r, g, b] = hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [255, 255, 255];
    const factor = percent / 100;
    r = Math.min(255, Math.floor(r + (255 - r) * factor));
    g = Math.min(255, Math.floor(g + (255 - g) * factor));
    b = Math.min(255, Math.floor(b + (255 - b) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const darkenColor = (hex: string, percent: number): string => {
    if (!hex || !hex.startsWith('#')) return '#000000';
    let [r, g, b] = hex.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
    const factor = 1 - percent / 100;
    r = Math.floor(r * factor);
    g = Math.floor(g * factor);
    b = Math.floor(b * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const hexToHsl = (hex: string): string => {
    if (!hex || !hex.startsWith('#')) return '0 0% 0%';
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length == 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
}

// --- ICONS (LUCIDE REACT) ---
// Standardized high-craft icons imported directly from lucide-react
import {
    Home,
    Users,
    FolderKanban,
    Briefcase,
    DollarSign,
    Calendar,
    Package,
    Settings,
    PieChart,
    Target,
    Plus,
    LogOut,
    Moon,
    Sun,
    ChevronRight,
    CreditCard,
    ClipboardList,
    Lightbulb,
    Star,
    Camera,
    FileText,
    Eye,
    Pencil,
    Trash2,
    Printer,
    X,
    Phone,
    Mail,
    ChevronDown,
    ChevronUp,
    Copy,
    RefreshCw,
    Bell,
    Share2,
    History,
    TrendingUp,
    AlertCircle,
    MessageSquare,
    MessageCircle,
    PhoneIncoming,
    MapPin,
    TrendingDown,
    ArrowDown,
    ArrowUp,
    Download,
    List,
    LayoutGrid,
    CheckSquare,
    Clock,
    Send,
    Mic,
    MicOff,
    CheckCircle,
    PiggyBank,
    UserCheck,
    Lock,
    BarChart2,
    Ban,
    Banknote,
    Key,
    Smile,
    ThumbsUp,
    Meh,
    Frown,
    ChevronLeft,
    Images,
    BookOpen,
    Check,
    Sparkles,
    QrCode,
    Instagram,
    Hash,
    Upload,
    Link,
    Image,
    CircleUser,
    FileSpreadsheet,
} from 'lucide-react';

export const HomeIcon = Home;
export const UsersIcon = Users;
export const FolderKanbanIcon = FolderKanban;
export const BriefcaseIcon = Briefcase;
export const DollarSignIcon = DollarSign;
export const CalendarIcon = Calendar;
export const PackageIcon = Package;
export const SettingsIcon = Settings;
export const ChartPieIcon = PieChart;
export const TargetIcon = Target;
export const PlusIcon = Plus;
export const LogOutIcon = LogOut;
export const MoonIcon = Moon;
export const SunIcon = Sun;
export const ChevronRightIcon = ChevronRight;
export const CreditCardIcon = CreditCard;
export const ClipboardListIcon = ClipboardList;
export const LightbulbIcon = Lightbulb;
export const StarIcon = Star;
export const CameraIcon = Camera;
export const FileTextIcon = FileText;
export const EyeIcon = Eye;
export const PencilIcon = Pencil;
export const Trash2Icon = Trash2;
export const PrinterIcon = Printer;
export const XIcon = X;
export const PhoneIcon = Phone;
export const MailIcon = Mail;
export const ChevronDownIcon = ChevronDown;
export const ChevronUpIcon = ChevronUp;
export const CopyIcon = Copy;
export const RefreshCwIcon = RefreshCw;
export const BellIcon = Bell;
export const Share2Icon = Share2;
export const HistoryIcon = History;
export const TrendingUpIcon = TrendingUp;
export const AlertCircleIcon = AlertCircle;
export const MessageSquareIcon = MessageSquare;
export const MessageCircleIcon = MessageCircle;
export const PhoneIncomingIcon = PhoneIncoming;
export const MapPinIcon = MapPin;
export const TrendingDownIcon = TrendingDown;
export const ArrowDownIcon = ArrowDown;
export const ArrowUpIcon = ArrowUp;
export const DownloadIcon = Download;
export const ListIcon = List;
export const LayoutGridIcon = LayoutGrid;
export const CheckSquareIcon = CheckSquare;
export const ClockIcon = Clock;
export const SendIcon = Send;
export const MicrophoneIcon = Mic;
export const MicrophoneOffIcon = MicOff;
export const CheckCircleIcon = CheckCircle;
export const PiggyBankIcon = PiggyBank;
export const UserCheckIcon = UserCheck;
export const LockIcon = Lock;
export const Users2Icon = Users;
export const BarChart2Icon = BarChart2;
export const BanIcon = Ban;
export const CashIcon = Banknote;
export const KeyIcon = Key;
export const SmileIcon = Smile;
export const ThumbsUpIcon = ThumbsUp;
export const MehIcon = Meh;
export const FrownIcon = Frown;
export const ChevronLeftIcon = ChevronLeft;
export const GalleryHorizontalIcon = Images;
export const BookOpenIcon = BookOpen;
export const CheckIcon = Check;
export const SparkleIcon = Sparkles;
export const QrCodeIcon = QrCode;
export const InstagramIcon = Instagram;
export const HashtagIcon = Hash;
export const UploadIcon = Upload;
export const TrashIcon = Trash2;
export const LinkIcon = Link;
export const ImageIcon = Image;
export const UserCircleIcon = CircleUser;
export const FileSpreadsheetIcon = FileSpreadsheet;

export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const WhatsappIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        {...props} 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="M16.5 14.5c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1s-1.3-.5-2.5-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.9c0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.8 5.2 3.4 1.5 3.4 1 4 1 .6 0 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.2-.3-.3-.6-.5z" fill="currentColor" stroke="none" />
    </svg>
);

// --- NAVIGATION ---
export const NAV_ITEMS = [
    { view: ViewType.DASHBOARD, label: 'Dashboard', icon: HomeIcon },
    { view: ViewType["Calon Pengantin"], label: 'Calon Pengantin', icon: TargetIcon },
    { view: ViewType.BOOKING, label: 'Booking Jadwal', icon: ClipboardListIcon },
    { view: ViewType.CALENDAR, label: 'Jadwal Wedding', icon: CalendarIcon },
    { view: ViewType.CLIENTS, label: 'Data Pengantin', icon: UsersIcon },
    { view: ViewType.TEAM, label: 'Pembayaran', icon: BriefcaseIcon },
    { view: ViewType.FINANCE, label: 'Keuangan', icon: DollarSignIcon },
    { view: ViewType.PACKAGES, label: 'Layanan / Package', icon: PackageIcon },
    { view: ViewType.PROMO_CODES, label: 'Voucher', icon: LightbulbIcon },
    { view: ViewType.GALLERY, label: 'Upload Pricelist Publik', icon: ImageIcon },
    { view: ViewType.VENDOR_PROFILE, label: 'Profil Vendor', icon: UserCircleIcon },
    { view: ViewType.BIO_LINKS, label: 'Link Publik', icon: LinkIcon },
    { view: ViewType.CLIENT_REPORTS, label: 'Testimoni', icon: ChartPieIcon },
    { view: ViewType.SETTINGS, label: 'Pengaturan', icon: SettingsIcon },
];

// --- TERMINOLOGY MAPPING CONFIGURATION ---
/**
 * Terminology changes mapping for wedding industry terminology update.
 * Maps old generic project management terms to wedding-specific terms.
 * Each entry includes context information and target files for the change.
 */
export interface TerminologyChange {
    oldTerm: string;
    newTerm: string;
    context: 'navigation' | 'page-title' | 'table-header' | 'label' | 'button';
    files: string[];
}

export const TERMINOLOGY_CHANGES: TerminologyChange[] = [
    {
        oldTerm: 'Klien Pengantin',
        newTerm: 'Data Pengantin',
        context: 'navigation',
        files: ['constants.tsx', 'pages/clients/ClientsPage.tsx', 'components/Clients.tsx']
    },
    {
        oldTerm: 'Detail Proyek',
        newTerm: 'Detail Acara Pernikahan',
        context: 'page-title',
        files: ['pages/projects/ProjectsPage.tsx', 'components/Projects.tsx', 'components/ClientPortal.tsx']
    },
    {
        oldTerm: 'Proyek Terbaru',
        newTerm: 'Acara Pernikahan Terbaru',
        context: 'table-header',
        files: ['pages/clients/ClientsPage.tsx', 'components/Clients.tsx', 'components/Dashboard.tsx']
    },
    {
        oldTerm: 'Total Nilai Proyek',
        newTerm: 'Total Package',
        context: 'label',
        files: ['pages/clients/ClientsPage.tsx', 'components/Clients.tsx', 'components/ClientPortal.tsx', 'components/ClientKPI.tsx']
    },
    {
        oldTerm: 'Progres Sub-Status',
        newTerm: 'Progres Pengerjaan Pengantin',
        context: 'label',
        files: ['pages/projects/ProjectsPage.tsx', 'components/Projects.tsx']
    },
    {
        oldTerm: 'Pekerjaan Wedding',
        newTerm: 'Acara Pernikahan',
        context: 'navigation',
        files: ['constants.tsx']
    }
];

// --- PENGATURAN: KONSTANTA DEFAULT (mempermudah input) ---
/** Saran kategori pemasukan untuk layanan pernikahan */
export const DEFAULT_INCOME_CATEGORIES = ['DP Acara Pernikahan', 'Pelunasan', 'Tambahan (Add-on)', 'Layanan Fisik/Produk', 'Lainnya'];
/** Saran kategori pengeluaran */
export const DEFAULT_EXPENSE_CATEGORIES = ['Gaji Tim / Vendor', 'Operasional', 'Produksi Fisik', 'Transport', 'Perlengkapan', 'Lainnya'];
/** Saran jenis proyek */
export const DEFAULT_PROJECT_TYPES = ['Pernikahan', 'Lamaran / Engagement', 'Corporate / Event', 'Ulang Tahun', 'Wisuda', 'Lainnya'];
/** Saran jenis Acara Pernikahan internal (kalender) */
export const DEFAULT_EVENT_TYPES = ['Meeting Pengantin', 'Persiapan Acara Pernikahan', 'Pelaksanaan (Hari H)', 'Evaluasi', 'Lainnya'];
/** Saran kategori Package */
export const DEFAULT_PACKAGE_CATEGORIES = ['Pernikahan', 'Lamaran / Engagement', 'Corporate / Event', 'Ulang Tahun', 'Wisuda', 'Lainnya'];
/** Saran sumber Calon Pengantin (leads) */
export const DEFAULT_LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Website', 'Telepon', 'Referensi', 'Form Saran', 'Lainnya'];
/** Saran status proyek beserta sub-status (id diisi di komponen) */
export const DEFAULT_PROJECT_STATUS_SUGGESTIONS: {
    name: string;
    color: string;
    description: string;
    defaultProgress: number;
    subStatuses: { name: string; note: string }[];
}[] = [
        {
            name: 'Dikonfirmasi',
            color: '#3b82f6', // blue-500
            description: 'Acara Pernikahan telah dikonfirmasi dan siap dijadwalkan.',
            defaultProgress: 10,
            subStatuses: [
                { name: 'DP Terbayar', note: 'Uang muka telah diterima' },
                { name: 'Kontrak Ditandatangani', note: 'Surat perjanjian sudah oke' }
            ]
        },
        {
            name: 'Persiapan',
            color: '#6366f1', // indigo-500
            description: 'Tahap persiapan teknis, vendor pendukung, dan koordinasi tim.',
            defaultProgress: 25,
            subStatuses: [
                { name: 'Technical Meeting', note: 'Koordinasi akhir dengan pengantin dan vendor lain' },
                { name: 'Persiapan Kebutuhan Acara Pernikahan', note: 'Cek kesiapan perlengkapan/material' }
            ]
        },
        {
            name: 'Hari H (Pelaksanaan)',
            color: '#f97316', // orange-500
            description: 'Pelaksanaan layanan di hari Acara Pernikahan pernikahan.',
            defaultProgress: 50,
            subStatuses: [
                { name: 'Loading In / Standby', note: 'Persiapan di lokasi Acara Pernikahan' },
                { name: 'Acara Pernikahan Selesai / Pelaksanaan Sukses', note: 'Pekerjaan di hari H selesai' }
            ]
        },
        {
            name: 'Pasca Acara Pernikahan / Penyelesaian',
            color: '#8b5cf6', // purple-500
            description: 'Tahap penyelesaian akhir atau follow-up pasca Acara Pernikahan.',
            defaultProgress: 75,
            subStatuses: [
                { name: 'Review / Evaluasi Internal', note: 'Evaluasi hasil kerja hari H' },
                { name: 'Follow-up Pengantin Pasca Acara Pernikahan', note: 'Memastikan kepuasan pengantin' }
            ]
        },
        {
            name: 'Serah Terima Keuangan/Aset',
            color: '#ec4899', // pink-500
            description: 'Tahap menyelesaikan sisa pembayaran atau serah terima aset khusus.',
            defaultProgress: 90,
            subStatuses: [
                { name: 'Rekap Sisa Pembayaran / Refund', note: 'Mengurus administrasi keuangan sisa' },
                { name: 'Pengembalian / Serah Terima Barang', note: 'Memastikan tidak ada aset tertinggal/dipinjam' }
            ]
        },
        {
            name: 'Penyelesaian Administrasi',
            color: '#06b6d4', // cyan-500
            description: 'Mengurus pengarsipan dan penutupan dokumen Acara Pernikahan.',
            defaultProgress: 95,
            subStatuses: [
                { name: 'Arsip Data Pengantin', note: 'Menyimpan riwayat Acara Pernikahan' },
                { name: 'Pengiriman Laporan/Dokumen Akhir', note: 'Jika pengantin meminta laporan khusus' }
            ]
        },
        {
            name: 'Selesai',
            color: '#10b981', // emerald-500
            description: 'Semua pekerjaan selesai dan hasil telah diterima pengantin.',
            defaultProgress: 100,
            subStatuses: [
                { name: 'Pekerjaan Selesai', note: 'Hasil akhir/layanan sudah diterima pengantin' },
                { name: 'Testimoni Diterima', note: 'Pengantin puas' }
            ]
        },
        {
            name: 'Dibatalkan',
            color: '#ef4444', // red-500
            description: 'Pekerjaan dibatalkan oleh vendor atau pengantin.',
            defaultProgress: 0,
            subStatuses: [
                { name: 'Refund Proses', note: 'Proses pengembalian dana jika ada' },
                { name: 'File Diarsipkan', note: 'Pekerjaan ditutup' }
            ]
        }
    ];

// --- DEFAULT TEMPLATES (untuk pengisian awal di Settings) ---
export const DEFAULT_BRIEFING_TEMPLATE = `Hai Tim,

Berikut briefing untuk acara ini. Mohon diperhatikan:
- Cek detail acara di link di atas
- Pastikan deadline dan deliverable jelas
- Jika ada pertanyaan, hubungi admin

Terima kasih!`;

export const DEFAULT_TERMS_AND_CONDITIONS = `1. Dp bersifat Non Refund.`;

export const DEFAULT_PACKAGE_SHARE_TEMPLATE = `Halo {leadName}!`;

export const DEFAULT_BOOKING_FORM_TEMPLATE = `Halo {leadName}!`;

// --- NEW SHARE TEMPLATES ---
export const DEFAULT_INVOICE_SHARE_TEMPLATE = `Halo *{clientName}*!`;

export const DEFAULT_RECEIPT_SHARE_TEMPLATE = `Halo *{clientName}*!`;

export const DEFAULT_EXPENSE_SHARE_TEMPLATE = `Halo *{targetName}*!`;

export const DEFAULT_PORTAL_SHARE_TEMPLATE = `Halo {clientName}!`;


// --- CHAT TEMPLATES ---
export const CHAT_TEMPLATES: ChatTemplate[] = [
    {
        id: 'welcome',
        title: 'Ucapan Selamat Datang',
        template: 'Halo {clientName}, selamat! Booking Anda untuk Acara Pernikahan "{projectName}" telah kami konfirmasi. Kami sangat senang bisa bekerja sama dengan Anda! Tim kami akan segera menghubungi Anda untuk langkah selanjutnya. Terima kasih!'
    },
    {
        id: 'next_steps',
        title: 'Langkah Selanjutnya',
        template: 'Hai {clientName}, menindaklanjuti konfirmasi Acara Pernikahan "{projectName}", berikut langkah selanjutnya: [jadwal meeting, survey lokasi, dll]. Mohon informasikan waktu terbaik Anda. Terima kasih.'
    },
    {
        id: 'progress_update',
        title: 'Update Progres Pengerjaan',
        template: 'Halo {clientName},\n\nKami ingin memberikan update progress Acara Pernikahan Anda:\n\nAcara Pernikahan: {projectName}\nTotal Biaya: {totalCost}\nTerbayar: {amountPaid}\nSisa Pembayaran: {sisaTagihan}\n\nAnda dapat memantau progres detailnya melalui portal pengantin di sini:\n{portalLink}\n\nTerima kasih!'
    },
    {
        id: 'schedule_confirmation',
        title: 'Konfirmasi Jadwal & Lokasi',
        template: 'Halo {clientName},\n\nKami ingin mengkonfirmasi jadwal Acara Pernikahan Anda:\n\nAcara Pernikahan: {projectName}\nLokasi: {location}\n\nMohon konfirmasinya jika sudah sesuai. Terima kasih!'
    },
    {
        id: 'payment_reminder',
        title: 'Pengingat Pelunasan',
        template: 'Yth. {clientName},\n\nIni pengingat ramah untuk pembayaran pelunasan Acara Pernikahan "{projectName}" yang akan segera jatuh tempo.\n\nSisa Pembayaran: {sisaTagihan}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih.'
    },
    {
        id: 'detailed_bill',
        title: 'Rekap Pembayaran',
        template: 'Halo {clientName},\n\nSemoga sehat selalu. Kami ingin mengingatkan perihal sisa pembayaran untuk Acara Pernikahan Anda.\n\nBerikut rinciannya:\n- Acara Pernikahan: *{projectName}*\n- Paket: *{packageName}*\n\nSudah Terbayar: *{amountPaid}*\nSisa Pembayaran: *{sisaTagihan}*\n\nTotal Sisa Pembayaran: *{sisaTagihan}*\n\nAnda dapat melihat rincian invoice dan riwayat pembayaran melalui Portal Pengantin Anda di sini:\n{portalLink}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih!\n\nSalam,\nTim {companyName}'
    },
    {
        id: 'survey_reminder',
        title: 'Pengingat Survey Lokasi',
        template: 'Hai {clientName}, untuk Acara Pernikahan "{projectName}", kami ingin mengatur jadwal survey lokasi. Kapan waktu yang cocok untuk Anda? Terima kasih.'
    },
    {
        id: 'delivery_ready',
        title: 'Hasil Siap Diambil / Selesai',
        template: 'Halo {clientName}, hasil kerja untuk "{projectName}" sudah siap! Silakan cek laporan/link yang kami kirim. Jika ada revisi atau tanggapan, beritahu kami dalam 7 hari. Terima kasih!'
    }
];

// --- BILLING / INVOICE CHAT TEMPLATES ---
export const DEFAULT_BILLING_TEMPLATES: ChatTemplate[] = [
    {
        id: 'billing_new_invoice',
        title: 'Kirim Invoice Baru',
        template: 'Halo {clientName},\n\nSalam dari {companyName}!\n\nKami mengirimkan invoice untuk Acara Pernikahan Anda.\n\nBerikut rinciannya:\n{projectDetails}\n\nTotal Pembayaran: *{totalDue}*\n\nSilakan cek detail invoice dan melakukan pembayaran melalui Portal Pengantin Anda di sini:\n{portalLink}\n\nPembayaran dapat dilakukan ke rekening berikut:\n{bankAccount}\n\nTerima kasih atas kepercayaan Anda!'
    },
    {
        id: 'billing_friendly_reminder',
        title: 'Pengingat Pembayaran Ramah',
        template: 'Halo {clientName},\n\nSemoga sehat selalu. Kami ingin mengingatkan perihal sisa pembayaran untuk Acara Pernikahan Anda.\n\nBerikut rinciannya:\n{projectDetails}\n\nTotal Sisa Pembayaran: *{totalDue}*\n\nAnda dapat melihat rincian invoice dan riwayat pembayaran melalui Portal Pengantin Anda di sini:\n{portalLink}\n\nPembayaran dapat dilakukan ke rekening berikut:\n{bankAccount}\n\nMohon konfirmasinya jika pembayaran telah dilakukan. Terima kasih!\n\nSalam,\nTim {companyName}'
    },
    {
        id: 'billing_due_date_reminder',
        title: 'Pengingat Jatuh Tempo',
        template: 'Yth. Bapak/Ibu {clientName},\n\nMenurut catatan kami, sisa pembayaran Acara Pernikahan Anda akan jatuh tempo. Berikut adalah rincian pembayaran Anda:\n\n{projectDetails}\n\nTotal Sisa Pembayaran: *{totalDue}*\n\nUntuk melihat detail invoice, silakan akses Portal Pengantin Anda di tautan berikut:\n{portalLink}\n\nKami mohon kesediaan Anda untuk menyelesaikan pembayaran sebelum tanggal jatuh tempo. Pembayaran dapat ditransfer ke:\n{bankAccount}\n\nTerima kasih atas kerja samanya.\n\nHormat kami,\nTim {companyName}'
    }
];
