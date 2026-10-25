import React from 'react';
import { Star as StarIcon, Trash2 as Trash2Icon } from 'lucide-react';
import { TeamMember, PerformanceNoteType } from '../../../types';

// ─── Star rating ──────────────────────────────────────────────────────────────

export const StarRating: React.FC<{
  rating: number;
  onSetRating?: (rating: number) => void;
}> = ({ rating, onSetRating }) => (
  <div className="flex items-center gap-0.5 sm:gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={onSetRating ? () => onSetRating(star) : undefined}
        disabled={!onSetRating}
        aria-label={`Set rating to ${star}`}
        className={`p-0.5 transition-transform ${onSetRating ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
      >
        <StarIcon
          className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
            star <= rating ? 'text-yellow-400 fill-current' : 'text-brand-border'
          }`}
        />
      </button>
    ))}
  </div>
);

// ─── Note type badge ──────────────────────────────────────────────────────────

export const getNoteTypeClass = (type: PerformanceNoteType) => {
  switch (type) {
    case PerformanceNoteType.PRAISE:
      return 'bg-green-500/15 text-green-400 border-green-500/30';
    case PerformanceNoteType.CONCERN:
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case PerformanceNoteType.LATE_DEADLINE:
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case PerformanceNoteType.GENERAL:
    default:
      return 'bg-brand-bg text-brand-text-secondary border-brand-border';
  }
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PerformanceTabProps {
  member: TeamMember;
  onSetRating: (rating: number) => void;
  newNote: string;
  setNewNote: (note: string) => void;
  newNoteType: PerformanceNoteType;
  setNewNoteType: (type: PerformanceNoteType) => void;
  onAddNote: () => void;
  onDeleteNote: (noteId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  member,
  onSetRating,
  newNote,
  setNewNote,
  newNoteType,
  setNewNoteType,
  onAddNote,
  onDeleteNote,
}) => (
  <div className="space-y-3 sm:space-y-5">
    {/* Rating card */}
    <div className="bg-brand-bg border border-brand-border rounded-xl sm:rounded-2xl p-3 sm:p-4">
      <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-brand-text-secondary mb-2 sm:mb-3">
        Rating Kinerja
      </p>
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        <StarRating rating={member.rating} onSetRating={onSetRating} />
        <span className="text-lg sm:text-2xl font-black text-brand-text-primary">
          {member.rating.toFixed(1)}
          <span className="text-[10px] sm:text-sm font-medium text-brand-text-secondary"> / 5</span>
        </span>
      </div>
      <p className="text-[10px] sm:text-xs text-brand-text-secondary mt-1.5 sm:mt-2">
        Klik bintang untuk mengubah rating.
      </p>
    </div>

    {/* Add note form */}
    <div className="bg-brand-bg border border-brand-border rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3">
      <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-brand-text-secondary">
        Catatan Baru
      </p>
      <textarea
        id="newPerformanceNote"
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
        rows={3}
        placeholder="Tulis catatan kinerja..."
        className="w-full px-3 py-2 text-sm rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600/60 transition-all resize-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={newNoteType}
          onChange={(e) => setNewNoteType(e.target.value as PerformanceNoteType)}
          className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-brand-border bg-brand-surface text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-blue-600/40 transition-all"
        >
          {Object.values(PerformanceNoteType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button
          onClick={onAddNote}
          disabled={!newNote.trim()}
          className="button-primary px-3 py-2 text-[10px] sm:text-sm disabled:opacity-40"
        >
          Tambah
        </button>
      </div>
    </div>

    {/* Notes history */}
    <div className="space-y-2">
      <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-brand-text-secondary px-1">
        Riwayat Catatan ({member.performanceNotes.length})
      </p>

      {member.performanceNotes.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <svg className="w-10 h-10 text-brand-text-secondary/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-brand-text-secondary">Belum ada catatan kinerja.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="bg-brand-bg">
                <tr className="border-b border-brand-border">
                  <th className="px-2.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:px-3 sm:text-[10px]">Tipe</th>
                  <th className="hidden px-2.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:table-cell sm:px-3 sm:text-[10px]">Tanggal</th>
                  <th className="px-2.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-brand-text-secondary sm:px-3 sm:text-[10px]">Catatan</th>
                  <th className="w-10 px-2.5 py-2 sm:px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {[...member.performanceNotes]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((note) => (
                    <tr key={note.id} className="hover:bg-brand-bg/40">
                      <td className="px-2.5 py-2.5 align-top sm:px-3">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${getNoteTypeClass(note.type)}`}
                        >
                          {note.type}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-2.5 py-2.5 align-top text-[10px] text-brand-text-secondary sm:table-cell sm:px-3 sm:text-xs">
                        {new Date(note.date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-2.5 py-2.5 align-top text-brand-text-primary sm:px-3">
                        <p className="text-sm leading-relaxed">{note.note}</p>
                        <p className="mt-0.5 text-[10px] text-brand-text-secondary sm:hidden">
                          {new Date(note.date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </td>
                      <td className="px-2.5 py-2.5 align-top text-right sm:px-3">
                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="shrink-0 p-1.5 rounded-lg text-brand-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all"
                          aria-label="Hapus catatan"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default PerformanceTab;
