import React, { useState, useEffect } from 'react';
import { Contract, Project, Profile } from '../../../types';
import ContractDocument from '../../contracts/components/ContractDocument';
import { DownloadIcon } from '../../../constants';
import { getContract, updateContract } from '../../../services/contracts';
import { getProjectWithRelations } from '../../../services/projects';
import { getPublicProfile } from '../../../services/profile';
import Modal from '../../../shared/ui/Modal';
import SignaturePad from '../../../shared/ui/SignaturePad';
import PDFViewer from '../../../shared/ui/PDFViewer';
import { generatePDFBlob } from '../../../shared/utils/pdfUtils';
import { downloadContractPdf } from '../../contracts/utils/contractPdf';
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh';

interface PublicContractProps {
    contractId: string;
}

const PublicContract: React.FC<PublicContractProps> = ({ contractId }) => {
    const [contract, setContract] = useState<Contract | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);

    useSupabaseRealtimeRefresh('public-contract', ['contracts', 'projects', 'project_add_ons', 'profiles'], () => {
        setRefreshVersion(version => version + 1);
    }, { realtime: false, refreshOnFocus: false });

    useEffect(() => {
        if (!contractId) {
            setError('ID kontrak tidak valid.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchData = async () => {
            try {
                setError(null);

                const fetchedContract = await getContract(contractId);
                
                if (cancelled) return;

                if (!fetchedContract) {
                    setError('Kontrak tidak ditemukan.');
                    setLoading(false);
                    return;
                }

                setContract(fetchedContract);

                const [fetchedProject, fetchedProfile] = await Promise.all([
                    getProjectWithRelations(fetchedContract.projectId),
                    getPublicProfile(),
                ]);

                if (cancelled) return;

                if (!fetchedProject) {
                    setError('Data acara terkait tidak ditemukan.');
                    setLoading(false);
                    return;
                }

                setProject(fetchedProject);
                setProfile(fetchedProfile);
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[PublicContract] Fetch error:', err);
                    setError('Terjadi kesalahan saat memuat kontrak. Coba lagi nanti.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [contractId, refreshVersion]);

    const handleGeneratePreview = async () => {
        if (!contract) return;
        setIsGenerating(true);
        try {
            const blob = await generatePDFBlob(
                'contract-document',
                `kontrak-${contract.contractNumber || 'digital'}.pdf`,
                {
                    margin: [15, 15, 20, 15],
                    windowWidth: 800,
                    pagebreak: { mode: ['css', 'legacy'] }
                }
            );
            setPdfBlob(blob);
        } catch (err) {
            console.error('[PublicContract] Error generating preview:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (contract && project && profile && !loading) {
            const timer = setTimeout(() => {
                handleGeneratePreview();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [contract, project, profile, loading]);

    const handleDownloadPDF = async () => {
        if (!contract || !project || !profile) return;

        // Ekspor PDF vector (teks tajam, multi-halaman) dibangun ulang dari data,
        // bukan screenshot DOM seperti jalur lama.
        try {
            await downloadContractPdf({ contract, project, profile });
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            window.print();
        }
    };

    const handleSaveSignature = async (signatureDataUrl: string) => {
        if (!contract) return;
        setIsSaving(true);
        try {
            const updated = await updateContract(contract.id, { clientSignature: signatureDataUrl });
            setContract(updated);
            setIsSignatureModalOpen(false);
            // Re-generate preview with new signature
            setTimeout(() => {
                handleGeneratePreview();
            }, 400);
            alert('Tanda tangan berhasil disimpan! Terima kasih.');
        } catch (err: any) {
            console.error('[PublicContract] Save signature error:', err);
            alert('Gagal menyimpan tanda tangan. Mohon coba lagi.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative flex justify-center items-center">
                        <div className="absolute border-4 border-brand-accent/20 rounded-full w-16 h-16"></div>
                        <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-16 h-16"></div>
                    </div>
                    <p className="text-sm font-medium text-brand-text-secondary animate-pulse">Memuat kontrak...</p>
                </div>
            </div>
        );
    }

    if (error || !contract || !project || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12">
                <div className="max-w-md w-full bg-brand-surface p-8 rounded-2xl border border-brand-border/50 shadow-xl text-center">
                    <div className="w-16 h-16 bg-brand-danger/10 text-brand-danger rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-brand-text-light tracking-tight mb-2">Kontrak Tidak Ditemukan</h2>
                    <p className="text-brand-text-secondary mb-6 leading-relaxed">
                        {error || 'Mohon maaf, data kontrak tidak dapat ditemukan.'}
                    </p>
                    <button
                        onClick={() => window.location.hash = '#/'}
                        className="w-full py-3 px-6 bg-brand-accent hover:bg-brand-accent-hover text-white font-bold rounded-xl shadow-lg shadow-brand-accent/20 transition-all"
                    >
                        Kembali ke Beranda
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-bg py-3 sm:py-12 px-0 sm:px-4 print:bg-white print:p-0 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 sm:mb-8 px-4 sm:px-0 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                        <div>
                            <h1 className="text-xl font-black text-brand-text-light tracking-tight">Kontrak Kerjasama</h1>
                            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest">{profile.companyName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!contract.clientSignature && (
                            <button
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-brand-accent hover:bg-brand-accent-hover text-white font-bold rounded-xl shadow-lg shadow-brand-accent/20 transition-all group"
                            >
                                <span>Tandatangani</span>
                            </button>
                        )}
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all group"
                        >
                            <DownloadIcon className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                            <span>Unduh PDF</span>
                        </button>
                    </div>
                </div>

                {/* Hidden Document for PDF Generation */}
                <div style={{ position: 'fixed', left: 0, top: 0, zIndex: -9999, opacity: 0, pointerEvents: 'none', width: '800px' }}>
                    <ContractDocument
                        id="contract-document"
                        contract={contract}
                        project={project}
                        profile={profile}
                    />
                </div>

                {/* PDF Viewer Canvas */}
                <div className="bg-brand-surface rounded-none sm:rounded-3xl shadow-none sm:shadow-xl overflow-hidden min-h-[500px]">
                    {isGenerating && !pdfBlob ? (
                        <div className="flex flex-col items-center justify-center py-32">
                            <div className="animate-spin border-4 border-brand-accent/20 border-t-brand-accent rounded-full w-12 h-12 mb-4"></div>
                            <p className="text-sm font-medium text-brand-text-secondary italic">Menyiapkan pratinjau dokumen PDF...</p>
                        </div>
                    ) : (
                        pdfBlob && <PDFViewer pdfBlob={pdfBlob} className="bg-white p-0 rounded-none shadow-none" />
                    )}

                    {!pdfBlob && !isGenerating && (
                        <div className="flex flex-col items-center justify-center py-32 text-brand-text-secondary">
                            <div className="animate-pulse w-48 h-64 bg-slate-800/10 rounded-xl mb-4"></div>
                            <p className="text-sm font-medium animate-pulse">Memuat pratinjau...</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center no-print">
                    <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} {profile.companyName} • Digital Business System
                    </p>
                </div>
            </div>

            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title="Bubuhkan Tanda Tangan Anda"
                size="md"
            >
                {isSaving ? (
                    <div className="py-12 flex flex-col items-center gap-4">
                        <div className="animate-spin border-4 border-brand-accent/20 border-t-brand-accent rounded-full w-12 h-12"></div>
                        <p className="text-sm font-bold text-brand-text-secondary">Menyimpan tanda tangan...</p>
                    </div>
                ) : (
                    <SignaturePad
                        onClose={() => setIsSignatureModalOpen(false)}
                        onSave={handleSaveSignature}
                    />
                )}
            </Modal>
        </div>
    );
};

export default PublicContract;
