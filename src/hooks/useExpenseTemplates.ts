import { useState, useEffect } from 'react';

export interface ExpenseTemplate {
  id: string;
  name: string;
  category: string;
  defaultAmount: number;
}

const STORAGE_KEY = 'expense_templates';

/**
 * Template pengeluaran yang sering dipakai.
 * Jumlah default dibiarkan 0 agar nominal tetap diketik manual bila belum diatur;
 * pengguna dapat mengubah/menambah lewat "Kelola Template Pengeluaran".
 */
export const DEFAULT_EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  { id: 'exp-1', name: 'Transport & Bensin Kru', category: 'Transport', defaultAmount: 0 },
  { id: 'exp-2', name: 'Konsumsi Kru & Klien', category: 'Operasional', defaultAmount: 0 },
  { id: 'exp-3', name: 'Cetak Album & Frame', category: 'Produksi Fisik', defaultAmount: 0 },
  { id: 'exp-4', name: 'Sewa Lighting / Alat Tambahan', category: 'Perlengkapan', defaultAmount: 0 },
  { id: 'exp-5', name: 'Pembayaran Kru Tambahan (Overtime)', category: 'Gaji Tim / Vendor', defaultAmount: 0 },
  { id: 'exp-6', name: 'Biaya Lain-lain', category: 'Lainnya', defaultAmount: 0 },
];

export const useExpenseTemplates = () => {
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
        return;
      } catch {
        // Data rusak → pakai default di bawah
      }
    }
    setTemplates(DEFAULT_EXPENSE_TEMPLATES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EXPENSE_TEMPLATES));
  }, []);

  const saveTemplates = (newTemplates: ExpenseTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
  };

  const addTemplate = (template: Omit<ExpenseTemplate, 'id'>) => {
    saveTemplates([...templates, { ...template, id: `exp-${Date.now()}` }]);
  };

  const updateTemplate = (id: string, updated: Omit<ExpenseTemplate, 'id'>) => {
    saveTemplates(templates.map(t => (t.id === id ? { ...updated, id } : t)));
  };

  const deleteTemplate = (id: string) => {
    saveTemplates(templates.filter(t => t.id !== id));
  };

  return { templates, addTemplate, updateTemplate, deleteTemplate };
};
