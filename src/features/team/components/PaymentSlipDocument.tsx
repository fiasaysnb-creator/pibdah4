import React from 'react';
import { TeamPaymentRecord, TeamMember, TeamProjectPayment, Project, Profile } from '../../../types';

export interface PaymentSlipDocumentProps {
    record: TeamPaymentRecord;
    teamMembers: TeamMember[];
    teamProjectPayments: TeamProjectPayment[];
    projects: Project[];
    userProfile: Profile;
}

export const PaymentSlipDocument: React.FC<PaymentSlipDocumentProps> = ({
    record,
    teamMembers,
    teamProjectPayments,
    projects,
    userProfile,
}) => {
    const member = teamMembers.find(m => m.id === record.teamMemberId);
    if (!member) return null;
    const projectsBeingPaid = teamProjectPayments.filter(p => record.projectPaymentIds.includes(p.id));

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div id={`payment-slip-content-${record.id}`} className="printable-content bg-white font-sans text-slate-900 printable-area max-w-[800px] min-w-0 w-full mx-auto">
            {/* Accent Border Top */}
            <div className="h-2 bg-brand-accent w-full"></div>

            <div className="p-4 sm:p-8">
                {/* Header Section */}
                <header className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-4 border-b border-slate-100 gap-4">
                    <div className="flex flex-col gap-2">
                        {userProfile.logoBase64 ? (
                            <img src={userProfile.logoBase64} alt="Company Logo" crossOrigin="anonymous" className="payment-slip-logo object-contain self-start" style={{ maxHeight: '40pt', maxWidth: '100pt', height: 'auto', width: 'auto' }} />
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">{userProfile.companyName?.charAt(0) || 'V'}</span>
                                </div>
                                <h1 className="text-lg font-bold text-slate-800">{userProfile.companyName}</h1>
                            </div>
                        )}
                        <div className="text-[10px] leading-relaxed text-slate-500 max-w-[200px]">
                            <p className="font-bold text-slate-700">{userProfile.companyName}</p>
                            <p>{userProfile.address}</p>
                            <p>{userProfile.phone}</p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <h2 className="text-2xl font-black text-brand-accent tracking-tighter mb-1">Bukti &amp; Invoice</h2>
                        <div className="inline-block bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 mb-2">
                            #{record.recordNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                            <p>Tanggal: <span className="font-bold text-slate-700">{formatDate(record.date)}</span></p>
                            <p>Metode: <span className="font-bold text-slate-700">Transfer</span></p>
                        </div>
                    </div>
                </header>

                {/* Recipient & Payer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-xl border border-slate-100">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Penerima</h4>
                        <div className="space-y-0.5">
                            <p className="text-base font-bold text-slate-800">{member.name}</p>
                            <div className="text-[11px] text-slate-600">
                                <p className="font-medium text-brand-accent">{member.role}</p>
                                <p>Rek: {member.noRek || '-'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-100">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Sumber</h4>
                        <div className="space-y-0.5">
                            <p className="text-base font-bold text-slate-800">{userProfile.companyName}</p>
                            <div className="text-[11px] text-slate-600">
                                <p>Rek: {userProfile.bankAccount || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Items Table */}
                <div className="mb-8 overflow-hidden">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Rincian</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-2 py-2 font-black text-slate-600 uppercase">Deskripsi</th>
                                    <th className="px-2 py-2 font-black text-slate-600 uppercase text-right">Fee</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {projectsBeingPaid.map((p) => {
                                    const project = projects.find(proj => proj.id === p.projectId);
                                    return (
                                        <tr key={p.id}>
                                            <td className="px-2 py-3">
                                                <p className="font-bold text-slate-800">{project?.projectName || 'Acara Selesai'}</p>
                                                <p className="text-[9px] text-slate-500">{project?.team.find(t => t.memberId === member.id)?.role}</p>
                                            </td>
                                            <td className="px-2 py-3 text-right font-bold text-slate-800">{formatCurrency(p.fee)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-200">
                                    <td className="px-2 py-3 text-right font-black text-slate-500 uppercase">Total</td>
                                    <td className="px-2 py-3 text-right text-lg font-black text-brand-accent">{formatCurrency(record.totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer / Signatures */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-slate-100 gap-6 avoid-break">
                    <div className="text-[9px] text-slate-400 italic text-center sm:text-left">
                        Slip dicetak otomatis untuk {member.name} - {formatDate(record.date)}
                    </div>

                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Verifikator,</p>
                        <div className="h-10 flex items-center justify-center mb-1">
                            {record.vendorSignature ? (
                                <img src={record.vendorSignature} alt="Tanda Tangan" crossOrigin="anonymous" className="object-contain" style={{ width: '100px', height: '32px' }} />
                            ) : userProfile.signatureBase64 ? (
                                <img src={userProfile.signatureBase64} alt="Tanda Tangan" crossOrigin="anonymous" className="object-contain" style={{ width: '100px', height: '32px' }} />
                            ) : (
                                <div className="h-px w-20 bg-slate-300" />
                            )}
                        </div>
                        <p className="text-xs font-bold text-slate-800">{userProfile.authorizedSigner || userProfile.companyName}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSlipDocument;
