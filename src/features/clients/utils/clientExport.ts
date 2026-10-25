import ExcelJS from 'exceljs';
import { downloadCSV } from '../../../utils/export';
import { PaymentStatus, TransactionType } from '../../../types';
import type { TeamProjectPayment, Transaction } from '../../../types';
import type { ClientWithSummary } from '../hooks/useClients';

type CellValue = string | number | boolean | Date | null | undefined;
type ExportRow = Record<string, CellValue>;

type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' | 'status';
type CellFormat = 'currency' | 'number';

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
    /** Teks informasi yang ditampilkan bila sheet belum memiliki baris data. */
    emptyMessage?: string;
}

interface SummaryRow {
    section: string;
    item: string;
    value: number;
    note: string;
    format: CellFormat;
}

interface ExportContext {
    companyName?: string;
}

interface ClientExportPayload {
    generatedAt: Date;
    companyName: string;
    summary: SummaryRow[];
    sheets: SheetDefinition[];
}

const currencyFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';
const numberFormat = '#,##0';
const dateFormat = 'dd/mm/yyyy';
const dateTimeFormat = 'dd/mm/yyyy hh:mm';
const timeFormat = 'hh:mm';

const headerFill = 'FF1E3A8A';
const headerBorder = 'FFBFDBFE';
const zebraFill = 'FFF8FAFC';
const borderColor = 'FFE2E8F0';
const summaryTitleFill = 'FF1E3A8A';
const summaryInfoColor = 'FF5A6A85';

const SECTION_FILL: Record<string, string> = {
    'Data Utama': 'FFEFF6FF',
    'Keuangan': 'FFECFDF5',
    'Status Pembayaran': 'FFFFF7ED',
    'Status Proyek': 'FFF5F3FF',
};

const COMPLETED_PROJECT_STATUS = 'Selesai';
const CANCELLED_PROJECT_STATUS = 'Dibatalkan';

const cancelledPaymentKeywords = /(batal|dibatalkan|ditolak|gagal)/i;
const refundKeywords = /(refund|pengembalian|koreksi)/i;

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

const parseTimeValue = (value?: string | null) => {
    if (!value) return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return new Date(1970, 0, 1, hours, minutes, 0, 0);
};

