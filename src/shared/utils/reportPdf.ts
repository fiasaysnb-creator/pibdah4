import { jsPDF } from 'jspdf';
import { Profile } from '../../types';
import {
  COLORS,
  CONTENT_BOTTOM,
  CONTENT_LEFT,
  CONTENT_RIGHT,
  CONTENT_W,
  DEFAULT_ACCENT,
  MARGIN_TOP,
  RGB,
  createPdfDoc,
  createPdfTools,
  embedPdfFonts,
  formatCurrency,
  hexToRgb,
  lineHeight,
  loadImageAsset,
  mixWithWhite,
  sanitize,
} from './pdfCore';

/**
 * Renderer PDF laporan generik (vector jsPDF).
 *
 * Dipakai untuk mengunduh laporan ringkas dari halaman KPI, Keuangan, dan Data
 * Pengantin. Struktur dokumen: header (judul + periode + logo), kartu ringkasan
 * angka, lalu satu atau beberapa tabel. Semua teks memakai font ter-embed
 * (VenaSans) sehingga tetap tajam di semua viewer.
 */

export type ReportAlign = 'left' | 'center' | 'right';

export interface ReportColumn {
  header: string;
  /** Bobot lebar kolom relatif terhadap kolom lain (default 1). */
  width?: number;
  align?: ReportAlign;
  /** Kolom angka: rata kanan + format Rupiah. */
  isCurrency?: boolean;
  /**
   * Warna nilai uang pada kolom ini:
   * - `positive` selalu hijau, `negative` selalu merah,
   * - `auto` hijau untuk pemasukan dan merah untuk pengeluaran.
   * Nilai negatif ditampilkan tanpa tanda minus (hanya diwarnai merah).
   */
  tone?: 'positive' | 'negative' | 'auto';
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  rows: (string | number | null | undefined)[][];
  emptyText?: string;
}

export interface ReportSummaryCard {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}

export interface ReportPdfInput {
  title: string;
  subtitle?: string;
  periodLabel: string;
  profile?: Profile | null;
  summaryCards?: ReportSummaryCard[];
  sections: ReportSection[];
  filename: string;
  footerNote?: string;
}

const BODY_SIZE = 8;
const HEADER_SIZE = 7.5;
/** Batas terkecil ukuran teks tabel agar tetap terbaca di kertas A4. */
const MIN_BODY_SIZE = 5.6;
const CELL_PAD_X = 1.8;
const CELL_PAD_Y = 1.4;
const FOOTER_LINE_Y = 291;
const FOOTER_TEXT_Y = 292.4;

const toneColor = (tone?: ReportSummaryCard['tone']): RGB => {
  if (tone === 'positive') return COLORS.green;
  if (tone === 'negative') return COLORS.red;
  return COLORS.text;
};

const cellToneColor = (value: string | number | null | undefined, tone?: ReportColumn['tone']): RGB => {
  if (tone === 'positive') return COLORS.green;
  if (tone === 'negative') return COLORS.red;
  if (tone === 'auto' && typeof value === 'number') return value < 0 ? COLORS.red : COLORS.green;
  return COLORS.text;
};

const formatCell = (
  value: string | number | null | undefined,
  isCurrency?: boolean,
  absolute = false,
): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    const numeric = absolute ? Math.abs(value) : value;
    return isCurrency ? formatCurrency(numeric) : new Intl.NumberFormat('id-ID').format(numeric);
  }
  return sanitize(value);
};

