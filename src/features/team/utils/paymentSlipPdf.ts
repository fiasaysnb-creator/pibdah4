import { jsPDF } from 'jspdf';
import { Profile, Project, TeamMember, TeamPaymentRecord, TeamProjectPayment } from '../../../types';
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
  sanitize,
} from '../../../shared/utils/pdfCore';

/**
 * Renderer PDF untuk Slip Pembayaran / Slip Gaji tim.
 *
 * Membangun ulang dokumen secara terpisah memakai primitive vector jsPDF
 * (bukan screenshot/raster) sehingga seluruh teks, garis, dan tabel tetap tajam
 * saat diperbesar maupun dicetak. Layout mengikuti PaymentSlipDocument pada
 * preview aplikasi; tampilan preview itu sendiri tidak diubah.
 */

export interface PaymentSlipPdfInput {
  record: TeamPaymentRecord;
  teamMembers: TeamMember[];
  teamProjectPayments: TeamProjectPayment[];
  projects: Project[];
  profile: Profile;
}

const safeFilePart = (value?: string): string =>
  sanitize(value).replace(/[\\/:*?"<>|\s]+/g, '_');

export const buildPaymentSlipFileName = (record: TeamPaymentRecord): string =>
  `Bukti-Invoice-Pembayaran-Tim-${safeFilePart(record.recordNumber || sanitize(record.id).slice(0, 8)) || 'slip'}.pdf`;

export const buildPaymentSlipPdf = async (input: PaymentSlipPdfInput): Promise<jsPDF> => {
  const { record, teamMembers, teamProjectPayments, projects } = input;
  const profile = input.profile || ({} as Profile);

  const accent = hexToRgb(profile.brandColor) || DEFAULT_ACCENT;

  const doc = createPdfDoc('portrait');
  await embedPdfFonts(doc);
  const { fill, stroke, ink, setFont, writeLines, wrap } = createPdfTools(doc);

  const member = teamMembers.find((m) => m.id === record.teamMemberId);
  const projectsBeingPaid = teamProjectPayments.filter((p) =>
    (record.projectPaymentIds || []).includes(p.id),
  );

  const [logo, signature] = await Promise.all([
    loadImageAsset(profile.logoBase64),
    loadImageAsset(record.vendorSignature || profile.signatureBase64, { grayscale: true }),
  ]);

  // ── Bar aksen atas (full-bleed) ─────────────────────────────────────────
  fill(accent);
  doc.rect(0, 0, 210, 1.8, 'F');

  let y = MARGIN_TOP + 3;

  // ── HEADER ─────────────────────────────────────────────────────────────
  const headerTop = y;
  let leftY = headerTop;
  const logoMaxW = 35;
  const logoMaxH = 14;

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
    leftY += h + 3;
  } else {
    const box = 8;
    fill(accent);
    doc.roundedRect(CONTENT_LEFT, leftY, box, box, 1.4, 1.4, 'F');
    setFont(11, 'bold');
    ink(COLORS.white);
    doc.text(
      sanitize((profile.companyName || 'V').charAt(0).toUpperCase()),
      CONTENT_LEFT + box / 2,
      leftY + box / 2 + (11 * PT_TO_MM) / 2,
      { align: 'center' },
    );
    setFont(13, 'bold');
    ink(COLORS.text);
    doc.text(
      sanitize(profile.companyName || 'Vendor'),
      CONTENT_LEFT + box + 2.6,
      leftY + box / 2 + (13 * PT_TO_MM) / 2,
    );
    leftY += box + 3;
  }

  const companyMeta = [profile.companyName, profile.address, profile.phone]
    .filter(Boolean)
    .map((line) => sanitize(line));
  leftY = writeLines(companyMeta, CONTENT_LEFT, leftY, 7.5, 'normal', COLORS.muted, 'left', 1.35);

  // Panel kanan: judul + badge nomor + tanggal/metode.
  let rightY = headerTop;
  setFont(20, 'bold');
  ink(accent);
  doc.text('Bukti & Invoice', CONTENT_RIGHT, rightY + 20 * PT_TO_MM, { align: 'right' });
  rightY += lineHeight(20, 1.05) + 1.2;

  const badgeText = `#${sanitize(record.recordNumber || '-')}`;
  setFont(8, 'bold');
  const badgePadX = 3;
  const badgeW = doc.getTextWidth(badgeText) + badgePadX * 2;
  const badgeH = 5.4;
  fill(COLORS.badge);
  doc.roundedRect(CONTENT_RIGHT - badgeW, rightY, badgeW, badgeH, 0.9, 0.9, 'F');
  ink(COLORS.textSoft);
  doc.text(badgeText, CONTENT_RIGHT - badgePadX, rightY + badgeH / 2, {
    align: 'right',
    baseline: 'middle',
  });
  rightY += badgeH + 2;

  const metaLine = (label: string, value: string) => {
    setFont(7.5, 'normal');
    const labelStr = sanitize(label);
    const valueStr = sanitize(value);
    ink(COLORS.label);
    const labelW = doc.getTextWidth(labelStr);
    setFont(7.5, 'bold');
    const valueW = doc.getTextWidth(valueStr);
    const startX = CONTENT_RIGHT - (labelW + valueW);
    setFont(7.5, 'normal');
    ink(COLORS.label);
    doc.text(labelStr, startX, rightY + 7.5 * PT_TO_MM);
    setFont(7.5, 'bold');
    ink(COLORS.text);
    doc.text(valueStr, CONTENT_RIGHT - valueW, rightY + 7.5 * PT_TO_MM);
    rightY += lineHeight(7.5, 1.4);
  };
  metaLine('Tanggal: ', formatDate(record.date));
  metaLine('Metode: ', 'Transfer');

  y = Math.max(leftY, rightY) + 2.5;

  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.25);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 6;

  // ── KOTAK PENERIMA & SUMBER ────────────────────────────────────────────
  const boxGap = 5;
  const boxW = (CONTENT_W - boxGap) / 2;
  const boxPadX = 4;
  const boxPadY = 4;

  const recipientName = sanitize(member?.name || 'Tim');
  const recipientRole = sanitize(member?.role || '');
  const recipientRek = `Rek: ${sanitize(member?.noRek || '-')}`;
  const sourceName = sanitize(profile.companyName || 'Vendor');
  const sourceRek = `Rek: ${sanitize(profile.bankAccount || '-')}`;

  const nameLinesL = wrap(recipientName, boxW - boxPadX * 2);
  const nameLinesR = wrap(sourceName, boxW - boxPadX * 2);

  const labelH = lineHeight(7, 1.3);
  const nameH = nameLinesL.length * lineHeight(11, 1.15);
  const roleH = recipientRole ? lineHeight(8.5, 1.3) : 0;
  const rekH = lineHeight(8.5, 1.3);
  const boxContentH = Math.max(nameH + roleH + rekH, nameLinesR.length * lineHeight(11, 1.15) + rekH);
  const boxH = boxPadY * 2 + labelH + 1.2 + boxContentH;

  const drawInfoBox = (x: number, label: string, body: () => void) => {
    fill(COLORS.white);
    stroke(COLORS.borderSoft);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.6, 1.6, 'FD');
    setFont(7, 'bold');
    ink(COLORS.muted);
    doc.text(label, x + boxPadX, y + boxPadY + 7 * PT_TO_MM);
    body();
  };

  let boxY = y + boxPadY + labelH + 1.2;
  drawInfoBox(CONTENT_LEFT, 'PENERIMA', () => {
    let cursor = boxY;
    cursor = writeLines(nameLinesL, CONTENT_LEFT + boxPadX, cursor, 11, 'bold', COLORS.text, 'left', 1.15);
    if (recipientRole) {
      cursor = writeLines([recipientRole], CONTENT_LEFT + boxPadX, cursor, 8.5, 'bold', accent, 'left', 1.3);
    }
    writeLines([recipientRek], CONTENT_LEFT + boxPadX, cursor, 8.5, 'normal', COLORS.textSoft, 'left', 1.3);
  });
  drawInfoBox(CONTENT_LEFT + boxW + boxGap, 'SUMBER', () => {
    let cursor = boxY;
    cursor = writeLines(nameLinesR, CONTENT_LEFT + boxW + boxGap + boxPadX, cursor, 11, 'bold', COLORS.text, 'left', 1.15);
    writeLines([sourceRek], CONTENT_LEFT + boxW + boxGap + boxPadX, cursor, 8.5, 'normal', COLORS.textSoft, 'left', 1.3);
  });

  y += boxH + 7;

  // ── TABEL RINCIAN ──────────────────────────────────────────────────────
  const colDescX = CONTENT_LEFT;
  const colFeeX = CONTENT_LEFT + CONTENT_W * 0.68;
  const cellPadX = 3;
  const cellPadY = 2.4;
  const descW = colFeeX - colDescX - cellPadX * 2;
  const feeW = CONTENT_RIGHT - colFeeX - cellPadX;

  setFont(7, 'bold');
  ink(COLORS.muted);
  doc.text('RINCIAN', CONTENT_LEFT, y + 7 * PT_TO_MM);
  y += lineHeight(7, 1.2) + 1.6;

  const drawRincianHeader = () => {
    const headerH = 7;
    fill(COLORS.headBg);
    stroke(COLORS.black);
    doc.setLineWidth(0.2);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, headerH, 'FD');
    setFont(7, 'bold');
    ink(COLORS.textSoft);
    const baseline = y + headerH / 2 + (7 * PT_TO_MM) / 2;
    doc.text('DESKRIPSI', colDescX + cellPadX, baseline);
    doc.text('FEE', CONTENT_RIGHT - cellPadX, baseline, { align: 'right' });
    y += headerH;
  };
  drawRincianHeader();

  projectsBeingPaid.forEach((payment) => {
    const project = projects.find((proj) => proj.id === payment.projectId);
    const title = sanitize(project?.projectName || 'Acara Selesai');
    const role = sanitize(project?.team?.find((t) => t.memberId === member?.id)?.role || '');

    setFont(8.5, 'bold');
    const titleLines = wrap(title, descW);
    setFont(7, 'normal');
    const roleLines = role ? wrap(role, descW) : [];

    let contentH = titleLines.length * lineHeight(8.5, 1.2);
    contentH += roleLines.length * lineHeight(7, 1.25);
    const rowH = cellPadY * 2 + contentH;

    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawRincianHeader();
    }

    fill(COLORS.white);
    stroke(COLORS.borderSoft);
    doc.setLineWidth(0.15);
    doc.line(colDescX, y, CONTENT_RIGHT, y);

    let cursor = y + cellPadY;
    cursor = writeLines(titleLines, colDescX + cellPadX, cursor, 8.5, 'bold', COLORS.text, 'left', 1.2);
    if (roleLines.length) {
      writeLines(roleLines, colDescX + cellPadX, cursor, 7, 'normal', COLORS.textSoft, 'left', 1.25);
    }

    setFont(8.5, 'bold');
    ink(COLORS.text);
    doc.text(formatCurrency(payment.fee), CONTENT_RIGHT - cellPadX, y + cellPadY + 8.5 * PT_TO_MM, {
      align: 'right',
    });

    y += rowH;
  });

  // Baris total.
  const totalH = 11;
  if (y + totalH > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }
  stroke(COLORS.label);
  doc.setLineWidth(0.5);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  const totalValue = formatCurrency(record.totalAmount);
  setFont(13, 'bold');
  const totalValueW = doc.getTextWidth(totalValue);
  const totalBaseline = y + totalH / 2 + (13 * PT_TO_MM) / 2;
  setFont(9, 'bold');
  ink(COLORS.label);
  doc.text('TOTAL', CONTENT_RIGHT - cellPadX - totalValueW - 6, totalBaseline, { align: 'right' });
  setFont(13, 'bold');
  ink(accent);
  doc.text(totalValue, CONTENT_RIGHT - cellPadX, totalBaseline, { align: 'right' });
  y += totalH;

  // ── FOOTER / TANDA TANGAN ──────────────────────────────────────────────
  const footerH = 34;
  if (y + footerH > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  y += 6;
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.25);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 6;

  setFont(7, 'italic');
  ink(COLORS.muted);
  const noteLines = wrap(
    `Slip dicetak otomatis untuk ${member?.name || 'Tim'} - ${formatDate(record.date)}`,
    CONTENT_W * 0.55,
  );
  writeLines(noteLines, CONTENT_LEFT, y, 7, 'italic', COLORS.muted, 'left', 1.35);

  const sigColW = 60;
  const sigCenterX = CONTENT_RIGHT - sigColW / 2;
  setFont(7, 'bold');
  ink(COLORS.muted);
  doc.text('VERIFIKATOR,', sigCenterX, y + 7 * PT_TO_MM, { align: 'center' });

  let sigY = y + 7 * PT_TO_MM + 2.5;
  const sigAreaH = 12;
  if (signature) {
    const ratio = signature.width / signature.height;
    let h = sigAreaH;
    let w = h * ratio;
    if (w > sigColW) {
      w = sigColW;
      h = w / ratio;
    }
    try {
      doc.addImage(
        signature.dataUrl,
        'PNG',
        sigCenterX - w / 2,
        sigY + (sigAreaH - h) / 2,
        w,
        h,
        undefined,
        'FAST',
      );
    } catch {
      // Abaikan bila tanda tangan gagal dirender.
    }
  } else {
    stroke(COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(sigCenterX - 14, sigY + sigAreaH - 1, sigCenterX + 14, sigY + sigAreaH - 1);
  }
  sigY += sigAreaH + 2;

  setFont(9, 'bold');
  ink(COLORS.text);
  doc.text(sanitize(profile.authorizedSigner || profile.companyName || ''), sigCenterX, sigY + 9 * PT_TO_MM, {
    align: 'center',
  });

  return doc;
};

export const downloadPaymentSlipPdf = async (input: PaymentSlipPdfInput): Promise<void> => {
  const doc = await buildPaymentSlipPdf(input);
  doc.save(buildPaymentSlipFileName(input.record));
};
