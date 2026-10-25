import React, { useEffect, useState, useCallback } from 'react';
import { XIcon, DownloadIcon } from '../../constants';

interface PdfPreviewModalProps {
    /** Dipanggil untuk generate blob URL PDF. Dipanggil sekali saat modal dibuka. */
    onGenerate: () => Promise<{ blobUrl: string; filename: string }>;
    onClose: () => void;
    title?: string;
}

type Status = 'loading' | 'ready' | 'error';

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ onGenerate, onClose, title = 'Preview PDF' }) => {
    const [status, setStatus] = useState<Status>('loading');
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [filename, setFilename] = useState<string>('laporan.pdf');
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Generate PDF blob saat modal mount
    useEffect(() => {
        let revoked = false;
        setStatus('loading');

        onGenerate()
            .then(({ blobUrl: url, filename: name }) => {
                if (!revoked) {
                    setBlobUrl(url);
                    setFilename(name);
                    setStatus('ready');
                }
            })
            .catch(err => {
                if (!revoked) {
                    console.error('[PdfPreviewModal] Gagal generate PDF:', err);
                    setErrorMsg('Gagal membuat preview PDF. Silakan coba lagi.');
                    setStatus('error');
                }
            });

        return () => {
            revoked = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Revoke blob URL saat modal tutup
    useEffect(() => {
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    const handleDownload = useCallback(() => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
    }, [blobUrl, filename]);

    // Tutup dengan Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-2 sm:p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-4xl"
                style={{ height: 'min(90vh, 860px)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAEFF4] flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                            {/* PDF icon */}
                            <svg className="w-4.5 h-4.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="9" y1="13" x2="15" y2="13" />
                                <line x1="9" y1="17" x2="15" y2="17" />
                                <polyline points="9 9 10 9" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#2A3547] leading-tight">{title}</h3>
                            {status === 'ready' && (
                                <p className="text-[11px] text-[#5A6A85] leading-tight">{filename}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'ready' && (
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#5D87FF] hover:bg-[#4871e3] text-white rounded-xl transition-all shadow-sm"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Unduh PDF
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] transition-all"
                        >
                            <XIcon className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden rounded-b-2xl bg-[#F4F6F9]">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-[#5A6A85]">
                            <svg className="w-8 h-8 animate-spin text-[#5D87FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            <p className="text-sm font-medium">Menyiapkan PDF...</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-[#5A6A85] p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-red-600">{errorMsg}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-1 px-4 py-2 text-xs font-bold bg-white border border-[#EAEFF4] rounded-xl hover:bg-[#F4F6F9] text-[#2A3547] transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    )}

                    {status === 'ready' && blobUrl && (
                        <iframe
                            src={blobUrl}
                            title="Preview PDF"
                            className="w-full h-full rounded-b-2xl"
                            style={{ border: 'none', display: 'block' }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PdfPreviewModal;
