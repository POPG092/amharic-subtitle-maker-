export type ExportFormat = 'srt' | 'vtt' | 'ass' | 'txt' | 'json';

export type SourceMode = 'auto' | 'amharic' | 'translate';

export type CueStyle = 'broadcast' | 'compact';

export interface SubtitleCue {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  originalText?: string;
  speaker?: string;
}

export interface RawCueInput {
  startTime?: string | number;
  endTime?: string | number;
  startMs?: number;
  endMs?: number;
  amharicText?: string;
  text?: string;
  originalText?: string;
  speaker?: string;
}

export interface SubtitleStats {
  cueCount: number;
  totalDurationMs: number;
  totalWords: number;
  ethiopicCharCount: number;
  avgCharsPerSec: number;
}

export interface ExportOptions {
  includeUtf8Bom?: boolean;
  includeTimestampsInTxt?: boolean;
  includeSpeakerLabels?: boolean;
  title?: string;
}

const ETHIOPIC_CHAR_RE = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/g;

/**
 * Parses timestamps in formats like:
 * - "00:01:23.450" or "00:01:23,450"
 * - "01:23.450" or "01:23"
 * - "83.45" (seconds) or numeric seconds
 */
export function parseTimestampToMs(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return 0;
    return Math.round(input * 1000);
  }

  const trimmed = String(input).trim();
  if (!trimmed) return 0;

  // Plain numeric seconds string (e.g. "12.345")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const secs = Number.parseFloat(trimmed);
    return Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : 0;
  }

  const normalized = trimmed.replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length === 3) {
    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);
    const seconds = Number.parseFloat(parts[2]);
    if ([hours, minutes, seconds].some((n) => !Number.isFinite(n) || n < 0)) return 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 2) {
    const minutes = Number.parseInt(parts[0], 10);
    const seconds = Number.parseFloat(parts[1]);
    if ([minutes, seconds].some((n) => !Number.isFinite(n) || n < 0)) return 0;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  return 0;
}

function pad2(value: number): string {
  return String(Math.floor(value)).padStart(2, '0');
}

function pad3(value: number): string {
  return String(Math.floor(value)).padStart(3, '0');
}

function decomposeMs(ms: number): { hours: number; minutes: number; seconds: number; millis: number } {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  return { hours, minutes, seconds, millis };
}

export function formatSrtTime(ms: number): string {
  const { hours, minutes, seconds, millis } = decomposeMs(ms);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`;
}

export function formatVttTime(ms: number): string {
  const { hours, minutes, seconds, millis } = decomposeMs(ms);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

export function formatAssTime(ms: number): string {
  const { hours, minutes, seconds, millis } = decomposeMs(ms);
  const centis = Math.floor(millis / 10);
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
}

export function formatDisplayTime(ms: number): string {
  const { hours, minutes, seconds, millis } = decomposeMs(ms);
  const tenths = Math.floor(millis / 100);
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${tenths}`;
  }
  return `${pad2(minutes)}:${pad2(seconds)}.${tenths}`;
}

export function formatTimeInput(ms: number): string {
  return formatVttTime(ms);
}

