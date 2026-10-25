import { describe, expect, it } from 'vitest';
import type { Workbook, Worksheet } from 'exceljs';
import { buildClientExportCsvPayloads, buildClientExportWorkbook, CLIENT_EXPORT_CSV_CATEGORIES } from './clientExport';
import type { ClientWithSummary } from '../hooks/useClients';

const headerIndex = (sheet: Worksheet, header: string) => {
    const headers = sheet.getRow(1).values as (string | undefined)[];
    return headers.indexOf(header);
};

const cellValue = (sheet: Worksheet, rowNumber: number, header: string) => {
    const index = headerIndex(sheet, header);
    if (index < 0) throw new Error(`Header "${header}" tidak ditemukan di sheet ${sheet.name}`);
    return sheet.getRow(rowNumber).getCell(index).value;
};

const summaryValue = (workbook: Workbook, item: string) => {
    const sheet = workbook.getWorksheet('Ringkasan')!;
    for (let row = 5; row <= sheet.rowCount; row += 1) {
        if (sheet.getRow(row).getCell(2).value === item) {
            return sheet.getRow(row).getCell(3).value;
        }
    }
    return undefined;
};

const buildProject = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    id: 'project-1',
    clientId: 'client-1',
    projectName: 'Acara Pernikahan',
    projectType: 'Pernikahan',
    date: '2026-11-20',
    startTime: '09:00',
    packageName: 'Paket Gold',
    packageId: 'package-1',
    unitPrice: 12000000,
    addOns: [],
    additionalPackages: [],
    customCosts: [],
    totalCost: 12000000,
    amountPaid: 0,
    discountAmount: 0,
    paymentStatus: 'DP Terbayar',
    progress: 25,
    status: 'Persiapan',
    team: [],
    location: 'Jakarta',
    address: 'Jl. Venue No. 1',
    ...overrides,
});

const buildClient = (overrides: Record<string, unknown>): ClientWithSummary => ({
    id: 'client-1',
    name: 'Rina',
    email: 'rina@example.com',
    phone: '0812345678',
    whatsapp: '0812345678',
    since: '2026-01-01',
    lastContact: '2026-02-01',
    status: 'Aktif',
    clientType: 'Langsung',
    portalAccessId: 'portal-1',
    address: 'Jakarta',
    projects: [],
    totalProjectValue: 0,
    balanceDue: 0,
    PackageTerbaru: '',
    overallPaymentStatus: null,
    mostRecentProject: null,
    ...overrides,
} as unknown as ClientWithSummary);

const projectOne = buildProject({
    id: 'project-1',
    projectName: 'Wedding Rina & Budi',
    date: '2026-11-20',
    totalCost: 12000000,
    amountPaid: 4000000,
    paymentStatus: 'DP Terbayar',
    status: 'Persiapan',
    durationSelection: '6 Jam',
    addOns: [{ id: 'addon-1', name: 'Album Exclusive', price: 500000 }],
    team: [{ memberId: 'member-1', name: 'Ayu', role: 'Fotografer', fee: 1000000, subJob: 'Foto Utama' }],
    dpProofUrl: 'https://example.com/dp.jpg',
});

const projectTwo = buildProject({
    id: 'project-2',
    projectName: 'Engagement Rina & Budi',
    date: '2026-08-10',
    packageName: 'Paket Silver',
    totalCost: 5000000,
    amountPaid: 5000000,
    paymentStatus: 'Lunas',
    status: 'Selesai',
});

const clientWithTwoProjects = buildClient({
    projects: [projectOne, projectTwo],
    mostRecentProject: projectOne,
    totalProjectValue: 17000000,
    balanceDue: 6000000,
    overallPaymentStatus: 'DP Terbayar',
});

const incomeTransaction = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    id: 'transaction-1',
    projectId: 'project-1',
    date: '2026-02-01',
    description: 'Pembayaran',
    field: undefined,
    amount: 0,
    type: 'Pemasukan',
    category: 'Pembayaran Pengantin',
    method: 'Transfer Bank',
    ...overrides,
});

