import type { SubtitleCue } from './subtitles';

export const SAMPLE_PROJECT_TITLE = 'Addis Ababa Tech Documentary (Sample).wav';

export const SAMPLE_AMHARIC_CUES: SubtitleCue[] = [
  {
    id: 'sample-1',
    index: 1,
    startMs: 400,
    endMs: 3200,
    text: 'ሰላም ለሁላችሁ፤ ወደ ዛሬው የአዲስ አበባ ቴክኖሎጂ ዘገባ እንኳን በደህና መጡ።',
    originalText: "Hello everyone, welcome to today's Addis Ababa technology report.",
    speaker: 'Narrator',
  },
  {
    id: 'sample-2',
    index: 2,
    startMs: 3400,
    endMs: 6500,
    text: 'በኢትዮጵያ የሚገኙ ወጣት ገንቢዎች ለአማርኛ ቋንቋ አዳዲስ መተግበሪያዎችን እየፈጠሩ ነው።',
    originalText: 'Young developers in Ethiopia are building new applications for the Amharic language.',
    speaker: 'Narrator',
  },
  {
    id: 'sample-3',
    index: 3,
    startMs: 6700,
    endMs: 9600,
    text: 'የድምጽ እና የቪዲዮ ፋይሎችን በቀጥታ ወደ ትክክለኛ የግዕዝ ፊደል ንዑስ ርዕሶች መቀየር ይቻላል።',
    originalText: 'Audio and video files can be turned directly into accurate Ge’ez script subtitles.',
    speaker: 'Narrator',
  },
  {
    id: 'sample-4',
    index: 4,
    startMs: 9800,
    endMs: 12900,
    text: 'ይህም ለፊልም አዘጋጆች፣ ለመምህራን እና ለይዘት ፈጣሪዎች ጊዜን ይቆጥባል።',
    originalText: 'This saves time for filmmakers, educators, and content creators.',
    speaker: 'Narrator',
  },
  {
    id: 'sample-5',
    index: 5,
    startMs: 13100,
    endMs: 15800,
    text: 'እያንዳንዱን ሰዓት እና ቃል እዚህ ገጽ ላይ በቀላሉ ማስተካከል ትችላላችሁ።',
    originalText: 'You can easily refine every timestamp and word right here on this page.',
    speaker: 'Narrator',
  },
  {
    id: 'sample-6',
    index: 6,
    startMs: 16000,
    endMs: 18500,
    text: 'በመጨረሻም በ SRT፣ VTT ወይም ASS ቅርጸት አውርደው መጠቀም ይችላሉ።',
    originalText: 'Finally, you can download and use them in SRT, VTT, or ASS format.',
    speaker: 'Narrator',
  },
];

/**
 * Synthesizes an 18.8-second stereo-safe mono WAV audio clip in memory
 * with gentle ambient chimes aligned to the 6 sample subtitle cues.
 */
export function createSampleAudioBlob(durationSeconds = 18.8): Blob {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Pentatonic-inspired Ethiopic Tizita chord tones (C4, D4, E4, G4, A4, C5)
  const cueFrequencies = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  const cueStarts = [0.4, 3.4, 6.7, 9.8, 13.1, 16.0];

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    let sample = 0;

    // Gentle warm bed
    sample += Math.sin(2 * Math.PI * 130.81 * t) * 0.04;

    for (let c = 0; c < cueStarts.length; c += 1) {
      const dt = t - cueStarts[c];
      if (dt >= 0 && dt < 2.6) {
        const attack = Math.min(1, dt / 0.08);
        const decay = Math.exp(-dt * 1.4);
        const freq = cueFrequencies[c];
        sample +=
          (Math.sin(2 * Math.PI * freq * dt) * 0.16 +
            Math.sin(2 * Math.PI * freq * 1.5 * dt) * 0.05) *
          attack *
          decay;
      }
    }

    const clamped = Math.max(-0.9, Math.min(0.9, sample));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
