import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { BioLinkPage as BioLinkPageData } from '../../types';
import { getBioLinkPage } from '../../services/bioLinks';
import { useSupabaseRealtimeRefresh } from '../../hooks/useSupabaseRealtimeRefresh';

interface BioLinkPageProps {
  slug?: string;
}

const BioLinkPage: React.FC<BioLinkPageProps> = ({ slug }) => {
  const [page, setPage] = useState<BioLinkPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useSupabaseRealtimeRefresh('public-bio-link', ['bio_link_pages'], () => {
    setRefreshVersion(version => version + 1);
  }, { realtime: false, refreshOnFocus: false });

  useEffect(() => {
    let cancelled = false;
    getBioLinkPage(slug)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Halaman link tidak dapat dimuat.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug, refreshVersion]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f8f8] text-sm text-[#737373]">Memuat halaman...</div>;
  }

  if (error || !page) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f8f8] px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold text-[#171717]">{error ? 'Halaman belum siap' : 'Link tidak ditemukan'}</h1>
          <p className="mt-2 text-sm leading-6 text-[#737373]">{error || 'Halaman ini tidak tersedia atau belum dipublikasikan.'}</p>
        </div>
      </main>
    );
  }

  const whatsapp = page.whatsapp_number.replace(/\D/g, '');
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp}` : '';

  return (
    <main className="bio-link-page min-h-screen bg-white pb-14 text-[#171717]" style={{ fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        .bio-link-page .bio-link-button {
          background-color: #171717 !important;
          border-color: #171717 !important;
          color: #ffffff !important;
        }
        .bio-link-page .bio-link-button:hover {
          background-color: #404040 !important;
          border-color: #404040 !important;
        }
        @media (max-width: 639px) {
          .bio-link-page .bio-link-title {
            font-size: 20px !important;
            line-height: 1.25 !important;
            letter-spacing: 0.01em !important;
          }
          .bio-link-page .bio-link-subtitle {
            font-size: 14px !important;
            line-height: 1.4 !important;
            letter-spacing: 0.01em !important;
          }
          .bio-link-page .bio-link-button {
            min-height: 50px !important;
            border-radius: 10px !important;
            font-size: 11px !important;
            letter-spacing: 0.1em !important;
          }
        }
      `}</style>
      <div className="mx-auto min-h-screen w-full max-w-[590px] bg-white shadow-[0_0_30px_rgba(0,0,0,0.06)]">
        <div className="relative h-[170px] overflow-visible bg-[#d4d4d4] sm:h-[220px]">
          {page.cover_url && <img src={page.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover grayscale"  loading="lazy" decoding="async" />}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -bottom-[44px] left-1/2 z-10 h-[104px] w-[104px] -translate-x-1/2 overflow-hidden rounded-full border-[4px] border-white bg-[#d4d4d4] shadow-sm sm:-bottom-[58px] sm:h-[132px] sm:w-[132px] sm:border-[5px]">
            {page.avatar_url ? (
              <img src={page.avatar_url} alt={page.title} className="h-full w-full object-cover grayscale"  loading="lazy" decoding="async" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-light text-[#525252]">
                {(page.title || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <section className="px-5 pt-[106px] text-center sm:px-6 sm:pt-[164px]">
          <h1 className="bio-link-title font-medium tracking-wide text-[#171717]" style={{ fontSize: 'clamp(1.25rem, 5vw, 1.6875rem)', lineHeight: 1.25 }}>{page.title}</h1>
          {page.subtitle && <p className="bio-link-subtitle mt-2 font-normal tracking-wide text-[#737373] sm:mt-3" style={{ fontSize: 'clamp(0.875rem, 3.8vw, 1.125rem)', lineHeight: 1.45 }}>{page.subtitle}</p>}

          <div className="mx-auto mt-6 flex max-w-[535px] flex-col gap-[9px] sm:mt-11 sm:gap-[18px]">
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="bio-link-button flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#262626] shadow-sm transition hover:bg-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-[#a3a3a3] focus:ring-offset-2 sm:min-h-[72px] sm:gap-3 sm:rounded-[15px] sm:px-5 sm:text-sm sm:tracking-[0.24em]">
                <MessageCircle size={17} aria-hidden="true" />
                {page.whatsapp_label || 'WhatsApp'}
              </a>
            )}
            {page.links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="bio-link-button flex min-h-[50px] items-center justify-center gap-2 rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#262626] shadow-sm transition hover:bg-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-[#a3a3a3] focus:ring-offset-2 sm:min-h-[72px] sm:gap-3 sm:rounded-[15px] sm:px-5 sm:text-sm sm:tracking-[0.24em]">
                <ExternalLink size={16} aria-hidden="true" />
                {link.title}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default BioLinkPage;