const transactions = [
    incomeTransaction({ id: 't1', date: '2026-02-01', amount: 4000000, category: 'DP Acara Pernikahan', description: 'DP Paket Gold' }),
    incomeTransaction({ id: 't2', date: '2026-03-01', amount: 1000000, category: 'Termin 2', description: 'Termin kedua' }),
    incomeTransaction({ id: 't3', date: '2026-03-05', amount: -500000, category: 'Refund', description: 'Refund koreksi' }),
    incomeTransaction({ id: 't4', date: '2026-03-10', amount: 2000000, category: 'Dibatalkan', description: 'Pembayaran yang dibatalkan' }),
    incomeTransaction({ id: 't5', date: '2026-03-20', amount: 1500000, category: 'Pelunasan Acara Pernikahan', description: 'Pelunasan' }),
    incomeTransaction({ id: 't7', projectId: 'project-2', date: '2026-01-15', amount: 5000000, category: 'Pelunasan Acara Pernikahan', description: 'Pelunasan penuh' }),
    {
        id: 'expense-1',
        projectId: 'project-1',
        date: '2026-02-02',
        description: 'Sewa perlengkapan',
        amount: 750000,
        type: 'Pengeluaran',
        category: 'Operasional Acara',
        method: 'Transfer Bank',
    },
];

const teamProjectPayments = [
    {
        id: 'team-payment-1',
        projectId: 'project-1',
        teamMemberId: 'member-1',
        teamMemberName: 'Ayu',
        role: 'Fotografer',
        date: '2026-11-20',
        status: 'Unpaid',
        fee: 1000000,
    },
];

const buildWorkbook = () => buildClientExportWorkbook(
    [clientWithTwoProjects],
    transactions as never,
    teamProjectPayments as never,
    { companyName: 'Vena Wedding' },
);

