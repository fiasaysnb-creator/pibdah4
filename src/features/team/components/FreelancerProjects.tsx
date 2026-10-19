import React from 'react';
import { CalendarDays, CheckCircle2, CircleAlert, Clock3, MapPin } from 'lucide-react';
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
}

const getDateKey = (date: string) => date?.slice(0, 10) || '';

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

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
    <section className="space-y-3 border-t border-brand-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-brand-text-primary sm:text-sm">Fee Belum Dibayar</h4>
          <p className="text-[10px] text-brand-text-secondary sm:text-xs">Pilih acara untuk membuat pembayaran.</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          {unpaidProjects.length}
        </span>
      </div>

      {unpaidProjects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-border px-3 py-3 text-center text-xs text-brand-text-secondary">
          Semua fee sudah lunas.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-brand-border">
            <div className="grid grid-cols-[1.25rem_1fr_auto_auto] items-center gap-2 border-b border-brand-border bg-brand-bg/60 px-2.5 py-2 sm:px-4 sm:gap-3 sm:py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                aria-label="Pilih semua fee belum dibayar"
                className="h-3.5 w-3.5 cursor-pointer rounded accent-blue-500 sm:h-4 sm:w-4"
              />
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:text-[10px]">Acara</span>
              <span className="hidden whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:block">Tanggal</span>
              <span className="text-right text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:text-[10px]">Fee</span>
            </div>
            <div className="divide-y divide-brand-border/50">
              {unpaidProjects.map(payment => {
                const projectName = projects.find(project => project.id === payment.projectId)?.projectName ?? 'Acara tidak ditemukan';
                const isSelected = projectsToPay.includes(payment.id);
                return (
                  <label
                    key={payment.id}
                    className={`grid cursor-pointer grid-cols-[1.25rem_1fr_auto_auto] items-center gap-2 px-2.5 py-2.5 transition-colors sm:px-4 sm:gap-3 ${isSelected ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-brand-bg/40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleProject(payment.id)}
                      aria-label={`Pilih fee ${projectName}`}
                      className="h-3.5 w-3.5 rounded accent-blue-500 sm:h-4 sm:w-4"
                    />
                    <span className="truncate text-xs font-semibold text-brand-text-primary sm:text-sm">{projectName}</span>
                    <span className="hidden whitespace-nowrap text-[10px] text-brand-text-secondary sm:block">{formatDate(payment.date)}</span>
                    <span className="whitespace-nowrap text-right text-[11px] font-bold text-brand-text-primary sm:text-sm">{formatCurrency(payment.fee)}</span>
                  </label>
                );
              })}
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

const ProjectEventGroup: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClassName: string;
  projects: Project[];
  emptyMessage: string;
  statusLabel?: string;
}> = ({ title, description, icon, iconClassName, projects, emptyMessage, statusLabel }) => (
  <section className="space-y-2.5">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-brand-text-primary sm:text-sm">{title}</h4>
          <p className="text-[10px] text-brand-text-secondary sm:text-xs">{description}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-brand-bg px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand-text-secondary">
        {projects.length}
      </span>
    </div>

    {projects.length === 0 ? (
      <p className="rounded-lg border border-dashed border-brand-border px-3 py-3 text-center text-xs text-brand-text-secondary">
        {emptyMessage}
      </p>
    ) : (
      <div className="space-y-2">
        {projects.map((project) => (
          <article key={project.id} className="flex items-start gap-3 rounded-lg border border-brand-border bg-white p-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-semibold text-brand-text-primary sm:text-sm">
                {project.projectName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-brand-text-secondary sm:text-xs">
                {project.date && <span>{formatDate(project.date)}</span>}
                {project.location && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="break-words">{project.location}</span>
                  </span>
                )}
              </div>
            </div>
            <span className={`max-w-[96px] shrink-0 rounded-full border px-2 py-0.5 text-right text-[9px] font-semibold leading-tight sm:max-w-none sm:text-[10px] ${getProjectStatusClassName(statusLabel || project.status)}`}>
              {statusLabel || project.status}
            </span>
          </article>
        ))}
      </div>
    )}
  </section>
);

const FreelancerProjects: React.FC<FreelancerProjectsProps> = ({
  projects,
}) => {
  const todayKey = getTodayKey();
  const memberProjects = projects.filter((project) => project.status !== 'Dibatalkan');
  const completedProjects = memberProjects
    .filter((project) => project.status === 'Selesai')
    .sort((left, right) => getDateKey(right.date).localeCompare(getDateKey(left.date)));
  const activeProjects = memberProjects.filter((project) => project.status !== 'Selesai');
  const upcomingProjects = activeProjects
    .filter((project) => getDateKey(project.date) >= todayKey)
    .sort((left, right) => getDateKey(left.date).localeCompare(getDateKey(right.date)));
  const overdueProjects = activeProjects
    .filter((project) => getDateKey(project.date) && getDateKey(project.date) < todayKey)
    .sort((left, right) => getDateKey(right.date).localeCompare(getDateKey(left.date)));
  const undatedProjects = activeProjects.filter((project) => !getDateKey(project.date));

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-2 text-center sm:px-2">
          <p className="text-sm font-black text-blue-700">{upcomingProjects.length}</p>
          <p className="text-[9px] font-semibold text-blue-700 sm:text-[10px]">Mendatang</p>
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-2 text-center sm:px-2">
          <p className="text-sm font-black text-emerald-700">{completedProjects.length}</p>
          <p className="text-[9px] font-semibold text-emerald-700 sm:text-[10px]">Selesai</p>
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-2 text-center sm:px-2">
          <p className="text-sm font-black text-amber-700">{overdueProjects.length + undatedProjects.length}</p>
          <p className="text-[9px] font-semibold text-amber-700 sm:text-[10px]">Perlu dicek</p>
        </div>
      </div>

      <div className="space-y-4">
        <ProjectEventGroup
          title="Acara Mendatang"
          description="Jadwal yang akan datang untuk anggota ini"
          icon={<Clock3 className="h-4 w-4" />}
          iconClassName="bg-blue-500/10 text-blue-600"
          projects={upcomingProjects}
          emptyMessage="Belum ada acara mendatang."
        />
        <ProjectEventGroup
          title="Perlu Ditindaklanjuti"
          description="Tanggal acara lewat, tetapi status belum selesai"
          icon={<CircleAlert className="h-4 w-4" />}
          iconClassName="bg-amber-500/10 text-amber-600"
          projects={overdueProjects}
          emptyMessage="Tidak ada acara lewat tanggal yang tertunda."
          statusLabel="Perlu dicek"
        />
        {undatedProjects.length > 0 && (
          <ProjectEventGroup
            title="Belum Dijadwalkan"
            description="Acara aktif tanpa tanggal"
            icon={<CalendarDays className="h-4 w-4" />}
            iconClassName="bg-slate-500/10 text-slate-600"
            projects={undatedProjects}
            emptyMessage="Tidak ada acara tanpa tanggal."
          />
        )}
        <ProjectEventGroup
          title="Riwayat Acara Selesai"
          description="Acara dengan status selesai"
          icon={<CheckCircle2 className="h-4 w-4" />}
          iconClassName="bg-emerald-500/10 text-emerald-600"
          projects={completedProjects}
          emptyMessage="Belum ada acara yang berstatus selesai."
        />
      </div>

    </div>
  );
};

export default FreelancerProjects;
