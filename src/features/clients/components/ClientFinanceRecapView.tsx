import React, { useMemo, useState } from 'react';
import { Client, Project, Transaction, TransactionType } from '../../../types';

const money = (value: number) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;

interface Props {
  clients: Client[];
  projects: Project[];
  transactions: Transaction[];
  monthFilter: string;
  setMonthFilter: (month: string) => void;
}

const ClientFinanceRecapView: React.FC<Props> = ({ clients, projects, transactions, monthFilter, setMonthFilter }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rows = useMemo(() => projects
    .filter(project => !monthFilter || project.date?.slice(0, 7) === monthFilter)
    .map(project => {
      const client = clients.find(item => item.id === project.clientId);
      const projectTransactions = transactions.filter(item => item.projectId === project.id);
      const incomes = projectTransactions.filter(item => item.type === TransactionType.INCOME);
      const expenses = projectTransactions.filter(item => item.type === TransactionType.EXPENSE);
      const additionalPackages = project.additionalPackages || [];
      const additionalIds = new Set(additionalPackages.map(item => item.id));
      const addOns = (project.addOns || []).filter(item => !additionalIds.has(item.id));
      const addOnTotal = [...additionalPackages, ...addOns].reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      const customTotal = (project.customCosts || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const printing = Number(project.printingCost) || 0;
      const transport = Number(project.transportCost) || 0;
      const packageAmount = Number(project.unitPrice) || Math.max(0, Number(project.totalCost || 0) + (Number(project.discountAmount) || 0) - addOnTotal - customTotal - printing - transport);
      const contractedIncome = Number(project.totalCost) || 0;
      return {
        project, client, incomes, expenses, packageAmount, addOns, additionalPackages,
        expenseTotal: expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        incomeTotal: incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        contractedIncome,
      };
    })
    .sort((a, b) => (a.project.date || '').localeCompare(b.project.date || '')),
  [projects, clients, transactions, monthFilter]);

  const totalIncome = rows.reduce((sum, row) => sum + row.incomeTotal, 0);
  const totalExpense = rows.reduce((sum, row) => sum + row.expenseTotal, 0);

  return <section className="space-y-4 animate-fade-in">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#EAEFF4] bg-white p-4">
      <div><h3 className="font-bold text-[#2A3547]">Rekap Keuangan per Pengantin</h3><p className="mt-1 text-xs text-[#5A6A85]">Total paket, pemasukan dan pengeluaran tercatat per acara.</p></div>
      <label className="flex items-center gap-2 text-xs font-semibold text-[#5A6A85]">Bulan acara
        <input type="month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} className="rounded-lg border border-[#EAEFF4] bg-white px-2 py-2 text-xs text-[#2A3547]" />
      </label>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Summary label="Total Paket" value={money(rows.reduce((sum, row) => sum + row.contractedIncome, 0))} />
      <Summary label="Pemasukan tercatat" value={money(totalIncome)} green />
      <Summary label="Pengeluaran tercatat" value={money(totalExpense)} red />
    </div>
    {rows.length === 0 ? <div className="rounded-2xl border border-[#EAEFF4] bg-white p-8 text-center text-sm text-[#5A6A85]">Belum ada acara pada periode ini.</div> : rows.map(({ project, client, incomes, expenses, packageAmount, addOns, additionalPackages, expenseTotal, incomeTotal, contractedIncome }) => {
      const expanded = expandedId === project.id;
      return <article key={project.id} className="overflow-hidden rounded-xl border border-[#EAEFF4] bg-white sm:rounded-2xl sm:shadow-sm">
        <button type="button" onClick={() => setExpandedId(expanded ? null : project.id)} className="grid w-full grid-cols-2 gap-2 p-2.5 text-left sm:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] sm:items-center sm:gap-3 sm:p-4">
          <span className="col-span-2 min-w-0 sm:col-span-1"><strong className="block truncate text-xs font-semibold text-[#2A3547] sm:text-sm sm:font-bold">{client?.name || project.clientName || 'Pengantin'}</strong><span className="mt-0.5 block truncate text-[10px] text-[#718096] sm:mt-1 sm:text-xs">{project.projectName || project.packageName || 'Acara'} · {project.date ? new Date(`${project.date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Tanggal belum diatur'}</span></span>
          <Metric label="Total Paket" value={money(contractedIncome)} />
          <Metric label="Pemasukan" value={money(incomeTotal)} green />
          <Metric label="Pengeluaran" value={money(expenseTotal)} red />
          <Metric label="Laba bersih" value={money(incomeTotal - expenseTotal)} green={incomeTotal >= expenseTotal} red={incomeTotal < expenseTotal} />
        </button>
        {expanded && <div className="grid gap-4 border-t border-[#EAEFF4] bg-[#FAFBFD] p-4 lg:grid-cols-3">
          <Ledger title="Rincian Total Paket" total={money(contractedIncome)}>
            <Line label={`Paket utama · ${project.packageName || 'Paket'}`} value={money(packageAmount)} />
            {additionalPackages.map((item, index) => <Line key={`package-${index}`} label={`Paket tambahan · ${item.name}`} value={money(Number(item.price) || 0)} />)}
            {addOns.map((item, index) => <Line key={`addon-${index}`} label={`Add-on · ${item.name}`} value={money(Number(item.price) || 0)} />)}
            {(project.customCosts || []).map(item => <Line key={item.id} label={item.description || 'Item tambahan'} value={money(Number(item.amount) || 0)} />)}
            {Number(project.discountAmount) > 0 && <Line label="Diskon" value={`− ${money(Number(project.discountAmount))}`} />}
          </Ledger>
          <Ledger title="Pemasukan tercatat" total={money(incomeTotal)} tone="income">
            {incomes.length ? incomes.map(item => <Line key={item.id} label={`${item.date ? new Date(`${item.date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID') : ''} · ${item.description || item.category}`} value={money(Number(item.amount) || 0)} tone="income" />) : <Empty>Belum ada transaksi pemasukan tercatat.</Empty>}
          </Ledger>
          <Ledger title="Pengeluaran tercatat" total={money(expenseTotal)} tone="expense">
            {expenses.length ? expenses.map(item => <Line key={item.id} label={`${item.date ? new Date(`${item.date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID') : ''} · ${item.description || item.category}`} value={money(Number(item.amount) || 0)} tone="expense" />) : <Empty>Belum ada transaksi pengeluaran tercatat.</Empty>}
          </Ledger>
        </div>}
      </article>;
    })}
  </section>;
};

const Summary = ({ label, value, green = false, red = false }: { label: string; value: string; green?: boolean; red?: boolean }) => <div className="rounded-xl border border-[#EAEFF4] bg-white p-4"><p className="text-xs text-[#5A6A85]">{label}</p><p className={`mt-1 text-base font-bold ${green ? 'text-emerald-600' : red ? 'text-red-600' : 'text-[#2A3547]'}`}>{value}</p></div>;
const Metric = ({ label, value, green = false, red = false }: { label: string; value: string; green?: boolean; red?: boolean }) => <span className="min-w-0 rounded-lg border border-[#F0F2F5] bg-[#FAFBFC] px-2 py-1.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"><span className="block text-[9px] text-[#718096] sm:text-[11px] sm:text-[#5A6A85]">{label}</span><strong className={`mt-0.5 block truncate text-[11px] font-medium sm:mt-1 sm:text-sm sm:font-semibold ${green ? 'text-emerald-700' : red ? 'text-rose-600' : 'text-[#374151]'}`}>{value}</strong></span>;
const Ledger = ({ title, total, tone, children }: { title: string; total: string; tone?: 'income' | 'expense'; children: React.ReactNode }) => {
  const toneClass = tone === 'income' ? 'text-emerald-700' : tone === 'expense' ? 'text-rose-600' : 'text-[#2A3547]';
  const borderClass = tone === 'income' ? 'border-emerald-100' : tone === 'expense' ? 'border-rose-100' : 'border-[#EAEFF4]';
  return <div className={`min-w-0 rounded-xl border ${borderClass} bg-white p-3`}><div className="mb-2 flex items-center justify-between gap-2"><strong className={`text-xs ${toneClass}`}>{title}</strong><strong className={`shrink-0 text-xs ${toneClass}`}>{total}</strong></div><div className="space-y-2">{children}</div></div>;
};
const Line = ({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) => <div className="flex items-start justify-between gap-3 border-t border-[#F0F2F5] pt-2 text-xs"><span className="min-w-0 break-words text-[#5A6A85]">{label}</span><span className={`shrink-0 font-semibold ${tone === 'income' ? 'text-emerald-700' : tone === 'expense' ? 'text-rose-600' : 'text-[#2A3547]'}`}>{value}</span></div>;
const Empty = ({ children }: { children: React.ReactNode }) => <p className="border-t border-[#F0F2F5] pt-2 text-xs text-[#8492A6]">{children}</p>;

export default ClientFinanceRecapView;
