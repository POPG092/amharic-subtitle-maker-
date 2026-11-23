import React, { useMemo, useState } from 'react';
import {
  Clock,
  Combine,
  Plus,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatDisplayTime,
  formatTimeInput,
  getSubtitleStats,
  parseTimestampToMs,
  type SubtitleCue,
} from '../utils/subtitles';

interface CueEditorPanelProps {
  cues: SubtitleCue[];
  activeCueId: string | null;
  isGenerating: boolean;
  onUpdateCue: (cueId: string, patch: Partial<SubtitleCue>) => void;
  onDeleteCue: (cueId: string) => void;
  onSplitCue: (cueId: string) => void;
  onMergeWithNext: (cueId: string) => void;
  onAddCue: () => void;
  onShiftAll: (offsetMs: number) => void;
  onSeekToCue: (startMs: number) => void;
  onGenerate: () => void;
}

export const CueEditorPanel: React.FC<CueEditorPanelProps> = ({
  cues,
  activeCueId,
  isGenerating,
  onUpdateCue,
  onDeleteCue,
  onSplitCue,
  onMergeWithNext,
  onAddCue,
  onShiftAll,
  onSeekToCue,
  onGenerate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [draftTimes, setDraftTimes] = useState<Record<string, { start?: string; end?: string }>>({});

  const stats = useMemo(() => getSubtitleStats(cues), [cues]);

  const filteredCues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cues;
    return cues.filter(
      (cue) =>
        cue.text.toLowerCase().includes(q) ||
        (cue.originalText && cue.originalText.toLowerCase().includes(q)) ||
        (cue.speaker && cue.speaker.toLowerCase().includes(q)),
    );
  }, [cues, searchQuery]);

  const commitTime = (cue: SubtitleCue, field: 'start' | 'end', raw: string) => {
    const parsedMs = parseTimestampToMs(raw);
    setDraftTimes((prev) => {
      const next = { ...prev };
      if (next[cue.id]) {
        const copy = { ...next[cue.id] };
        delete copy[field];
        next[cue.id] = copy;
      }
      return next;
    });

    if (field === 'start') {
      const clampedStart = Math.max(0, parsedMs);
      const nextEnd = Math.max(clampedStart + 300, cue.endMs);
      onUpdateCue(cue.id, { startMs: clampedStart, endMs: nextEnd });
    } else {
      const nextEnd = Math.max(cue.startMs + 300, parsedMs);
      onUpdateCue(cue.id, { endMs: nextEnd });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Amharic cues..."
            aria-label="Search Amharic cues"
            className="w-full rounded-lg border border-white/10 bg-zinc-950/90 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={cues.length === 0}
            onClick={() => onShiftAll(-250)}
            title="Shift all cues earlier by 250ms"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>-0.25s</span>
          </button>

          <button
            type="button"
            disabled={cues.length === 0}
            onClick={() => onShiftAll(250)}
            title="Shift all cues later by 250ms"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>+0.25s</span>
          </button>

          <button
            type="button"
            onClick={onAddCue}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Cue</span>
          </button>
        </div>
      </div>

      {/* Unboxed Stats Strip */}
      <div className="border-b border-white/10 bg-zinc-950/60 px-4 py-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400 tabular-nums">
        <span>{stats.cueCount} cues</span>
        <span aria-hidden="true">·</span>
        <span>{formatDisplayTime(stats.totalDurationMs)} span</span>
        <span aria-hidden="true">·</span>
        <span>{stats.totalWords} words</span>
        <span aria-hidden="true">·</span>
        <span>{stats.ethiopicCharCount} Ge’ez chars</span>
        <span aria-hidden="true">·</span>
        <span>{stats.avgCharsPerSec} chars/s</span>
      </div>

      {/* Cue Rows Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/10 max-h-[540px]">
        {isGenerating ? (
          <div className="p-4 space-y-3" aria-label="Generating Amharic subtitles">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 rounded-lg border border-white/10 bg-zinc-900/60 animate-pulse"
              />
            ))}
          </div>
        ) : cues.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-display text-sm font-semibold text-zinc-200">
              No Amharic subtitle cues yet
            </p>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-400 leading-relaxed">
              Generate time-synced Amharic Ge’ez subtitles from your media file or add a manual
              subtitle cue.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Generate Amharic Subtitles
              </button>
              <button
                type="button"
                onClick={onAddCue}
                className="rounded-lg border border-white/15 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                Add Manual Cue
              </button>
            </div>
          </div>
        ) : filteredCues.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-zinc-400">
            No subtitle cues match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredCues.map((cue, visibleIndex) => {
            const isActive = cue.id === activeCueId;
            const draft = draftTimes[cue.id] || {};
            const startVal = draft.start ?? formatTimeInput(cue.startMs);
            const endVal = draft.end ?? formatTimeInput(cue.endMs);
            const canMerge = visibleIndex < filteredCues.length - 1 && !searchQuery.trim();

            return (
              <div
                key={cue.id}
                data-testid={`cue-row-${cue.index}`}
                className={`px-4 py-3.5 transition-colors ${
                  isActive ? 'bg-amber-500/[0.08]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSeekToCue(cue.startMs)}
                      aria-label={`Jump to cue ${cue.index}`}
                      className={`font-mono text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded transition-colors ${
                        isActive
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {String(cue.index).padStart(2, '0')}
                    </button>

                    <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
                      <input
                        type="text"
                        aria-label={`Cue ${cue.index} start time`}
                        value={startVal}
                        onChange={(e) =>
                          setDraftTimes((prev) => ({
                            ...prev,
                            [cue.id]: { ...prev[cue.id], start: e.target.value },
                          }))
                        }
                        onBlur={(e) => commitTime(cue, 'start', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-[116px] rounded border border-white/10 bg-zinc-950 px-2 py-1 text-center text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                      />
                      <span className="text-zinc-600" aria-hidden="true">→</span>
                      <input
                        type="text"
                        aria-label={`Cue ${cue.index} end time`}
                        value={endVal}
                        onChange={(e) =>
                          setDraftTimes((prev) => ({
                            ...prev,
                            [cue.id]: { ...prev[cue.id], end: e.target.value },
                          }))
                        }
                        onBlur={(e) => commitTime(cue, 'end', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-[116px] rounded border border-white/10 bg-zinc-950 px-2 py-1 text-center text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSplitCue(cue.id)}
                      aria-label={`Split cue ${cue.index}`}
                      title="Split cue at midpoint"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    {canMerge && (
                      <button
                        type="button"
                        onClick={() => onMergeWithNext(cue.id)}
                        aria-label={`Merge cue ${cue.index} with next`}
                        title="Merge with next cue"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <Combine className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteCue(cue.id)}
                      aria-label={`Delete cue ${cue.index}`}
                      title="Delete cue"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-rose-950/60 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  aria-label={`Cue ${cue.index} Amharic text`}
                  value={cue.text}
                  onChange={(e) => onUpdateCue(cue.id, { text: e.target.value })}
                  className="mt-2.5 w-full resize-y rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-ethiopic text-sm text-zinc-100 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />

                {(cue.originalText || cue.speaker) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {cue.speaker && <span className="font-medium text-zinc-300">{cue.speaker}</span>}
                    {cue.speaker && cue.originalText && <span aria-hidden="true">·</span>}
                    {cue.originalText && <span className="truncate">{cue.originalText}</span>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
