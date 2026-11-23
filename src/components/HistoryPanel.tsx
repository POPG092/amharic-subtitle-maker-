import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileAudio, FileVideo, Search, Trash2 } from 'lucide-react';
import type { SubtitleHistoryRow } from '../lib/supabase';

interface HistoryPanelProps {
  rows: SubtitleHistoryRow[];
  loading: boolean;
  onLoadRowIntoStudio: (row: SubtitleHistoryRow) => void;
  onDeleteRow: (id: string) => Promise<void>;
  onGoToStudio: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  rows,
  loading,
  onLoadRowIntoStudio,
  onDeleteRow,
  onGoToStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.file_name.toLowerCase().includes(q) ||
        r.srt_content.toLowerCase().includes(q) ||
        (r.detected_language ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const handleCopySrt = async (row: SubtitleHistoryRow) => {
    try {
      await navigator.clipboard.writeText(row.srt_content);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDownloadSrt = (row: SubtitleHistoryRow) => {
    const content = row.srt_content.startsWith('\uFEFF')
      ? row.srt_content
      : `\uFEFF${row.srt_content}`;
    const blob = new Blob([content], { type: 'application/x-subrip;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const base = row.file_name.replace(/\.[^.]+$/, '').trim() || 'amharic_subtitles';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${base}_am.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteRow(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6">
      <div className="luxury-border-frame rounded-2xl p-[1px]">
        <div className="luxury-surface rounded-[15px] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-zinc-50">
                Saved Subtitle History
              </h1>
              <p className="mt-1 text-xs text-zinc-400 tabular-nums">
                {rows.length} saved {rows.length === 1 ? 'project' : 'projects'} in Supabase
              </p>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved subtitles..."
                aria-label="Search saved subtitle history"
                className="w-60 rounded-lg border border-white/10 bg-zinc-950/90 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-14 rounded-lg border border-white/10 bg-zinc-900/60 animate-pulse"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-display text-base font-semibold text-zinc-100">
                No saved Amharic subtitles yet
              </p>
              <p className="mt-1.5 max-w-md mx-auto text-xs text-zinc-400 leading-relaxed">
                Every video or audio file you subtitle is automatically saved here so you can copy
                or download its .srt file anytime.
              </p>
              <button
                type="button"
                onClick={onGoToStudio}
                className="mt-5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Open Studio
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-zinc-400">
              No saved subtitle entries match &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-zinc-950/60 text-xs font-medium text-zinc-400">
                    <th className="px-5 py-3">Media File</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Cues</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-xs">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {row.media_kind === 'video' ? (
                            <FileVideo className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
                          ) : (
                            <FileAudio className="h-4 w-4 text-violet-300 shrink-0" aria-hidden="true" />
                          )}
                          <span className="font-medium text-zinc-100 truncate max-w-[260px]" title={row.file_name}>
                            {row.file_name}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap">
                        {row.detected_language || row.source_mode}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-200 whitespace-nowrap">
                        {row.cue_count}
                      </td>

                      <td className="px-4 py-3.5 font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onLoadRowIntoStudio(row)}
                            className="rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                          >
                            View Cues
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleCopySrt(row)}
                            aria-label={`Copy SRT for ${row.file_name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                          >
                            {copiedId === row.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Copy SRT</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadSrt(row)}
                            aria-label={`Download SRT for ${row.file_name}`}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-400/90 px-2.5 py-1.5 font-semibold text-zinc-950 hover:bg-amber-300 whitespace-nowrap"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>.SRT</span>
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => void handleDelete(row.id)}
                            aria-label={`Delete ${row.file_name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-950/60 hover:text-rose-300 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
