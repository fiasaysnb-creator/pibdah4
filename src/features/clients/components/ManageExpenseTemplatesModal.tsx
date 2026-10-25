import React, { useState } from 'react';
import { Plus, Trash2, Pencil, X, Wallet, Settings2 } from 'lucide-react';
import { useExpenseTemplates, ExpenseTemplate } from '../../../hooks/useExpenseTemplates';
import RupiahInput from '../../../shared/form/RupiahInput';
import { formatCurrency } from '../../../utils/currency';

interface ManageExpenseTemplatesModalProps {
  onClose: () => void;
  /** Kategori pengeluaran aktif dari pengaturan (profile.expenseCategories). */
  categories: string[];
}

const ManageExpenseTemplatesModal: React.FC<ManageExpenseTemplatesModalProps> = ({ onClose, categories }) => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useExpenseTemplates();
  const categoryOptions = categories.length ? categories : ['Lainnya'];
  const defaultCategory = categoryOptions[0];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', category: defaultCategory, defaultAmount: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const payload = {
      name: formData.name.trim(),
      category: formData.category.trim() || 'Lainnya',
      defaultAmount: Number(formData.defaultAmount) || 0,
    };
    if (editingId) {
      updateTemplate(editingId, payload);
      setEditingId(null);
    } else {
      addTemplate(payload);
    }
    setFormData({ name: '', category: defaultCategory, defaultAmount: '' });
  };

  const startEdit = (t: ExpenseTemplate) => {
    setEditingId(t.id);
    setFormData({ name: t.name, category: t.category, defaultAmount: t.defaultAmount ? String(t.defaultAmount) : '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', category: defaultCategory, defaultAmount: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-700 text-white flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Kelola Template Pengeluaran</h2>
              <p className="text-xs text-slate-500">Atur pengeluaran/biaya yang sering dicatat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Nama Pengeluaran / Biaya
            </label>
            <input
              type="text"
              placeholder="Contoh: Transport & Bensin Kru"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Kategori
            </label>
            <select
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              required
            >
              {categoryOptions.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Jumlah Default (Rp)
              </label>
              <span className="text-[10px] font-medium text-slate-500">
                Kosongkan bila nominal diketik manual
              </span>
            </div>
            <RupiahInput
              placeholder="0"
              className="w-full px-3 py-2 text-xs font-semibold tabular-nums border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              value={formData.defaultAmount}
              onChange={raw => setFormData({ ...formData, defaultAmount: raw })}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-brand-accent hover:bg-brand-accent-hover text-white py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              {editingId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingId ? 'Simpan Perubahan' : 'Tambah Template'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Daftar Template Tersedia</p>
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Belum ada template. Tambahkan sekarang.</p>
          ) : (
            templates.map(t => (
              <div
                key={t.id}
                className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-xs text-slate-800 truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                      {t.category}
                    </span>
                    <span className="text-[11px] font-bold text-red-700">
                      • {t.defaultAmount > 0 ? formatCurrency(t.defaultAmount) : 'Nominal manual'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 transition-colors"
                    title="Edit Template"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-600/10 transition-colors"
                    title="Hapus Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-500">
          <Settings2 className="mt-px h-3.5 w-3.5 shrink-0" />
          Daftar kategori diambil dari Pengaturan → Kategori Pengeluaran.
        </p>
      </div>
    </div>
  );
};

export default ManageExpenseTemplatesModal;
