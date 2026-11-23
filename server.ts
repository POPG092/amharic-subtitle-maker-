import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  normalizeCues,
  type CueStyle,
  type RawCueInput,
  type SourceMode,
} from './src/utils/subtitles.ts';
import {
  evaluateSubscriptionState,
  type UserProfile,
} from './src/utils/subscription.ts';

dotenv.config();

const PORT = 3000;
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024; // 80 MB
const INLINE_DATA_THRESHOLD_BYTES = 14 * 1024 * 1024; // 14 MB

function getSupabaseServerConfig(): { url: string; anonKey: string } | null {
  const url = (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !anonKey || url.includes('your-project-id')) {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

async function verifySupabaseUserAndProfile(accessToken: string): Promise<{
  userId: string;
  email: string;
  profile: UserProfile;
  supabaseUrl: string;
  anonKey: string;
}> {
  const cfg = getSupabaseServerConfig();
  if (!cfg) {
    throw Object.assign(
      new Error('Supabase is not configured on the server. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      { status: 503 },
    );
  }

  // 1. Verify caller JWT against Supabase Auth
  const userResp = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResp.ok) {
    throw Object.assign(
      new Error('Invalid or expired session. Please sign in again.'),
      { status: 401 },
    );
  }

  const userJson = (await userResp.json()) as { id?: string; email?: string };
  if (!userJson.id) {
    throw Object.assign(
      new Error('Invalid Supabase user session.'),
      { status: 401 },
    );
  }

  // 2. Fetch caller profile via Supabase REST with caller's Bearer token (enforces RLS)
  const profileResp = await fetch(
    `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userJson.id)}&select=*`,
    {
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!profileResp.ok) {
    throw Object.assign(
      new Error('Unable to load account subscription profile.'),
      { status: 403 },
    );
  }

  const rows = (await profileResp.json()) as UserProfile[];
  const profile: UserProfile = rows[0] ?? {
    id: userJson.id,
    email: userJson.email ?? '',
    plan_type: 'free',
    videos_used: 0,
    is_pro: false,
    pro_expires_at: null,
    payment_status: 'none',
  };

  return {
    userId: userJson.id,
    email: userJson.email ?? '',
    profile,
    supabaseUrl: cfg.url,
    anonKey: cfg.anonKey,
  };
}

async function patchSupabaseProfile(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Failed to update subscription profile (${resp.status}).`);
  }
}

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'video/mpeg',
  'video/x-msvideo',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
]);

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
};

const uploadDir = path.join(os.tmpdir(), 'fidelsub-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime) || Boolean(EXTENSION_MIME_FALLBACK[ext])) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported media format. Please upload MP4, WebM, MOV, MKV, MP3, WAV, M4A, OGG, AAC, or FLAC files.',
        ),
      );
    }
  },
});

function resolveMimeType(file: Express.Multer.File): string {
  const mime = file.mimetype.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(mime)) {
    return mime === 'audio/mp3' ? 'audio/mpeg' : mime;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  return EXTENSION_MIME_FALLBACK[ext] || 'application/octet-stream';
}

function buildInstruction(
  sourceMode: SourceMode,
  cueStyle: CueStyle,
  includeOriginal: boolean,
): string {
  const modeGuidance =
    sourceMode === 'amharic'
      ? 'The spoken language is primarily Amharic. Transcribe every spoken utterance accurately in native Amharic Ge’ez script (አማርኛ ፊደል), preserving natural Amharic punctuation (። ፣ ፤).'
      : sourceMode === 'translate'
        ? 'Transcribe the spoken audio/video and translate every segment into clear, idiomatic Amharic written in native Ge’ez script (አማርኛ ፊደል).'
        : 'Detect the spoken language automatically. If spoken in Amharic, transcribe accurately in native Amharic Ge’ez script (አማርኛ). If spoken in English or any other language, translate faithfully into natural, idiomatic Amharic Ge’ez script (አማርኛ).';

  const pacingGuidance =
    cueStyle === 'compact'
      ? 'Keep each subtitle cue concise for vertical/social video: 1 to 2 short lines, max ~36 characters per cue, 1.5–4 seconds each.'
      : 'Use standard broadcast subtitle pacing: 1 to 2 readable lines per cue, max ~68 characters per cue, 2–5.5 seconds each, split cleanly at natural phrase pauses.';

  const originalGuidance = includeOriginal
    ? 'Also include `originalText` with the verbatim transcript in the original spoken language when helpful.'
    : 'Leave `originalText` empty unless needed.';

  return [
    'You are an expert Amharic (Ethiopic Ge’ez script) subtitling specialist.',
    modeGuidance,
    pacingGuidance,
    originalGuidance,
    'Align `startTime` and `endTime` precisely to when speech begins and ends using HH:MM:SS.mmm format (e.g., 00:00:04.250).',
    'Never invent dialogue during music-only or silent sections. Return cues in strict chronological order.',
  ].join(' ');
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message:
        'Gemini API access was denied or the API key is invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached. Please wait briefly and try again or check your billing quota in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('File too large')) {
    return {
      status: 413,
      message: 'Media file exceeds the 80 MB upload limit. Please trim or compress the file and retry.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Failed to generate Amharic subtitles from the uploaded media.',
  };
}

function safeUnlink(filePath?: string) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup failure
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      hasSupabase: Boolean(getSupabaseServerConfig()),
    });
  });

  app.post('/api/subtitles/generate', (req, res) => {
    upload.single('media')(req, res, async (uploadErr) => {
      if (uploadErr) {
        const status =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE'
            ? 413
            : 400;
        res.status(status).json({ error: uploadErr.message || 'Invalid upload request.' });
        return;
      }

      const file = req.file;

      // 1. Verify Supabase Auth Bearer Token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        safeUnlink(file?.path);
        res.status(401).json({ error: 'Please sign in to generate Amharic subtitles.' });
        return;
      }

      const accessToken = authHeader.slice('Bearer '.length).trim();
      let verified;
      try {
        verified = await verifySupabaseUserAndProfile(accessToken);
      } catch (authErr) {
        safeUnlink(file?.path);
        const status = (authErr as { status?: number })?.status ?? 401;
        const msg = authErr instanceof Error ? authErr.message : 'Authentication required.';
        res.status(status).json({ error: msg });
        return;
      }

      // 2. Enforce Automatic Plan Expiration & Free Trial Limit
      const evaluation = evaluateSubscriptionState(verified.profile, new Date());
      if (evaluation.needsExpirationTermination && evaluation.terminationPatch) {
        try {
          await patchSupabaseProfile(
            verified.supabaseUrl,
            verified.anonKey,
            accessToken,
            verified.userId,
            evaluation.terminationPatch,
          );
        } catch {
          // continue returning PLAN_EXPIRED even if patch fails transiently
        }
        safeUnlink(file?.path);
        res.status(403).json({
          code: 'PLAN_EXPIRED',
          error: 'Your Pro plan has expired. Renew your package via Telebirr to continue.',
        });
        return;
      }

      if (!evaluation.canGenerate) {
        safeUnlink(file?.path);
        res.status(403).json({
          code: evaluation.reason === 'plan_expired' ? 'PLAN_EXPIRED' : 'TRIAL_EXHAUSTED',
          error:
            evaluation.reason === 'plan_expired'
              ? 'Your Pro plan has expired. Renew via Telebirr to continue.'
              : 'Free trial limit reached (1 video). Upgrade to Pro via Telebirr (0951084993) to continue.',
        });
        return;
      }

      if (!file) {
        res.status(400).json({ error: 'No video or audio file was uploaded.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        safeUnlink(file.path);
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured yet. Add your key in Settings > Secrets, or try the Sample Project.',
        });
        return;
      }

      const rawMode = String(req.body?.sourceMode ?? 'auto');
      const sourceMode: SourceMode =
        rawMode === 'amharic' || rawMode === 'translate' ? rawMode : 'auto';
      const rawStyle = String(req.body?.cueStyle ?? 'broadcast');
      const cueStyle: CueStyle = rawStyle === 'compact' ? 'compact' : 'broadcast';
      const includeOriginal = String(req.body?.includeOriginal ?? 'true') !== 'false';

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let uploadedFileName: string | undefined;

      try {
        const mimeType = resolveMimeType(file);
        const promptText = buildInstruction(sourceMode, cueStyle, includeOriginal);

        const mediaPart =
          file.size <= INLINE_DATA_THRESHOLD_BYTES
            ? {
                inlineData: {
                  mimeType,
                  data: fs.readFileSync(file.path).toString('base64'),
                },
              }
            : await (async () => {
                const uploaded = await ai.files.upload({
                  file: file.path,
                  config: { mimeType },
                });
                uploadedFileName = uploaded.name;

                let current = uploaded;
                const deadline = Date.now() + 90_000;
                while (current.state === 'PROCESSING' && Date.now() < deadline) {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  if (!current.name) break;
                  current = await ai.files.get({ name: current.name });
                }

                if (current.state === 'FAILED') {
                  throw new Error('Gemini media processing failed for this file format.');
                }

                return {
                  fileData: {
                    fileUri: current.uri ?? '',
                    mimeType: current.mimeType ?? mimeType,
                  },
                };
              })();

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              mediaPart,
              {
                text: 'Generate time-synced Amharic (Ge’ez script) subtitle cues for all speech in this media.',
              },
            ],
          },
          config: {
            systemInstruction: promptText,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedLanguage: {
                  type: Type.STRING,
                  description: 'Primary spoken language detected in the media.',
                },
                cues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      startTime: {
                        type: Type.STRING,
                        description: 'Cue start timestamp in HH:MM:SS.mmm format.',
                      },
                      endTime: {
                        type: Type.STRING,
                        description: 'Cue end timestamp in HH:MM:SS.mmm format.',
                      },
                      amharicText: {
                        type: Type.STRING,
                        description: 'Subtitle text written in Amharic Ge’ez script.',
                      },
                      originalText: {
                        type: Type.STRING,
                        description: 'Original spoken transcript when translated.',
                      },
                      speaker: {
                        type: Type.STRING,
                        description: 'Optional speaker label (e.g., Speaker 1).',
                      },
                    },
                    required: ['startTime', 'endTime', 'amharicText'],
                  },
                },
              },
              required: ['cues'],
            },
          },
        });

        const rawJson = (response.text ?? '{}').trim();
        let parsed: { detectedLanguage?: string; cues?: RawCueInput[] } = {};
        try {
          parsed = JSON.parse(rawJson) as { detectedLanguage?: string; cues?: RawCueInput[] };
        } catch {
          throw new Error('The subtitle generator returned an unreadable response. Please retry.');
        }

        const cues = normalizeCues(Array.isArray(parsed.cues) ? parsed.cues : []);

        // 3. Increment videos_used after generation
        const nextVideosUsed = (Number(verified.profile.videos_used) || 0) + 1;
        await patchSupabaseProfile(
          verified.supabaseUrl,
          verified.anonKey,
          accessToken,
          verified.userId,
          { videos_used: nextVideosUsed },
        );

        res.json({
          detectedLanguage: parsed.detectedLanguage || 'Detected Speech',
          cues,
          videosUsed: nextVideosUsed,
        });
      } catch (err) {
        const { status, message } = extractErrorDetails(err);
        res.status(status).json({ error: message });
      } finally {
        safeUnlink(file.path);
        if (uploadedFileName) {
          ai.files.delete({ name: uploadedFileName }).catch(() => undefined);
        }
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FidelSub server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FidelSub server:', err);
  process.exit(1);
});
