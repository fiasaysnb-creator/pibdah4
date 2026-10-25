import ExcelJS from 'exceljs';
import { TransactionType } from '../../../types';
import type { Card, FinancialPocket, Project, Transaction } from '../../../types';
import { downloadCSV } from '../../../utils/export';

// ─────────────────────────────────────────────────────────────────────────────
// Tipe & definisi kolom (dipakai bersama oleh Excel dan CSV agar tidak ada
// kolom yang hilang/berbeda antara kedua format).
// ─────────────────────────────────────────────────────────────────────────────

type CellValue = string | number | boolean | Date | null | undefined;
type ExportRow = Record<string, CellValue>;
type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'status';

interface ColumnDefinition {
    header: string;
    key: string;
    type?: ColumnType;
    wrap?: boolean;
    align?: 'left' | 'center' | 'right';
    minWidth?: number;
    maxWidth?: number;
}

interface SheetDefinition {
    name: string;
    columns: ColumnDefinition[];
    rows: ExportRow[];
    /** Teks informasi bila sheet belum memiliki baris data. */
    emptyMessage?: string;
}

interface SummaryRow {
    section: string;
    item: string;
    value: number;
    note: string;
    format: 'currency' | 'number';
}

/**
 * Konteks opsional untuk memperkaya kolom export (nama kartu/kantong/proyek).
 * Data sudah ter-filter per vendor sebelum sampai ke sini (RLS + filter vendor_id),
 * sehingga tidak ada perubahan pada isolasi multi-tenant.
 */
export interface FinanceExportContext {
    companyName?: string;
    cards?: Card[];
    pockets?: FinancialPocket[];
    projects?: Project[];
    transactions?: Transaction[];
}

export interface FinanceSummaryMetric {
    income: number;
    expense: number;
    net: number;
}