describe('clientExport', () => {
    it('membentuk 5 sheet dengan urutan yang benar', () => {
        const workbook = buildWorkbook();
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
            'Ringkasan',
            'Pengantin & Acara Pernikahan',
            'Riwayat Pembayaran',
            'Pengeluaran Proyek',
            'Tim & Honor',
        ]);
    });

    it('menggabungkan data pengantin & acara dengan satu baris per proyek', () => {
        const workbook = buildWorkbook();
        const sheet = workbook.getWorksheet('Pengantin & Acara Pernikahan')!;

        expect(sheet.rowCount).toBe(3); // header + 2 proyek
        // Diurutkan berdasarkan tanggal acara: project-2 (10/08) lebih dulu
        expect(cellValue(sheet, 2, 'Nama Acara')).toBe('Engagement Rina & Budi');
        expect(cellValue(sheet, 3, 'Nama Acara')).toBe('Wedding Rina & Budi');
        // ID klien sama untuk kedua baris proyek
        expect(cellValue(sheet, 2, 'ID Klien')).toBe('client-1');
        expect(cellValue(sheet, 3, 'ID Klien')).toBe('client-1');
        // Nama pengantin diambil dari nama klien
        expect(cellValue(sheet, 3, 'Nama Pengantin Pria')).toBe('Rina');
        expect(cellValue(sheet, 3, 'Nama Pengantin Wanita')).toBeFalsy();
        expect(cellValue(sheet, 3, 'Add-on dan Harga Tambahan')).toContain('Album Exclusive');
        expect(cellValue(sheet, 3, 'Harga Paket')).toBe(12000000);
        // Durasi paket diambil apa adanya dari project.durationSelection
        expect(cellValue(sheet, 3, 'Durasi Paket')).toBe('6 Jam');
        // Proyek tanpa durasi tetap dikosongkan (tidak diisi nilai default buatan)
        expect(cellValue(sheet, 2, 'Durasi Paket')).toBeFalsy();
    });

    it('menghitung pembayaran bersih: abaikan transaksi batal, refund mengurangi', () => {
        const workbook = buildWorkbook();
        const sheet = workbook.getWorksheet('Pengantin & Acara Pernikahan')!;
        const row = (name: string) => (cellValue(sheet, 2, 'Nama Acara') === name ? 2 : 3);

        const weddingRow = row('Wedding Rina & Budi');
        // 4.000.000 + 1.000.000 - 500.000 + 1.500.000 = 6.000.000 (2.000.000 batal diabaikan)
        expect(cellValue(sheet, weddingRow, 'Total Pembayaran Masuk')).toBe(6000000);
        expect(cellValue(sheet, weddingRow, 'Sisa Tagihan')).toBe(6000000);
        // Fallback ke amountPaid hanya bila tidak ada transaksi
        expect(cellValue(sheet, 2, 'Total Pembayaran Masuk')).toBe(5000000);
        expect(cellValue(sheet, 2, 'Sisa Tagihan')).toBe(0);
    });

    it('menampilkan seluruh riwayat pembayaran termasuk refund & batal', () => {
        const workbook = buildWorkbook();
        const sheet = workbook.getWorksheet('Riwayat Pembayaran')!;

        expect(sheet.rowCount).toBe(7); // header + 6 transaksi pemasukan
        const statuses = [2, 3, 4, 5, 6, 7].map((rowNumber) => cellValue(sheet, rowNumber, 'Status Pembayaran'));
        expect(statuses).toContain('Batal / Ditolak');
        expect(statuses).toContain('Refund / Koreksi');
        // Nama pengantin diambil dari nama klien
        expect(cellValue(sheet, 2, 'Nama Pengantin')).toBe('Rina');
        expect(cellValue(sheet, 3, 'Nama Pengantin')).toBe('Rina');
        expect(cellValue(sheet, 3, 'Bukti Pembayaran')).toBe('https://example.com/dp.jpg');
    });

    it('menampilkan pengeluaran proyek dan honor tim tanpa duplikasi', () => {
        const workbook = buildWorkbook();
        const expenseSheet = workbook.getWorksheet('Pengeluaran Proyek')!;
        const teamSheet = workbook.getWorksheet('Tim & Honor')!;

        expect(expenseSheet.rowCount).toBe(2);
        expect(cellValue(expenseSheet, 2, 'ID Pengeluaran')).toBe('expense-1');
        expect(cellValue(expenseSheet, 2, 'Nominal Pengeluaran')).toBe(750000);

        expect(teamSheet.rowCount).toBe(2); // 1 anggota tim, tidak digandakan
        expect(cellValue(teamSheet, 2, 'Nama Anggota Tim')).toBe('Ayu');
        expect(cellValue(teamSheet, 2, 'Total Honor')).toBe(1000000);
        expect(cellValue(teamSheet, 2, 'Honor yang Sudah Dibayar')).toBe(0);
        expect(cellValue(teamSheet, 2, 'Sisa Honor')).toBe(1000000);
        expect(cellValue(teamSheet, 2, 'Status Pembayaran Honor')).toBe('Belum Dibayar');
    });

    it('menjaga konsistensi angka ringkasan dengan sheet detail', () => {
        const workbook = buildWorkbook();
        const eventSheet = workbook.getWorksheet('Pengantin & Acara Pernikahan')!;

        const detailContract = [2, 3].reduce((sum, rowNumber) => sum + Number(cellValue(eventSheet, rowNumber, 'Total Nilai Kontrak') ?? 0), 0);
        const detailPayment = [2, 3].reduce((sum, rowNumber) => sum + Number(cellValue(eventSheet, rowNumber, 'Total Pembayaran Masuk') ?? 0), 0);
        const detailRemaining = [2, 3].reduce((sum, rowNumber) => sum + Number(cellValue(eventSheet, rowNumber, 'Sisa Tagihan') ?? 0), 0);

        expect(summaryValue(workbook, 'Total pengantin / klien')).toBe(1);
        expect(summaryValue(workbook, 'Total proyek / acara')).toBe(2);
        expect(summaryValue(workbook, 'Total nilai kontrak')).toBe(detailContract);
        expect(summaryValue(workbook, 'Total nilai kontrak')).toBe(17000000);
        expect(summaryValue(workbook, 'Total pembayaran masuk')).toBe(detailPayment);
        expect(summaryValue(workbook, 'Total pembayaran masuk')).toBe(11000000);
        expect(summaryValue(workbook, 'Total sisa tagihan')).toBe(detailRemaining);
        expect(summaryValue(workbook, 'Total sisa tagihan')).toBe(6000000);
        expect(summaryValue(workbook, 'Total pengeluaran proyek')).toBe(750000);
        expect(summaryValue(workbook, 'Total honor tim')).toBe(1000000);
        // Saldo bersih = pembayaran masuk - pengeluaran proyek (honor tim tidak dicampur)
        expect(summaryValue(workbook, 'Saldo bersih (pembayaran masuk - pengeluaran proyek)')).toBe(10250000);
        expect(summaryValue(workbook, 'Proyek selesai')).toBe(1);
        expect(summaryValue(workbook, 'Proyek berjalan')).toBe(1);
        expect(summaryValue(workbook, 'Proyek belum lunas')).toBe(1);
    });

    it('menelusuri selisih dengan aturan halaman Keuangan (cakupan & status transaksi)', () => {
        const workbook = buildWorkbook();

        // Aturan halaman Keuangan (FinancePage.tsx): SEMUA transaksi dijumlahkan apa adanya,
        // tanpa filter status. Untuk proyek-1 nilainya:
        // 4.000.000 (DP) + 1.000.000 (Termin) - 500.000 (Refund) + 2.000.000 (batal) + 1.500.000 (Pelunasan) = 8.000.000
        const financeRuleIncomeProjectOne = 4000000 + 1000000 - 500000 + 2000000 + 1500000;
        const financeRuleIncomeProjectTwo = 5000000;
        const financeRuleExpenseProjectOne = 750000;

        const exportIncome = Number(summaryValue(workbook, 'Total pembayaran masuk') ?? 0);
        const exportExpense = Number(summaryValue(workbook, 'Total pengeluaran proyek') ?? 0);

        // Pengeluaran identik: tidak ada transaksi pengeluaran batal.
        expect(exportExpense).toBe(financeRuleExpenseProjectOne);
        // Pada cakupan proyek yang sama, selisih pemasukan sepenuhnya berasal dari
        // transaksi batal (t4 = 2.000.000) yang dikecualikan export.
        const financeRuleIncome = financeRuleIncomeProjectOne + financeRuleIncomeProjectTwo;
        expect(financeRuleIncome - exportIncome).toBe(2000000);
        // Refund bernilai negatif sudah mengikuti aturan Keuangan (mengurangi total) di kedua sisi.
        expect(exportIncome).toBe(6000000 + 5000000);
    });

    it('menampilkan informasi pada sheet kosong dan tetap menyediakan header', () => {
        const emptyClient = buildClient({ id: 'client-2', name: 'Klien Tanpa Proyek', projects: [] });
        const workbook = buildClientExportWorkbook([emptyClient], [], [], { companyName: 'Vena' });
        const expenseSheet = workbook.getWorksheet('Pengeluaran Proyek')!;
        const teamSheet = workbook.getWorksheet('Tim & Honor')!;
        const eventSheet = workbook.getWorksheet('Pengantin & Acara Pernikahan')!;

        expect(expenseSheet.rowCount).toBe(2);
        expect(String(expenseSheet.getCell('A2').value)).toContain('Belum terdapat');
        expect(String(teamSheet.getCell('A2').value)).toContain('Belum terdapat');
        // Klien tanpa proyek tetap muncul agar tidak kehilangan data
        expect(eventSheet.rowCount).toBe(2);
        expect(cellValue(eventSheet, 2, 'ID Klien')).toBe('client-2');
    });

    it('menyediakan CSV per kategori dengan nominal berupa angka murni', () => {
        const payloads = buildClientExportCsvPayloads(
            [clientWithTwoProjects],
            transactions as never,
            teamProjectPayments as never,
            { companyName: 'Vena Wedding' },
        );

        expect(payloads.map((payload) => payload.category)).toEqual([...CLIENT_EXPORT_CSV_CATEGORIES]);
        expect(payloads).toHaveLength(4);

        const paymentCsv = payloads.find((payload) => payload.category === 'Riwayat Pembayaran')!;
        expect(paymentCsv.headers).toContain('Nominal Pembayaran');
        const amountIndex = paymentCsv.headers.indexOf('Nominal Pembayaran');
        expect(paymentCsv.rows.every((row) => typeof row[amountIndex] === 'number')).toBe(true);

        const eventCsv = payloads.find((payload) => payload.category === 'Pengantin & Acara Pernikahan')!;
        const dateIndex = eventCsv.headers.indexOf('Tanggal Acara');
        expect(eventCsv.rows[0][dateIndex]).toBe('10/08/2026');
    });

    it('menghasilkan buffer Excel .xlsx yang valid (siap dibuka di Microsoft Excel)', async () => {
        const workbook = buildWorkbook();
        const buffer = await workbook.xlsx.writeBuffer();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('hanya menarik data untuk proyek yang diberikan (isolasi multi-tenant)', () => {
        // Koleksi yang diberikan hanya berisi project-1; transaksi project-2 tidak boleh ikut terbawa.
        const scopedClient = buildClient({ id: 'client-1', projects: [projectOne] });
        const workbook = buildClientExportWorkbook(
            [scopedClient],
            transactions as never,
            teamProjectPayments as never,
            { companyName: 'Vendor A' },
        );
        const paymentSheet = workbook.getWorksheet('Riwayat Pembayaran')!;
        const projectNames = [2, 3, 4, 5].map((rowNumber) => cellValue(paymentSheet, rowNumber, 'Nama Proyek/Acara'));

        expect(paymentSheet.rowCount).toBe(6); // header + 5 transaksi project-1 (t7 milik project-2 tidak ikut)
        expect(projectNames.every((name) => name === 'Wedding Rina & Budi')).toBe(true);
        expect(summaryValue(workbook, 'Total pembayaran masuk')).toBe(6000000);
        expect(summaryValue(workbook, 'Total proyek / acara')).toBe(1);
    });
});
