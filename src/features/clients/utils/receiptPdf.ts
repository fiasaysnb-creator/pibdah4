import { jsPDF } from 'jspdf';
import { Client, Profile, Project, Transaction, TransactionType } from '../../../types';
import {
  COLORS,
  CONTENT_BOTTOM,
  CONTENT_LEFT,
  CONTENT_RIGHT,
  CONTENT_W,
  DEFAULT_ACCENT,
  MARGIN_TOP,
  PT_TO_MM,
  createPdfDoc,
  createPdfTools,
  embedPdfFonts,
  formatCurrency,
  formatDate,
  hexToRgb,
  lineHeight,
  loadImageAsset,
  mixWithWhite,
  sanitize,
} from '../../../shared/utils/pdfCore';

/**
 * Renderer PDF untuk Tanda Terima / Bukti Pengeluaran.
 *
 * Membangun ulang dokumen memakai primitive vector jsPDF sehingga teks, garis,
 * tabel, dan area tanda tangan tetap tajam saat diperbesar. Struktur mengikuti
 * ClientReceiptDocument pada preview aplikasi; preview itu sendiri tidak diubah.
 */

export interface ReceiptPdfInput {
  transaction: Transaction;
  project?: Project | null;
  profile: Profile;
  client?: Client | null;
}

export const buildReceiptFileName = (transaction: Transaction): string =>
  `Tanda_Terima-${sanitize(transaction.id).slice(0, 8)}.pdf`;

