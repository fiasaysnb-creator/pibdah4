import React, { useEffect, useMemo, useState } from 'react';
import { Project, WeddingDayChecklist } from '../../../types';
import { getProjectWithRelations } from '../../../services/projects';
import { 
  listChecklistByProject, 
  initializeDefaultChecklist, 
  setChecklistItemCompleted, 
  updateChecklistItemFields,
  normalizeChecklist,
  upsertChecklistItems,
  deleteChecklistItem,
  updateChecklistItemText
} from '../../../services/weddingDayChecklist';
import { supabase } from '../../../lib/supabaseClient';
import { CheckCircleIcon, PlusIcon, SendIcon, TrashIcon, PencilIcon, UserIcon, XIcon, MessageSquareIcon, MoreVerticalIcon } from 'lucide-react';
import ShareMessageModal from '../../communication/components/ShareMessageModal';

type Props = {
  projectId: string;
};

export default function ChecklistPortal({ projectId }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<WeddingDayChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharePreview, setSharePreview] = useState<{ title: string; message: string } | null>(null);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [assignedToDraft, setAssignedToDraft] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  
  const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const itemsByCategory = useMemo(() => {
    return (items || []).reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WeddingDayChecklist[]>);
  }, [items]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [proj, checklist] = await Promise.all([
          getProjectWithRelations(projectId, { includeChecklist: false }).catch((): null => null),
          listChecklistByProject(projectId).catch((): any[] => [])
        ]);
        if (!mounted) return;
        setProject(proj);
        setItems(checklist);
      } catch (e) {
        console.error('[ChecklistPortal] failed to load', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`realtime-wedding-day-checklists-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wedding_day_checklists', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT') {
              setItems(prev => {
                if (prev.find(p => p.id === payload.new.id)) return prev;
                return [...prev, normalizeChecklist(payload.new)];
              });
            } else if (payload.eventType === 'UPDATE') {
              setItems(prev => prev.map(p => p.id === payload.new.id ? normalizeChecklist(payload.new) : p));
            } else if (payload.eventType === 'DELETE') {
              setItems(prev => prev.filter(p => p.id === payload.old.id));
            }
          } catch (e) {
            console.warn('[ChecklistPortal] realtime refresh failed', e);
            const next = await listChecklistByProject(projectId).catch((): any[] => []);
            setItems(next);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, isCompleted: !current, updatedAt: new Date().toISOString() } : item
      ));
      await setChecklistItemCompleted(id, !current);
    } catch (e) {
      console.error('[ChecklistPortal] toggle failed', e);
      const refreshed = await listChecklistByProject(projectId);
      setItems(refreshed);
    }
  };

  const handleInitDefault = async () => {
    if (isInitializing) return;
    setIsInitializing(true);
    try {
      const res = await initializeDefaultChecklist(projectId);
      setItems(res);
    } catch (e) {
      console.error('[ChecklistPortal] init default failed', e);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleQuickAdd = async (category: string) => {
    if (!quickAddName.trim()) return;
    try {
      const newItems = await upsertChecklistItems([{
        projectId,
        category,
        itemName: quickAddName.trim(),
        isCompleted: false,
      }]);
      if (newItems && newItems.length > 0) {
         setItems(prev => {
           if (prev.find(p => p.id === newItems[0].id)) return prev;
           return [...prev, newItems[0]];
         });
      }
      setQuickAddCategory(null);
      setQuickAddName('');
    } catch (e) {
      console.error('[ChecklistPortal] failed to quick add', e);
    }
  };

  const handleShareRecap = () => {
    const total = items.length;
    const completed = items.filter(i => i.isCompleted).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const grouped = items.reduce((acc, it) => {
      if (!acc[it.category]) acc[it.category] = [];
      acc[it.category].push(it);
      return acc;
    }, {} as Record<string, WeddingDayChecklist[]>);

    let message = `*PORTAL CHECKLIST HARI H*\n${project?.projectName ? `*${project.projectName}*\n` : ''}`;
    message += `📊 *Progres: ${progress}%* (${completed} dari ${total} tugas selesai)\n\n`;

    const onlyPending = window.confirm('Apakah Anda ingin membagikan HANYA tugas yang belum selesai? (Klik OK untuk Hanya Pending, Cancel untuk Semua Tugas)');

    Object.entries(grouped).forEach(([cat, its]) => {
      const filteredIts = onlyPending ? its.filter(i => !i.isCompleted) : its;
      if (filteredIts.length === 0) return;
      
      message += `*${cat}:*\n`;
      filteredIts.forEach(i => {
        message += `${i.isCompleted ? '✅' : '⬜'} ${i.itemName}${i.assignedTo ? ` (@${i.assignedTo})` : ''}\n`;
      });
      message += `\n`;
    });

    setSharePreview({
      title: 'Bagikan Rekap Checklist',
      message,
    });
  };

  const portalLink = `${window.location.origin}/#/checklist-portal/${projectId}`;

  const handleSharePortalLink = () => {
    const message = `Link Portal Checklist Hari H${project?.projectName ? ` - ${project.projectName}` : ''}:\n${portalLink}`;

    setSharePreview({
      title: 'Bagikan Link Portal Checklist',
      message,
    });
  };

  const totalItems = items.length;
  const completedItems = items.filter(i => i.isCompleted).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-brand-text-secondary animate-pulse">Menghubungkan ke Lapangan...</p>
        </div>
      </div>
    );
  }

  const categories = Object.keys(itemsByCategory);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-brand-accent/30 selection:text-brand-accent overflow-x-hidden">
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-in { animation: fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .glass-panel { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .checkbox-bounce:active { transform: scale(0.9); }
        .checklist-item { transition: all 0.2s ease; }
        .checklist-item:hover { background: rgba(255, 255, 255, 0.03); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-brand-accent/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/20 blur-[80px]"></div>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-12">
        {sharePreview && (
          <ShareMessageModal
            isOpen={!!sharePreview}
            onClose={() => setSharePreview(null)}
            title={sharePreview.title}
            initialMessage={sharePreview.message}
            phone={null}
          />
        )}

        {/* Hero Image */}
        <div className="w-full h-48 sm:h-56 mb-8 rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in">
          <img src="/assets/images/backgrounds/detail-pengantin-4.jpg" alt="Hero" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
        </div>

        <header className="mb-8 animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-[10px] font-bold uppercase tracking-wider text-brand-accent mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                </span>
                Live Lapangan
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                Checklist Hari H
              </h1>
              {project?.projectName && (
                <p className="text-slate-400 font-medium">{project.projectName}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSharePortalLink}
                className="w-10 h-10 flex items-center justify-center rounded-xl glass-panel text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all active:scale-95 flex-shrink-0"
                title="Bagikan link portal"
              >
                <SendIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleShareRecap}
                className="w-10 h-10 flex items-center justify-center rounded-xl glass-panel text-brand-accent hover:bg-brand-accent/10 transition-all active:scale-95 flex-shrink-0"
                title="Kirim rekap ke WhatsApp"
              >
                <CheckCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Keseluruhan Progres</p>
                  <p className="text-4xl font-black text-white">{progressPercent}%</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-200 font-bold text-lg">{completedItems}/{totalItems}</p>
                  <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Item Selesai</p>
                </div>
              </div>
              <div className="h-3 w-full bg-slate-800/50 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-brand-accent to-blue-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {categories.length > 0 && (
            <div className="flex overflow-x-auto gap-2 py-4 no-scrollbar -mx-4 px-4 mt-2">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => {
                    const el = document.getElementById(`category-${cat}`);
                    if (el) {
                      const yOffset = -20;
                      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                    setActiveCategory(cat);
                  }}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all flex-shrink-0 ${activeCategory === cat ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-3xl animate-in" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-lg font-bold text-white mb-2">Belum ada checklist</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">Klik tombol di bawah untuk membuat checklist default untuk acara ini.</p>
              <button 
                onClick={handleInitDefault} 
                disabled={isInitializing}
                className="px-6 py-3 rounded-2xl bg-brand-accent text-white font-bold text-sm shadow-xl shadow-brand-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="w-5 h-5" /> {isInitializing ? 'Menyiapkan...' : 'Buat Checklist Default'}
              </button>
            </div>
          ) : (
            Object.entries(itemsByCategory).map(([category, catItems], idx) => {
              const catTotal = catItems.length;
              const catDone = catItems.filter(i => i.isCompleted).length;
              const catProgress = Math.round((catDone / catTotal) * 100);

              return (
                <section 
                  key={category} 
                  id={`category-${category}`}
                  className="animate-in scroll-mt-6" 
                  style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
                >
                  <div className="flex items-end justify-between px-2 mb-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-white tracking-tight">{category}</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sub-kategori Persiapan</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-brand-accent">{catDone}/{catTotal}</span>
                      <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-brand-accent" style={{ width: `${catProgress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-3xl overflow-hidden shadow-xl">
                    <div className="divide-y divide-slate-700/30">
                      {catItems.map(it => (
                        <div key={it.id} className={`checklist-item group ${it.isCompleted ? 'bg-brand-accent/[0.02]' : ''}`}>
                          <div className="p-4 flex items-start gap-4">
                            <button
                              onClick={() => handleToggle(it.id, it.isCompleted)}
                              className={`
                                flex-shrink-0 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all checkbox-bounce mt-0.5
                                ${it.isCompleted 
                                  ? 'bg-brand-accent border-brand-accent shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                                  : 'border-slate-700 bg-slate-800/50 hover:border-brand-accent/50'}
                              `}
                            >
                              {it.isCompleted && <CheckCircleIcon className="w-5 h-5 text-white" />}
                            </button>
                            
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  {isEditingName && expandedId === it.id ? (
                                    <input
                                      value={nameDraft}
                                      onChange={e => setNameDraft(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent mb-2"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex flex-col">
                                      <p className={`text-base font-medium leading-tight transition-colors ${it.isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                        {it.itemName}
                                      </p>
                                      {it.assignedTo && !it.isCompleted && (
                                        <div className="flex items-center gap-1 mt-1 text-[11px] text-brand-accent/80 font-medium">
                                          <UserIcon className="w-3 h-3" />
                                          <span>{it.assignedTo}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => { 
                                    if (expandedId === it.id) {
                                      setExpandedId(null);
                                      setIsEditingName(false);
                                    } else {
                                      setExpandedId(it.id); 
                                      setNotesDraft(it.notes || ''); 
                                      setAssignedToDraft(it.assignedTo || '');
                                      setIsEditingName(false);
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${it.notes ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                  {it.notes ? <MessageSquareIcon className="w-4 h-4" /> : <MoreVerticalIcon className="w-4 h-4" />}
                                </button>
                              </div>

                              {it.notes && expandedId !== it.id && (
                                <div className="mt-2 text-xs text-yellow-200/70 italic px-2 border-l-2 border-yellow-500/30">
                                  "{it.notes}"
                                </div>
                              )}
                              
                              <p className="mt-1.5 text-[10px] text-slate-600 font-medium">
                                {it.updatedAt && expandedId !== it.id ? `Terakhir update: ${new Date(it.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </p>

                              {expandedId === it.id && (
                                <div className="mt-4 animate-in space-y-3">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => { 
                                          setIsEditingName(!isEditingName); 
                                          if (!isEditingName) setNameDraft(it.itemName); 
                                        }} 
                                        className="text-[10px] font-medium flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-2 py-1 rounded"
                                      >
                                        <PencilIcon className="w-3 h-3" /> Edit
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if(window.confirm('Hapus tugas ini?')) {
                                            try {
                                              await deleteChecklistItem(it.id);
                                              setItems(prev => prev.filter(p => p.id !== it.id));
                                            } catch (e) {
                                              console.error(e);
                                            }
                                          }
                                        }} 
                                        className="text-[10px] font-medium flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-2 py-1 rounded"
                                      >
                                        <TrashIcon className="w-3 h-3" /> Hapus
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                      <UserIcon className="w-3 h-3" /> PIC / Penanggung Jawab
                                    </label>
                                    <input
                                      value={assignedToDraft}
                                      onChange={(e) => setAssignedToDraft(e.target.value)}
                                      placeholder="Nama Kru / Divisi (Opsional)"
                                      className="w-full bg-slate-900/50 shadow-inner border border-slate-700 rounded-xl p-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Catatan Tambahan</label>
                                    <textarea
                                      value={notesDraft}
                                      onChange={(e) => setNotesDraft(e.target.value)}
                                      rows={2}
                                      placeholder="Tulis catatan atau kondisi lapangan..."
                                      className="w-full bg-slate-900/50 shadow-inner border border-slate-700 rounded-xl p-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all"
                                    />
                                  </div>
                                  
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={async () => {
                                        try {
                                          let updated = { ...it, notes: notesDraft, assignedTo: assignedToDraft };
                                          
                                          if (isEditingName && nameDraft.trim() !== it.itemName && nameDraft.trim() !== '') {
                                            await updateChecklistItemText(it.id, { itemName: nameDraft.trim() });
                                            updated.itemName = nameDraft.trim();
                                          }
                                          
                                          await updateChecklistItemFields(it.id, { notes: notesDraft, assignedTo: assignedToDraft });
                                          
                                          setItems(prev => prev.map(p => p.id === it.id ? { ...updated, updatedAt: new Date().toISOString() } : p));
                                          setExpandedId(null);
                                          setIsEditingName(false);
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }}
                                      className="flex-1 py-2 bg-brand-accent text-white font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all"
                                    >
                                      Simpan
                                    </button>
                                    <button
                                      onClick={() => { setExpandedId(null); setIsEditingName(false); }}
                                      className="px-4 py-2 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:text-white transition-all"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-3 border-t border-slate-700/30 bg-slate-800/20">
                      {quickAddCategory === category ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={quickAddName}
                            onChange={e => setQuickAddName(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                await handleQuickAdd(category);
                              }
                            }}
                            placeholder="Nama tugas baru..."
                            autoFocus
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                          />
                          <button
                            onClick={() => handleQuickAdd(category)}
                            disabled={!quickAddName.trim()}
                            className="px-3 py-1.5 bg-brand-accent text-white font-bold text-xs rounded-lg disabled:opacity-50"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => { setQuickAddCategory(null); setQuickAddName(''); }}
                            className="p-1.5 text-slate-400 hover:text-white"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setQuickAddCategory(category); setQuickAddName(''); }}
                          className="text-xs font-semibold text-brand-accent hover:text-brand-accent/80 flex items-center gap-1 transition-colors w-full"
                        >
                          <PlusIcon className="w-3.5 h-3.5" /> Tambah Tugas
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </main>

        <footer className="mt-12 text-center pb-8 animate-in" style={{ animationDelay: '0.4s' }}>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">Wedding Management System</p>
          <p className="text-[10px] text-slate-700 mt-1">Real-time sync enabled • Secure Environment</p>
        </footer>
      </div>
    </div>
  );
}
