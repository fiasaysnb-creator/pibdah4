export interface PDFBlobOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    pagebreak?: any;
    windowWidth?: number;
    scale?: number;
}

export const generatePDFBlob = async (
    elementId: string,
    filename: string,
    options?: PDFBlobOptions
): Promise<Blob> => {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element with id ${elementId} not found`);
    }

    const safeMargin: [number, number, number, number] =
        options?.margin !== undefined
            ? Array.isArray(options.margin)
                ? [options.margin[0], options.margin[1], options.margin[2], options.margin[3]]
                : [options.margin, options.margin, options.margin, options.margin]
            : [12, 12, 12, 12];
    const printableWidthPx = Math.round(((210 - safeMargin[1] - safeMargin[3]) / 25.4) * 96);

    const opt: any = {
        margin: safeMargin,
        filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: options?.scale || 1.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            windowWidth: options?.windowWidth || 794,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc: any) => {
                const el = clonedDoc.getElementById(elementId);
                if (el) {
                    el.style.opacity = '1';
                    el.style.visibility = 'visible';
                    el.style.transform = 'none';
                    el.style.width = `${printableWidthPx}px`;
                    el.style.maxWidth = `${printableWidthPx}px`;
                    el.style.minWidth = '0';
                    el.style.margin = '0 auto';
                    el.style.boxSizing = 'border-box';
                    el.style.boxShadow = 'none';
                    el.style.overflow = 'visible';
                    el.style.height = 'auto';
                    el.style.maxHeight = 'none';
                    el.style.padding = '0';
                    el.classList.add('force-desktop');

                    const parent = el.parentElement;
                    if (parent) {
                        parent.style.opacity = '1';
                        parent.style.visibility = 'visible';
                        parent.style.overflow = 'visible';
                        parent.style.maxHeight = 'none';
                        parent.style.height = 'auto';
                    }
                }

                try {
                    clonedDoc.body.style.height = 'auto';
                    clonedDoc.body.style.maxHeight = 'none';
                    clonedDoc.body.style.overflow = 'visible';
                    clonedDoc.body.style.margin = '0';
                } catch (e) {
                    // no-op
                }

                const wrappers = clonedDoc.querySelectorAll('.pdf-page-wrapper, .modal-content-area, [class*="max-h-"], [class*="overflow-hidden"], [class*="max-height"]');
                wrappers.forEach((w: HTMLElement) => {
                    try {
                        w.style.maxHeight = 'none';
                        w.style.height = 'auto';
                        w.style.overflow = 'visible';
                        w.style.boxShadow = 'none';
                    } catch (e) {
                        // no-op
                    }
                });

                const container = clonedDoc.querySelector('.html2pdf__container');
                if (container) {
                    container.style.boxSizing = 'border-box';
                    container.style.overflow = 'visible';
                    container.style.maxHeight = 'none';
                    container.style.height = 'auto';
                }

                try {
                    const style = clonedDoc.createElement('style');
                    style.type = 'text/css';
                    style.appendChild(clonedDoc.createTextNode(`
                        html, body {
                          margin: 0 !important;
                          padding: 0 !important;
                          width: 100% !important;
                          height: auto !important;
                          max-height: none !important;
                          overflow: visible !important;
                        }
                        .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
                        .section-title {
                          page-break-after: avoid !important;
                          break-after: avoid !important;
                          page-break-inside: avoid !important;
                          break-inside: avoid !important;
                        }
                                                .contract-document,
                        .document-page,
                        .page,
                        .pdf-page {
                                                    width: ${printableWidthPx}px !important;
                                                    max-width: ${printableWidthPx}px !important;
                          min-width: 0 !important;
                          overflow: visible !important;
                          max-height: none !important;
                          height: auto !important;
                          box-sizing: border-box !important;
                        }
                        .html2pdf__container {
                          overflow: visible !important;
                          max-height: none !important;
                          height: auto !important;
                        }
                        p, li, td, th {
                          orphans: 2;
                          widows: 2;
                          overflow-wrap: anywhere;
                          word-break: break-word;
                        }
                    `));
                    clonedDoc.head.appendChild(style);
                } catch (e) {
                    // no-op
                }
            }
        },
        pagebreak: {
            mode: options?.pagebreak?.mode || ['css', 'legacy'],
            before: options?.pagebreak?.before || ['.page-break'],
            avoid: options?.pagebreak?.avoid || ['tr', '.avoid-break', 'thead', 'tbody']
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    const html2pdfModule: any = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;
    const worker = html2pdf().from(element).set(opt);
    try {
        const blob: Blob = await worker.output('blob');
        return blob;
    } finally {
        worker.prop?.overlay?.remove();
    }
};
