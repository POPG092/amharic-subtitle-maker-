import React, { useRef, useState } from 'react';
import { FileAudio, FileVideo, Play, Upload } from 'lucide-react';
import type { CueStyle, SourceMode } from '../utils/subtitles';

interface UploadStageProps {
  sourceMode: SourceMode;
  cueStyle: CueStyle;
  onChangeSourceMode: (mode: SourceMode) => void;
  onChangeCueStyle: (style: CueStyle) => void;
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onTriggerUpload: () => void;
}

export const UploadStage: React.FC<UploadStageProps> = ({
  sourceMode,
  cueStyle,
  onChangeSourceMode,
  onChangeCueStyle,
  onFileSelected,
  onLoadSample,
  onTriggerUpload,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <section className="mx-auto max-w-[1160px] px-6 py-10 lg:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium tracking-wide text-amber-300/90">
          Video &amp; Audio Subtitling <span aria-hidden="true">·</span> Ge’ez Script (አማርኛ)
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl text-balance">
          Amharic subtitles from any video or audio
        </h1>
        <p className="mt-4 text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto">
          Upload Amharic or foreign-language media to generate time-synced Ge’ez subtitles, refine
          timings inline, and export clean SRT, WebVTT, ASS, or plain text files.
        </p>
      </div>

      <div className="mt-9 mx-auto max-w-3xl luxury-border-frame rounded-2xl p-[1px] shadow-2xl shadow-black/60">
        <div className="luxury-surface rounded-[15px] p-6 sm:p-8">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors duration-150 ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-white/15 bg-zinc-950/75 hover:border-amber-400/40'
            }`}
          >
            <div className="flex items-center gap-3 text-zinc-300">
              <FileVideo className="h-6 w-6 text-amber-300" aria-hidden="true" />
              <span className="text-zinc-600" aria-hidden="true">/</span>
              <FileAudio className="h-6 w-6 text-violet-300" aria-hidden="true" />
            </div>

            <h2 className="mt-4 font-display text-lg font-semibold text-zinc-100">
              Drop a video or audio file here
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              MP4 · MOV · WebM · MKV · MP3 · WAV · M4A · FLAC (up to 80 MB)
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onTriggerUpload}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Choose Media File</span>
              </button>

              <button
                type="button"
                onClick={onLoadSample}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/90 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors duration-150 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Load Sample Project</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-zinc-400 mb-2">
                Source Audio Handling
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-950/90 p-1 border border-white/10">
                {(
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'amharic', label: 'Amharic' },
                    { id: 'translate', label: 'Translate' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChangeSourceMode(option.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      sourceMode === option.id
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-400 mb-2">
                Subtitle Pacing
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/90 p-1 border border-white/10">
                {(
                  [
                    { id: 'broadcast', label: 'Broadcast (68 chars)' },
                    { id: 'compact', label: 'Compact (36 chars)' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChangeCueStyle(option.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                      cueStyle === option.id
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 mx-auto max-w-4xl grid gap-6 sm:grid-cols-3 border-t border-white/10 pt-8">
        <div>
          <h3 className="font-display text-sm font-semibold text-zinc-100">
            01. Transcribe or Translate
          </h3>
          <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
            Transcribes native Amharic speech into Ge’ez script or translates English and other
            spoken languages directly into natural Amharic.
          </p>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-zinc-100">
            02. Frame-Synced Cue Editor
          </h3>
          <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
            Preview live Amharic overlays over video or audio waveforms, split long phrases, and
            shift global cue timing in 250ms steps.
          </p>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-zinc-100">
            03. Cloud History &amp; Export
          </h3>
          <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
            Every generated subtitle set is saved to your Supabase history for instant .srt,
            WebVTT, ASS, or plain text downloads anytime.
          </p>
        </div>
      </div>
    </section>
  );
};