const formatDateForCsv = (value?: string | null) => {
    const date = parseDateValue(value);
    if (!date) return '';
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatDateTimeForCsv = (value?: string | null) => {
    const date = parseDateValue(value);
    if (!date) return '';
    return `${formatDateForCsv(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTimeForCsv = (value?: string | null) => {
    const time = parseTimeValue(value);
    if (!time) return '';
    return `${pad(time.getHours())}:${pad(time.getMinutes())}`;
};

const formatDateTimeDisplay = (date: Date) =>
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatRupiahPlain = (value: number) => `Rp ${toNumber(value).toLocaleString('id-ID')}`;

const inferPaymentKind = (transaction: Transaction) => {
    const haystack = `${transaction.category || ''} ${transaction.description || ''}`.toLowerCase();
    if (refundKeywords.test(haystack) || toNumber(transaction.amount) < 0) return 'Refund / Koreksi';
    if (/(^|\W)(dp|uang muka)(\W|$)|booking fee/i.test(haystack)) return 'DP';
    if (/pelunasan|lunas/i.test(haystack)) return 'Pelunasan';
    if (/termin|angsuran/i.test(haystack)) return 'Termin';
    return 'Pembayaran';
};

const inferPaymentRowStatus = (transaction: Transaction) => {
    const haystack = `${transaction.category || ''} ${transaction.description || ''}`.toLowerCase();
    if (cancelledPaymentKeywords.test(haystack)) return 'Batal / Ditolak';
    if (refundKeywords.test(haystack) || toNumber(transaction.amount) < 0) return 'Refund / Koreksi';
    return 'Diterima';
};

/**
 * Kontribusi transaksi terhadap pembayaran bersih.
 * - Hanya transaksi pemasukan yang dihitung.
 * - Transaksi batal / ditolak tidak dihitung (0).
 * - Refund / koreksi bernilai negatif otomatis mengurangi total.
 */
const getPaymentContribution = (transaction: Transaction) => {
    if (transaction.type !== TransactionType.INCOME) return 0;
    const haystack = `${transaction.category || ''} ${transaction.description || ''}`.toLowerCase();
    if (cancelledPaymentKeywords.test(haystack)) return 0;
    return toNumber(transaction.amount);
};

/**
 * Total pembayaran bersih per proyek.
 * Mengikuti konvensi modul keuangan: transaksi adalah sumber kebenaran,
 * `project.amountPaid` hanya dipakai bila belum ada transaksi terkait.
 */
const deriveProjectPaidAmount = (projectAmountPaid: number, projectIncomeTransactions: Transaction[]) => {
    if (projectIncomeTransactions.length === 0) return toNumber(projectAmountPaid);
    return projectIncomeTransactions.reduce((sum, transaction) => sum + getPaymentContribution(transaction), 0);
};

const buildStatusCounts = (items: string[]) =>
    [...items
        .filter(Boolean)
        .reduce((accumulator, item) => {
            accumulator.set(item, (accumulator.get(item) || 0) + 1);
            return accumulator;
        }, new Map<string, number>())
        .entries()];

const statusColor = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('lunas') || normalized.includes('selesai') || normalized === 'paid' || normalized.includes('diterima')) {
        return { fill: 'FFDCFCE7', font: 'FF166534' };
    }
    if (normalized.includes('batal') || normalized.includes('ditolak') || normalized.includes('refund') || normalized.includes('gagal') || normalized.includes('cancelled')) {
        return { fill: 'FFFEE2E2', font: 'FFB91C1C' };
    }
    if (normalized.includes('belum') || normalized === 'unpaid' || normalized.includes('pending') || normalized.includes('menunggu')) {
        return { fill: 'FFFEF3C7', font: 'FF92400E' };
    }
    if (
        normalized.includes('dp') || normalized.includes('sebagian') || normalized.includes('proses') ||
        normalized.includes('aktif') || normalized.includes('dikonfirmasi') || normalized.includes('persiapan') ||
        normalized.includes('hari h') || normalized.includes('pasca') || normalized.includes('administrasi') ||
        normalized.includes('serah terima') || normalized.includes('terbayar')
    ) {
        return { fill: 'FFDBEAFE', font: 'FF1D4ED8' };
    }
    return null;
};

const formatCellForWidth = (value: CellValue, columnType?: ColumnType) => {
    if (value == null) return '';
    if (value instanceof Date) {
        if (columnType === 'time') return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
        if (columnType === 'datetime') return formatDateTimeDisplay(value);
        return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
    }
    if (typeof value === 'number') return value.toLocaleString('id-ID');
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
    if (columnDefinition.type === 'date' || columnDefinition.type === 'datetime' || columnDefinition.type === 'time') return 'center';
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
        switch (columnDefinition.type) {
            case 'currency':
                column.numFmt = currencyFormat;
                break;
            case 'number':
                column.numFmt = numberFormat;
                break;
            case 'date':
                column.numFmt = dateFormat;
                break;
            case 'datetime':
                column.numFmt = dateTimeFormat;
                break;
            case 'time':
                column.numFmt = timeFormat;
                break;
            default:
                break;
        }
    });
};

const applyStatusCellStyling = (worksheet: ExcelJS.Worksheet, columns: ColumnDefinition[]) => {
    const statusColumnIndexes = columns
        .map((column, index) => ({ column, index: index + 1 }))
        .filter(({ column }) => column.type === 'status')
        .map(({ index }) => index);

    statusColumnIndexes.forEach((columnIndex) => {
        worksheet.getColumn(columnIndex).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber === 1 || typeof cell.value !== 'string' || !cell.value) return;
            const color = statusColor(cell.value);
            if (!color) return;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.fill } };
            cell.font = { bold: true, color: { argb: color.font } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
    });
};

const createWorksheet = (workbook: ExcelJS.Workbook, sheet: SheetDefinition) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.minWidth ?? 14,
    }));

    sheet.rows.forEach((row) => {
        worksheet.addRow(row);
    });

    if (sheet.rows.length === 0 && sheet.emptyMessage) {
        const lastColumn = Math.max(1, sheet.columns.length);
        worksheet.mergeCells(2, 1, 2, lastColumn);
        const infoCell = worksheet.getCell(2, 1);
        infoCell.value = sheet.emptyMessage;
        infoCell.font = { italic: true, color: { argb: summaryInfoColor } };
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
    summary: SummaryRow[],
    payload: { companyName: string; generatedAt: Date },
) => {
    const worksheet = workbook.addWorksheet('Ringkasan');
    const columnWidths = [22, 40, 20, 52];
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `LAPORAN RINGKASAN — ${payload.companyName}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: summaryTitleFill } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 32;

    worksheet.mergeCells('A2:D2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Laporan data pengantin, acara, dan keuangan • Dibuat: ${formatDateTimeDisplay(payload.generatedAt)}`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: summaryInfoColor } };
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
        const rowNumber = headerRowNumber + 1 + index;
        const targetRow = worksheet.getRow(rowNumber);
        const isNewSection = row.section !== previousSection;
        previousSection = row.section;

        targetRow.getCell(1).value = isNewSection ? row.section : '';
        targetRow.getCell(2).value = row.item;
        targetRow.getCell(3).value = row.value;
        targetRow.getCell(4).value = row.note;

        const sectionFill = SECTION_FILL[row.section] || zebraFill;
        targetRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            if (columnNumber > headerLabels.length) return;
            const columnKey = headerLabels[columnNumber - 1];
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sectionFill } };
            applyCellBorder(cell);
            cell.alignment = {
                vertical: 'top',
                horizontal: columnNumber === 3 ? 'right' : 'left',
                wrapText: columnKey === 'Catatan' || columnKey === 'Item',
            };
            if (columnNumber === 3) {
                cell.numFmt = row.format === 'currency' ? currencyFormat : numberFormat;
                cell.font = { bold: true };
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

interface ProjectSheetContext {
    client: ClientWithSummary;
    project: ClientWithSummary['projects'][number] | null;
}

const buildAddOnDescription = (project: ClientWithSummary['projects'][number] | null) => {
    if (!project) return '';
    const entries = [
        ...(project.addOns || []).map((item) => ({ name: item.name, price: toNumber(item.price) })),
        ...((project.additionalPackages || []).map((item) => ({ name: item.name, price: toNumber(item.price) }))),
        ...((project.customCosts || []).map((item) => ({ name: item.description, price: toNumber(item.amount) }))),
    ].filter((entry) => entry.name);

    return entries.map((entry) => `${entry.name} (${formatRupiahPlain(entry.price)})`).join('\n');
};

const buildClientExportPayload = (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
    context: ExportContext = {},
): ClientExportPayload => {
    const generatedAt = new Date();
    const companyName = context.companyName || 'Vena';

    const projectEntries = clients.flatMap((client) => client.projects.map((project) => ({ client, project })));
    const projectIds = new Set(projectEntries.map(({ project }) => project.id));
    const projectById = new Map(projectEntries.map(({ project }) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));

    const incomeTransactionsByProjectId = new Map<string, Transaction[]>();
    const expenseTransactionsByProjectId = new Map<string, Transaction[]>();

    transactions
        .filter((transaction) => transaction.projectId && projectIds.has(transaction.projectId))
        .forEach((transaction) => {
            const bucket = transaction.type === TransactionType.EXPENSE
                ? expenseTransactionsByProjectId
                : incomeTransactionsByProjectId;
            const list = bucket.get(transaction.projectId!) || [];
            list.push(transaction);
            bucket.set(transaction.projectId!, list);
        });

    [...incomeTransactionsByProjectId.values()].forEach((list) => {
        list.sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0));
    });
    [...expenseTransactionsByProjectId.values()].forEach((list) => {
        list.sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0));
    });

    const projectPaymentMap = new Map<string, number>();
    projectEntries.forEach(({ project }) => {
        const projectIncome = incomeTransactionsByProjectId.get(project.id) || [];
        projectPaymentMap.set(project.id, deriveProjectPaidAmount(project.amountPaid, projectIncome));
    });

    // ── Sheet: Pengantin & Acara Pernikahan (satu baris per proyek) ────────
    const eventRows: ExportRow[] = [];
    const buildEventRow = ({ client, project }: ProjectSheetContext): ExportRow => {
        const totalPayment = project ? (projectPaymentMap.get(project.id) || 0) : 0;
        const totalContract = project ? toNumber(project.totalCost) : 0;

        return {
            clientId: client.id,
            groomName: client.name,
            brideName: '',
            whatsapp: client.whatsapp || client.phone || '',
            email: client.email || '',
            address: client.homeAddress || client.address || '',
            registeredAt: parseDateValue(client.since),
            clientStatus: client.status || '',
            projectName: project?.projectName || '',
            eventDate: parseDateValue(project?.date),
            eventTime: parseTimeValue(project?.startTime),
            location: project?.location || '',
            venueAddress: project?.address || '',
            packageName: project?.packageName || '',
            packageDuration: project?.durationSelection || '',
            packagePrice: project?.unitPrice ?? null,
            addOns: buildAddOnDescription(project),
            discount: project ? toNumber(project.discountAmount) : 0,
            totalContract,
            totalPayment,
            remainingBalance: totalContract - totalPayment,
            paymentStatus: project?.paymentStatus || '',
            projectStatus: project?.status || '',
            notes: project?.notes || '',
        };
    };

    clients.forEach((client) => {
        if (client.projects.length === 0) {
            eventRows.push(buildEventRow({ client, project: null }));
            return;
        }
        [...client.projects]
            .sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0))
            .forEach((project) => eventRows.push(buildEventRow({ client, project })));
    });

    // ── Sheet: Riwayat Pembayaran (satu baris per transaksi) ──────────────
    const paymentRows: ExportRow[] = transactions
        .filter((transaction) => transaction.projectId && projectIds.has(transaction.projectId) && transaction.type === TransactionType.INCOME)
        .sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0))
        .map((transaction) => {
            const project = projectById.get(transaction.projectId!);
            const client = project ? clientById.get(project.clientId) : undefined;
            const paymentKind = inferPaymentKind(transaction);
            const proofUrl = paymentKind === 'DP' ? (project?.dpProofUrl || '') : '';

            return {
                transactionId: transaction.id,
                paymentDate: parseDateValue(transaction.date),
                clientName: client?.name || project?.clientName || '',
                projectName: project?.projectName || '',
                paymentKind,
                paymentMethod: transaction.method || '',
                amount: toNumber(transaction.amount),
                paymentStatus: inferPaymentRowStatus(transaction),
                note: transaction.description || transaction.category || '',
                proofUrl,
                category: transaction.category || '',
            };
        });

    // ── Sheet: Pengeluaran Proyek ─────────────────────────────────────────
    const expenseRows: ExportRow[] = transactions
        .filter((transaction) => transaction.projectId && projectIds.has(transaction.projectId) && transaction.type === TransactionType.EXPENSE)
        .sort((left, right) => (Date.parse(left.date || '') || 0) - (Date.parse(right.date || '') || 0))
        .map((transaction) => {
            const project = projectById.get(transaction.projectId!);
            const client = project ? clientById.get(project.clientId) : undefined;
            const noteParts = [
                transaction.cardId ? `Kartu: ${transaction.cardId}` : '',
                transaction.pocketId ? `Kantong: ${transaction.pocketId}` : '',
            ].filter(Boolean);

            return {
                expenseId: transaction.id,
                clientName: client?.name || project?.clientName || '',
                projectName: project?.projectName || '',
                expenseDate: parseDateValue(transaction.date),
                category: transaction.category || '',
                description: transaction.description || '',
                vendor: '',
                amount: toNumber(transaction.amount),
                paymentMethod: transaction.method || '',
                status: 'Tercatat',
                note: noteParts.join(' | '),
            };
        });

    // ── Sheet: Tim & Honor (satu baris per anggota tim per proyek) ────────
    const teamRowMap = new Map<string, ExportRow>();
    const teamKey = (projectId: string, teamMemberId: string, teamMemberName: string) =>
        `${projectId}|${teamMemberId || teamMemberName}`;

    const ensureTeamRow = (
        projectId: string,
        teamMemberId: string,
        teamMemberName: string,
        seed: Partial<ExportRow>,
    ) => {
        const key = teamKey(projectId, teamMemberId, teamMemberName);
        let row = teamRowMap.get(key);
        if (!row) {
            row = {
                teamMemberName,
                projectName: '',
                role: '',
                assignmentDate: null,
                totalFee: 0,
                paidFee: 0,
                remainingFee: 0,
                paymentStatus: '',
                note: '',
                ...seed,
            };
            teamRowMap.set(key, row);
        }
        return row;
    };

    projectEntries.forEach(({ client, project }) => {
        (project.team || []).forEach((member) => {
            ensureTeamRow(project.id, member.memberId, member.name, {
                projectName: project.projectName,
                role: member.role || '',
                assignmentDate: parseDateValue(project.date),
                totalFee: toNumber(member.fee),
                note: [client.name, member.subJob || ''].filter(Boolean).join(' | '),
            });
        });
    });

    teamProjectPayments
        .filter((payment) => projectIds.has(payment.projectId))
        .forEach((payment) => {
            const project = projectById.get(payment.projectId);
            const client = project ? clientById.get(project.clientId) : undefined;
            const row = ensureTeamRow(payment.projectId, payment.teamMemberId, payment.teamMemberName, {
                projectName: project?.projectName || '',
                role: payment.role || '',
                assignmentDate: parseDateValue(payment.date || project?.date || null),
                totalFee: toNumber(payment.fee),
                note: client?.name || '',
            });
            const currentTotalFee = toNumber(row.totalFee);
            const nextTotalFee = Math.max(currentTotalFee, toNumber(payment.fee));
            row.totalFee = nextTotalFee;
            if (!row.assignmentDate) {
                row.assignmentDate = parseDateValue(payment.date || project?.date || null);
            }
            if (!row.role && payment.role) {
                row.role = payment.role;
            }
            if (payment.status === 'Paid') {
                row.paidFee = toNumber(row.paidFee) + toNumber(payment.fee);
            }
        });

    const teamRows: ExportRow[] = [...teamRowMap.values()].map((row) => {
        const totalFee = toNumber(row.totalFee);
        const paidFee = toNumber(row.paidFee);
        const remainingFee = Math.max(0, totalFee - paidFee);
        let paymentStatus = 'Belum Dibayar';
        if (paidFee > 0 && paidFee >= totalFee) paymentStatus = 'Lunas';
        else if (paidFee > 0) paymentStatus = 'Sebagian';

        return {
            ...row,
            totalFee,
            paidFee,
            remainingFee,
            paymentStatus,
        };
    });

    // ── Ringkasan ─────────────────────────────────────────────────────────
    const totalContractValue = eventRows.reduce((sum, row) => sum + toNumber(row.totalContract), 0);
    const totalPaymentValue = [...projectPaymentMap.values()].reduce((sum, amount) => sum + amount, 0);
    const totalExpenseValue = expenseRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const totalTeamFee = teamRows.reduce((sum, row) => sum + toNumber(row.totalFee), 0);
    const totalTeamPaid = teamRows.reduce((sum, row) => sum + toNumber(row.paidFee), 0);
    const totalRemainingBalance = totalContractValue - totalPaymentValue;

    const completedProjects = projectEntries.filter(({ project }) => project.status === COMPLETED_PROJECT_STATUS).length;
    const cancelledProjects = projectEntries.filter(({ project }) => project.status === CANCELLED_PROJECT_STATUS).length;
    const runningProjects = projectEntries.filter(({ project }) =>
        project.status !== COMPLETED_PROJECT_STATUS && project.status !== CANCELLED_PROJECT_STATUS).length;
    const unpaidProjects = projectEntries.filter(({ project }) => project.paymentStatus !== PaymentStatus.LUNAS).length;

    // Selaras aturan halaman Keuangan: laba/rugi bersih = pemasukan - pengeluaran (honor tim tidak dicampur).
    const netProjectBalance = totalPaymentValue - totalExpenseValue;

    const summary: SummaryRow[] = [
        { section: 'Data Utama', item: 'Total pengantin / klien', value: clients.length, note: 'Jumlah klien pada data yang diexport', format: 'number' },
        { section: 'Data Utama', item: 'Total proyek / acara', value: projectEntries.length, note: 'Jumlah proyek/acara pada data yang diexport', format: 'number' },
        { section: 'Keuangan', item: 'Total nilai kontrak', value: totalContractValue, note: 'Jumlah kolom "Total Nilai Kontrak"', format: 'currency' },
        { section: 'Keuangan', item: 'Total pembayaran masuk', value: totalPaymentValue, note: 'Hanya transaksi pemasukan yang terhubung ke proyek; transaksi batal tidak dihitung, refund bernilai negatif mengurangi', format: 'currency' },
        { section: 'Keuangan', item: 'Total sisa tagihan', value: totalRemainingBalance, note: 'Total nilai kontrak dikurangi total pembayaran masuk', format: 'currency' },
        { section: 'Keuangan', item: 'Total pengeluaran proyek', value: totalExpenseValue, note: 'Transaksi pengeluaran yang terhubung ke proyek', format: 'currency' },
        { section: 'Keuangan', item: 'Total honor tim', value: totalTeamFee, note: 'Total honor seluruh anggota tim pada proyek', format: 'currency' },
        { section: 'Keuangan', item: 'Total honor tim dibayar', value: totalTeamPaid, note: 'Honor tim yang berstatus sudah dibayar', format: 'currency' },
        { section: 'Keuangan', item: 'Saldo bersih (pembayaran masuk - pengeluaran proyek)', value: netProjectBalance, note: 'Dipisahkan dari honor tim; dibandingkan dengan "Laba / Rugi Bersih" halaman Keuangan', format: 'currency' },
        { section: 'Status Proyek', item: 'Proyek selesai', value: completedProjects, note: `Status proyek = ${COMPLETED_PROJECT_STATUS}`, format: 'number' },
        { section: 'Status Proyek', item: 'Proyek berjalan', value: runningProjects, note: 'Status proyek selain selesai dan dibatalkan', format: 'number' },
        { section: 'Status Proyek', item: 'Proyek dibatalkan', value: cancelledProjects, note: `Status proyek = ${CANCELLED_PROJECT_STATUS}`, format: 'number' },
        { section: 'Status Pembayaran', item: 'Proyek belum lunas', value: unpaidProjects, note: 'Status pembayaran bukan Lunas', format: 'number' },
    ];

    buildStatusCounts(projectEntries.map(({ project }) => project.paymentStatus || '').filter(Boolean))
        .forEach(([status, count]) => {
            summary.push({
                section: 'Status Pembayaran',
                item: status,
                value: count,
                note: 'Jumlah proyek',
                format: 'number',
            });
        });

    buildStatusCounts(projectEntries.map(({ project }) => project.status || '').filter(Boolean))
        .forEach(([status, count]) => {
            summary.push({
                section: 'Status Proyek',
                item: status,
                value: count,
                note: 'Jumlah proyek',
                format: 'number',
            });
        });

    const sheets: SheetDefinition[] = [
        {
            name: 'Pengantin & Acara Pernikahan',
            columns: [
                { header: 'ID Klien', key: 'clientId', type: 'text', minWidth: 18 },
                { header: 'Nama Pengantin Pria', key: 'groomName', type: 'text', minWidth: 22 },
                { header: 'Nama Pengantin Wanita', key: 'brideName', type: 'text', minWidth: 22 },
                { header: 'Nomor WhatsApp', key: 'whatsapp', type: 'text', minWidth: 16 },
                { header: 'Email', key: 'email', type: 'text', minWidth: 22 },
                { header: 'Alamat Klien', key: 'address', type: 'text', wrap: true, minWidth: 24, maxWidth: 40 },
                { header: 'Tanggal Pendaftaran', key: 'registeredAt', type: 'date', minWidth: 16, align: 'center' },
                { header: 'Status Klien', key: 'clientStatus', type: 'status', minWidth: 16 },
                { header: 'Nama Acara', key: 'projectName', type: 'text', minWidth: 22 },
                { header: 'Tanggal Acara', key: 'eventDate', type: 'date', minWidth: 16, align: 'center' },
                { header: 'Jam Acara', key: 'eventTime', type: 'time', minWidth: 12, align: 'center' },
                { header: 'Lokasi Acara', key: 'location', type: 'text', minWidth: 18 },
                { header: 'Alamat Venue', key: 'venueAddress', type: 'text', wrap: true, minWidth: 24, maxWidth: 40 },
                { header: 'Paket yang Dipilih', key: 'packageName', type: 'text', minWidth: 20 },
                { header: 'Durasi Paket', key: 'packageDuration', type: 'text', minWidth: 14, align: 'center' },
                { header: 'Harga Paket', key: 'packagePrice', type: 'currency', minWidth: 18 },
                { header: 'Add-on dan Harga Tambahan', key: 'addOns', type: 'text', wrap: true, minWidth: 26, maxWidth: 44 },
                { header: 'Diskon', key: 'discount', type: 'currency', minWidth: 16 },
                { header: 'Total Nilai Kontrak', key: 'totalContract', type: 'currency', minWidth: 18 },
                { header: 'Total Pembayaran Masuk', key: 'totalPayment', type: 'currency', minWidth: 18 },
                { header: 'Sisa Tagihan', key: 'remainingBalance', type: 'currency', minWidth: 18 },
                { header: 'Status Pembayaran', key: 'paymentStatus', type: 'status', minWidth: 18 },
                { header: 'Status Proyek', key: 'projectStatus', type: 'status', minWidth: 16 },
                { header: 'Keterangan', key: 'notes', type: 'text', wrap: true, minWidth: 26, maxWidth: 44 },
            ],
            rows: eventRows,
            emptyMessage: 'Belum terdapat data pengantin & acara pernikahan.',
        },
        {
            name: 'Riwayat Pembayaran',
            columns: [
                { header: 'ID Transaksi', key: 'transactionId', type: 'text', minWidth: 18 },
                { header: 'Tanggal Pembayaran', key: 'paymentDate', type: 'date', minWidth: 16, align: 'center' },
                { header: 'Nama Pengantin', key: 'clientName', type: 'text', minWidth: 22 },
                { header: 'Nama Proyek/Acara', key: 'projectName', type: 'text', minWidth: 22 },
                { header: 'Jenis Pembayaran', key: 'paymentKind', type: 'text', minWidth: 16, align: 'center' },
                { header: 'Metode Pembayaran', key: 'paymentMethod', type: 'text', minWidth: 16 },
                { header: 'Nominal Pembayaran', key: 'amount', type: 'currency', minWidth: 18 },
                { header: 'Status Pembayaran', key: 'paymentStatus', type: 'status', minWidth: 18 },
                { header: 'Catatan', key: 'note', type: 'text', wrap: true, minWidth: 24, maxWidth: 42 },
                { header: 'Bukti Pembayaran', key: 'proofUrl', type: 'text', wrap: true, minWidth: 24, maxWidth: 42 },
                { header: 'Kategori', key: 'category', type: 'text', minWidth: 18 },
            ],
            rows: paymentRows,
            emptyMessage: 'Belum terdapat transaksi pembayaran yang terhubung ke proyek.',
        },
        {
            name: 'Pengeluaran Proyek',
            columns: [
                { header: 'ID Pengeluaran', key: 'expenseId', type: 'text', minWidth: 18 },
                { header: 'Nama Pengantin', key: 'clientName', type: 'text', minWidth: 22 },
                { header: 'Nama Proyek/Acara', key: 'projectName', type: 'text', minWidth: 22 },
                { header: 'Tanggal Pengeluaran', key: 'expenseDate', type: 'date', minWidth: 16, align: 'center' },
                { header: 'Kategori Pengeluaran', key: 'category', type: 'text', minWidth: 20 },
                { header: 'Keterangan', key: 'description', type: 'text', wrap: true, minWidth: 24, maxWidth: 42 },
                { header: 'Vendor atau Penerima', key: 'vendor', type: 'text', minWidth: 18 },
                { header: 'Nominal Pengeluaran', key: 'amount', type: 'currency', minWidth: 18 },
                { header: 'Metode Pembayaran', key: 'paymentMethod', type: 'text', minWidth: 16 },
                { header: 'Status Pengeluaran', key: 'status', type: 'status', minWidth: 16 },
                { header: 'Catatan', key: 'note', type: 'text', wrap: true, minWidth: 22, maxWidth: 38 },
            ],
            rows: expenseRows,
            emptyMessage: 'Belum terdapat transaksi pengeluaran proyek.',
        },
        {
            name: 'Tim & Honor',
            columns: [
                { header: 'Nama Anggota Tim', key: 'teamMemberName', type: 'text', minWidth: 20 },
                { header: 'Nama Proyek/Acara', key: 'projectName', type: 'text', minWidth: 22 },
                { header: 'Posisi atau Peran', key: 'role', type: 'text', minWidth: 18 },
                { header: 'Tanggal Tugas', key: 'assignmentDate', type: 'date', minWidth: 16, align: 'center' },
                { header: 'Total Honor', key: 'totalFee', type: 'currency', minWidth: 16 },
                { header: 'Honor yang Sudah Dibayar', key: 'paidFee', type: 'currency', minWidth: 20 },
                { header: 'Sisa Honor', key: 'remainingFee', type: 'currency', minWidth: 16 },
                { header: 'Status Pembayaran Honor', key: 'paymentStatus', type: 'status', minWidth: 20 },
                { header: 'Catatan', key: 'note', type: 'text', wrap: true, minWidth: 24, maxWidth: 42 },
            ],
            rows: teamRows,
            emptyMessage: 'Belum terdapat data tim & honor yang terhubung ke proyek.',
        },
    ];

    return {
        generatedAt,
        companyName,
        summary,
        sheets,
    };
};