export function normalizeCues(rawCues: RawCueInput[]): SubtitleCue[] {
  const parsed = rawCues
    .map((item) => {
      const startMs =
        typeof item.startMs === 'number' && Number.isFinite(item.startMs)
          ? Math.max(0, Math.round(item.startMs))
          : parseTimestampToMs(item.startTime);
      const rawEndMs =
        typeof item.endMs === 'number' && Number.isFinite(item.endMs)
          ? Math.max(0, Math.round(item.endMs))
          : parseTimestampToMs(item.endTime);
      const text = (item.amharicText ?? item.text ?? '').trim();
      const originalText = item.originalText?.trim() || undefined;
      const speaker = item.speaker?.trim() || undefined;
      return {
        startMs,
        endMs: rawEndMs > startMs ? rawEndMs : startMs + 1500,
        text,
        originalText,
        speaker,
      };
    })
    .filter((cue) => cue.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const normalized: SubtitleCue[] = [];
  for (let i = 0; i < parsed.length; i += 1) {
    const current = parsed[i];
    const prev = normalized[normalized.length - 1];
    let startMs = current.startMs;
    if (prev && startMs < prev.endMs) {
      // Gently clamp previous cue end if overlap exceeds 100ms, otherwise nudge startMs
      if (prev.endMs - prev.startMs > 600 && startMs > prev.startMs + 400) {
        prev.endMs = startMs;
      } else {
        startMs = prev.endMs;
      }
    }
    const endMs = Math.max(startMs + 400, current.endMs);
    normalized.push({
      id: `cue-${i + 1}`,
      index: i + 1,
      startMs,
      endMs,
      text: current.text,
      originalText: current.originalText,
      speaker: current.speaker,
    });
  }

  return normalized;
}

export function reindexCues(cues: SubtitleCue[]): SubtitleCue[] {
  return [...cues]
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
    .map((cue, idx) => ({
      ...cue,
      index: idx + 1,
    }));
}

export function shiftCueTimings(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  return cues.map((cue) => {
    const duration = Math.max(200, cue.endMs - cue.startMs);
    const nextStart = Math.max(0, cue.startMs + offsetMs);
    return {
      ...cue,
      startMs: nextStart,
      endMs: nextStart + duration,
    };
  });
}

export function splitCue(cues: SubtitleCue[], cueId: string): SubtitleCue[] {
  const targetIndex = cues.findIndex((c) => c.id === cueId);
  if (targetIndex === -1) return cues;

  const target = cues[targetIndex];
  const duration = target.endMs - target.startMs;
  if (duration < 600) return cues;

  const words = target.text.trim().split(/\s+/).filter(Boolean);
  let firstText = target.text.trim();
  let secondText = target.text.trim();

  if (words.length >= 2) {
    const midWord = Math.ceil(words.length / 2);
    firstText = words.slice(0, midWord).join(' ');
    secondText = words.slice(midWord).join(' ');
  } else if (firstText.length >= 4) {
    const midChar = Math.ceil(firstText.length / 2);
    secondText = firstText.slice(midChar);
    firstText = firstText.slice(0, midChar);
  }

  const midMs = Math.round((target.startMs + target.endMs) / 2);
  const firstCue: SubtitleCue = {
    ...target,
    endMs: midMs,
    text: firstText,
  };
  const secondCue: SubtitleCue = {
    ...target,
    id: `${target.id}-split-${Date.now().toString(36)}`,
    startMs: midMs,
    endMs: target.endMs,
    text: secondText,
    originalText: undefined,
  };

  const next = [...cues];
  next.splice(targetIndex, 1, firstCue, secondCue);
  return reindexCues(next);
}

export function mergeWithNextCue(cues: SubtitleCue[], cueId: string): SubtitleCue[] {
  const targetIndex = cues.findIndex((c) => c.id === cueId);
  if (targetIndex === -1 || targetIndex >= cues.length - 1) return cues;

  const current = cues[targetIndex];
  const nextCue = cues[targetIndex + 1];
  const merged: SubtitleCue = {
    ...current,
    endMs: Math.max(current.endMs, nextCue.endMs),
    text: `${current.text.trim()} ${nextCue.text.trim()}`.trim(),
    originalText:
      current.originalText && nextCue.originalText
        ? `${current.originalText.trim()} ${nextCue.originalText.trim()}`
        : current.originalText || nextCue.originalText,
  };

  const result = [...cues];
  result.splice(targetIndex, 2, merged);
  return reindexCues(result);
}

export function findActiveCue(cues: SubtitleCue[], currentTimeMs: number): SubtitleCue | null {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    if (currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs) {
      return cue;
    }
  }
  return null;
}

export function getSubtitleStats(cues: SubtitleCue[]): SubtitleStats {
  if (cues.length === 0) {
    return {
      cueCount: 0,
      totalDurationMs: 0,
      totalWords: 0,
      ethiopicCharCount: 0,
      avgCharsPerSec: 0,
    };
  }

  let totalWords = 0;
  let ethiopicCharCount = 0;
  let totalCueDurationSec = 0;
  let totalNonSpaceChars = 0;
  let maxEndMs = 0;

  for (const cue of cues) {
    const trimmed = cue.text.trim();
    if (trimmed) {
      totalWords += trimmed.split(/\s+/).length;
      const matches = trimmed.match(ETHIOPIC_CHAR_RE);
      ethiopicCharCount += matches ? matches.length : 0;
      totalNonSpaceChars += trimmed.replace(/\s+/g, '').length;
    }
    const durSec = Math.max(0.1, (cue.endMs - cue.startMs) / 1000);
    totalCueDurationSec += durSec;
    if (cue.endMs > maxEndMs) maxEndMs = cue.endMs;
  }

  return {
    cueCount: cues.length,
    totalDurationMs: maxEndMs,
    totalWords,
    ethiopicCharCount,
    avgCharsPerSec: totalCueDurationSec > 0 ? Number((totalNonSpaceChars / totalCueDurationSec).toFixed(1)) : 0,
  };
}

