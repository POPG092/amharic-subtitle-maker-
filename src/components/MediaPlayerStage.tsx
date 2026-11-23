import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileAudio,
  FileVideo,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatDisplayTime,
  type CueStyle,
  type SourceMode,
  type SubtitleCue,
} from '../utils/subtitles';

interface MediaPlayerStageProps {
  mediaUrl: string;
  mediaKind: 'video' | 'audio';
  fileName: string;
  fileSizeBytes: number;
  isSample: boolean;
  cues: SubtitleCue[];
  activeCue: SubtitleCue | null;
  currentTimeMs: number;
  durationMs: number;
  isGenerating: boolean;
  sourceMode: SourceMode;
  cueStyle: CueStyle;
  showOriginalOverlay: boolean;
  onChangeSourceMode: (mode: SourceMode) => void;
  onChangeCueStyle: (style: CueStyle) => void;
  onToggleOriginalOverlay: () => void;
  onGenerate: () => void;
  onReplaceFile: () => void;
  onTimeUpdate: (ms: number) => void;
  onDurationLoaded: (ms: number) => void;
  seekRequestMs: { value: number; seq: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaPlayerStage: React.FC<MediaPlayerStageProps> = ({
  mediaUrl,
  mediaKind,
  fileName,
  fileSizeBytes,
  isSample,
  cues,
  activeCue,
  currentTimeMs,
  durationMs,
  isGenerating,
  sourceMode,
  cueStyle,
  showOriginalOverlay,
  onChangeSourceMode,
  onChangeCueStyle,
  onToggleOriginalOverlay,
  onGenerate,
  onReplaceFile,
  onTimeUpdate,
  onDurationLoaded,
  seekRequestMs,
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [overlaySize, setOverlaySize] = useState<'sm' | 'md' | 'lg'>('md');

  const waveformBars = useMemo(() => {
    const count = 64;
    return Array.from({ length: count }, (_, i) => {
      const wave =
        Math.sin(i * 0.42) * 0.35 +
        Math.cos(i * 0.19) * 0.25 +
        Math.sin(i * 0.85) * 0.15;
      return Math.max(18, Math.min(92, Math.round((0.52 + wave) * 100)));
    });
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [mediaUrl]);

  useEffect(() => {
    if (!seekRequestMs || !mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, seekRequestMs.value / 1000);
    onTimeUpdate(seekRequestMs.value);
  }, [seekRequestMs, onTimeUpdate]);

  const togglePlay = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const skipBy = (deltaMs: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const maxSec = el.duration && Number.isFinite(el.duration) ? el.duration : durationMs / 1000;
    const nextSec = Math.max(0, Math.min(maxSec || 0, el.currentTime + deltaMs / 1000));
    el.currentTime = nextSec;
    onTimeUpdate(Math.round(nextSec * 1000));
  };

  const seekToRatio = (ratio: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const totalMs =
      el.duration && Number.isFinite(el.duration) ? el.duration * 1000 : durationMs;
    if (totalMs <= 0) return;
    const nextMs = Math.max(0, Math.min(totalMs, ratio * totalMs));
    el.currentTime = nextMs / 1000;
    onTimeUpdate(Math.round(nextMs));
  };

  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  const overlaySizeClass =
    overlaySize === 'sm'
      ? 'text-sm sm:text-base'
      : overlaySize === 'lg'
        ? 'text-lg sm:text-xl'
        : 'text-base sm:text-lg';

  const effectiveDurationMs = Math.max(
    durationMs,
    cues.length > 0 ? cues[cues.length - 1].endMs : 0,
    1000,
  );
  const progressPct = Math.min(100, Math.max(0, (currentTimeMs / effectiveDurationMs) * 100));

  return (
    <div className="luxury-border-frame rounded-2xl p-[1px] min-w-0 w-full">
      <div className="luxury-surface flex flex-col min-w-0 w-full rounded-[15px] overflow-hidden">
        {/* Media Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {mediaKind === 'video' ? (
              <FileVideo className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
            ) : (
              <FileAudio className="h-4 w-4 text-violet-300 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate text-sm font-semibold text-zinc-100" title={fileName}>
              {fileName}
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400 whitespace-nowrap shrink-0 tabular-nums">
              <span aria-hidden="true">· </span>
              {mediaKind === 'video' ? 'Video' : 'Audio'}
              <span aria-hidden="true"> · </span>
              {formatBytes(fileSizeBytes)}
            </span>
          </div>

          <button
            type="button"
            onClick={onReplaceFile}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Replace File</span>
          </button>
        </div>

        {/* Media Viewport with Live Amharic Subtitle Overlay */}
        <div className="relative bg-black aspect-video w-full flex flex-col items-center justify-center overflow-hidden">
          {mediaKind === 'video' ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl}
              playsInline
              onClick={togglePlay}
              onTimeUpdate={(e) => onTimeUpdate(Math.round(e.currentTarget.currentTime * 1000))}
              onLoadedMetadata={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) {
                  onDurationLoaded(Math.round(e.currentTarget.duration * 1000));
                }
              }}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="h-full w-full object-contain cursor-pointer"
            />
          ) : (
            <div className="flex h-full w-full flex-col justify-between p-6">
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={mediaUrl}
                onTimeUpdate={(e) => onTimeUpdate(Math.round(e.currentTarget.currentTime * 1000))}
                onLoadedMetadata={(e) => {
                  if (Number.isFinite(e.currentTarget.duration)) {
                    onDurationLoaded(Math.round(e.currentTarget.duration * 1000));
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Audio Waveform Preview</span>
                <span className="font-mono tabular-nums">
                  {formatDisplayTime(currentTimeMs)} / {formatDisplayTime(effectiveDurationMs)}
                </span>
              </div>

              <div
                className="my-auto flex h-24 items-end gap-[3px] px-2 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekToRatio(ratio);
                }}
                role="slider"
                aria-label="Audio waveform scrubber"
                aria-valuemin={0}
                aria-valuemax={effectiveDurationMs}
                aria-valuenow={currentTimeMs}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') skipBy(-2000);
                  if (e.key === 'ArrowRight') skipBy(2000);
                }}
              >
                {waveformBars.map((heightPct, index) => {
                  const barPct = ((index + 0.5) / waveformBars.length) * 100;
                  const played = barPct <= progressPct;
                  return (
                    <div
                      key={index}
                      className={`flex-1 rounded-sm transition-colors ${
                        played ? 'bg-amber-400' : 'bg-zinc-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>

              <div className="h-12" />
            </div>
          )}

          {/* Live Amharic Subtitle Overlay */}
          <div
            data-testid="live-subtitle-overlay"
            className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col items-center text-center"
          >
            {activeCue ? (
              <div className="max-w-[92%] rounded-md bg-black/85 px-4 py-2 text-zinc-50 border border-white/10">
                <p className={`font-ethiopic font-medium leading-snug ${overlaySizeClass}`}>
                  {activeCue.text}
                </p>
                {showOriginalOverlay && activeCue.originalText && (
                  <p className="mt-1 text-xs text-zinc-300 leading-snug">
                    {activeCue.originalText}
                  </p>
                )}
              </div>
            ) : (
              <div className="px-3 py-1 text-xs text-zinc-500">
                {cues.length > 0 ? 'Waiting for next spoken cue' : 'No subtitles generated yet'}
              </div>
            )}
          </div>
        </div>

        {/* Cue Timeline Scrubber */}
        <div className="border-t border-white/10 bg-zinc-950/70 px-4 py-3">
          <div
            className="relative h-7 w-full rounded-md bg-zinc-900 border border-white/10 overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seekToRatio(ratio);
            }}
            aria-label="Subtitle timeline"
          >
            {cues.map((cue) => {
              const leftPct = (cue.startMs / effectiveDurationMs) * 100;
              const widthPct = Math.max(0.8, ((cue.endMs - cue.startMs) / effectiveDurationMs) * 100);
              const isActive = activeCue?.id === cue.id;
              return (
                <button
                  key={cue.id}
                  type="button"
                  aria-label={`Jump to cue ${cue.index}: ${cue.text.slice(0, 24)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToRatio(cue.startMs / effectiveDurationMs);
                  }}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1 bottom-1 rounded-sm transition-colors ${
                    isActive ? 'bg-amber-400' : 'bg-violet-500/50 hover:bg-violet-400/70'
                  }`}
                />
              );
            })}

            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-amber-300"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause media' : 'Play media'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skipBy(-5000)}
                aria-label="Rewind 5 seconds"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>5s</span>
              </button>

              <button
                type="button"
                onClick={() => skipBy(5000)}
                aria-label="Forward 5 seconds"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span>5s</span>
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <span className="ml-1 font-mono text-xs text-zinc-300 tabular-nums">
                {formatDisplayTime(currentTimeMs)} <span className="text-zinc-600">/</span>{' '}
                {formatDisplayTime(effectiveDurationMs)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-white/10 bg-zinc-900 p-0.5 text-xs">
                {(['sm', 'md', 'lg'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setOverlaySize(size)}
                    aria-label={`Subtitle overlay size ${size}`}
                    className={`rounded px-2 py-1 uppercase font-medium transition-colors ${
                      overlaySize === size
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onToggleOriginalOverlay}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  showOriginalOverlay
                    ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bilingual Overlay
              </button>
            </div>
          </div>
        </div>

        {/* Subtitle Generation Toolbar */}
        <div className="border-t border-white/10 px-4 py-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
            <label className="sr-only" htmlFor="studio-source-mode">
              Source Audio Mode
            </label>
            <select
              id="studio-source-mode"
              value={sourceMode}
              onChange={(e) => onChangeSourceMode(e.target.value as SourceMode)}
              className="w-full sm:w-auto rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <option value="auto">Auto-detect → Amharic</option>
              <option value="amharic">Amharic Speech → Ge’ez</option>
              <option value="translate">Translate Speech → Amharic</option>
            </select>

            <label className="sr-only" htmlFor="studio-cue-style">
              Subtitle Pacing
            </label>
            <select
              id="studio-cue-style"
              value={cueStyle}
              onChange={(e) => onChangeCueStyle(e.target.value as CueStyle)}
              className="w-full sm:w-auto rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <option value="broadcast">Broadcast Pacing</option>
              <option value="compact">Compact Social Pacing</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerate}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Generating Amharic Subtitles…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isSample ? 'Re-run AI on Sample' : 'Generate Amharic Subtitles'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