export const buildReceiptPdf = async (input: ReceiptPdfInput): Promise<jsPDF> => {
  const { transaction, project, client } = input;
  const profile = input.profile || ({} as Profile);

  const accent = hexToRgb(profile.brandColor) || DEFAULT_ACCENT;
  const accentSoft = mixWithWhite(accent, 0.94);

  const doc = createPdfDoc('portrait');
  await embedPdfFonts(doc);
  const { fill, stroke, ink, setFont, writeLines, wrap } = createPdfTools(doc);

  const [logo, signature] = await Promise.all([
    loadImageAsset(profile.logoBase64),
    loadImageAsset(transaction.vendorSignature || profile.signatureBase64),
  ]);

  const companyName = sanitize(profile.companyName || 'Vendor');
  const signer = sanitize(profile.authorizedSigner || companyName);
  const isExpense = transaction.type === TransactionType.EXPENSE;
  const documentTitle = isExpense ? 'BUKTI PENGELUARAN' : 'TANDA TERIMA';
  const statusText = isExpense ? 'TELAH DIBAYARKAN SECARA SAH' : 'TELAH DITERIMA SECARA SAH';
  // Pengeluaran ditandai merah, pemasukan hijau. Nominal tidak memakai tanda minus.
  const statusColor = isExpense ? COLORS.red : COLORS.green;
  const amountColor = isExpense ? COLORS.red : COLORS.green;

  let targetName = sanitize(client?.name || 'Pengantin');
  if (isExpense) {
    if (transaction.category === 'Gaji Tim / Vendor') {
      const match = transaction.description?.match(/Gaji Freelance - (.+?) \(/);
      targetName = match && match[1] ? sanitize(match[1]) : 'Vendor / Tim';
    } else {
      targetName = 'Pihak Lain';
    }
  }

  let y = MARGIN_TOP + 4;

  // ── HEADER ─────────────────────────────────────────────────────────────
  const headerTop = y;
  let leftY = headerTop;
  const logoMaxW = 60;
  const logoMaxH = 16.5;

  if (logo) {
    const ratio = logo.width / logo.height;
    let h = logoMaxH;
    let w = h * ratio;
    if (w > logoMaxW) {
      w = logoMaxW;
      h = w / ratio;
    }
    try {
      doc.addImage(logo.dataUrl, 'PNG', CONTENT_LEFT, leftY, w, h, undefined, 'FAST');
    } catch {
      // Abaikan bila logo gagal dirender.
    }
    leftY += h + 2.6;
  } else {
    setFont(16, 'bold');
    ink(accent);
    doc.text(companyName, CONTENT_LEFT, leftY + 16 * PT_TO_MM);
    leftY += lineHeight(16, 1.2) + 1;
  }

  if (profile.address) {
    leftY = writeLines([sanitize(profile.address)], CONTENT_LEFT, leftY, 8, 'normal', COLORS.muted, 'left', 1.35);
  }

  let rightY = headerTop;
  setFont(15, 'bold');
  ink(COLORS.muted);
  doc.text(documentTitle, CONTENT_RIGHT, rightY + 15 * PT_TO_MM, { align: 'right' });
  rightY += lineHeight(15, 1.1) + 1.6;

  const idText = `#${sanitize(transaction.id).slice(0, 8).toUpperCase()}`;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  ink(COLORS.label);
  doc.text(idText, CONTENT_RIGHT, rightY + 8 * PT_TO_MM, { align: 'right' });
  rightY += lineHeight(8, 1.3);

  y = Math.max(leftY, rightY) + 3;
  stroke(accent);
  doc.setLineWidth(0.7);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 6;

  // ── KOTAK STATUS & NOMINAL ─────────────────────────────────────────────
  const boxPadX = 5;
  const boxPadY = 5;
  const amountText = formatCurrency(Math.abs(Number(transaction.amount) || 0));
  setFont(26, 'bold');
  const amountH = 26 * PT_TO_MM;

  const boxH = boxPadY * 2 + lineHeight(7.5, 1.3) + lineHeight(9, 1.3) + amountH + 1 + lineHeight(8.5, 1.3);

  if (y + boxH > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  fill(COLORS.panel);
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.25);
  doc.roundedRect(CONTENT_LEFT, y, CONTENT_W, boxH, 1.6, 1.6, 'FD');

  let boxY = y + boxPadY;
  boxY = writeLines(['STATUS PEMBAYARAN'], CONTENT_LEFT + boxPadX, boxY, 7.5, 'bold', COLORS.muted, 'left', 1.3);
  boxY = writeLines([statusText], CONTENT_LEFT + boxPadX, boxY, 9, 'bold', statusColor, 'left', 1.3);
  boxY += 1;
  setFont(26, 'bold');
  ink(amountColor);
  doc.text(amountText, CONTENT_LEFT + boxPadX, boxY + 26 * PT_TO_MM);
  boxY += amountH + 1;
  writeLines([`Tanggal: ${formatDate(transaction.date)}`], CONTENT_LEFT + boxPadX, boxY, 8.5, 'normal', COLORS.textSoft, 'left', 1.3);

  y += boxH + 7;

  // ── BARIS INFORMASI ────────────────────────────────────────────────────
  const rowPadY = 2.6;
  const rowH = rowPadY * 2 + lineHeight(9.5, 1.35);
  const drawRow = (label: string, value: string) => {
    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
    const baseline = y + rowPadY + 9.5 * PT_TO_MM;
    setFont(9.5, 'normal');
    ink(COLORS.label);
    doc.text(sanitize(label), CONTENT_LEFT, baseline);
    setFont(9.5, 'bold');
    ink(COLORS.text);
    doc.text(sanitize(value), CONTENT_RIGHT, baseline, { align: 'right' });
    y += rowH;
    stroke(COLORS.borderSoft);
    doc.setLineWidth(0.15);
    doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  };

  drawRow(isExpense ? 'Dibayarkan Kepada' : 'Diterima Dari', targetName);
  drawRow('Metode Pembayaran', sanitize(transaction.method || '-'));

  y += 6;

  // Tujuan pembayaran.
  if (y + 20 > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }
  setFont(7.5, 'bold');
  ink(COLORS.muted);
  doc.text('TUJUAN PEMBAYARAN', CONTENT_LEFT, y + 7.5 * PT_TO_MM);
  y += lineHeight(7.5, 1.3) + 2;
  const descLines = wrap(transaction.description || '-', CONTENT_W - 2);
  y = writeLines(descLines, CONTENT_LEFT, y, 9.5, 'normal', COLORS.textSoft, 'left', 1.4);
  y += 6;

  // Blok progres proyek (opsional).
  if (project) {
    const projTitle = `Progres Acara Pernikahan Pengantin: ${sanitize(project.projectName || '-')}`;
    setFont(9, 'bold');
    const projTitleLines = wrap(projTitle, CONTENT_W - boxPadX * 2);
    const projBoxH = boxPadY * 2 + projTitleLines.length * lineHeight(9, 1.3) + 1.5 + lineHeight(9, 1.35);

    if (y + projBoxH > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    fill(accentSoft);
    stroke(COLORS.borderSoft);
    doc.setLineWidth(0.25);
    doc.roundedRect(CONTENT_LEFT, y, CONTENT_W, projBoxH, 1.6, 1.6, 'FD');

    let projY = y + boxPadY;
    projY = writeLines(projTitleLines, CONTENT_LEFT + boxPadX, projY, 9, 'bold', COLORS.textSoft, 'left', 1.3);
    projY += 1.5;
    const totalText = `Total Pembayaran: ${formatCurrency(project.totalCost)}`;
    const sisaText = `Sisa: ${formatCurrency((Number(project.totalCost) || 0) - (Number(project.amountPaid) || 0))}`;
    const projBaseline = projY + 9 * PT_TO_MM;
    setFont(9, 'normal');
    ink(COLORS.textSoft);
    doc.text(sanitize(totalText), CONTENT_LEFT + boxPadX, projBaseline);
    setFont(9, 'bold');
    doc.text(sanitize(sisaText), CONTENT_RIGHT - boxPadX, projBaseline, { align: 'right' });

    y += projBoxH + 6;
  }

  // ── FOOTER / TANDA TANGAN ──────────────────────────────────────────────
  const footerH = 40;
  if (y + footerH > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  y += 4;
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.25);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 7;

  const noteLines = wrap(`Dicetak otomatis oleh ${companyName}`, CONTENT_W * 0.55);
  writeLines(noteLines, CONTENT_LEFT, y, 7.5, 'italic', COLORS.muted, 'left', 1.35);

  const sigColW = 55;
  const sigCenterX = CONTENT_RIGHT - sigColW / 2;
  setFont(7.5, 'bold');
  ink(COLORS.muted);
  doc.text('PENERIMA,', sigCenterX, y + 7.5 * PT_TO_MM, { align: 'center' });

  let sigY = y + 7.5 * PT_TO_MM + 3;
  const sigAreaH = 15;
  if (signature) {
    const ratio = signature.width / signature.height;
    let h = sigAreaH;
    let w = h * ratio;
    if (w > sigColW) {
      w = sigColW;
      h = w / ratio;
    }
    try {
      doc.addImage(signature.dataUrl, 'PNG', sigCenterX - w / 2, sigY + (sigAreaH - h) / 2, w, h, undefined, 'FAST');
    } catch {
      // Abaikan bila tanda tangan gagal dirender.
    }
  } else {
    stroke(COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(sigCenterX - 13, sigY + sigAreaH - 1, sigCenterX + 13, sigY + sigAreaH - 1);
  }
  sigY += sigAreaH + 2.5;

  setFont(9.5, 'bold');
  ink(COLORS.text);
  const signerText = `(${signer})`;
  doc.text(sanitize(signerText), sigCenterX, sigY + 9.5 * PT_TO_MM, { align: 'center' });
  const signerW = doc.getTextWidth(sanitize(signerText));
  stroke(COLORS.border);
  doc.setLineWidth(0.15);
  doc.line(sigCenterX - signerW / 2, sigY + 9.5 * PT_TO_MM + 0.9, sigCenterX + signerW / 2, sigY + 9.5 * PT_TO_MM + 0.9);

  return doc;
};

export const downloadReceiptPdf = async (input: ReceiptPdfInput): Promise<void> => {
  const doc = await buildReceiptPdf(input);
  doc.save(buildReceiptFileName(input.transaction));
};