function formatCueLine(cue: SubtitleCue, includeSpeakerLabels?: boolean): string {
  if (includeSpeakerLabels && cue.speaker) {
    return `[${cue.speaker}] ${cue.text.trim()}`;
  }
  return cue.text.trim();
}

export function exportToSrt(cues: SubtitleCue[], options: ExportOptions = {}): string {
  const ordered = reindexCues(cues);
  const body = ordered
    .map((cue, idx) => {
      const start = formatSrtTime(cue.startMs);
      const end = formatSrtTime(cue.endMs);
      return `${idx + 1}\n${start} --> ${end}\n${formatCueLine(cue, options.includeSpeakerLabels)}`;
    })
    .join('\n\n');

  const content = body ? `${body}\n` : '';
  return options.includeUtf8Bom ? `\uFEFF${content}` : content;
}

export function exportToVtt(cues: SubtitleCue[], options: ExportOptions = {}): string {
  const ordered = reindexCues(cues);
  const blocks = ordered
    .map((cue, idx) => {
      const start = formatVttTime(cue.startMs);
      const end = formatVttTime(cue.endMs);
      return `${idx + 1}\n${start} --> ${end}\n${formatCueLine(cue, options.includeSpeakerLabels)}`;
    })
    .join('\n\n');

  const content = blocks ? `WEBVTT\n\n${blocks}\n` : 'WEBVTT\n\n';
  return options.includeUtf8Bom ? `\uFEFF${content}` : content;
}

export function exportToAss(cues: SubtitleCue[], options: ExportOptions = {}): string {
  const ordered = reindexCues(cues);
  const title = (options.title || 'Amharic Subtitles').replace(/[\r\n]+/g, ' ').trim();
  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans Ethiopic,54,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,2.5,1,2,48,48,54,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = ordered
    .map((cue) => {
      const start = formatAssTime(cue.startMs);
      const end = formatAssTime(cue.endMs);
      const speaker = (cue.speaker || '').replace(/,/g, ' ');
      const text = cue.text.trim().replace(/\r?\n/g, '\\N');
      return `Dialogue: 0,${start},${end},Default,${speaker},0,0,0,,${text}`;
    })
    .join('\n');

  const content = events ? `${header}\n${events}\n` : `${header}\n`;
  return options.includeUtf8Bom ? `\uFEFF${content}` : content;
}

export function exportToTxt(cues: SubtitleCue[], options: ExportOptions = {}): string {
  const ordered = reindexCues(cues);
  const lines = ordered.map((cue) => {
    const text = formatCueLine(cue, options.includeSpeakerLabels);
    if (options.includeTimestampsInTxt) {
      return `[${formatDisplayTime(cue.startMs)} - ${formatDisplayTime(cue.endMs)}] ${text}`;
    }
    return text;
  });
  const content = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  return options.includeUtf8Bom ? `\uFEFF${content}` : content;
}

export function exportToJson(cues: SubtitleCue[]): string {
  const ordered = reindexCues(cues).map((cue) => ({
    index: cue.index,
    startTime: formatVttTime(cue.startMs),
    endTime: formatVttTime(cue.endMs),
    startMs: cue.startMs,
    endMs: cue.endMs,
    amharicText: cue.text.trim(),
    ...(cue.originalText ? { originalText: cue.originalText } : {}),
    ...(cue.speaker ? { speaker: cue.speaker } : {}),
  }));
  return JSON.stringify({ language: 'am', script: 'Ethiopic', cues: ordered }, null, 2);
}

export function formatExportContent(
  cues: SubtitleCue[],
  format: ExportFormat,
  options: ExportOptions = {},
): string {
  switch (format) {
    case 'srt':
      return exportToSrt(cues, options);
    case 'vtt':
      return exportToVtt(cues, options);
    case 'ass':
      return exportToAss(cues, options);
    case 'txt':
      return exportToTxt(cues, options);
    case 'json':
      return exportToJson(cues);
  }
}

export function getExportExtension(format: ExportFormat): string {
  return format;
}

export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'srt':
      return 'application/x-subrip;charset=utf-8';
    case 'vtt':
      return 'text/vtt;charset=utf-8';
    case 'ass':
      return 'text/plain;charset=utf-8';
    case 'txt':
      return 'text/plain;charset=utf-8';
    case 'json':
      return 'application/json;charset=utf-8';
  }
}
