import React, { useState, useEffect } from 'react';
import { getClientByPortalAccessId } from '../../../services/clients';
import { getPublicGallery } from '../../../services/galleries';
import { getTransaction } from '../../../services/transactions';
import { getTeamMemberByPortalAccessId } from '../../../services/teamMembers';
import { toPublicNameSlug } from '../../../utils/publicRouting';

import ClientPortal from '../../clients/components/ClientPortal';
import PublicGallery from './PublicGallery';
import PublicReceipt from './PublicReceipt';
import FreelancerPortal from '../../team/components/FreelancerPortal';

import { Client, Project, TeamMember, Transaction, Profile, Package, ClientFeedback, Notification } from '../../../types';

interface PublicRouterProps {
  slug: string;
  clients?: Client[];
  projects?: Project[];
  transactions?: Transaction[];
  teamMembers?: TeamMember[];
  userProfile: Profile;
  packages?: Package[];
  showNotification: (msg: string) => void;
  setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
  onClientSubStatusConfirmation: (projectId: string, subStatusName: string, note: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
}

type ResolvedTarget =
  | { type: 'client'; data: Client }
  | { type: 'gallery'; id: string }
  | { type: 'transaction'; id: string }
  | { type: 'freelancer'; data: TeamMember }
  | null;

export const PublicRouter: React.FC<PublicRouterProps> = ({
  slug,
  clients = [],
  projects = [],
  transactions = [],
  teamMembers = [],
  userProfile,
  packages = [],
  showNotification,
  setClientFeedback,
  onClientSubStatusConfirmation,
  addNotification,
}) => {
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<ResolvedTarget>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !slug.trim()) {
      setErrorMessage('Tautan tidak memiliki parameter pengenal yang valid.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    const cleanSlug = decodeURIComponent(slug.trim().split(/[?#]/)[0]);

    const resolveSlug = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        // 1. Check in client portal access ID (or ID)
        const matchingClients = clients.filter(c => c.portalAccessId === cleanSlug || c.id === cleanSlug || c.name === cleanSlug || toPublicNameSlug(c.name) === cleanSlug);
        const cachedClient = matchingClients.length === 1 ? matchingClients[0] : undefined;
        if (cachedClient) {
          if (isMounted) {
            setResolved({ type: 'client', data: cachedClient });
            setLoading(false);
          }
          return;
        }

        const client = await getClientByPortalAccessId(cleanSlug);
        if (client && isMounted) {
          setResolved({ type: 'client', data: client });
          setLoading(false);
          return;
        }

        // 2. Check if it's a public gallery
        const gallery = await getPublicGallery(cleanSlug);
        if (gallery && isMounted) {
          setResolved({ type: 'gallery', id: gallery.public_id || gallery.id });
          setLoading(false);
          return;
        }

        // 3. Check if it's a transaction (Receipt)
        const cachedTx = transactions.find(t => t.id === cleanSlug);
        if (cachedTx) {
          if (isMounted) {
            setResolved({ type: 'transaction', id: cachedTx.id });
            setLoading(false);
          }
          return;
        }

        const tx = await getTransaction(cleanSlug).catch((): null => null);
        if (tx && isMounted) {
          setResolved({ type: 'transaction', id: tx.id });
          setLoading(false);
          return;
        }

        // 4. Check if it's a freelancer / team portal
        const matchingMembers = teamMembers.filter(m => m.portalAccessId === cleanSlug || m.id === cleanSlug || m.name === cleanSlug || toPublicNameSlug(m.name) === cleanSlug);
        const cachedMember = matchingMembers.length === 1 ? matchingMembers[0] : undefined;
        if (cachedMember) {
          if (isMounted) {
            setResolved({ type: 'freelancer', data: cachedMember });
            setLoading(false);
          }
          return;
        }

        const member = await getTeamMemberByPortalAccessId(cleanSlug);
        if (member && isMounted) {
          setResolved({ type: 'freelancer', data: member });
          setLoading(false);
          return;
        }

        // Not found in any public table
        if (isMounted) {
          setResolved(null);
          setErrorMessage('Tautan publik tidak ditemukan atau sudah tidak berlaku.');
          setLoading(false);
        }
      } catch (err) {
        console.error('[PublicRouter] Error resolving slug:', err);
        if (isMounted) {
          setResolved(null);
          setErrorMessage('Terjadi kendala saat memeriksa tautan publik. Silakan coba kembali.');
          setLoading(false);
        }
      }
    };

    resolveSlug();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="relative flex justify-center items-center mb-6">
          <div className="absolute border-4 border-indigo-200 rounded-full w-16 h-16"></div>
          <div className="animate-spin border-4 border-transparent border-t-indigo-600 rounded-full w-16 h-16"></div>
        </div>
        <h2 className="text-base font-semibold text-slate-800">Menghubungkan ke Halaman Publik...</h2>
        <p className="mt-1 text-sm text-slate-500">Memverifikasi tautan dan mengambil data...</p>
      </div>
    );
  }

  if (resolved?.type === 'client') {
    return (
      <ClientPortal
        key={resolved.data.id}
        accessId={resolved.data.portalAccessId || slug}
        clients={clients.length > 0 ? clients : [resolved.data]}
        projects={projects}
        transactions={transactions}
        userProfile={userProfile}
        packages={packages}
        teamMembers={teamMembers}
        showNotification={showNotification}
        setClientFeedback={setClientFeedback}
        onClientSubStatusConfirmation={onClientSubStatusConfirmation}
      />
    );
  }

  if (resolved?.type === 'gallery') {
    return <PublicGallery galleryId={resolved.id} />;
  }

  if (resolved?.type === 'transaction') {
    return <PublicReceipt transactionId={resolved.id} />;
  }

  if (resolved?.type === 'freelancer') {
    return (
      <FreelancerPortal
        accessId={resolved.data.portalAccessId || slug}
        teamMembers={teamMembers.length > 0 ? teamMembers : [resolved.data]}
        projects={projects}
        teamProjectPayments={[]}
        teamPaymentRecords={[]}
        userProfile={userProfile}
        showNotification={showNotification}
        addNotification={addNotification}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-200">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-3xl font-bold">
          !
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tautan Tidak Ditemukan</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {errorMessage || 'Tautan yang Anda tuju mungkin sudah kedaluwarsa, dinonaktifkan, atau salah ketik. Pastikan tautan lengkap yang dibagikan telah sesuai.'}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="#/home"
            className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 transition-colors"
          >
            Buka Beranda Utama
          </a>
          <button
            onClick={() => window.history.back()}
            className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Kembali ke Halaman Sebelumnya
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicRouter;
