import React, { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import {
  formatExportContent,
  getExportExtension,
  getExportMimeType,
  type ExportFormat,
  type SubtitleCue,
} from '../utils/subtitles';

interface ExportStudioProps {
  cues: SubtitleCue[];
  projectTitle: string;
  selectedFormat: ExportFormat;
  onSelectFormat: (format: ExportFormat) => void;
}

const FORMAT_OPTIONS: Array<{ id: ExportFormat; label: string; description: string }> = [
  { id: 'srt', label: 'SRT (.srt)', description: 'SubRip — Premiere Pro, DaVinci, YouTube, VLC' },
  { id: 'vtt', label: 'WebVTT (.vtt)', description: 'HTML5 web video players & streaming' },
  { id: 'ass', label: 'ASS (.ass)', description: 'SubStation Alpha with Noto Sans Ethiopic styling' },
  { id: 'txt', label: 'Text (.txt)', description: 'Clean Amharic transcript or timestamped script' },
  { id: 'json', label: 'JSON (.json)', description: 'Structured cues with millisecond timings' },
];

export const ExportStudio: React.FC<ExportStudioProps> = ({
  cues,
  projectTitle,
  selectedFormat,
  onSelectFormat,
}) => {
  const [includeUtf8Bom, setIncludeUtf8Bom] = useState(true);
  const [includeTimestampsInTxt, setIncludeTimestampsInTxt] = useState(true);
  const [includeSpeakerLabels, setIncludeSpeakerLabels] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportContent = useMemo(
    () =>
      formatExportContent(cues, selectedFormat, {
        includeUtf8Bom,
        includeTimestampsInTxt,
        includeSpeakerLabels,
        title: projectTitle,
      }),
    [cues, selectedFormat, includeUtf8Bom, includeTimestampsInTxt, includeSpeakerLabels, projectTitle],
  );

  const baseFileName = useMemo(() => {
    const stripped = projectTitle.replace(/\.[^.]+$/, '').trim();
    const safe = stripped.replace(/[^a-zA-Z0-9_\-\u1200-\u137F]+/g, '_').replace(/^_+|_+$/g, '');
    return `${safe || 'amharic_subtitles'}_am`;
  }, [projectTitle]);

  const handleCopy = async () => {
    if (!exportContent || cues.length === 0) return;
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownload = () => {
    if (cues.length === 0) return;
    const blob = new Blob([exportContent], { type: getExportMimeType(selectedFormat) });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseFileName}.${getExportExtension(selectedFormat)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeMeta = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div>
        <span className="block text-xs font-medium text-zinc-400 mb-2">
          Export Format
        </span>
        <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-950/90 p-1 border border-white/10">
          {FORMAT_OPTIONS.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => onSelectFormat(fmt.id)}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                selectedFormat === fmt.id
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>
        {activeMeta && (
          <p className="mt-2 text-xs text-zinc-400">{activeMeta.description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-y border-white/10 py-3 text-xs text-zinc-300">
        {selectedFormat !== 'json' && (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUtf8Bom}
              onChange={(e) => setIncludeUtf8Bom(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-zinc-900 accent-amber-400"
            />
            <span>Include UTF-8 BOM (recommended for Premiere &amp; Windows)</span>
          </label>
        )}

        {(selectedFormat === 'srt' || selectedFormat === 'vtt' || selectedFormat === 'txt') && (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSpeakerLabels}
              onChange={(e) => setIncludeSpeakerLabels(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-zinc-900 accent-amber-400"
            />
            <span>Include speaker labels</span>
          </label>
        )}

        {selectedFormat === 'txt' && (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTimestampsInTxt}
              onChange={(e) => setIncludeTimestampsInTxt(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-zinc-900 accent-amber-400"
            />
            <span>Include timestamps</span>
          </label>
        )}
      </div>

      <div className="flex-1 min-h-[260px] min-w-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-zinc-400">
          <span className="shrink-0">Output Preview</span>
          <span className="font-mono tabular-nums truncate">
            {baseFileName}.{getExportExtension(selectedFormat)}
          </span>
        </div>
        <pre
          data-testid="export-preview-code"
          className="flex-1 max-h-[340px] max-w-full overflow-auto rounded-lg border border-white/10 bg-zinc-950 p-3.5 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap break-words"
        >
          {cues.length > 0
            ? exportContent
            : 'Generate or add Amharic subtitle cues to preview the exported file.'}
        </pre>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <button
          type="button"
          disabled={cues.length === 0}
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy Output</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={cues.length === 0}
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 transition-opacity hover:opacity-95 disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Download .{getExportExtension(selectedFormat).toUpperCase()}</span>
        </button>
      </div>
    </div>
  );
};