interface CardStatsLike {
    creditDebt: number;
    debitAndCashAssets: number;
    mostUsedCardName: string;
    mostUsedCardTxCount: number;
    cashBalance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format angka & tanggal (standar Indonesia)
// ─────────────────────────────────────────────────────────────────────────────

const currencyFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';
const numberFormat = '#,##0';
const dateFormat = 'dd/mm/yyyy';

const headerFill = 'FF1E3A8A';
const headerBorder = 'FFBFDBFE';
const zebraFill = 'FFF8FAFC';
const borderColor = 'FFE2E8F0';
const titleFill = 'FF1E3A8A';
const infoColor = 'FF5A6A85';

const SECTION_FILL: Record<string, string> = {
    'Ringkasan Keuangan': 'FFECFDF5',
    'Ringkasan Filter': 'FFEFF6FF',
    'Ringkasan Semua Data': 'FFF5F3FF',
    'Periode Laporan': 'FFEFF6FF',
    'Laba & Rugi': 'FFECFDF5',
    'Aset & Utang': 'FFFFF7ED',
    'Informasi': 'FFF5F3FF',
};

const pad = (value: number) => String(value).padStart(2, '0');

const getExportDateStamp = (date: Date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toNumber = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const parseDateValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateForCsv = (value?: string | null) => {
    const date = parseDateValue(value);
    if (!date) return '';
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatDateTimeDisplay = (date: Date) =>
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const typeLabel = (type: TransactionType) =>
    type === TransactionType.INCOME ? 'Pemasukan' : 'Pengeluaran';

// ─────────────────────────────────────────────────────────────────────────────
// Resolusi relasi (kartu / kantong / proyek)
// ─────────────────────────────────────────────────────────────────────────────

const buildContextMaps = (context: FinanceExportContext) => ({
    cardById: new Map((context.cards || []).map((card) => [card.id, card])),
    pocketById: new Map((context.pockets || []).map((pocket) => [pocket.id, pocket])),
    projectById: new Map((context.projects || []).map((project) => [project.id, project])),
});

const describeCard = (card?: Card) => {
    if (!card) return '';
    const digits = card.lastFourDigits ? ` ••••${card.lastFourDigits}` : '';
    return `${card.bankName}${digits}`.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// Definisi kolom per jenis laporan
// ─────────────────────────────────────────────────────────────────────────────

const TRANSACTION_COLUMNS: ColumnDefinition[] = [
    { header: 'No', key: 'no', type: 'number', minWidth: 6, align: 'center' },
    { header: 'Tanggal', key: 'date', type: 'date', minWidth: 14, align: 'center' },
    { header: 'ID Transaksi', key: 'transactionId', type: 'text', minWidth: 20 },
    { header: 'Keterangan', key: 'description', type: 'text', wrap: true, minWidth: 26, maxWidth: 44 },
    { header: 'Kategori', key: 'category', type: 'text', minWidth: 18 },
    { header: 'Jenis Transaksi', key: 'type', type: 'status', minWidth: 16 },
    { header: 'Nominal', key: 'amount', type: 'currency', minWidth: 18 },
    { header: 'Metode Pembayaran', key: 'method', type: 'text', minWidth: 18 },
    { header: 'Kartu / Rekening', key: 'account', type: 'text', minWidth: 20 },
    { header: 'Proyek / Klien', key: 'project', type: 'text', wrap: true, minWidth: 24, maxWidth: 40 },
    { header: 'Catatan / Bukti', key: 'proof', type: 'text', wrap: true, minWidth: 22, maxWidth: 38 },
];

const PROFIT_COLUMNS: ColumnDefinition[] = [
    { header: 'No', key: 'no', type: 'number', minWidth: 6, align: 'center' },
    { header: 'ID Pengantin', key: 'clientId', type: 'text', minWidth: 20 },
    { header: 'Nama Pengantin', key: 'clientName', type: 'text', minWidth: 24 },
    { header: 'Jumlah Acara', key: 'projectCount', type: 'number', minWidth: 12, align: 'center' },
    { header: 'Harga Paket', key: 'totalPackageRevenue', type: 'currency', minWidth: 18 },
    { header: 'Biaya Tambahan', key: 'totalCustomCosts', type: 'currency', minWidth: 16 },
    { header: 'Transport', key: 'totalTransportCosts', type: 'currency', minWidth: 16 },
    { header: 'Total Tagihan', key: 'totalBilling', type: 'currency', minWidth: 18 },
    { header: 'Total Pemasukan', key: 'totalIncome', type: 'currency', minWidth: 18 },
    { header: 'Biaya Produksi', key: 'totalCost', type: 'currency', minWidth: 18 },
    { header: 'Laba Bersih', key: 'profit', type: 'currency', minWidth: 18 },
    { header: 'Status', key: 'profitStatus', type: 'status', minWidth: 14 },
];

const CARD_COLUMNS: ColumnDefinition[] = [
    { header: 'No', key: 'no', type: 'number', minWidth: 6, align: 'center' },
    { header: 'Nama Pemegang', key: 'cardHolderName', type: 'text', minWidth: 22 },
    { header: 'Bank / Penerbit', key: 'bankName', type: 'text', minWidth: 18 },
    { header: 'Jenis Kartu', key: 'cardType', type: 'text', minWidth: 14, align: 'center' },
    { header: '4 Digit Terakhir', key: 'lastFourDigits', type: 'text', minWidth: 14, align: 'center' },
    { header: 'Kedaluwarsa', key: 'expiryDate', type: 'text', minWidth: 12, align: 'center' },
    { header: 'Saldo', key: 'balance', type: 'currency', minWidth: 18 },
    { header: 'Jumlah Transaksi Terkait', key: 'txCount', type: 'number', minWidth: 16, align: 'center' },
];

const POCKET_COLUMNS: ColumnDefinition[] = [
    { header: 'No', key: 'no', type: 'number', minWidth: 6, align: 'center' },
    { header: 'Nama Kantong', key: 'name', type: 'text', minWidth: 22 },
    { header: 'Jenis', key: 'pocketType', type: 'text', minWidth: 20 },
    { header: 'Deskripsi', key: 'description', type: 'text', wrap: true, minWidth: 26, maxWidth: 42 },
    { header: 'Saldo Saat Ini', key: 'amount', type: 'currency', minWidth: 18 },
    { header: 'Target', key: 'goalAmount', type: 'currency', minWidth: 18 },
    { header: 'Ditautkan ke Kartu', key: 'sourceCard', type: 'text', minWidth: 20 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pembentuk baris data
// ─────────────────────────────────────────────────────────────────────────────

const buildTransactionRows = (
    transactions: Transaction[],
    context: FinanceExportContext,
): ExportRow[] => {
    const { cardById, pocketById, projectById } = buildContextMaps(context);

    return [...transactions]
        .sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0))
        .map((transaction, index) => {
            const card = transaction.cardId ? cardById.get(transaction.cardId) : undefined;
            const pocket = transaction.pocketId ? pocketById.get(transaction.pocketId) : undefined;
            const project = transaction.projectId ? projectById.get(transaction.projectId) : undefined;

            const account = card
                ? describeCard(card)
                : pocket
                    ? `Kantong: ${pocket.name}`
                    : '';

            const projectLabel = project
                ? [project.projectName, project.clientName].filter(Boolean).join(' — ')
                : '';

            const proofParts = [
                transaction.vendorSignature ? 'Tanda tangan vendor tersedia' : '',
                transaction.printingItemId ? `Item cetak: ${transaction.printingItemId}` : '',
            ].filter(Boolean);

            return {
                no: index + 1,
                date: parseDateValue(transaction.date),
                transactionId: transaction.id,
                description: transaction.description || '',
                category: transaction.category || '',
                type: typeLabel(transaction.type),
                amount: toNumber(transaction.amount),
                method: transaction.method || '',
                account,
                project: projectLabel,
                proof: proofParts.join(' | '),
            };
        });
};

const buildProfitRows = (projectProfitabilityData: any[]): ExportRow[] =>
    projectProfitabilityData.map((data, index) => {
        const totalPackageRevenue = toNumber(data?.totalPackageRevenue);
        const totalCustomCosts = toNumber(data?.totalCustomCosts);
        const totalTransportCosts = toNumber(data?.totalTransportCosts);
        const profit = toNumber(data?.profit);
        return {
            no: index + 1,
            clientId: data?.clientId || '',
            clientName: data?.clientName || '',
            projectCount: Array.isArray(data?.projects) ? data.projects.length : 0,
            totalPackageRevenue,
            totalCustomCosts,
            totalTransportCosts,
            totalBilling: totalPackageRevenue + totalCustomCosts + totalTransportCosts,
            totalIncome: toNumber(data?.totalIncome),
            totalCost: toNumber(data?.totalCost),
            profit,
            profitStatus: profit >= 0 ? 'Profit' : 'Rugi',
        };
    });

const buildCardRows = (cards: Card[], transactions: Transaction[]): ExportRow[] => {
    const cardIdSet = new Set(cards.map((card) => card.id));
    const txCountByCard = transactions.reduce((accumulator, transaction) => {
        if (transaction.cardId && cardIdSet.has(transaction.cardId)) {
            accumulator[transaction.cardId] = (accumulator[transaction.cardId] || 0) + 1;
        }
        return accumulator;
    }, {} as Record<string, number>);

    return cards.map((card, index) => ({
        no: index + 1,
        cardHolderName: card.cardHolderName || '',
        bankName: card.bankName || '',
        cardType: card.cardType || '',
        lastFourDigits: card.lastFourDigits || '',
        expiryDate: card.expiryDate || '',
        balance: toNumber(card.balance),
        txCount: txCountByCard[card.id] || 0,
    }));
};

const buildPocketRows = (pockets: FinancialPocket[], context: FinanceExportContext): ExportRow[] => {
    const { cardById } = buildContextMaps(context);
    return pockets.map((pocket, index) => ({
        no: index + 1,
        name: pocket.name || '',
        pocketType: pocket.type || '',
        description: pocket.description || '',
        amount: toNumber(pocket.amount),
        goalAmount: pocket.goalAmount == null ? null : toNumber(pocket.goalAmount),
        sourceCard: pocket.sourceCardId ? describeCard(cardById.get(pocket.sourceCardId)) : '',
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper styling Excel (pola sama dengan export Pengantin)
// ─────────────────────────────────────────────────────────────────────────────

const statusColor = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('pemasukan') || normalized.includes('profit') || normalized.includes('lunas')) {
        return { fill: 'FFDCFCE7', font: 'FF166534' };
    }
    if (normalized.includes('pengeluaran') || normalized.includes('rugi')) {
        return { fill: 'FFFEE2E2', font: 'FFB91C1C' };
    }
    if (normalized.includes('pending') || normalized.includes('menunggu')) {
        return { fill: 'FFFEF3C7', font: 'FF92400E' };
    }
    return null;
};

const formatCellForWidth = (value: CellValue, columnType?: ColumnType) => {
    if (value == null) return '';
    if (value instanceof Date) {
        return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
    }
    if (typeof value === 'number') {
        if (columnType === 'currency') return `Rp ${value.toLocaleString('id-ID')}`;
        return value.toLocaleString('id-ID');
    }
    if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
    return String(value);
};

const autoFitColumns = (worksheet: ExcelJS.Worksheet, columns: ColumnDefinition[]) => {
    columns.forEach((columnDefinition, index) => {
        const column = worksheet.getColumn(index + 1);
        const minWidth = columnDefinition.minWidth ?? 14;
        const maxWidth = columnDefinition.maxWidth ?? (columnDefinition.wrap ? 36 : 26);
        let width = Math.max(minWidth, columnDefinition.header.length + 2);

        column.eachCell({ includeEmpty: true }, (cell) => {
            const value = formatCellForWidth(cell.value as CellValue, columnDefinition.type);
            const longestLine = value
                .split('\n')
                .reduce((longest, line) => Math.max(longest, line.length), 0);
            width = Math.max(width, longestLine + 2);
        });

        column.width = Math.min(maxWidth, width);
    });
};

const applyCellBorder = (cell: ExcelJS.Cell, color: string = borderColor) => {
    cell.border = {
        top: { style: 'thin', color: { argb: color } },
        left: { style: 'thin', color: { argb: color } },
        bottom: { style: 'thin', color: { argb: color } },
        right: { style: 'thin', color: { argb: color } },
    };
};

const styleHeaderRow = (row: ExcelJS.Row, columnCount: number) => {
    row.height = 28;
    for (let index = 1; index <= columnCount; index += 1) {
        const cell = row.getCell(index);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        applyCellBorder(cell, headerBorder);
    }
};

const getAlignment = (columnDefinition: ColumnDefinition): 'left' | 'center' | 'right' => {
    if (columnDefinition.align) return columnDefinition.align;
    if (columnDefinition.type === 'currency' || columnDefinition.type === 'number') return 'right';
    if (columnDefinition.type === 'date') return 'center';
    return 'left';
};

const applyWorksheetStyles = (worksheet: ExcelJS.Worksheet, columns: ColumnDefinition[]) => {
    worksheet.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', showGridLines: false }];
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
    };

    styleHeaderRow(worksheet.getRow(1), columns.length);

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            const columnDefinition = columns[columnNumber - 1];
            if (!columnDefinition) return;
            cell.alignment = {
                vertical: 'top',
                horizontal: getAlignment(columnDefinition),
                wrapText: Boolean(columnDefinition.wrap),
            };
            applyCellBorder(cell);
            if (rowNumber % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
            }
        });
    });
};

const applyColumnFormats = (worksheet: ExcelJS.Worksheet, columns: ColumnDefinition[]) => {
    columns.forEach((columnDefinition, index) => {
        const column = worksheet.getColumn(index + 1);
        if (columnDefinition.type === 'currency') column.numFmt = currencyFormat;
        else if (columnDefinition.type === 'number') column.numFmt = numberFormat;
        else if (columnDefinition.type === 'date') column.numFmt = dateFormat;
    });
};

/**
 * Pewarnaan kondisional untuk kolom bertipe status/jenis.
 * Transaction tidak memiliki field `status`, sehingga kolom "Jenis Transaksi"
 * (Pemasukan/Pengeluaran) yang diwarnai; kolom Laba memakai Profit/Rugi.
 */
const applyStatusCellStyling = (worksheet: ExcelJS.Worksheet, columns: ColumnDefinition[]) => {
    columns
        .map((column, index) => ({ column, index: index + 1 }))
        .filter(({ column }) => column.type === 'status')
        .forEach(({ index }) => {
            worksheet.getColumn(index).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber === 1 || typeof cell.value !== 'string' || !cell.value) return;
                const color = statusColor(cell.value);
                if (!color) return;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.fill } };
                cell.font = { bold: true, color: { argb: color.font } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });
        });
};

