import React from 'react';
import { TeamProjectPayment, Project } from '../../../types';
import { formatDate } from '../utils/teamUtils';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

interface UnpaidTeamPaymentsSectionProps {
  unpaidProjects: TeamProjectPayment[];
  projectsToPay: string[];
  onToggleProject: (projectPaymentId: string) => void;
  onProceedToPayment: () => void;
  projects: Project[];
}

interface FreelancerProjectsProps {
  projects: Project[];
  /** Bila diisi, kolom "Gaji" (fee anggota untuk acara tsb) ditampilkan. */
  memberId?: string;
}

const getDateKey = (date: string) => date?.slice(0, 10) || '';

const getProjectStatusClassName = (status: string) => {
  const normalizedStatus = status.trim().toLocaleLowerCase('id-ID');
  if (normalizedStatus.includes('selesai')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalizedStatus.includes('batal') || normalizedStatus.includes('tolak')) return 'border-red-200 bg-red-50 text-red-700';
  if (normalizedStatus.includes('konfirmasi')) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalizedStatus.includes('tunda') || normalizedStatus.includes('menunggu') || normalizedStatus.includes('cek')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalizedStatus.includes('proses') || normalizedStatus.includes('berjalan')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const thClass = 'px-2.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:px-3 sm:text-[10px]';
const tdClass = 'px-2.5 py-2.5 align-middle text-brand-text-primary sm:px-3';

export const UnpaidTeamPaymentsSection: React.FC<UnpaidTeamPaymentsSectionProps> = ({
  unpaidProjects,
  projectsToPay,
  onToggleProject,
  onProceedToPayment,
  projects,
}) => {
  const allSelected = projectsToPay.length === unpaidProjects.length && unpaidProjects.length > 0;
  const totalSelected = unpaidProjects
    .filter(payment => projectsToPay.includes(payment.id))
    .reduce((sum, payment) => sum + payment.fee, 0);

  const handleSelectAll = () => {
    if (allSelected) {
      unpaidProjects.forEach(payment => onToggleProject(payment.id));
    } else {
      unpaidProjects.filter(payment => !projectsToPay.includes(payment.id)).forEach(payment => onToggleProject(payment.id));
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-brand-text-primary sm:text-sm">Pembayaran Belum Dibayar</h4>
          <p className="text-[10px] text-brand-text-secondary sm:text-xs">Pilih acara untuk membuat pembayaran.</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          {unpaidProjects.length}
        </span>
      </div>

      {unpaidProjects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-border px-3 py-3 text-center text-xs text-brand-text-secondary">
          Semua pembayaran sudah lunas.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-brand-border">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead className="bg-brand-bg/60">
                  <tr className="border-b border-brand-border">
                    <th className="w-8 px-2.5 py-2 sm:px-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        aria-label="Pilih semua Pembayaran belum dibayar"
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-blue-500 sm:h-4 sm:w-4"
                      />
                    </th>
                    <th className={thClass}>Acara</th>
                    <th className={`${thClass} hidden whitespace-nowrap sm:table-cell`}>Tanggal</th>
                    <th className={`${thClass} text-right`}>Pembayaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50">
                  {unpaidProjects.map(payment => {
                    const projectName = projects.find(project => project.id === payment.projectId)?.projectName ?? 'Acara tidak ditemukan';
                    const isSelected = projectsToPay.includes(payment.id);
                    return (
                      <tr key={payment.id} className={isSelected ? 'bg-blue-500/10' : 'hover:bg-brand-bg/40'}>
                        <td className="px-2.5 py-2.5 sm:px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleProject(payment.id)}
                            aria-label={`Pilih fee ${projectName}`}
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-blue-500 sm:h-4 sm:w-4"
                          />
                        </td>
                        <td className={`${tdClass} font-semibold`}>{projectName}</td>
                        <td className={`${tdClass} hidden whitespace-nowrap text-brand-text-secondary sm:table-cell`}>{formatDate(payment.date)}</td>
                        <td className={`${tdClass} whitespace-nowrap text-right font-bold`}>{formatCurrency(payment.fee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {projectsToPay.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-brand-accent/30 bg-brand-accent/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
              <p className="text-xs sm:text-sm">
                <span className="font-semibold text-brand-accent">{projectsToPay.length} acara</span>
                <span className="mx-2 text-brand-text-secondary">·</span>
                <span className="text-brand-text-secondary">Total: </span>
                <span className="font-black text-brand-text-primary">{formatCurrency(totalSelected)}</span>
              </p>
              <button type="button" onClick={onProceedToPayment} className="button-primary w-full px-4 py-2 text-xs sm:w-auto sm:px-5 sm:text-sm">
                Lanjut ke Pembayaran
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const FreelancerProjects: React.FC<FreelancerProjectsProps> = ({ projects, memberId }) => {
  const showFee = Boolean(memberId);

  const rows = [...projects]
    .filter((project) => project.status !== 'Dibatalkan')
    .sort((left, right) => getDateKey(right.date).localeCompare(getDateKey(left.date)));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-border px-3 py-6 text-center text-xs text-brand-text-secondary">
        Belum ada acara untuk anggota ini.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead className="bg-brand-bg">
            <tr className="border-b border-brand-border">
              <th className={`${thClass} whitespace-nowrap`}>Tanggal</th>
              <th className={thClass}>Acara</th>
              <th className={`${thClass} hidden md:table-cell`}>Lokasi</th>
              <th className={thClass}>Status</th>
              {showFee && <th className={`${thClass} text-right`}>Gaji</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">
            {rows.map((project) => {
              const assigned = memberId
                ? project.team?.find((member) => member.memberId === memberId)
                : undefined;
              return (
                <tr key={project.id} className="hover:bg-brand-bg/40">
                  <td className={`${tdClass} whitespace-nowrap text-brand-text-secondary`}>{project.date ? formatDate(project.date) : '-'}</td>
                  <td className={`${tdClass} font-semibold`}>{project.projectName}</td>
                  <td className={`${tdClass} hidden text-brand-text-secondary md:table-cell`}>{project.location || '-'}</td>
                  <td className={tdClass}>
                    <span className={`inline-flex max-w-[120px] rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-tight sm:text-[10px] ${getProjectStatusClassName(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  {showFee && (
                    <td className={`${tdClass} whitespace-nowrap text-right font-bold`}>{formatCurrency(assigned?.fee ?? 0)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FreelancerProjects;