const buildWorkbookFromPayload = (payload: ClientExportPayload) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = payload.companyName;
    workbook.created = payload.generatedAt;
    workbook.modified = payload.generatedAt;
    Object.assign(workbook, {
        subject: 'Export data pengantin, acara, dan keuangan',
        title: `Export ${payload.companyName}`,
    });

    createSummaryWorksheet(workbook, payload.summary, payload);
    payload.sheets.forEach((sheet) => {
        createWorksheet(workbook, sheet);
    });

    return workbook;
};

const formatCsvValue = (value: CellValue, column: ColumnDefinition) => {
    if (value == null) return '';
    switch (column.type) {
        case 'date':
            return value instanceof Date
                ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
                : formatDateForCsv(String(value));
        case 'datetime':
            return value instanceof Date
                ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`
                : formatDateTimeForCsv(String(value));
        case 'time':
            return value instanceof Date
                ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
                : formatTimeForCsv(String(value));
        case 'currency':
        case 'number':
            return typeof value === 'number' ? value : toNumber(value);
        default:
            return typeof value === 'string' ? value : String(value);
    }
};

export const buildClientExportWorkbook = (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
    context: ExportContext = {},
): ExcelJS.Workbook => {
    const payload = buildClientExportPayload(clients, transactions, teamProjectPayments, context);
    return buildWorkbookFromPayload(payload);
};

export interface ClientExportCsvPayload {
    filename: string;
    category: string;
    headers: string[];
    rows: (string | number)[][];
}

export const buildClientExportCsvPayloads = (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
    context: ExportContext = {},
): ClientExportCsvPayload[] => {
    const payload = buildClientExportPayload(clients, transactions, teamProjectPayments, context);
    const dateStamp = getExportDateStamp(payload.generatedAt);

    return payload.sheets.map((sheet) => ({
        filename: `${sheet.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateStamp}.csv`,
        category: sheet.name,
        headers: sheet.columns.map((column) => column.header),
        rows: sheet.rows.map((row) => sheet.columns.map((column) => formatCsvValue(row[column.key], column))),
    }));
};

export const exportClientsToExcel = async (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
    context: ExportContext = {},
) => {
    const workbook = buildClientExportWorkbook(clients, transactions, teamProjectPayments, context);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-pengantin-lengkap-${getExportDateStamp()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
};

export const exportClientsToCategoryCSVs = (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
    context: ExportContext = {},
) => {
    const csvPayloads = buildClientExportCsvPayloads(clients, transactions, teamProjectPayments, context);
    csvPayloads.forEach((csvPayload) => {
        downloadCSV(csvPayload.headers, csvPayload.rows, csvPayload.filename);
    });
};

export const CLIENT_EXPORT_CSV_CATEGORIES = [
    'Pengantin & Acara Pernikahan',
    'Riwayat Pembayaran',
    'Pengeluaran Proyek',
    'Tim & Honor',
] as const;
