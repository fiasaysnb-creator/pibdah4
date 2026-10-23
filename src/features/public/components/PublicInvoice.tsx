import React, { useState, useEffect } from 'react';
import { Project, Profile, Package, Client } from '../../../types';
import InvoiceDocument from '../../finance/components/InvoiceDocument';
import { downloadInvoicePdf } from '../../finance/utils/invoicePdf';
import { DownloadIcon } from '../../../constants';
import { getProjectWithRelations } from '../../../services/projects';
import { getClient } from '../../../services/clients';
import { listPackagesForInvoice } from '../../../services/packages';
import { getPublicProfile } from '../../../services/profile';
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh';

interface PublicInvoiceProps {
    projectId: string;
    projects?: Project[];
    profile?: Profile;
    packages?: Package[];
    clients?: Client[];
}

const PublicInvoice: React.FC<PublicInvoiceProps> = ({ projectId }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [client, setClient] = useState<Client | null | undefined>(undefined);
    const [packages, setPackages] = useState<Package[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshVersion, setRefreshVersion] = useState(0);

    useSupabaseRealtimeRefresh('public-invoice', ['projects', 'project_add_ons', 'clients', 'packages', 'profiles'], () => {
        setRefreshVersion(version => version + 1);
    }, { realtime: false, refreshOnFocus: false });

    useEffect(() => {
        if (!projectId) {
            setError('ID invoice tidak valid.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchData = async () => {
            try {
                setError(null);

                // Fetch everything in parallel
                const [fetchedProject, fetchedProfile] = await Promise.all([
                    getProjectWithRelations(projectId),
                    getPublicProfile(),
                ]);

                if (cancelled) return;

                if (!fetchedProject) {
                    setError('Invoice tidak ditemukan.');
                    setLoading(false);
                    return;
                }

                const fetchedPackages = await listPackagesForInvoice(fetchedProject);
                if (cancelled) return;

                setProject(fetchedProject);
                setPackages(fetchedPackages);
                setProfile(fetchedProfile);

                // Fetch client after we have the project
                if (fetchedProject.clientId) {
                    const fetchedClient = await getClient(fetchedProject.clientId);
                    if (!cancelled) setClient(fetchedClient);
                } else {
                    setClient(null);
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[PublicInvoice] Fetch error:', err);
                    setError('Terjadi kesalahan saat memuat invoice. Coba lagi nanti.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [projectId, refreshVersion]);

    const handleDownloadPDF = async () => {
        if (!project || !profile) return;

        // Invoice diekspor sebagai PDF vector (teks tajam), bukan screenshot HTML.
        try {
            await downloadInvoicePdf({
                project,
                profile,
                packages,
                client: client ?? undefined,
            });
        } catch (err) {
            console.error('[PublicInvoice] PDF export failed:', err);
        }
    };

    // --- Loading state ---
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative flex justify-center items-center">
                        <div className="absolute border-4 border-brand-accent/20 rounded-full w-16 h-16"></div>
                        <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-16 h-16"></div>
                    </div>
                    <p className="text-sm font-medium text-brand-text-secondary animate-pulse">Memuat invoice...</p>
                </div>
            </div>
        );
    }

    // --- Error / Not Found state ---
    if (error || !project || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12">
                <div className="max-w-md w-full bg-brand-surface p-8 rounded-2xl border border-brand-border/50 shadow-xl text-center">
                    <div className="w-16 h-16 bg-brand-danger/10 text-brand-danger rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-brand-text-light tracking-tight mb-2">Invoice Tidak Ditemukan</h2>
                    <p className="text-brand-text-secondary mb-6 leading-relaxed">
                        {error || 'Mohon maaf, data invoice tidak dapat ditemukan. Pastikan link yang Anda gunakan sudah benar atau hubungi kami jika masalah berlanjut.'}
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
        <div className="min-h-screen bg-brand-bg py-3 sm:py-12 px-0 sm:px-4 print:bg-white print:p-0">
            <div className="max-w-4xl mx-auto">
                {/* Actions bar - hidden when printing */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 sm:mb-8 px-4 sm:px-0 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-brand-accent rounded-full" />
                        <div>
                            <h1 className="text-xl font-black text-brand-text-light tracking-tight">Invoice Resmi</h1>
                            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest">{profile.companyName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-accent hover:bg-brand-accent-hover text-white font-bold rounded-xl shadow-lg shadow-brand-accent/20 transition-all group"
                        >
                            <DownloadIcon className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                            <span>Unduh PDF</span>
                        </button>
                    </div>
                </div>

                {/* Use the same invoice document view as the dashboard. */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <InvoiceDocument
                        id="invoice-document"
                        project={project}
                        profile={profile}
                        packages={packages}
                        client={client ?? undefined}
                    />
                </div>

                {/* Footer info - hidden when printing */}
                <div className="mt-8 text-center no-print">
                    <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} {profile.companyName} • Professional Document
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicInvoice;
