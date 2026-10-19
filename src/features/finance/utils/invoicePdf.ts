import { jsPDF } from 'jspdf';
import { Client, Package, PaymentStatus, PhysicalItem, Profile, Project, Transaction, TransactionType } from '../../../types';
import {
  COLORS,
  CONTENT_BOTTOM,
  CONTENT_LEFT,
  CONTENT_RIGHT,
  CONTENT_W,
  DEFAULT_ACCENT,
  MARGIN_TOP,
  PT_TO_MM,
  RGB,
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
 * Renderer PDF khusus invoice.
 *
 * Modul ini TIDAK menyentuh tampilan aplikasi sama sekali. Ia membangun ulang
 * dokumen invoice secara terpisah menggunakan primitive vector jsPDF sehingga
 * teks, garis, dan tabel tetap tajam saat di-zoom, bukan raster hasil screenshot.
 *
 * Layout mengikuti struktur InvoiceDocument (preview aplikasi) agar seluruh
 * informasi dan susunan visualnya tetap identik.
 */

export interface InvoicePdfInput {
  project: Project;
  profile: Profile;
  packages?: Package[];
  client?: Client | null;
  issuedDate?: string;
}

export const getLatestInvoicePaymentDate = (projectId: string, transactions: Transaction[] = []): string =>
  transactions
    .filter(transaction => transaction.projectId === projectId && transaction.type === TransactionType.INCOME)
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.date
  || new Date().toISOString().slice(0, 10);

export const buildInvoiceFileName = (project: Project): string => {
  const name = (project.projectName || project.clientName || 'Invoice').replace(
    /[\\/:*?"<>|\s]+/g,
    '_',
  );
  return `Invoice-${name || project.id.slice(-8)}.pdf`;
};

export const buildInvoicePdf = async (input: InvoicePdfInput): Promise<jsPDF> => {
  const { project, packages = [], client } = input;
  const issuedDate = input.issuedDate || getLatestInvoicePaymentDate(project.id);
  const profile = input.profile || ({} as Profile);

  const accent = hexToRgb(profile.brandColor) || DEFAULT_ACCENT;
  const accentSoft = mixWithWhite(accent, 0.92);
  const accentLine = mixWithWhite(accent, 0.55);

  const doc = createPdfDoc('portrait');
  await embedPdfFonts(doc);

  // Muat logo, tanda tangan, dan seluruh bukti pembayaran secara paralel.
  const proofAttachments = [
    ...(project.dpProofUrl ? [{ url: project.dpProofUrl, label: 'BUKTI TRANSFER DP' }] : []),
    ...(project.paymentProofs || []).map((proof, index) => ({
      url: proof.url,
      label: `BUKTI PEMBAYARAN ${index + 1}${proof.amount ? ` - ${formatCurrency(proof.amount)}` : ''}`,
    })),
  ];
  const [logo, signature, ...paymentProofs] = await Promise.all([
    loadImageAsset(profile.logoBase64),
    loadImageAsset(project.invoiceSignature || profile.signatureBase64, { grayscale: true }),
    ...proofAttachments.map(proof => loadImageAsset(proof.url)),
  ]);

  // ── Perhitungan data (identik dengan InvoiceDocument) ──────────────────
  const safeAddOns = Array.isArray(project.addOns) ? project.addOns : [];
  const safeAdditionalPackages = Array.isArray(project.additionalPackages)
    ? project.additionalPackages
    : [];
  const safeCustomCosts = Array.isArray(project.customCosts) ? project.customCosts : [];

  const subtotal = (Number(project.totalCost) || 0) + (Number(project.discountAmount) || 0);
  const addOnsTotal = safeAddOns.reduce((acc, curr) => acc + (Number(curr?.price) || 0), 0);
  const additionalPackagesTotal = safeAdditionalPackages.reduce(
    (acc, item) => acc + (Number(item?.price) || 0),
    0,
  );
  const customCostsTotal = safeCustomCosts.reduce(
    (acc, curr) => acc + (Number(curr?.amount) || 0),
    0,
  );
  const packagePrice = Math.max(
    0,
    subtotal -
      addOnsTotal -
      additionalPackagesTotal -
      (Number(project.transportCost) || 0) -
      customCostsTotal,
  );

  const mainPackage = packages.find(
    (p) => p.id === project.packageId || p.name === project.packageName,
  );
  let displayTeam = '';
  let displayDigitalItems: string[] = [];
  let displayPhysicalItems: PhysicalItem[] = [];
  if (mainPackage) {
    const selectedOption = mainPackage.durationOptions?.find(
      (opt) => opt.label === project.durationSelection,
    );
    displayTeam =
      selectedOption?.photographers?.trim() ||
      [mainPackage.photographers, mainPackage.videographers].filter(Boolean).join(' & ');

    if (selectedOption?.digitalItems?.length) displayDigitalItems = selectedOption.digitalItems;
    if (selectedOption?.physicalItems?.length) displayPhysicalItems = selectedOption.physicalItems;
    if (displayDigitalItems.length === 0 && mainPackage.digitalItems?.length) {
      displayDigitalItems = mainPackage.digitalItems;
    }
    if (displayPhysicalItems.length === 0 && mainPackage.physicalItems?.length) {
      displayPhysicalItems = mainPackage.physicalItems;
    }
  }

  // ── Helper menggambar ──────────────────────────────────────────────────
  const { fill, stroke, ink, setFont, writeLines, wrap } = createPdfTools(doc);

  let y = MARGIN_TOP;

  // ── HEADER ─────────────────────────────────────────────────────────────
  const headerTop = y;
  let leftY = headerTop;
  const logoMaxW = 46;
  const logoMaxH = 15;

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
      // Abaikan bila gambar gagal dirender, lanjutkan dengan data lain.
    }
    leftY += h + 2.2;
  } else {
    const box = 7.5;
    fill(accent);
    doc.roundedRect(CONTENT_LEFT, leftY, box, box, 1.2, 1.2, 'F');
    setFont(11, 'bold');
    ink(COLORS.white);
    doc.text(
      sanitize((profile.companyName || 'V').charAt(0).toUpperCase()),
      CONTENT_LEFT + box / 2,
      leftY + box / 2 + 11 * PT_TO_MM / 2,
      { align: 'center' },
    );
    setFont(12, 'bold');
    ink(COLORS.text);
    doc.text(
      sanitize(profile.companyName || 'Vendor'),
      CONTENT_LEFT + box + 2.5,
      leftY + box / 2 + 12 * PT_TO_MM / 2,
    );
    leftY += box + 2.2;
  }

  const companyMeta: string[] = [];
  if (profile.address) companyMeta.push(sanitize(profile.address));
  const contactLine = [profile.phone, profile.email].filter(Boolean).join(' • ');
  if (contactLine) companyMeta.push(sanitize(contactLine));

  setFont(8.5, 'bold');
  ink(COLORS.textSoft);
  doc.text(sanitize(profile.companyName || 'Vendor'), CONTENT_LEFT, leftY + 8.5 * PT_TO_MM);
  leftY += lineHeight(8.5, 1.3);
  leftY = writeLines(companyMeta, CONTENT_LEFT, leftY, 7, 'normal', COLORS.muted, 'left', 1.35);

  // Panel kanan: judul, badge ID, tanggal, status.
  let rightY = headerTop;
  setFont(20, 'bold');
  ink(accent);
  doc.text('INVOICE', CONTENT_RIGHT, rightY + 20 * PT_TO_MM, { align: 'right' });
  rightY += lineHeight(20, 1.05) + 1.2;

  const badgeText = `ID: #INV-${sanitize(project.id || '').slice(-8).toUpperCase()}`;
  setFont(7.5, 'bold');
  const badgePadX = 3;
  const badgeW = doc.getTextWidth(badgeText) + badgePadX * 2;
  const badgeH = 5.2;
  fill(COLORS.badge);
  doc.roundedRect(CONTENT_RIGHT - badgeW, rightY, badgeW, badgeH, 0.8, 0.8, 'F');
  ink(COLORS.textSoft);
  doc.text(badgeText, CONTENT_RIGHT - badgePadX, rightY + badgeH / 2, {
    align: 'right',
    baseline: 'middle',
  });
  rightY += badgeH + 1.6;

  const metaLine = (label: string, value: string, valueColor: RGB) => {
    setFont(7.5, 'normal');
    const labelStr = sanitize(label);
    const valueStr = sanitize(value);
    ink(COLORS.label);
    const labelW = doc.getTextWidth(labelStr);
    setFont(7.5, 'bold');
    const valueW = doc.getTextWidth(valueStr);
    const startX = CONTENT_RIGHT - (labelW + valueW + 1);
    setFont(7.5, 'normal');
    ink(COLORS.label);
    doc.text(labelStr, startX, rightY + 7.5 * PT_TO_MM);
    setFont(7.5, 'bold');
    ink(valueColor);
    doc.text(valueStr, CONTENT_RIGHT - valueW, rightY + 7.5 * PT_TO_MM);
    rightY += lineHeight(7.5, 1.35);
  };

  metaLine('Diterbitkan: ', formatDate(issuedDate), COLORS.text);
  metaLine(
    'Status: ',
    String(project.paymentStatus || '').toUpperCase(),
    project.paymentStatus === PaymentStatus.LUNAS ? COLORS.green : COLORS.orange,
  );

  y = Math.max(leftY, rightY) + 2;
  stroke(accent);
  doc.setLineWidth(0.8);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 4.5;

  // ── GRID BILLING ───────────────────────────────────────────────────────
  const colGap = 6;
  const colW = (CONTENT_W - colGap) / 2;
  const leftColX = CONTENT_LEFT;
  const rightColX = CONTENT_LEFT + colW + colGap;

  let billingY = y;
  setFont(7, 'bold');
  ink(COLORS.muted);
  doc.text('PENERIMA INVOICE', leftColX, billingY + 7 * PT_TO_MM);
  doc.text('DETAIL LAYANAN', rightColX, billingY + 7 * PT_TO_MM);
  billingY += lineHeight(7, 1.2) + 1.4;

  // Kiri: nama pengantin + kontak.
  let leftMetaY = billingY;
  setFont(10, 'bold');
  ink(COLORS.text);
  doc.text(sanitize(project.clientName || '-'), leftColX, leftMetaY + 10 * PT_TO_MM);
  leftMetaY += lineHeight(10, 1.25) + 0.6;
  if (client) {
    leftMetaY = writeLines(
      [client.phone, client.email].filter(Boolean).map(sanitize),
      leftColX,
      leftMetaY,
      7.5,
      'normal',
      COLORS.textSoft,
      'left',
      1.3,
    );
  }

  // Kanan: nama proyek + lokasi/tipe/alamat.
  let rightMetaY = billingY;
  const eventDateLabel = formatDate(project.date);
  const projectNameWithoutPrefix = (project.projectName || '').replace(/^Acara Pernikahan\s+/i, '').trim();
  const displayProjectName = eventDateLabel !== 'Tanpa Tanggal' && projectNameWithoutPrefix.endsWith(eventDateLabel)
    ? projectNameWithoutPrefix.slice(0, -eventDateLabel.length).replace(/[\s,–—-]+$/, '').trim()
    : projectNameWithoutPrefix;
  setFont(10, 'bold');
  ink(COLORS.text);
  doc.text(sanitize(displayProjectName || project.projectName || '-'), rightColX, rightMetaY + 10 * PT_TO_MM);
  rightMetaY += lineHeight(10, 1.25) + 0.6;

  const kvInline = (label: string, value: string, x: number, yTop: number, maxW: number): number => {
    setFont(7.5, 'normal');
    const labelStr = sanitize(label);
    ink(COLORS.muted);
    doc.text(labelStr, x, yTop + 7.5 * PT_TO_MM);
    const labelW = doc.getTextWidth(labelStr);
    ink(COLORS.textSoft);
    const lines = wrap(value || '-', Math.max(8, maxW - labelW));
    let cursor = yTop;
    lines.forEach((line) => {
      doc.text(line, x + labelW, cursor + 7.5 * PT_TO_MM);
      cursor += lineHeight(7.5, 1.3);
    });
    return cursor;
  };

  rightMetaY = kvInline('Tanggal Acara: ', eventDateLabel, rightColX, rightMetaY, colW);
  const subColW = colW / 2;
  const kvBottom = Math.max(
    kvInline('Lokasi: ', project.location || '-', rightColX, rightMetaY, subColW - 2),
    kvInline('Tipe: ', project.projectType || '-', rightColX + subColW, rightMetaY, subColW - 2),
  );
  rightMetaY = kvBottom;
  if (project.address) {
    rightMetaY = kvInline('Alamat: ', project.address, rightColX, rightMetaY, colW);
  }

  y = Math.max(leftMetaY, rightMetaY) + 2;
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 4;

  // ── TABEL ITEM ─────────────────────────────────────────────────────────
  const noW = CONTENT_W * 0.08;
  const descW = CONTENT_W * 0.68;
  const totalW = CONTENT_W - noW - descW;
  const cNoX = CONTENT_LEFT;
  const cDescX = cNoX + noW;
  const cTotalX = cDescX + descW;
  const cellPadX = 2;
  const cellPadY = 1.8;
  const descInnerW = descW - cellPadX * 2;

  interface TableRow {
    no: string;
    title: string;
    titleSize: number;
    titleBold: boolean;
    subs: string[];
    physicalLabel?: string;
    physicals: string[];
    price: string;
  }

  const rows: TableRow[] = [];

  rows.push({
    no: '1',
    title: sanitize(project.packageName || '-'),
    titleSize: 8.5,
    titleBold: true,
    subs: [
      ...(displayTeam ? [displayTeam] : []),
      ...(displayDigitalItems.length > 0
        ? displayDigitalItems
        : ['Package utama layanan profesional']),
    ],
    physicalLabel: displayPhysicalItems.length > 0 ? 'Vendor (Allpackage):' : undefined,
    physicals: displayPhysicalItems.map((item) => item.name),
    price: formatCurrency(packagePrice),
  });

  safeAdditionalPackages.forEach((packageItem, idx) => {
    const additionalPackage = packages.find(
      (item) => item.id === packageItem.id || item.name === packageItem.name,
    );
    const deliverables = [
      ...(additionalPackage?.digitalItems || []),
      ...(additionalPackage?.physicalItems || []).map((item) => item.name),
    ].filter(Boolean);

    rows.push({
      no: String(2 + idx),
      title: sanitize(packageItem.name || additionalPackage?.name || '-'),
      titleSize: 8.5,
      titleBold: true,
      subs: deliverables,
      physicals: [],
      price: formatCurrency(Number(packageItem.price) || 0),
    });
  });

  safeAddOns.forEach((addon, idx) => {
    rows.push({
      no: String(2 + safeAdditionalPackages.length + idx),
      title: sanitize(addon.name || '-'),
      titleSize: 8,
      titleBold: false,
      subs: ['Add-on Item'],
      physicals: [],
      price: formatCurrency(Number(addon.price) || 0),
    });
  });

  if (project.transportCost && Number(project.transportCost) > 0) {
    rows.push({
      no: String(safeAdditionalPackages.length + safeAddOns.length + 2),
      title: 'Biaya Transport',
      titleSize: 8,
      titleBold: false,
      subs: ['Logistik & Operasional'],
      physicals: [],
      price: formatCurrency(Number(project.transportCost)),
    });
  }

  safeCustomCosts.forEach((cost, idx) => {
    const transportOffset = project.transportCost && Number(project.transportCost) > 0 ? 1 : 0;
    const rowNo =
      2 + safeAdditionalPackages.length + safeAddOns.length + transportOffset + idx;
    rows.push({
      no: String(rowNo),
      title: sanitize(cost.description || '-'),
      titleSize: 8,
      titleBold: false,
      subs: [],
      physicals: [],
      price: formatCurrency(Number(cost.amount) || 0),
    });
  });

  const drawTableHeader = () => {
    const headerH = 6.6;
    fill(COLORS.headBg);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, headerH, 'F');
    stroke(COLORS.black);
    doc.setLineWidth(0.25);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, headerH, 'S');
    doc.line(cDescX, y, cDescX, y + headerH);
    doc.line(cTotalX, y, cTotalX, y + headerH);
    setFont(7, 'bold');
    ink(COLORS.black);
    const baseline = y + headerH / 2 + (7 * PT_TO_MM) / 2;
    doc.text('NO', cNoX + noW / 2, baseline, { align: 'center' });
    doc.text('DESKRIPSI PRODUK / LAYANAN', cDescX + cellPadX, baseline);
    doc.text('TOTAL HARGA', cTotalX + totalW - cellPadX, baseline, { align: 'right' });
    y += headerH;
  };

  drawTableHeader();

  rows.forEach((row) => {
    setFont(row.titleSize, row.titleBold ? 'bold' : 'normal');
    const titleLines = wrap(row.title, descInnerW);
    setFont(7, 'normal');
    const subLines = row.subs.flatMap((sub) => wrap(`•  ${sub}`, descInnerW));
    setFont(6.5, 'bold');
    const physicalLabelLines = row.physicalLabel ? wrap(row.physicalLabel, descInnerW) : [];
    setFont(7, 'normal');
    const physicalLines = row.physicals.flatMap((item) => wrap(`•  ${item}`, descInnerW));

    let contentH = titleLines.length * lineHeight(row.titleSize, 1.15);
    contentH += subLines.length * lineHeight(7, 1.25);
    if (row.physicals.length > 0) {
      contentH += 1.4 + physicalLabelLines.length * lineHeight(6.5, 1.2);
      contentH += physicalLines.length * lineHeight(7, 1.25);
    }
    const rowH = cellPadY * 2 + contentH;

    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawTableHeader();
    }

    fill(COLORS.white);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, rowH, 'F');
    stroke(COLORS.black);
    doc.setLineWidth(0.2);
    doc.rect(CONTENT_LEFT, y, CONTENT_W, rowH, 'S');
    doc.line(cDescX, y, cDescX, y + rowH);
    doc.line(cTotalX, y, cTotalX, y + rowH);

    setFont(8, 'normal');
    ink(COLORS.text);
    doc.text(row.no, cNoX + noW / 2, y + cellPadY + 8 * PT_TO_MM, { align: 'center' });

    setFont(8, row.titleBold ? 'bold' : 'normal');
    ink(COLORS.text);
    doc.text(row.price, cTotalX + totalW - cellPadX, y + cellPadY + 8 * PT_TO_MM, {
      align: 'right',
    });

    let descY = y + cellPadY;
    descY = writeLines(titleLines, cDescX + cellPadX, descY, row.titleSize, row.titleBold ? 'bold' : 'normal', COLORS.text, 'left', 1.15);
    if (subLines.length) {
      descY = writeLines(subLines, cDescX + cellPadX, descY, 7, 'normal', COLORS.muted, 'left', 1.25);
    }
    if (row.physicals.length > 0) {
      stroke(COLORS.borderSoft);
      doc.setLineWidth(0.15);
      doc.line(cDescX + cellPadX, descY + 0.6, cDescX + descW - cellPadX, descY + 0.6);
      descY += 1.4;
      descY = writeLines(physicalLabelLines, cDescX + cellPadX, descY, 6.5, 'bold', COLORS.label, 'left', 1.2);
      descY = writeLines(physicalLines, cDescX + cellPadX, descY, 7, 'normal', COLORS.muted, 'left', 1.25);
    }

    y += rowH;
  });

  // ── RINGKASAN & TOTAL ──────────────────────────────────────────────────
  const totalsW = 80;
  const totalsX = CONTENT_RIGHT - totalsW;
  const infoW = CONTENT_W - totalsW - 6;

  const termsText =
    profile.termsAndConditions ||
    'Terima kasih telah mempercayai layanan kami. Kepuasan Anda adalah prioritas kami.';
  const paymentNote =
    'Silakan kirimkan bukti transfer melalui Whatsapp atau Portal Client setelah melakukan pembayaran.';

  setFont(7, 'normal');
  const paymentNoteLines = wrap(paymentNote, infoW - 6);
  setFont(6.5, 'italic');
  const termsLines = wrap(`"${termsText}"`, infoW);

  const infoBoxH = 11 + paymentNoteLines.length * lineHeight(7, 1.3) + 3;
  const summaryBlockH = Math.max(
    infoBoxH + 2.5 + termsLines.length * lineHeight(6.5, 1.3),
    9 + 5.2 + 1.5 + 9 + 5.2 + 9,
  );

  if (y + summaryBlockH + 4 > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  let summaryY = y + 5;
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(CONTENT_LEFT, summaryY - 2.5, CONTENT_RIGHT, summaryY - 2.5);

  // Kotak informasi pembayaran.
  fill(COLORS.panel);
  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.2);
  doc.roundedRect(CONTENT_LEFT, summaryY, infoW, infoBoxH, 1, 1, 'FD');
  setFont(7, 'bold');
  ink(COLORS.label);
  doc.text('INFORMASI PEMBAYARAN', CONTENT_LEFT + 3, summaryY + 3 + 7 * PT_TO_MM);
  setFont(9, 'bold');
  ink(COLORS.text);
  doc.text(sanitize(profile.bankAccount || '-'), CONTENT_LEFT + 3, summaryY + 8.5 + 9 * PT_TO_MM);
  setFont(7, 'normal');
  ink(COLORS.label);
  let noteY = summaryY + 12.5;
  paymentNoteLines.forEach((line) => {
    doc.text(line, CONTENT_LEFT + 3, noteY + 7 * PT_TO_MM);
    noteY += lineHeight(7, 1.3);
  });

  let termsY = summaryY + infoBoxH + 2.5;
  termsY = writeLines(termsLines, CONTENT_LEFT, termsY, 6.5, 'italic', COLORS.muted, 'left', 1.3);

  // Panel total (kanan).
  let totalY = summaryY;
  const totalRowH = 5.2;
  const drawTotalRow = (
    label: string,
    value: string,
    color: RGB,
    style: 'normal' | 'bold' = 'normal',
  ) => {
    setFont(9, style);
    ink(color);
    doc.text(sanitize(label), totalsX + 2, totalY + 9 * PT_TO_MM);
    doc.text(sanitize(value), totalsX + totalsW - 2, totalY + 9 * PT_TO_MM, { align: 'right' });
    totalY += totalRowH;
  };

  drawTotalRow('Subtotal', formatCurrency(subtotal), COLORS.textSoft);
  if (project.discountAmount) {
    drawTotalRow('Diskon', `-${formatCurrency(project.discountAmount)}`, COLORS.red, 'bold');
  }

  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(totalsX, totalY + 0.6, totalsX + totalsW, totalY + 0.6);
  totalY += 2.4;

  const grandBoxH = 9.5;
  fill(COLORS.headBg);
  doc.roundedRect(totalsX, totalY, totalsW, grandBoxH, 1, 1, 'F');
  setFont(8, 'bold');
  ink(COLORS.label);
  doc.text('GRAND TOTAL', totalsX + 2.5, totalY + grandBoxH / 2 + (8 * PT_TO_MM) / 2);
  setFont(12, 'bold');
  ink(accent);
  doc.text(
    formatCurrency(project.totalCost),
    totalsX + totalsW - 2.5,
    totalY + grandBoxH / 2 + (12 * PT_TO_MM) / 2,
    { align: 'right' },
  );
  totalY += grandBoxH + 1.6;

  drawTotalRow('Sudah Dibayar', formatCurrency(project.amountPaid || 0), COLORS.green, 'bold');

  const balanceBoxH = 9.5;
  fill(accentSoft);
  stroke(accentLine);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, totalY, totalsW, balanceBoxH, 1, 1, 'FD');
  setFont(8, 'bold');
  ink(accent);
  doc.text('SISA PEMBAYARAN', totalsX + 2.5, totalY + balanceBoxH / 2 + (8 * PT_TO_MM) / 2);
  setFont(11, 'bold');
  doc.text(
    formatCurrency((Number(project.totalCost) || 0) - (Number(project.amountPaid) || 0)),
    totalsX + totalsW - 2.5,
    totalY + balanceBoxH / 2 + (11 * PT_TO_MM) / 2,
    { align: 'right' },
  );
  totalY += balanceBoxH;

  // ── FOOTER / TANDA TANGAN ──────────────────────────────────────────────
  y = Math.max(totalY, termsY) + 4;
  const signatureBlockH = 30;
  if (y + signatureBlockH > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  stroke(COLORS.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(CONTENT_LEFT, y, CONTENT_RIGHT, y);
  y += 4;

  const sigGap = 6;
  const sigColW = (CONTENT_W - sigGap * 2) / 3;
  const sigColX = CONTENT_LEFT + 2 * (sigColW + sigGap);
  const sigCenterX = sigColX + sigColW / 2;

  setFont(6.5, 'bold');
  ink(COLORS.muted);
  doc.text(
    'DICETAK OTOMATIS VENA PICTURES',
    CONTENT_LEFT + (sigColW * 2 + sigGap) / 2,
    y + 6.5 * PT_TO_MM,
    { align: 'center' },
  );

  setFont(7, 'bold');
  ink(COLORS.muted);
  doc.text('HORMAT KAMI,', sigCenterX, y + 7 * PT_TO_MM, { align: 'center' });

  let sigY = y + 7 * PT_TO_MM + 3;
  const sigAreaH = 14;
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
    doc.line(sigCenterX - 12, sigY + sigAreaH - 1, sigCenterX + 12, sigY + sigAreaH - 1);
  }
  sigY += sigAreaH + 1.6;

  const signerName = sanitize(profile.authorizedSigner || '');
  setFont(8.5, 'bold');
  ink(COLORS.text);
  doc.text(signerName, sigCenterX, sigY + 8.5 * PT_TO_MM, { align: 'center' });
  if (signerName) {
    const nameW = doc.getTextWidth(signerName);
    stroke(COLORS.border);
    doc.setLineWidth(0.15);
    doc.line(
      sigCenterX - nameW / 2,
      sigY + 8.5 * PT_TO_MM + 0.9,
      sigCenterX + nameW / 2,
      sigY + 8.5 * PT_TO_MM + 0.9,
    );
  }
  sigY += lineHeight(8.5, 1.3);
  setFont(6.5, 'bold');
  ink(COLORS.muted);
  doc.text(sanitize(profile.companyName || ''), sigCenterX, sigY + 6.5 * PT_TO_MM, {
    align: 'center',
  });

  paymentProofs.forEach((paymentProof, index) => {
    if (!paymentProof) return;
    doc.addPage();
    setFont(14, 'bold');
    ink(accent);
    doc.text(sanitize(proofAttachments[index].label), CONTENT_LEFT, MARGIN_TOP + 6);

    const proofMaxW = CONTENT_W;
    const proofMaxH = CONTENT_BOTTOM - MARGIN_TOP - 18;
    const ratio = paymentProof.width / paymentProof.height;
    let proofW = proofMaxW;
    let proofH = proofW / ratio;
    if (proofH > proofMaxH) {
      proofH = proofMaxH;
      proofW = proofH * ratio;
    }
    try {
      doc.addImage(
        paymentProof.dataUrl,
        'PNG',
        CONTENT_LEFT + (CONTENT_W - proofW) / 2,
        MARGIN_TOP + 14,
        proofW,
        proofH,
        undefined,
        'FAST',
      );
    } catch {
      // Abaikan lampiran bila gambar bukti tidak dapat dirender.
    }
  });

  return doc;
};

/**
 * Menghasilkan dan mengunduh PDF invoice berbasis teks/vector (tajam, A4).
 */
export const downloadInvoicePdf = async (input: InvoicePdfInput): Promise<void> => {
  const doc = await buildInvoicePdf(input);
  doc.save(buildInvoiceFileName(input.project));
};