const createDataWorksheet = (workbook: ExcelJS.Workbook, sheet: SheetDefinition) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.minWidth ?? 14,
    }));

    sheet.rows.forEach((row) => worksheet.addRow(row));

    if (sheet.rows.length === 0 && sheet.emptyMessage) {
        const lastColumn = Math.max(1, sheet.columns.length);
        worksheet.mergeCells(2, 1, 2, lastColumn);
        const infoCell = worksheet.getCell(2, 1);
        infoCell.value = sheet.emptyMessage;
        infoCell.font = { italic: true, color: { argb: infoColor } };
        infoCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        worksheet.getRow(2).height = 24;
        applyCellBorder(infoCell);
    }

    applyWorksheetStyles(worksheet, sheet.columns);
    applyColumnFormats(worksheet, sheet.columns);
    applyStatusCellStyling(worksheet, sheet.columns);
    autoFitColumns(worksheet, sheet.columns);

    return worksheet;
};

const createSummaryWorksheet = (
    workbook: ExcelJS.Workbook,
    title: string,
    subtitle: string,
    summary: SummaryRow[],
) => {
    const worksheet = workbook.addWorksheet('Ringkasan');
    const columnWidths = [22, 42, 20, 52];
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleFill } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 32;

    worksheet.mergeCells('A2:D2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, size: 10, color: { argb: infoColor } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(2).height = 20;

    const headerRowNumber = 4;
    const headerLabels = ['Bagian', 'Item', 'Nilai', 'Catatan'];
    const headerRow = worksheet.getRow(headerRowNumber);
    headerLabels.forEach((label, index) => {
        headerRow.getCell(index + 1).value = label;
    });
    styleHeaderRow(headerRow, headerLabels.length);

    let previousSection = '';
    summary.forEach((row, index) => {
        const targetRow = worksheet.getRow(headerRowNumber + 1 + index);
        const isNewSection = row.section !== previousSection;
        previousSection = row.section;

        targetRow.getCell(1).value = isNewSection ? row.section : '';
        targetRow.getCell(2).value = row.item;
        targetRow.getCell(3).value = row.value;
        targetRow.getCell(4).value = row.note;

        const sectionFill = SECTION_FILL[row.section] || zebraFill;
        targetRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            if (columnNumber > headerLabels.length) return;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sectionFill } };
            applyCellBorder(cell);
            cell.alignment = {
                vertical: 'top',
                horizontal: columnNumber === 3 ? 'right' : 'left',
                wrapText: columnNumber === 2 || columnNumber === 4,
            };
            if (columnNumber === 3) {
                cell.numFmt = row.format === 'currency' ? currencyFormat : numberFormat;
                cell.font = { bold: true, color: { argb: row.value < 0 ? 'FFB91C1C' : 'FF166534' } };
            }
            if (columnNumber === 1 && isNewSection) {
                cell.font = { bold: true, color: { argb: 'FF1E3A8A' } };
            }
        });
    });

    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];
    worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: headerRowNumber, column: headerLabels.length },
    };

    return worksheet;
};