export const buildReportPdf = async (input: ReportPdfInput): Promise<jsPDF> => {
  const doc = createPdfDoc('portrait');
  await embedPdfFonts(doc);
  const tools = createPdfTools(doc);

  const accent = hexToRgb(input.profile?.brandColor) || DEFAULT_ACCENT;
  const accentSoft = mixWithWhite(accent, 0.9);
  const accentLine = mixWithWhite(accent, 0.5);

  const logo = input.profile?.logoBase64
    ? await loadImageAsset(input.profile.logoBase64)
    : null;

  let y = MARGIN_TOP;

  // ── Header ──────────────────────────────────────────────────────────────
  const drawHeader = (compact: boolean) => {
    tools.fill(accent);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, 2.2, 'F');
    y += 2.2;

    if (compact) {
      y += 4;
      tools.writeLines([input.title], CONTENT_LEFT, y, 10.5, 'bold', COLORS.text);
      y += lineHeight(10.5, 1.2) + 1;
      tools.writeLines(
        [`Periode: ${input.periodLabel}`],
        CONTENT_LEFT,
        y,
        8,
        'normal',
        COLORS.label,
      );
      y += lineHeight(8, 1.2) + 1.6;
      tools.stroke(COLORS.borderSoft);
      doc.setLineWidth(0.2);
      doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
      y += 3;
      return;
    }

    y += 6;
    const startY = y;
    let textX = CONTENT_LEFT;
    let logoBottom = startY;

    if (logo) {
      const logoH = 13;
      const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
      const logoW = Math.min(30, logoH * ratio);
      try {
        doc.addImage(logo.dataUrl, 'PNG', CONTENT_LEFT, startY, logoW, logoH);
        logoBottom = startY + logoH;
      } catch {
        // Lewati logo bila gagal digambar.
      }
      textX = CONTENT_LEFT + logoW + 4;
    }

    let cursor = tools.writeLines([input.title], textX, startY, 16, 'bold', COLORS.text);
    if (input.subtitle) {
      cursor = tools.writeLines([input.subtitle], textX, cursor + 0.6, 8.5, 'normal', COLORS.textSoft);
    }
    const titleBottom = cursor;

    // Pil periode di kanan.
    const periodText = `Periode: ${input.periodLabel}`;
    tools.setFont(8.5, 'bold');
    const pillW = Math.min(CONTENT_W / 2, doc.getTextWidth(sanitize(periodText)) + 8);
    const pillH = 7;
    const pillX = CONTENT_RIGHT - pillW;
    const pillY = startY + 1;
    tools.fill(accentSoft);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.6, 1.6, 'F');
    tools.writeLines(
      [periodText],
      pillX + pillW / 2,
      pillY + (pillH - lineHeight(8.5, 1.2)) / 2,
      8.5,
      'bold',
      accent,
      'center',
    );

    y = Math.max(titleBottom, logoBottom, pillY + pillH) + 3;
    tools.stroke(accentLine);
    doc.setLineWidth(0.5);
    doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
    y += 4;
  };

  const addPage = () => {
    doc.addPage();
    y = MARGIN_TOP;
    drawHeader(true);
  };

  // ── Kartu ringkasan ─────────────────────────────────────────────────────
  const drawSummaryCards = (cards: ReportSummaryCard[]) => {
    if (!cards.length) return;
    const perRow = cards.length === 1 ? 1 : cards.length === 2 ? 2 : cards.length === 4 ? 4 : 3;
    const gap = 3;
    const cardW = (CONTENT_W - gap * (perRow - 1)) / perRow;
    const cardH = 15;

    cards.forEach((card, index) => {
      const col = index % perRow;
      const rowIndex = Math.floor(index / perRow);
      const x = CONTENT_LEFT + col * (cardW + gap);
      const cy = y + rowIndex * (cardH + gap);

      tools.fill(COLORS.panel);
      tools.stroke(COLORS.borderSoft);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'FD');

      tools.fill(accent);
      doc.rect(x, cy + 2.4, 0.9, cardH - 4.8, 'F');

      tools.writeLines([card.label], x + 3.2, cy + 2.8, 7.5, 'normal', COLORS.label);
      tools.writeLines([card.value], x + 3.2, cy + 7.2, 11, 'bold', toneColor(card.tone));
    });

    const rowCount = Math.ceil(cards.length / perRow);
    y += rowCount * cardH + (rowCount - 1) * gap + 5;
  };

  // ── Tabel laporan ───────────────────────────────────────────────────────
  const widthCache = new WeakMap<ReportSection, number[]>();
  const getWidths = (section: ReportSection): number[] => {
    const cached = widthCache.get(section);
    if (cached) return cached;
    const totalWeight = section.columns.reduce((sum, col) => sum + (col.width ?? 1), 0) || 1;
    const widths = section.columns.map((col) => (CONTENT_W * (col.width ?? 1)) / totalWeight);
    widthCache.set(section, widths);
    return widths;
  };

  const drawSection = (section: ReportSection) => {
    const widths = getWidths(section);

    /**
     * Lebar teks harus diukur memakai font & ukuran yang benar. jsPDF memakai
     * ukuran font yang sedang aktif saat `splitTextToSize` dipanggil, sehingga
     * pengukuran dengan font yang salah membuat teks meluber keluar kolom.
     */
    const wrapAt = (text: string, maxWidth: number, size: number, style: 'normal' | 'bold'): string[] => {
      tools.setFont(size, style);
      const lines = tools.wrap(text, Math.max(4, maxWidth));
      return lines.length ? lines : [''];
    };

    const columnX = (index: number): { x: number; align: ReportAlign } => {
      const col = section.columns[index];
      const align: ReportAlign = col.align || (col.isCurrency ? 'right' : 'left');
      let left = CONTENT_LEFT;
      for (let cursor = 0; cursor < index; cursor += 1) left += widths[cursor];
      const x =
        align === 'right'
          ? left + widths[index] - CELL_PAD_X
          : align === 'center'
            ? left + widths[index] / 2
            : left + CELL_PAD_X;
      return { x, align };
    };

    /** Garis kolom (vertikal) agar isi tabel tidak tampak menyatu. */
    const drawColumnBorders = (top: number, height: number, color: RGB) => {
      tools.stroke(color);
      doc.setLineWidth(0.12);
      doc.line(CONTENT_LEFT, top, CONTENT_LEFT, top + height);
      doc.line(CONTENT_RIGHT, top, CONTENT_RIGHT, top + height);
      let x = CONTENT_LEFT;
      for (let index = 0; index < widths.length - 1; index += 1) {
        x += widths[index];
        doc.line(x, top, x, top + height);
      }
    };

    const titleLines = wrapAt(section.title, CONTENT_W, 10, 'bold');
    const titleHeight = titleLines.length * lineHeight(10, 1.2) + 1.8;

    /**
     * Ukuran teks isi tabel menyesuaikan jumlah kolom, lalu dikecilkan lagi
     * bila masih ada isi sel yang lebih lebar dari kolomnya. Tujuannya agar
     * tabel berkolom banyak tetap tampil satu baris per data.
     */
    const columnCountScale = section.columns.length >= 8 ? 0.78 : section.columns.length >= 6 ? 0.87 : 1;
    const baseBodySize = Math.max(MIN_BODY_SIZE, BODY_SIZE * columnCountScale);

    const widestByColumn = widths.map(() => 0);
    section.rows.forEach(row => {
      section.columns.forEach((col, colIndex) => {
        const text = formatCell(row[colIndex], col.isCurrency, col.tone !== undefined);
        if (!text) return;
        tools.setFont(baseBodySize, colIndex === 0 ? 'bold' : 'normal');
        const widestLine = text
          .split('\n')
          .reduce((widest, line) => Math.max(widest, doc.getTextWidth(line)), 0);
        widestByColumn[colIndex] = Math.max(widestByColumn[colIndex], widestLine);
      });
    });

    const fitScale = widths.reduce((scale, width, colIndex) => {
      const available = width - CELL_PAD_X * 2;
      const widest = widestByColumn[colIndex];
      if (!widest || widest <= available) return scale;
      const needed = available / widest;
      // Kolom deskriptif yang isinya jauh lebih panjang dari kolomnya dibiarkan
      // membungkus teks, agar kolom angka/label tetap tampil satu baris dan
      // ukuran teks tabel tidak ikut mengecil berlebihan.
      if (needed < 0.6) return scale;
      return Math.min(scale, needed);
    }, 1);

    const bodySize = Math.max(MIN_BODY_SIZE, baseBodySize * fitScale);
    const headerSize = bodySize * (HEADER_SIZE / BODY_SIZE);

    const headerLines = section.columns.map((col, index) =>
      wrapAt(col.header, widths[index] - CELL_PAD_X * 2, headerSize, 'bold'),
    );
    const headerRowH =
      Math.max(1, ...headerLines.map(lines => lines.length)) * lineHeight(headerSize, 1.2) + CELL_PAD_Y * 2;

    const drawSectionTitle = () => {
      tools.writeLines(titleLines, CONTENT_LEFT, y, 10, 'bold', COLORS.text);
      y += titleHeight;
    };

    const drawTableHeader = () => {
      tools.fill(accent);
      doc.rect(CONTENT_LEFT, y, CONTENT_W, headerRowH, 'F');
      headerLines.forEach((lines, index) => {
        const { x, align } = columnX(index);
        const blockHeight = lines.length * lineHeight(headerSize, 1.2);
        tools.writeLines(
          lines,
          x,
          y + Math.max(CELL_PAD_Y * 0.6, (headerRowH - blockHeight) / 2),
          headerSize,
          'bold',
          COLORS.white,
          align,
          1.2,
        );
      });
      drawColumnBorders(y, headerRowH, COLORS.white);
      y += headerRowH;
    };

    const bodyLineH = lineHeight(bodySize, 1.25);

    if (y + titleHeight + headerRowH + bodyLineH * 2 > CONTENT_BOTTOM) addPage();
    drawSectionTitle();
    if (y + headerRowH + bodyLineH * 2 > CONTENT_BOTTOM) {
      addPage();
      drawSectionTitle();
    }
    drawTableHeader();

    if (!section.rows.length) {
      tools.writeLines(
        [section.emptyText || 'Tidak ada data pada periode ini.'],
        CONTENT_LEFT + CELL_PAD_X,
        y + 3,
        8,
        'italic',
        COLORS.muted,
      );
      y += lineHeight(8, 1.3) + 6;
      return;
    }

    // Baris digambar per-potong (chunk) agar baris yang sangat tinggi (mis.
    // rincian paket/biaya yang panjang) tetap tampil utuh lewat halaman baru.
    const lineH = bodyLineH;

    section.rows.forEach((row, index) => {
      const cellLines = section.columns.map((col, colIndex) => {
        const text = formatCell(row[colIndex], col.isCurrency, col.tone !== undefined);
        if (!text) return [''];
        return wrapAt(text, widths[colIndex] - CELL_PAD_X * 2, bodySize, colIndex === 0 ? 'bold' : 'normal');
      });
      const totalLines = Math.max(1, ...cellLines.map(lines => lines.length));

      let drawn = 0;
      let firstChunk = true;
      while (drawn < totalLines) {
        if (CONTENT_BOTTOM - y < lineH * 3 + CELL_PAD_Y * 2) {
          addPage();
          drawSectionTitle();
          drawTableHeader();
        }

        const maxLinesFit = Math.max(1, Math.floor((CONTENT_BOTTOM - y - CELL_PAD_Y * 2) / lineH));
        const chunk = Math.min(maxLinesFit, totalLines - drawn);
        const rowH = chunk * lineH + CELL_PAD_Y * 2;
        const rowTop = y;

        if (index % 2 === 1 && firstChunk) {
          tools.fill(COLORS.panel);
          doc.rect(CONTENT_LEFT, y, CONTENT_W, rowH, 'F');
        }

        section.columns.forEach((col, colIndex) => {
          const { x, align } = columnX(colIndex);
          const block = cellLines[colIndex].slice(drawn, drawn + chunk);
          const blockHeight = block.length * lineH;
          tools.writeLines(
            block,
            x,
            y + Math.max(CELL_PAD_Y * 0.5, (rowH - blockHeight) / 2),
            bodySize,
            colIndex === 0 ? 'bold' : 'normal',
            cellToneColor(row[colIndex], col.tone),
            align,
            1.25,
          );
        });

        y += rowH;

        tools.stroke(COLORS.borderSoft);
        doc.setLineWidth(0.12);
        doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
        drawColumnBorders(rowTop, rowH, COLORS.borderSoft);

        drawn += chunk;
        firstChunk = false;
      }
    });

    y += 5;
  };

  // ── Susun dokumen ───────────────────────────────────────────────────────
  drawHeader(false);
  if (input.summaryCards?.length) drawSummaryCards(input.summaryCards);
  input.sections.forEach(drawSection);

  if (input.footerNote) {
    if (y + 12 > CONTENT_BOTTOM) addPage();
    tools.writeLines(tools.wrap(input.footerNote, CONTENT_W), CONTENT_LEFT, y + 2, 7.5, 'italic', COLORS.muted);
  }

  const pageCount = doc.getNumberOfPages();
  const baseName = input.filename.replace(/\.pdf$/i, '');
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    tools.stroke(COLORS.borderSoft);
    doc.setLineWidth(0.2);
    doc.line(CONTENT_LEFT, FOOTER_LINE_Y, CONTENT_RIGHT, FOOTER_LINE_Y);
    tools.writeLines([baseName], CONTENT_LEFT, FOOTER_TEXT_Y, 7.5, 'normal', COLORS.muted);
    tools.writeLines(
      [`Halaman ${page} dari ${pageCount}`],
      CONTENT_RIGHT,
      FOOTER_TEXT_Y,
      7.5,
      'normal',
      COLORS.muted,
      'right',
    );
  }

  return doc;
};

export const downloadReportPdf = async (input: ReportPdfInput): Promise<void> => {
  const doc = await buildReportPdf(input);
  doc.save(input.filename);
};

export const buildReportFileName = (base: string, periodKey: string): string => {
  const safeBase = (base || 'Laporan').replace(/[\\/:*?"<>|\s]+/g, '_');
  const safePeriod = (periodKey || 'periode').replace(/[\\/:*?"<>|\s]+/g, '_');
  return `${safeBase}-${safePeriod}.pdf`;
};
