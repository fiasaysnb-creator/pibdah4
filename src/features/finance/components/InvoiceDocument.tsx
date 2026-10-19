import React from 'react';
import { Project, Profile, Package, Client, PaymentStatus, PhysicalItem } from '../../../types';

interface InvoiceDocumentProps {
  project: Project;
  profile: Profile;
  packages: Package[];
  client?: Client;
  issuedDate?: string;
  id?: string;
}

const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  project,
  profile,
  packages = [],
  client,
  issuedDate,
  id = "invoice-document"
}) => {
  const safeProfile = profile || ({} as Partial<Profile>);
  const safePackages = packages || [];
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [safeProfile.logoBase64]);
  // Helper to format currency (Indonesian Rupiah)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Helper to format date (Indonesian style)
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Tanpa Tanggal';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const eventDateLabel = formatDate(project.date);
  const projectNameWithoutPrefix = (project.projectName || '').replace(/^Acara Pernikahan\s+/i, '').trim();
  const displayProjectName = eventDateLabel !== 'Tanpa Tanggal' && projectNameWithoutPrefix.endsWith(eventDateLabel)
    ? projectNameWithoutPrefix.slice(0, -eventDateLabel.length).replace(/[\s,–—-]+$/, '').trim()
    : projectNameWithoutPrefix;

  const safeAddOns = Array.isArray(project.addOns) ? project.addOns : [];
  const safeAdditionalPackages = Array.isArray(project.additionalPackages) ? project.additionalPackages : [];
  const safeCustomCosts = Array.isArray(project.customCosts) ? project.customCosts : [];
  const subtotal = (Number(project.totalCost) || 0) + (Number(project.discountAmount) || 0);
  const addOnsTotal = safeAddOns.reduce((acc, curr) => acc + (Number(curr?.price) || 0), 0);
  const additionalPackagesTotal = safeAdditionalPackages.reduce((acc, packageItem) => acc + (Number(packageItem?.price) || 0), 0);
  const customCostsTotal = safeCustomCosts.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
  const packagePrice = Math.max(0, subtotal - addOnsTotal - additionalPackagesTotal - (Number(project.transportCost) || 0) - customCostsTotal);

  // Find the package description
  const mainPackage = safePackages.find(p => p.id === project.packageId || p.name === project.packageName);
  let displayTeam = '';
  let displayDigitalItems: string[] = [];
  let displayPhysicalItems: PhysicalItem[] = [];
  if (mainPackage) {
    const selectedOption = mainPackage.durationOptions?.find(opt => opt.label === project.durationSelection);
    displayTeam = selectedOption?.photographers?.trim()
      || [mainPackage.photographers, mainPackage.videographers].filter(Boolean).join(' & ');

    // Try to get from selected option first
    if (selectedOption) {
      if (selectedOption.digitalItems && selectedOption.digitalItems.length > 0) {
        displayDigitalItems = selectedOption.digitalItems;
      }
      if (selectedOption.physicalItems && selectedOption.physicalItems.length > 0) {
        displayPhysicalItems = selectedOption.physicalItems;
      }
    }

    // Fallback to main package digital items
    if (displayDigitalItems.length === 0 && mainPackage.digitalItems && mainPackage.digitalItems.length > 0) {
      displayDigitalItems = mainPackage.digitalItems;
    }

    // Fallback to main package physical items
    if (displayPhysicalItems.length === 0 && mainPackage.physicalItems && mainPackage.physicalItems.length > 0) {
      displayPhysicalItems = mainPackage.physicalItems;
    }
  }

  return (
    <div id={id} className="invoice-container invoice-document-mobile bg-white rounded-none border border-slate-200 shadow-xl overflow-visible print:shadow-none print:border-none print:bg-white print:rounded-none mx-auto w-full min-w-0 font-sans text-slate-900">
      {/* Professional Header Section */}
      <div className="invoice-header avoid-break p-2.5 sm:p-6 border-b-2 sm:border-b-4 border-brand-accent bg-slate-50 print:bg-white print:p-0 print:pt-4 print:pb-4">
        <div className="invoice-header-content flex flex-row justify-between items-start gap-2.5 sm:gap-4">
          <div className="invoice-brand-panel flex flex-col gap-1 sm:gap-2 flex-1 min-w-0 pr-1">
            {safeProfile.logoBase64 && !logoError ? (
              <img
                src={safeProfile.logoBase64}
                alt={safeProfile.companyName || 'Logo'}
                onError={() => setLogoError(true)}
                className="invoice-logo h-9 sm:h-20 w-auto max-w-[130px] sm:max-w-[220px] object-contain object-left self-start block shrink-0"
              />
            ) : (
              <div className="invoice-logo-fallback flex items-center gap-1.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-brand-accent flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs sm:text-xl">{safeProfile.companyName?.charAt(0) || 'V'}</span>
                </div>
                <h1 className="text-xs sm:text-xl font-bold text-slate-800 truncate">{safeProfile.companyName || 'Vendor'}</h1>
              </div>
            )}
            <div className="invoice-company-meta text-[7.5px] sm:text-[11px] leading-snug sm:leading-relaxed text-slate-500 max-w-full sm:max-w-[280px] break-words print:text-black">
              <p className="font-bold text-slate-700 print:text-black">{safeProfile.companyName}</p>
              <p>{safeProfile.address}</p>
              <p className="break-words">{safeProfile.phone}{safeProfile.phone && safeProfile.email ? ' • ' : ''}{safeProfile.email}</p>
            </div>
          </div>

          <div className="invoice-meta-panel text-right flex flex-col items-end shrink-0">
            <h2 className="invoice-title text-base sm:text-3xl font-black text-brand-accent tracking-tighter mb-0.5 sm:mb-1.5">INVOICE</h2>
            <div className="invoice-meta-badge bg-slate-200 px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-sm text-[7.5px] sm:text-[11px] font-bold text-slate-700 mb-1 sm:mb-2 print:bg-white print:border print:border-slate-300">
              ID: #INV-{project.id.slice(-8).toUpperCase()}
            </div>
            <div className="invoice-meta-text text-[7.5px] sm:text-[11px] text-slate-500 text-right space-y-0 sm:space-y-0.5 print:text-black">
              <p>Diterbitkan: <span className="font-bold text-slate-700 print:text-black">{formatDate(issuedDate || new Date().toISOString().slice(0, 10))}</span></p>
              <p>Status: <span className={`font-bold ${project.paymentStatus === PaymentStatus.LUNAS ? 'text-green-600' : 'text-orange-600'} print:text-black uppercase`}>{project.paymentStatus}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="invoice-body p-2.5 sm:p-6 space-y-2.5 sm:space-y-5 print:p-0 print:pt-4">
        {/* Billing Grid */}
        <div className="invoice-section avoid-break grid grid-cols-2 gap-2.5 sm:gap-6 border-b border-slate-100 pb-2.5 sm:pb-4 print:border-slate-200">
          <div>
            <h4 className="invoice-section-label text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-2 print:text-slate-500">Penerima Invoice</h4>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="invoice-party-name text-[10px] sm:text-base font-bold text-slate-800 print:text-black">{project.clientName}</p>
              {client && (
                <div className="invoice-party-meta text-[7.5px] sm:text-[11px] text-slate-600 print:text-black space-y-0 sm:space-y-0.5">
                  <p>{client.phone}</p>
                  <p>{client.email}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="invoice-section-label text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-2 print:text-slate-500">Detail Layanan</h4>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="invoice-party-name truncate text-[10px] sm:text-base font-bold text-slate-800 print:text-black" title={displayProjectName || project.projectName}>{displayProjectName || project.projectName}</p>
              <div className="invoice-party-meta grid grid-cols-2 gap-x-1.5 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 text-[7.5px] sm:text-[11px] text-slate-600 print:text-black">
                <p className="col-span-2 whitespace-nowrap"><span className="text-slate-400 font-medium">Tanggal Acara:</span> {eventDateLabel}</p>
                <p><span className="text-slate-400 font-medium">Lokasi:</span> {project.location}</p>
                <p><span className="text-slate-400 font-medium">Tipe:</span> {project.projectType}</p>
                {project.address && <p className="col-span-2"><span className="text-slate-400 font-medium">Alamat:</span> {project.address}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Item Table */}
        <div className="invoice-table-wrapper mb-2.5 sm:mb-6">
          <table className="invoice-table-tight w-full text-left">
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '68%' }} />
              <col style={{ width: '24%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 border-b border-black print:bg-slate-50">
                <th className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-[7px] sm:text-[10px] font-black text-black uppercase tracking-widest border-r border-black">No</th>
                <th className="px-1.5 py-1 sm:px-3 sm:py-2 text-[7px] sm:text-[10px] font-black text-black uppercase tracking-widest border-r border-black">Deskripsi Produk / Layanan</th>
                <th className="px-1.5 py-1 sm:px-3 sm:py-2 text-right text-[7px] sm:text-[10px] font-black text-black uppercase tracking-widest">Total Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black print:divide-black text-[8px] sm:text-[12px]">
              <tr className="align-top bg-white">
                <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-slate-800 font-medium border-r border-black align-top">1</td>
                <td className="px-1.5 py-1 sm:px-3 sm:py-2 border-r border-black align-top">
                  <div className="invoice-desc-box m-0 p-0 block">
                    <p className="invoice-item-title invoice-item-title-main font-bold text-slate-800 text-[8.5px] sm:text-[13px] print:text-black m-0 p-0">{project.packageName}</p>
                    {displayTeam && (
                      <p className="invoice-item-sub text-[7px] sm:text-[10px] text-slate-500 leading-tight flex items-start gap-1">
                        <span className="shrink-0">•</span>
                        <span>{displayTeam}</span>
                      </p>
                    )}
                    {displayDigitalItems.length > 0 ? (
                      <div className="mt-0.5 sm:mt-1 space-y-0 sm:space-y-0.5">
                        {displayDigitalItems.map((item, idx) => (
                          <p key={idx} className="invoice-item-sub text-[7px] sm:text-[10px] text-slate-500 leading-tight flex items-start gap-1">
                            <span className="shrink-0">•</span>
                            <span>{item}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="invoice-item-sub text-[7px] sm:text-[10px] text-slate-500 mt-0.5 italic">Package utama layanan profesional</p>
                    )}

                    {displayPhysicalItems.length > 0 && (
                      <div className="mt-1 pt-1 sm:mt-1.5 sm:pt-1.5 border-t border-slate-200 space-y-0 sm:space-y-0.5">
                        <p className="invoice-item-tag text-[6.5px] sm:text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Vendor (Allpackage):</p>
                        {displayPhysicalItems.map((item, idx) => (
                          <p key={idx} className="invoice-item-sub text-[7px] sm:text-[10px] text-slate-500 leading-tight flex items-start gap-1">
                            <span className="shrink-0">•</span>
                            <span>{item.name}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-right font-bold text-slate-800 text-[8px] sm:text-[12px] whitespace-nowrap print:text-black align-top">{formatCurrency(packagePrice)}</td>
              </tr>
              {safeAdditionalPackages.map((packageItem, idx) => {
                const additionalPackage = safePackages.find(item => item.id === packageItem.id || item.name === packageItem.name);
                const deliverables = [
                  ...(additionalPackage?.digitalItems || []),
                  ...(additionalPackage?.physicalItems || []).map(item => item.name),
                ].filter(Boolean);

                return (
                  <tr key={packageItem.id || `additional-package-${idx}`} className="align-top bg-white">
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-slate-800 font-medium border-r border-black align-top">{2 + idx}</td>
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 border-r border-black align-top">
                      <div className="invoice-desc-box m-0 p-0 block">
                        <p className="invoice-item-title invoice-item-title-main font-bold text-slate-800 text-[8.5px] sm:text-[13px] print:text-black m-0 p-0">{packageItem.name || additionalPackage?.name}</p>
                        {deliverables.length > 0 && (
                          <div className="mt-0.5 sm:mt-1 space-y-0 sm:space-y-0.5">
                            {deliverables.map((item, itemIndex) => (
                              <p key={`${packageItem.id}-${itemIndex}`} className="invoice-item-sub text-[7px] sm:text-[10px] text-slate-500 leading-tight flex items-start gap-1">
                                <span className="shrink-0">•</span>
                                <span>{item}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-right font-medium text-slate-800 text-[8px] sm:text-[12px] whitespace-nowrap print:text-black align-top">{formatCurrency(Number(packageItem.price) || 0)}</td>
                  </tr>
                );
              })}
              {safeAddOns.map((addon, idx) => (
                <tr key={addon.id || idx} className="align-top bg-white">
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-slate-800 font-medium border-r border-black align-top">{2 + safeAdditionalPackages.length + idx}</td>
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 border-r border-black align-top">
                    <div className="invoice-desc-box m-0 p-0 block">
                      <p className="invoice-item-title font-medium text-slate-800 text-[8px] sm:text-[12px] print:text-black m-0 p-0">{addon.name}</p>
                      <span className="invoice-item-tag block text-[6.5px] sm:text-[9px] text-slate-500 uppercase font-bold tracking-tight mt-0.5">Add-on Item</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-right font-medium text-slate-800 text-[8px] sm:text-[12px] whitespace-nowrap print:text-black align-top">{formatCurrency(addon.price)}</td>
                </tr>
              ))}
              {project.transportCost && Number(project.transportCost) > 0 && (
                <tr className="align-top bg-white">
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-slate-800 font-medium border-r border-black align-top">{safeAdditionalPackages.length + safeAddOns.length + 2}</td>
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 border-r border-black align-top">
                    <div className="invoice-desc-box m-0 p-0 block">
                      <p className="invoice-item-title font-medium text-slate-800 text-[8px] sm:text-[12px] print:text-black m-0 p-0">Biaya Transport</p>
                      <span className="invoice-item-tag block text-[6.5px] sm:text-[9px] text-slate-500 uppercase font-bold tracking-tight mt-0.5">Logistik & Operasional</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-right font-medium text-slate-800 text-[8px] sm:text-[12px] whitespace-nowrap print:text-black align-top">{formatCurrency(Number(project.transportCost))}</td>
                </tr>
              )}
              {safeCustomCosts.map((cost, idx) => {
                const transportOffset = (project.transportCost && Number(project.transportCost) > 0) ? 1 : 0;
                const rowNo = 2 + safeAdditionalPackages.length + safeAddOns.length + transportOffset + idx;
                return (
                  <tr key={cost.id || idx} className="align-top bg-white">
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-center text-slate-800 font-medium border-r border-black align-top">{rowNo}</td>
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 border-r border-black align-top">
                      <div className="invoice-desc-box m-0 p-0 block">
                        <p className="invoice-item-title font-medium text-slate-800 text-[8px] sm:text-[12px] print:text-black m-0 p-0">{cost.description}</p>
                      </div>
                    </td>
                    <td className="px-1.5 py-1 sm:px-3 sm:py-2 text-right font-medium text-slate-800 text-[8px] sm:text-[12px] whitespace-nowrap print:text-black align-top">{formatCurrency(cost.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        <div className="invoice-totals avoid-break flex flex-row justify-between items-start gap-2 sm:gap-4 border-t border-slate-100 pt-2.5 sm:pt-4 print:border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="invoice-payment-box bg-slate-50 p-2 sm:p-3.5 rounded border border-slate-100 print:bg-white print:border-slate-200">
              <h5 className="invoice-section-label text-[7px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5 sm:mb-1.5">Informasi Pembayaran</h5>
              <p className="invoice-bank-text text-[8px] sm:text-[12px] font-bold text-slate-800 mb-0.5 sm:mb-1 print:text-black">{safeProfile.bankAccount}</p>
              <p className="invoice-payment-note text-[7px] sm:text-[10px] text-slate-500 leading-snug sm:leading-relaxed print:text-black">Silakan kirimkan bukti transfer melalui Whatsapp atau Portal Client setelah melakukan pembayaran.</p>
            </div>
            <div className="invoice-terms mt-1.5 sm:mt-2.5 text-[6.5px] sm:text-[9.5px] text-slate-400 italic leading-snug sm:leading-relaxed print:text-slate-500 whitespace-pre-line">
              &quot;{safeProfile.termsAndConditions || 'Terima kasih telah mempercayai layanan kami. Kepuasan Anda adalah prioritas kami.'}&quot;
            </div>
          </div>

          <div className="invoice-total-panel w-[140px] sm:w-[280px] shrink-0 space-y-1 sm:space-y-1.5">
            <div className="invoice-total-row flex justify-between text-[8px] sm:text-[12px] text-slate-600 px-1.5 sm:px-2 print:text-black">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {project.discountAmount ? (
              <div className="invoice-total-row flex justify-between text-[8px] sm:text-[12px] text-red-600 px-1.5 sm:px-2 font-medium">
                <span>Diskon</span>
                <span>-{formatCurrency(project.discountAmount)}</span>
              </div>
            ) : null}
            <div className="h-px bg-slate-200 my-0.5 sm:my-1" />
            <div className="invoice-grand-total flex justify-between items-center px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-slate-100 rounded print:bg-white print:border print:border-slate-200">
              <span className="invoice-total-label text-[7px] sm:text-[11px] font-black text-slate-600 uppercase print:text-black">Grand Total</span>
              <span className="invoice-grand-val text-[9.5px] sm:text-lg font-black text-brand-accent print:text-black tracking-tight">{formatCurrency(project.totalCost)}</span>
            </div>
            <div className="invoice-total-row flex justify-between text-[7.5px] sm:text-[11px] text-green-600 px-1.5 sm:px-2 pt-0.5 font-bold">
              <span>Sudah Dibayar</span>
              <span>{formatCurrency(project.amountPaid || 0)}</span>
            </div>
            <div className="invoice-balance-due flex justify-between items-center px-1.5 py-1 sm:px-2.5 sm:py-1.5 border sm:border-2 border-brand-accent/20 rounded-md mt-0.5 sm:mt-1 bg-brand-accent/5 print:bg-white print:border-slate-800">
              <span className="invoice-total-label text-[7px] sm:text-[11px] font-black text-brand-accent uppercase print:text-black">Sisa Pembayaran</span>
              <span className="invoice-balance-val text-[9px] sm:text-base font-black text-brand-accent print:text-black tracking-tight">{formatCurrency(project.totalCost - (project.amountPaid || 0))}</span>
            </div>
          </div>
        </div>

        {/* Footer / Signatures */}
        <div className="invoice-signature-section avoid-break grid grid-cols-3 gap-2 sm:gap-6 pt-2.5 sm:pt-4 border-t border-slate-100 print:border-slate-200">
          <div className="col-span-2 flex items-end justify-center pb-1 sm:pb-2">
            <p className="invoice-footer-note text-[6.5px] sm:text-[9px] text-slate-400 text-center uppercase tracking-widest font-black">Dicetak Otomatis Vena Pictures</p>
          </div>
          <div className="text-center flex flex-col items-center">
            <p className="invoice-section-label text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Hormat Kami,</p>
            <div className="invoice-signature-box h-10 sm:h-14 w-full flex items-center justify-center">
              {(project.invoiceSignature || safeProfile.signatureBase64) ? (
                <img
                  src={project.invoiceSignature || safeProfile.signatureBase64}
                  alt="Tanda Tangan"
                  className="invoice-signature-img h-9 sm:h-14 w-auto max-w-full object-contain grayscale mx-auto block"
                />
              ) : (
                <div className="h-px w-14 sm:w-24 bg-slate-200 mx-auto mt-3 sm:mt-6 print:bg-slate-300" />
              )}
            </div>
            <p className="invoice-signer-name text-[8px] sm:text-[12px] font-bold text-slate-800 mt-1 sm:mt-1.5 print:text-black underline underline-offset-2 sm:underline-offset-4 decoration-slate-300">{safeProfile.authorizedSigner}</p>
            <p className="invoice-footer-note text-[6.5px] sm:text-[9px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter">{safeProfile.companyName}</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        /* Explicitly style and protect the invoice document from outside index.css pollution */
        #${id}, .invoice-container {
          width: 100% !important;
          max-width: 800px;
          box-sizing: border-box !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
          overflow: visible !important;
        }
        .force-desktop,
        .html2pdf__container #${id},
        .html2pdf__container .invoice-container {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border-left: none !important;
          border-right: none !important;
          overflow: visible !important;
        }
        #${id} *, .invoice-container * {
          box-sizing: border-box !important;
        }
        #${id} .invoice-table-wrapper, .invoice-container .invoice-table-wrapper {
          page-break-inside: auto !important;
          break-inside: auto !important;
          overflow: visible !important;
          border: none !important;
        }
        #${id} table, .invoice-container table {
          border-collapse: collapse !important;
          border: 1.5px solid #000000 !important;
          width: 100% !important;
          table-layout: fixed !important;
          background-color: #ffffff !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
        #${id} thead, .invoice-container thead {
          display: table-header-group !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #${id} thead tr, .invoice-container thead tr {
          background-color: #f8fafc !important;
          border-bottom: 1.5px solid #000000 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #${id} thead th, .invoice-container thead th {
          background-color: #f8fafc !important;
          border: 1px solid #000000 !important;
          border-top: none !important;
          padding: 7px 10px !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          color: #000000 !important;
          vertical-align: top !important;
        }
        #${id} tbody, .invoice-container tbody {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
        #${id} tbody tr, .invoice-container tbody tr {
          background-color: #ffffff !important;
          border-bottom: 1px solid #000000 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          vertical-align: top !important;
        }
        #${id} tbody tr:nth-child(even), .invoice-container tbody tr:nth-child(even) {
          background-color: #ffffff !important;
        }
        #${id} {
          width: 100% !important;
          max-width: 800px;
          box-sizing: border-box !important;
          background-color: #ffffff !important;
        }
        .force-desktop,
        .html2pdf__container #${id} {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
        }
        #${id} tbody td, .invoice-container tbody td {
          border: 1px solid #000000 !important;
          padding: 6px 10px !important;
          padding-top: 6px !important;
          padding-bottom: 6px !important;
          background-color: #ffffff !important;
          vertical-align: top !important;
          color: #000000 !important;
          line-height: 1.15 !important;
        }
        #${id} p, .invoice-container p {
          margin: 0 !important;
          line-height: 1.35 !important;
        }
        #${id} tbody td .invoice-desc-box,
        .invoice-container tbody td .invoice-desc-box {
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
        }
        #${id} tbody td .invoice-item-title,
        .invoice-container tbody td .invoice-item-title {
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.15 !important;
          display: block !important;
        }
        #${id} tbody td .invoice-item-title-main,
        .invoice-container tbody td .invoice-item-title-main {
          line-height: 1.08 !important;
        }
        #${id} tbody td .invoice-item-sub,
        .invoice-container tbody td .invoice-item-sub {
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.25 !important;
        }
        #${id} tbody td .invoice-item-tag,
        .invoice-container tbody td .invoice-item-tag {
          margin-top: 2px !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          line-height: 1.15 !important;
          display: block !important;
        }
        @media (max-width: 768px) {
          #${id}:not(.force-desktop) {
            overflow: hidden !important;
          }
          #${id}:not(.force-desktop) .invoice-header {
            padding: 10px 12px !important;
          }
          #${id}:not(.force-desktop) .invoice-header-content {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 8px !important;
            width: 100% !important;
          }
          #${id}:not(.force-desktop) .invoice-brand-panel {
            flex: 1 1 0% !important;
            min-width: 0 !important;
            width: auto !important;
            max-width: 56% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          #${id}:not(.force-desktop) .invoice-meta-panel {
            flex: 0 0 auto !important;
            width: auto !important;
            max-width: 44% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-end !important;
            text-align: right !important;
          }
          #${id}:not(.force-desktop) .invoice-body {
            padding: 10px 12px !important;
          }
          #${id}:not(.force-desktop) .invoice-logo {
            display: block !important;
            height: 32px !important;
            max-height: 32px !important;
            width: auto !important;
            max-width: 120px !important;
            object-fit: contain !important;
            object-position: left center !important;
            margin-bottom: 2px !important;
          }
          #${id}:not(.force-desktop) .invoice-title {
            font-size: 14px !important;
            line-height: 1.1 !important;
            color: var(--color-accent, #3b82f6) !important;
            text-align: right !important;
            margin-bottom: 3px !important;
          }
          #${id}:not(.force-desktop) .invoice-meta-badge {
            font-size: 7px !important;
            padding: 2px 6px !important;
            white-space: nowrap !important;
            margin-bottom: 3px !important;
          }
          #${id}:not(.force-desktop) .invoice-company-meta {
            width: 100% !important;
            max-width: 100% !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
          }
          #${id}:not(.force-desktop) .invoice-company-meta p {
            font-size: 7px !important;
            line-height: 1.35 !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
          }
          #${id}:not(.force-desktop) .invoice-meta-text {
            text-align: right !important;
            width: 100% !important;
          }
          #${id}:not(.force-desktop) .invoice-meta-text p,
          #${id}:not(.force-desktop) .invoice-meta-text span {
            font-size: 7px !important;
            line-height: 1.35 !important;
            white-space: nowrap !important;
            text-align: right !important;
          }
          #${id}:not(.force-desktop) .invoice-section {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
            padding-bottom: 8px !important;
          }
          #${id}:not(.force-desktop) .invoice-section > div {
            min-width: 0 !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
          }
          #${id}:not(.force-desktop) .invoice-party-meta p,
          #${id}:not(.force-desktop) .invoice-party-meta span {
            font-size: 7px !important;
            line-height: 1.3 !important;
          }
          #${id}:not(.force-desktop) .invoice-section-label {
            font-size: 6.5px !important;
            line-height: 1.2 !important;
          }
          #${id}:not(.force-desktop) .invoice-party-name {
            font-size: 9.5px !important;
            line-height: 1.25 !important;
          }
          #${id}:not(.force-desktop) .invoice-table-wrapper {
            overflow-x: hidden !important;
            display: block !important;
            width: 100% !important;
            margin-bottom: 10px !important;
          }
          #${id}:not(.force-desktop) table {
            table-layout: fixed !important;
            min-width: 0 !important;
            width: 100% !important;
            font-size: 7.5px !important;
            border: 1px solid #000000 !important;
          }
          #${id}:not(.force-desktop) thead th,
          #${id}:not(.force-desktop) tbody td {
            font-size: 7.5px !important;
            padding: 3.5px 5px !important;
            padding-top: 3.5px !important;
            padding-bottom: 3.5px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
          }
          #${id}:not(.force-desktop) thead th {
            font-size: 7px !important;
            letter-spacing: 0.03em !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-item-title {
            font-size: 8px !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #${id}:not(.force-desktop) .invoice-item-title-main {
            line-height: 1.1 !important;
          }
          #${id}:not(.force-desktop) .invoice-item-sub {
            font-size: 6.5px !important;
            line-height: 1.25 !important;
          }
          #${id}:not(.force-desktop) .invoice-item-tag {
            font-size: 6px !important;
            line-height: 1.15 !important;
          }
          #${id}:not(.force-desktop) tbody td:first-child {
            width: 8% !important;
          }
          #${id}:not(.force-desktop) tbody td:nth-child(2) {
            width: 66% !important;
          }
          #${id}:not(.force-desktop) tbody td:nth-child(3) {
            width: 26% !important;
            white-space: nowrap !important;
            text-align: right !important;
            font-size: 7.5px !important;
          }
          #${id}:not(.force-desktop) .invoice-totals {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 8px 0 0 0 !important;
            background: transparent !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-radius: 0 !important;
            margin-bottom: 0 !important;
          }
          #${id}:not(.force-desktop) .invoice-payment-box {
            padding: 6px 8px !important;
          }
          #${id}:not(.force-desktop) .invoice-bank-text {
            font-size: 7.5px !important;
            line-height: 1.25 !important;
          }
          #${id}:not(.force-desktop) .invoice-payment-note {
            font-size: 6.5px !important;
            line-height: 1.25 !important;
          }
          #${id}:not(.force-desktop) .invoice-terms {
            font-size: 6px !important;
            line-height: 1.25 !important;
          }
          #${id}:not(.force-desktop) .invoice-total-panel {
            width: 43% !important;
            min-width: 132px !important;
            max-width: 165px !important;
          }
          #${id}:not(.force-desktop) .invoice-total-row,
          #${id}:not(.force-desktop) .invoice-grand-total,
          #${id}:not(.force-desktop) .invoice-balance-due {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-total-row,
          #${id}:not(.force-desktop) .invoice-total-row span {
            font-size: 7px !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-total-label {
            font-size: 6.5px !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-grand-val {
            font-size: 8.5px !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-balance-val {
            font-size: 8px !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
          }
          #${id}:not(.force-desktop) .invoice-signature-section {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
            padding: 8px 0 0 0 !important;
            box-shadow: none !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-radius: 0 !important;
          }
          #${id}:not(.force-desktop) .invoice-signature-box {
            height: 36px !important;
            min-height: 36px !important;
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          #${id}:not(.force-desktop) .invoice-signature-img {
            display: block !important;
            height: 32px !important;
            max-height: 32px !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
            margin: 0 auto !important;
          }
          #${id}:not(.force-desktop) .invoice-signer-name {
            font-size: 7.5px !important;
            line-height: 1.2 !important;
          }
          #${id}:not(.force-desktop) .invoice-footer-note {
            font-size: 6px !important;
            line-height: 1.2 !important;
          }
        }
        .avoid-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .html2pdf-pad-row td {
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
        }

        @media print {
          @page {
            margin: 6mm 8mm !important;
            size: A4 portrait;
          }
          body * { 
            visibility: hidden !important; 
          }
          #${id}, #${id} * { 
            visibility: visible !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #${id} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}} />
    </div>
  );
};

export default InvoiceDocument;