// ─────────────────────────────────────────────────────────────────────────────
// Penulisan file
// ─────────────────────────────────────────────────────────────────────────────

const buildWorkbook = (context: FinanceExportContext, subject: string) => {
    const workbook = new ExcelJS.Workbook();
    const companyName = context.companyName || 'Vena';
    const now = new Date();
    workbook.creator = companyName;
    workbook.created = now;
    workbook.modified = now;
    Object.assign(workbook, { subject, title: `Export ${companyName}` });
    return { workbook, companyName, generatedAt: now };
};

const downloadWorkbook = async (workbook: ExcelJS.Workbook, filename: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const formatCsvValue = (value: CellValue, column: ColumnDefinition): string | number => {
    if (value == null) return '';
    if (column.type === 'date') {
        return value instanceof Date
            ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
            : formatDateForCsv(String(value));
    }
    if (column.type === 'currency' || column.type === 'number') return toNumber(value);
    return typeof value === 'string' ? value : String(value);
};

const toCsvPayload = (columns: ColumnDefinition[], rows: ExportRow[]): { headers: string[]; data: (string | number)[][] } => ({
    headers: columns.map((column) => column.header),
    data: rows.map((row) => columns.map((column) => formatCsvValue(row[column.key], column))),
});

const makeCsvRow = (columns: ColumnDefinition[], values: Partial<Record<string, CellValue>>) =>
    columns.map((column) => formatCsvValue(values[column.key], column));

// ─────────────────────────────────────────────────────────────────────────────
// Export: Transaksi (tab Transaksi)
// ─────────────────────────────────────────────────────────────────────────────

const buildTransactionSummary = (
    filteredSummary: FinanceSummaryMetric,
    allTransactions: Transaction[],
): SummaryRow[] => {
    const overallIncome = allTransactions
        .filter((transaction) => transaction.type === TransactionType.INCOME)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const overallExpense = allTransactions
        .filter((transaction) => transaction.type === TransactionType.EXPENSE)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const overallNet = overallIncome - overallExpense;

    return [
        { section: 'Ringkasan Filter', item: 'Total pemasukan (filter aktif)', value: filteredSummary.income, note: 'Jumlah transaksi pemasukan pada filter yang sedang aktif', format: 'currency' },
        { section: 'Ringkasan Filter', item: 'Total pengeluaran (filter aktif)', value: filteredSummary.expense, note: 'Jumlah transaksi pengeluaran pada filter yang sedang aktif', format: 'currency' },
        { section: 'Ringkasan Filter', item: 'Saldo bersih (filter aktif)', value: filteredSummary.net, note: 'Pemasukan - pengeluaran, sama dengan ringkasan halaman Keuangan', format: 'currency' },
        { section: 'Ringkasan Semua Data', item: 'Total pemasukan (semua data)', value: overallIncome, note: 'Seluruh transaksi pemasukan tanpa filter status', format: 'currency' },
        { section: 'Ringkasan Semua Data', item: 'Total pengeluaran (semua data)', value: overallExpense, note: 'Seluruh transaksi pengeluaran tanpa filter status', format: 'currency' },
        { section: 'Ringkasan Semua Data', item: 'Saldo bersih (semua data)', value: overallNet, note: 'Pemasukan - pengeluaran; sama dengan kartu statistik halaman Keuangan', format: 'currency' },
        { section: 'Informasi', item: 'Jumlah transaksi diexport', value: 0, note: '', format: 'number' },
    ];
};

export const buildTransactionsWorkbook = (
    filteredTransactions: Transaction[],
    allTransactions: Transaction[],
    filteredSummary: FinanceSummaryMetric,
    context: FinanceExportContext = {},
): ExcelJS.Workbook => {
    const { workbook, companyName, generatedAt } = buildWorkbook(context, 'Export transaksi keuangan');
    const rows = buildTransactionRows(filteredTransactions, context);

    const summary = buildTransactionSummary(filteredSummary, allTransactions);
    summary[summary.length - 1].value = rows.length;

    createSummaryWorksheet(
        workbook,
        `RINGKASAN TRANSAKSI — ${companyName}`,
        `Ringkasan pemasukan, pengeluaran, dan saldo bersih • Dibuat: ${formatDateTimeDisplay(generatedAt)}`,
        summary,
    );

    createDataWorksheet(workbook, {
        name: 'Transaksi',
        columns: TRANSACTION_COLUMNS,
        rows,
        emptyMessage: 'Tidak ada transaksi yang cocok dengan filter aktif.',
    });

    return workbook;
};

export const exportTransactionsToExcel = async (
    filteredTransactions: Transaction[],
    allTransactions: Transaction[],
    filteredSummary: FinanceSummaryMetric,
    context: FinanceExportContext = {},
): Promise<void> => {
    const workbook = buildTransactionsWorkbook(filteredTransactions, allTransactions, filteredSummary, context);
    await downloadWorkbook(workbook, `Transaksi-Keuangan-${getExportDateStamp()}.xlsx`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export: Laporan (tab Laporan)
// ─────────────────────────────────────────────────────────────────────────────

export const buildReportWorkbook = (
    reportTransactions: Transaction[],
    reportFilters: { client: string; dateFrom: string; dateTo: string },
    reportClientOptions: { id: string; name: string }[],
    context: FinanceExportContext = {},
): ExcelJS.Workbook => {
    const { workbook, companyName, generatedAt } = buildWorkbook(context, 'Export laporan keuangan');
    const rows = buildTransactionRows(reportTransactions, context);

    const clientName = reportFilters.client === 'all'
        ? 'Semua Pengantin'
        : (reportClientOptions.find((option) => option.id === reportFilters.client)?.name || 'Pengantin');

    const income = reportTransactions
        .filter((transaction) => transaction.type === TransactionType.INCOME)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = reportTransactions
        .filter((transaction) => transaction.type === TransactionType.EXPENSE)
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const periodLabel = [
        reportFilters.dateFrom ? `dari ${formatDateForCsv(reportFilters.dateFrom)}` : '',
        reportFilters.dateTo ? `sampai ${formatDateForCsv(reportFilters.dateTo)}` : '',
    ].filter(Boolean).join(' ') || 'seluruh periode';

    createSummaryWorksheet(
        workbook,
        `LAPORAN KEUANGAN — ${companyName}`,
        `Pengantin: ${clientName} • Periode: ${periodLabel} • Dibuat: ${formatDateTimeDisplay(generatedAt)}`,
        [
            { section: 'Ringkasan Keuangan', item: 'Total pemasukan', value: income, note: 'Jumlah transaksi pemasukan sesuai filter laporan', format: 'currency' },
            { section: 'Ringkasan Keuangan', item: 'Total pengeluaran', value: expense, note: 'Jumlah transaksi pengeluaran sesuai filter laporan', format: 'currency' },
            { section: 'Ringkasan Keuangan', item: 'Saldo bersih', value: income - expense, note: 'Pemasukan - pengeluaran (sama dengan aturan halaman Keuangan)', format: 'currency' },
            { section: 'Periode Laporan', item: 'Jumlah transaksi', value: rows.length, note: 'Jumlah baris pada sheet "Transaksi"', format: 'number' },
        ],
    );

    createDataWorksheet(workbook, {
        name: 'Transaksi',
        columns: TRANSACTION_COLUMNS,
        rows,
        emptyMessage: 'Tidak ada transaksi pada filter laporan ini.',
    });

    return workbook;
};

export const exportReportToExcel = async (
    reportTransactions: Transaction[],
    reportFilters: { client: string; dateFrom: string; dateTo: string },
    reportClientOptions: { id: string; name: string }[],
    context: FinanceExportContext = {},
): Promise<void> => {
    const workbook = buildReportWorkbook(reportTransactions, reportFilters, reportClientOptions, context);
    const clientName = reportFilters.client === 'all'
        ? 'Semua Pengantin'
        : (reportClientOptions.find((option) => option.id === reportFilters.client)?.name || 'Pengantin');
    const fileClient = clientName.replace(/\s+/g, '-');
    await downloadWorkbook(workbook, `Laporan-Keuangan-${fileClient}-${getExportDateStamp()}.xlsx`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export: Laba per Acara (tab Laba Acara)
// ─────────────────────────────────────────────────────────────────────────────

export const buildProfitReportWorkbook = (
    projectProfitabilityData: any[],
    profitReportFilters: { year: number; month: number },
    context: FinanceExportContext = {},
): ExcelJS.Workbook => {
    const { workbook, companyName, generatedAt } = buildWorkbook(context, 'Export laba per acara pernikahan');
    const rows = buildProfitRows(projectProfitabilityData);

    const totalProfit = rows.reduce((sum, row) => sum + toNumber(row.profit), 0);
    const totalIncome = rows.reduce((sum, row) => sum + toNumber(row.totalIncome), 0);
    const totalCost = rows.reduce((sum, row) => sum + toNumber(row.totalCost), 0);
    const avgProfit = rows.length > 0 ? totalProfit / rows.length : 0;
    const monthName = new Date(0, profitReportFilters.month).toLocaleString('id-ID', { month: 'long' });

    createSummaryWorksheet(
        workbook,
        `LABA PER ACARA PERNIKAHAN — ${companyName}`,
        `Periode: ${monthName} ${profitReportFilters.year} • Dibuat: ${formatDateTimeDisplay(generatedAt)}`,
        [
            { section: 'Laba & Rugi', item: 'Total pemasukan', value: totalIncome, note: 'Seluruh transaksi pemasukan yang terhubung ke acara pada periode ini', format: 'currency' },
            { section: 'Laba & Rugi', item: 'Total biaya produksi', value: totalCost, note: 'Seluruh transaksi pengeluaran yang terhubung ke acara pada periode ini', format: 'currency' },
            { section: 'Laba & Rugi', item: 'Total laba bersih', value: totalProfit, note: 'Pemasukan - biaya produksi', format: 'currency' },
            { section: 'Laba & Rugi', item: 'Rata-rata laba per pengantin', value: avgProfit, note: 'Total laba dibagi jumlah pengantin pada periode ini', format: 'currency' },
            { section: 'Informasi', item: 'Jumlah pengantin', value: rows.length, note: 'Jumlah baris pada sheet "Laba per Acara Pernikahan"', format: 'number' },
        ],
    );

    createDataWorksheet(workbook, {
        name: 'Laba per Acara Pernikahan',
        columns: PROFIT_COLUMNS,
        rows,
        emptyMessage: 'Tidak ada data acara pernikahan untuk periode ini.',
    });

    return workbook;
};

export const exportProfitReportToExcel = async (
    projectProfitabilityData: any[],
    profitReportFilters: { year: number; month: number },
    context: FinanceExportContext = {},
): Promise<void> => {
    const workbook = buildProfitReportWorkbook(projectProfitabilityData, profitReportFilters, context);
    const period = `${profitReportFilters.month + 1}-${profitReportFilters.year}`;
    await downloadWorkbook(workbook, `Laporan-Laba-Acara-Pernikahan-${period}-${getExportDateStamp()}.xlsx`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export: Kartu & Akun (tab Kartu)
// ─────────────────────────────────────────────────────────────────────────────

export const buildCardsWorkbook = (
    cards: Card[],
    pockets: FinancialPocket[],
    cardStats: CardStatsLike,
    context: FinanceExportContext = {},
): ExcelJS.Workbook => {
    const { workbook, companyName, generatedAt } = buildWorkbook(context, 'Export kartu & akun keuangan');
    const cardRows = buildCardRows(cards, context.transactions || []);
    const pocketRows = buildPocketRows(pockets, context);

    const totalDebitCash = toNumber(cardStats.debitAndCashAssets);
    const totalCredit = toNumber(cardStats.creditDebt);
    const netAssets = totalDebitCash - totalCredit;

    createSummaryWorksheet(
        workbook,
        `KARTU & AKUN — ${companyName}`,
        `Ringkasan aset, utang kartu kredit, dan kantong anggaran • Dibuat: ${formatDateTimeDisplay(generatedAt)}`,
        [
            { section: 'Aset & Utang', item: 'Total aset debit & tunai', value: totalDebitCash, note: 'Saldo seluruh kartu debit dan tunai', format: 'currency' },
            { section: 'Aset & Utang', item: 'Saldo tunai', value: toNumber(cardStats.cashBalance), note: 'Saldo kartu bertipe Tunai', format: 'currency' },
            { section: 'Aset & Utang', item: 'Total utang kartu kredit', value: totalCredit, note: 'Total saldo kartu kredit (nilai absolut)', format: 'currency' },
            { section: 'Aset & Utang', item: 'Aset bersih', value: netAssets, note: 'Aset debit & tunai - utang kartu kredit', format: 'currency' },
            { section: 'Informasi', item: 'Jumlah kartu / akun', value: cardRows.length, note: 'Jumlah baris pada sheet "Kartu & Akun"', format: 'number' },
            { section: 'Informasi', item: 'Jumlah kantong', value: pocketRows.length, note: 'Jumlah baris pada sheet "Kantong"', format: 'number' },
            { section: 'Informasi', item: 'Kartu paling sering dipakai', value: toNumber(cardStats.mostUsedCardTxCount), note: cardStats.mostUsedCardName || 'N/A', format: 'number' },
        ],
    );

    createDataWorksheet(workbook, {
        name: 'Kartu & Akun',
        columns: CARD_COLUMNS,
        rows: cardRows,
        emptyMessage: 'Belum ada kartu / akun yang tercatat.',
    });

    createDataWorksheet(workbook, {
        name: 'Kantong',
        columns: POCKET_COLUMNS,
        rows: pocketRows,
        emptyMessage: 'Belum ada kantong anggaran yang tercatat.',
    });

    return workbook;
};

export const exportCardsToExcel = async (
    cards: Card[],
    pockets: FinancialPocket[],
    cardStats: CardStatsLike,
    context: FinanceExportContext = {},
): Promise<void> => {
    const workbook = buildCardsWorkbook(cards, pockets, cardStats, context);
    await downloadWorkbook(workbook, `Kartu-dan-Akun-${getExportDateStamp()}.xlsx`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export CSV (fungsi existing dipertahankan, format disempurnakan)
// ─────────────────────────────────────────────────────────────────────────────

export function downloadReportCSV(
    reportTransactions: Transaction[],
    reportFilters: { client: string; dateFrom: string; dateTo: string },
    reportClientOptions: { id: string; name: string }[],
    context: FinanceExportContext = {},
): void {
    const rows = buildTransactionRows(reportTransactions, context);
    const { headers, data } = toCsvPayload(TRANSACTION_COLUMNS, rows);
    const clientName = reportFilters.client === 'all'
        ? 'Semua-Pengantin'
        : (reportClientOptions.find(c => c.id === reportFilters.client)?.name || 'Pengantin').replace(/\s+/g, '-');

    downloadCSV(headers, data, `Laporan-Keuangan-${clientName}-${getExportDateStamp()}.csv`);
}

export function downloadTransactionsCSV(
    filteredTransactions: Transaction[],
    allTransactions: Transaction[],
    filteredSummary: FinanceSummaryMetric,
    context: FinanceExportContext = {},
): void {
    const rows = buildTransactionRows(filteredTransactions, context);
    const { headers, data } = toCsvPayload(TRANSACTION_COLUMNS, rows);

    // Baris ringkasan (format CSV tetap sama seperti sebelumnya, kini nominal angka murni)
    data.push(makeCsvRow(TRANSACTION_COLUMNS, {}));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Ringkasan (Filter Aktif)' }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Total Pemasukan (Filter)', amount: filteredSummary.income }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Total Pengeluaran (Filter)', amount: filteredSummary.expense }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Saldo Bersih (Filter)', amount: filteredSummary.net }));

    const overallIncome = allTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
    const overallExpense = allTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

    data.push(makeCsvRow(TRANSACTION_COLUMNS, {}));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Ringkasan (Semua Data)' }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Total Pemasukan (Semua)', amount: overallIncome }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Total Pengeluaran (Semua)', amount: overallExpense }));
    data.push(makeCsvRow(TRANSACTION_COLUMNS, { description: 'Saldo Bersih (Semua)', amount: overallIncome - overallExpense }));

    const preface = [
        makeCsvRow(TRANSACTION_COLUMNS, { description: `Transaksi Keuangan - ${formatDateForCsv(new Date().toISOString())}` }),
        makeCsvRow(TRANSACTION_COLUMNS, {}),
    ];

    downloadCSV(headers, data, `Transaksi-${getExportDateStamp()}.csv`, preface);
}

export function downloadProfitReportCSV(
    projectProfitabilityData: any[],
    profitReportFilters: { year: number; month: number },
): void {
    const rows = buildProfitRows(projectProfitabilityData);
    const { headers, data } = toCsvPayload(PROFIT_COLUMNS, rows);
    const period = `${profitReportFilters.month + 1}-${profitReportFilters.year}`;
    downloadCSV(headers, data, `Laporan-Laba-Acara-Pernikahan-${period}-${getExportDateStamp()}.csv`);
}
