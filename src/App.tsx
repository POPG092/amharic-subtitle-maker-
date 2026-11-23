import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AlertCircle, Crown, X } from 'lucide-react';
import { ApprovalsPanel } from './components/ApprovalsPanel';
import { AuthScreen } from './components/AuthScreen';
import { CueEditorPanel } from './components/CueEditorPanel';
import { ExportStudio } from './components/ExportStudio';
import { HistoryPanel } from './components/HistoryPanel';
import { MediaPlayerStage } from './components/MediaPlayerStage';
import { TopBar, type ActiveView } from './components/TopBar';
import { UpgradeModal } from './components/UpgradeModal';
import { UploadStage } from './components/UploadStage';
import {
  approveUserPlanByOwner,
  deleteSubtitleHistoryRow,
  fetchAllProfilesForOwner,
  fetchAndEnforceProfile,
  fetchUserSubtitleHistory,
  isSupabaseConfigured,
  resetUserToFreeByOwner,
  saveSubtitleToHistory,
  signInWithEmailPassword,
  signInWithGoogleOAuth,
  signOutSupabase,
  signUpWithEmailPassword,
  submitTelebirrPaymentRequest,
  supabase,
  type SubtitleHistoryRow,
} from './lib/supabase';
import { createSampleAudioBlob, SAMPLE_AMHARIC_CUES, SAMPLE_PROJECT_TITLE } from './utils/sampleMedia';
import {
  evaluateSubscriptionState,
  formatPlanLabel,
  isOwnerEmail,
  type PaidPlanType,
  type UserProfile,
} from './utils/subscription';
import {
  exportToSrt,
  findActiveCue,
  getExportMimeType,
  mergeWithNextCue,
  normalizeCues,
  reindexCues,
  shiftCueTimings,
  splitCue,
  type CueStyle,
  type ExportFormat,
  type SourceMode,
  type SubtitleCue,
} from './utils/subtitles';

interface LoadedMedia {
  file: File;
  url: string;
  kind: 'video' | 'audio';
  isSample: boolean;
}

const MAX_CLIENT_BYTES = 80 * 1024 * 1024;

function inferMediaKind(file: File): 'video' | 'audio' | null {
  const mime = file.type;
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'mpeg', 'mpg'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg', 'oga', 'aac', 'flac'].includes(ext)) return 'audio';
  return null;
}

export default function App() {
  // Supabase Auth & Profile State
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Plan Expiration & Upgrade Modal State
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [expiredFromPlan, setExpiredFromPlan] = useState<'monthly' | 'yearly' | null>(null);

  // Subtitle History & Owner Approvals
  const [historyRows, setHistoryRows] = useState<SubtitleHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);

  // Studio State
  const [activeView, setActiveView] = useState<ActiveView>('studio');
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('auto');
  const [cueStyle, setCueStyle] = useState<CueStyle>('broadcast');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('srt');
  const [showOriginalOverlay, setShowOriginalOverlay] = useState(false);

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [seekRequestMs, setSeekRequestMs] = useState<{ value: number; seq: number } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaUrlRef = useRef<string | null>(null);
  const authSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (mediaUrlRef.current) {
        URL.revokeObjectURL(mediaUrlRef.current);
      }
    };
  }, []);

  const syncUserState = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      setHistoryRows([]);
      setAllProfiles([]);
      setExpiredFromPlan(null);
      setActiveView('studio');
      return;
    }

    try {
      const { profile: enforcedProfile, justExpiredPlan } = await fetchAndEnforceProfile(nextUser);
      setProfile(enforcedProfile);
      if (justExpiredPlan) {
        setExpiredFromPlan(justExpiredPlan);
        setUpgradeModalOpen(true);
      }

      setHistoryLoading(true);
      const history = await fetchUserSubtitleHistory(nextUser.id);
      setHistoryRows(history);

      if (isOwnerEmail(nextUser.email)) {
        const profiles = await fetchAllProfilesForOwner();
        setAllProfiles(profiles);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to load your Supabase profile or history.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Listen to Supabase Auth State
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      void syncUserState(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
      void syncUserState(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncUserState]);

  const isOwner = isOwnerEmail(user?.email);

  const subscriptionEval = useMemo(
    () =>
      profile
        ? evaluateSubscriptionState(profile, new Date())
        : evaluateSubscriptionState({
            plan_type: 'free',
            videos_used: 0,
            is_pro: false,
            pro_expires_at: null,
            payment_status: 'none',
          }),
    [profile],
  );

  const pendingApprovalCount = useMemo(
    () => allProfiles.filter((p) => p.payment_status === 'pending').length,
    [allProfiles],
  );

  const handleSignInEmail = async (email: string, password: string) => {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithEmailPassword(email, password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignUpEmail = async (email: string, password: string) => {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const data = await signUpWithEmailPassword(email, password);
      if (!data.session) {
        setAuthNotice(
          'Account created! Check your email inbox to confirm your address before signing in.',
        );
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignInGoogle = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithGoogleOAuth();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    setAuthError(null);
    setAuthNotice(null);
    await signOutSupabase();
  };

  const verifyQuotaBeforeGeneration = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setErrorMsg('Please sign in to generate subtitles.');
      return false;
    }

    try {
      const { profile: latest, justExpiredPlan } = await fetchAndEnforceProfile(user);
      setProfile(latest);
      const check = evaluateSubscriptionState(latest, new Date());

      if (justExpiredPlan || check.reason === 'plan_expired') {
        setExpiredFromPlan(justExpiredPlan ?? 'monthly');
        setUpgradeModalOpen(true);
        return false;
      }

      if (!check.canGenerate) {
        setExpiredFromPlan(null);
        setUpgradeModalOpen(true);
        return false;
      }

      return true;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to verify subscription status.');
      return false;
    }
  }, [user]);

  const loadSampleProject = useCallback(() => {
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
    }
    const blob = createSampleAudioBlob(18.8);
    const sampleFile = new File([blob], SAMPLE_PROJECT_TITLE, { type: 'audio/wav' });
    const url = URL.createObjectURL(sampleFile);
    mediaUrlRef.current = url;

    setMedia({
      file: sampleFile,
      url,
      kind: 'audio',
      isSample: true,
    });
    setCues(SAMPLE_AMHARIC_CUES.map((c) => ({ ...c })));
    setDurationMs(18800);
    setCurrentTimeMs(500);
    setSeekRequestMs((prev) => ({ value: 500, seq: (prev?.seq ?? 0) + 1 }));
    setDetectedLanguage('Sample Amharic Narration');
    setErrorMsg(null);
    setActiveView('studio');
  }, []);

  const generateFromMedia = useCallback(
    async (targetFile: File, mode: SourceMode, style: CueStyle) => {
      if (!user || !session) {
        setErrorMsg('Please sign in before generating Amharic subtitles.');
        return;
      }

      const permitted = await verifyQuotaBeforeGeneration();
      if (!permitted) return;

      setIsGenerating(true);
      setErrorMsg(null);

      try {
        const formData = new FormData();
        formData.append('media', targetFile);
        formData.append('sourceMode', mode);
        formData.append('cueStyle', style);
        formData.append('includeOriginal', 'true');

        const response = await fetch('/api/subtitles/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          detectedLanguage?: string;
          cues?: SubtitleCue[];
          videosUsed?: number;
        };

        if (!response.ok) {
          if (payload.code === 'PLAN_EXPIRED') {
            await syncUserState(user);
            setExpiredFromPlan('monthly');
            setUpgradeModalOpen(true);
            return;
          }
          if (payload.code === 'TRIAL_EXHAUSTED') {
            await syncUserState(user);
            setExpiredFromPlan(null);
            setUpgradeModalOpen(true);
            return;
          }
          throw new Error(payload.error || `Subtitle generation failed (${response.status}).`);
        }

        const nextCues = normalizeCues(Array.isArray(payload.cues) ? payload.cues : []);
        const detected = payload.detectedLanguage || 'Detected Speech';
        setCues(nextCues);
        setDetectedLanguage(detected);

        if (typeof payload.videosUsed === 'number') {
          setProfile((prev) => (prev ? { ...prev, videos_used: payload.videosUsed! } : prev));
        }

        // Persist generated Amharic subtitles to Supabase `subtitles` table
        if (nextCues.length > 0) {
          const kind = inferMediaKind(targetFile) ?? 'audio';
          const srtContent = exportToSrt(nextCues, { includeUtf8Bom: false });
          const savedRow = await saveSubtitleToHistory({
            userId: user.id,
            fileName: targetFile.name,
            mediaKind: kind,
            sourceMode: mode,
            detectedLanguage: detected,
            cues: nextCues,
            srtContent,
          });
          setHistoryRows((prev) => [savedRow, ...prev]);
        } else {
          setErrorMsg('No clear speech was detected in this media file.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to process media file.';
        setErrorMsg(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [session, syncUserState, user, verifyQuotaBeforeGeneration],
  );

  const handleFileSelected = useCallback(
    (file: File) => {
      const kind = inferMediaKind(file);
      if (!kind) {
        setErrorMsg(
          'Unsupported file format. Please select a video (MP4, WebM, MOV, MKV) or audio (MP3, WAV, M4A, OGG, FLAC) file.',
        );
        return;
      }

      if (file.size > MAX_CLIENT_BYTES) {
        setErrorMsg('File exceeds the 80 MB limit. Please select a smaller video or audio clip.');
        return;
      }

      if (mediaUrlRef.current) {
        URL.revokeObjectURL(mediaUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      mediaUrlRef.current = url;

      setMedia({
        file,
        url,
        kind,
        isSample: false,
      });
      setCues([]);
      setCurrentTimeMs(0);
      setDurationMs(0);
      setDetectedLanguage(null);
      setErrorMsg(null);
      setActiveView('studio');

      void generateFromMedia(file, sourceMode, cueStyle);
    },
    [cueStyle, generateFromMedia, sourceMode],
  );

  const handleTriggerUpload = async () => {
    if (!user) return;
    const permitted = await verifyQuotaBeforeGeneration();
    if (!permitted) return;

    setActiveView('studio');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleQuickExportSrt = () => {
    if (cues.length === 0) return;
    const srtContent = exportToSrt(cues, { includeUtf8Bom: true });
    const blob = new Blob([srtContent], { type: getExportMimeType('srt') });
    const url = URL.createObjectURL(blob);
    const base = (media?.file.name || 'amharic_subtitles').replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}_am.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadHistoryRowIntoStudio = (row: SubtitleHistoryRow) => {
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
    }
    const maxSec =
      row.cues.length > 0 ? Math.max(12, Math.ceil(row.cues[row.cues.length - 1].endMs / 1000) + 1) : 15;
    const blob = createSampleAudioBlob(maxSec);
    const previewFile = new File([blob], row.file_name, { type: 'audio/wav' });
    const url = URL.createObjectURL(previewFile);
    mediaUrlRef.current = url;

    setMedia({
      file: previewFile,
      url,
      kind: 'audio',
      isSample: false,
    });
    setCues(normalizeCues(row.cues));
    setDurationMs(maxSec * 1000);
    setCurrentTimeMs(0);
    setDetectedLanguage(row.detected_language || 'Saved History');
    setActiveView('studio');
  };

  const handleDeleteHistoryRow = async (id: string) => {
    if (!user) return;
    await deleteSubtitleHistoryRow(id, user.id);
    setHistoryRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmitTelebirr = async (plan: PaidPlanType, reference: string) => {
    if (!user) return;
    const updated = await submitTelebirrPaymentRequest(user.id, plan, reference);
    setProfile(updated);
    if (isOwner) {
      const profiles = await fetchAllProfilesForOwner();
      setAllProfiles(profiles);
    }
  };

  const handleApprovePlan = async (targetUserId: string, plan: PaidPlanType) => {
    setBusyProfileId(targetUserId);
    try {
      const updated = await approveUserPlanByOwner(targetUserId, plan);
      setAllProfiles((prev) => prev.map((p) => (p.id === targetUserId ? updated : p)));
      if (user && targetUserId === user.id) {
        setProfile(updated);
      }
    } finally {
      setBusyProfileId(null);
    }
  };

  const handleResetFree = async (targetUserId: string) => {
    setBusyProfileId(targetUserId);
    try {
      const updated = await resetUserToFreeByOwner(targetUserId);
      setAllProfiles((prev) => prev.map((p) => (p.id === targetUserId ? updated : p)));
      if (user && targetUserId === user.id) {
        setProfile(updated);
      }
    } finally {
      setBusyProfileId(null);
    }
  };

  const activeCue = useMemo(() => findActiveCue(cues, currentTimeMs), [cues, currentTimeMs]);

  const handleUpdateCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    setCues((prev) =>
      reindexCues(prev.map((c) => (c.id === cueId ? { ...c, ...patch } : c))),
    );
  };

  const handleDeleteCue = (cueId: string) => {
    setCues((prev) => reindexCues(prev.filter((c) => c.id !== cueId)));
  };

  const handleSplitCue = (cueId: string) => {
    setCues((prev) => splitCue(prev, cueId));
  };

  const handleMergeWithNext = (cueId: string) => {
    setCues((prev) => mergeWithNextCue(prev, cueId));
  };

  const handleAddCue = () => {
    const lastEnd = cues.length > 0 ? cues[cues.length - 1].endMs : currentTimeMs;
    const startMs = Math.max(0, lastEnd + 200);
    const endMs = startMs + 2500;
    const newCue: SubtitleCue = {
      id: `cue-${Date.now().toString(36)}`,
      index: cues.length + 1,
      startMs,
      endMs,
      text: 'አዲስ የአማርኛ ንዑስ ርዕስ',
    };
    setCues((prev) => reindexCues([...prev, newCue]));
    setSeekRequestMs((prev) => ({ value: startMs, seq: (prev?.seq ?? 0) + 1 }));
  };

  const handleShiftAll = (offsetMs: number) => {
    setCues((prev) => shiftCueTimings(prev, offsetMs));
  };

  const handleSeekToCue = (startMs: number) => {
    setSeekRequestMs((prev) => ({ value: startMs, seq: (prev?.seq ?? 0) + 1 }));
  };

  const planSummaryLabel = useMemo(() => formatPlanLabel(profile), [profile]);

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
      <TopBar
        isSignedIn={Boolean(user)}
        isOwner={isOwner}
        isProActive={subscriptionEval.isProActive}
        hasMedia={Boolean(media)}
        hasCues={cues.length > 0}
        historyCount={historyRows.length}
        pendingApprovalCount={pendingApprovalCount}
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenPricing={() => {
          setExpiredFromPlan(
            subscriptionEval.reason === 'plan_expired'
              ? subscriptionEval.expiredFromPlan
              : null,
          );
          setUpgradeModalOpen(true);
        }}
        onLoadSample={loadSampleProject}
        onTriggerUpload={() => void handleTriggerUpload()}
        onQuickExport={handleQuickExportSrt}
        onSignOut={() => void handleSignOut()}
        onFocusAuth={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {user && (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.mp3,.wav,.m4a,.ogg,.aac,.flac"
          className="hidden"
          aria-label="Upload video or audio file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelected(file);
            }
          }}
        />
      )}

      {/* Account Plan Strip & Mobile Nav */}
      {user && (
        <div className="border-b border-white/10 bg-zinc-950/70">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2 text-xs text-zinc-400">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-zinc-200 truncate max-w-[200px] sm:max-w-none">{user.email}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`tabular-nums ${
                  subscriptionEval.reason === 'plan_expired'
                    ? 'text-rose-300 font-medium'
                    : subscriptionEval.isProActive
                      ? 'text-amber-300 font-medium'
                      : 'text-zinc-300'
                }`}
              >
                {planSummaryLabel}
              </span>
              {!subscriptionEval.isProActive && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium underline underline-offset-4 whitespace-nowrap"
                  >
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    <span>Upgrade to Pro</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex md:hidden items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveView('studio')}
                className={activeView === 'studio' ? 'text-zinc-50 font-medium' : 'text-zinc-400'}
              >
                Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={activeView === 'history' ? 'text-zinc-50 font-medium' : 'text-zinc-400'}
              >
                History ({historyRows.length})
              </button>
              {media && (
                <button
                  type="button"
                  onClick={() => setActiveView('export')}
                  className={activeView === 'export' ? 'text-zinc-50 font-medium' : 'text-zinc-400'}
                >
                  Export
                </button>
              )}
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="text-amber-300"
              >
                Pro
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setActiveView('approvals')}
                  className={
                    activeView === 'approvals' ? 'text-zinc-50 font-medium' : 'text-zinc-400'
                  }
                >
                  Approvals
                </button>
              )}
              <button type="button" onClick={() => void handleSignOut()} className="text-zinc-400">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mx-auto mt-4 w-full max-w-[1440px] px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
              className="text-rose-300 hover:text-white shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {!user ? (
          <div ref={authSectionRef}>
            <AuthScreen
              authLoading={authLoading}
              isSupabaseConfigured={isSupabaseConfigured}
              isSubmitting={authSubmitting}
              authError={authError}
              authNotice={authNotice}
              onSignInEmail={handleSignInEmail}
              onSignUpEmail={handleSignUpEmail}
              onSignInGoogle={handleSignInGoogle}
              onOpenPricing={() => setUpgradeModalOpen(true)}
            />
          </div>
        ) : activeView === 'history' ? (
          <HistoryPanel
            rows={historyRows}
            loading={historyLoading}
            onLoadRowIntoStudio={handleLoadHistoryRowIntoStudio}
            onDeleteRow={handleDeleteHistoryRow}
            onGoToStudio={() => setActiveView('studio')}
          />
        ) : activeView === 'approvals' && isOwner ? (
          <ApprovalsPanel
            profiles={allProfiles}
            busyId={busyProfileId}
            onApprovePlan={handleApprovePlan}
            onResetFree={handleResetFree}
          />
        ) : !media ? (
          <UploadStage
            sourceMode={sourceMode}
            cueStyle={cueStyle}
            onChangeSourceMode={setSourceMode}
            onChangeCueStyle={setCueStyle}
            onFileSelected={handleFileSelected}
            onLoadSample={loadSampleProject}
            onTriggerUpload={() => void handleTriggerUpload()}
          />
        ) : (
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6">
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              {/* Left Stage: Media Player + Live Amharic Overlay + Timeline */}
              <div className="min-w-0 lg:col-span-6">
                <MediaPlayerStage
                  mediaUrl={media.url}
                  mediaKind={media.kind}
                  fileName={media.file.name}
                  fileSizeBytes={media.file.size}
                  isSample={media.isSample}
                  cues={cues}
                  activeCue={activeCue}
                  currentTimeMs={currentTimeMs}
                  durationMs={durationMs}
                  isGenerating={isGenerating}
                  sourceMode={sourceMode}
                  cueStyle={cueStyle}
                  showOriginalOverlay={showOriginalOverlay}
                  onChangeSourceMode={setSourceMode}
                  onChangeCueStyle={setCueStyle}
                  onToggleOriginalOverlay={() => setShowOriginalOverlay((v) => !v)}
                  onGenerate={() => void generateFromMedia(media.file, sourceMode, cueStyle)}
                  onReplaceFile={() => void handleTriggerUpload()}
                  onTimeUpdate={setCurrentTimeMs}
                  onDurationLoaded={setDurationMs}
                  seekRequestMs={seekRequestMs}
                />
              </div>

              {/* Right Stage: Cue Editor / Export Studio */}
              <div className="min-w-0 lg:col-span-6 luxury-border-frame rounded-2xl p-[1px]">
                <div className="luxury-surface rounded-[15px] overflow-hidden flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-1 rounded-lg bg-zinc-950 p-1 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setActiveView('studio')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          activeView === 'studio'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Cue Editor ({cues.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView('export')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          activeView === 'export'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Export Subtitles
                      </button>
                    </div>

                    {detectedLanguage && (
                      <span className="text-xs text-zinc-400 truncate max-w-[240px]">
                        Source: {detectedLanguage}
                      </span>
                    )}
                  </div>

                  {activeView === 'studio' ? (
                    <CueEditorPanel
                      cues={cues}
                      activeCueId={activeCue?.id ?? null}
                      isGenerating={isGenerating}
                      onUpdateCue={handleUpdateCue}
                      onDeleteCue={handleDeleteCue}
                      onSplitCue={handleSplitCue}
                      onMergeWithNext={handleMergeWithNext}
                      onAddCue={handleAddCue}
                      onShiftAll={handleShiftAll}
                      onSeekToCue={handleSeekToCue}
                      onGenerate={() => void generateFromMedia(media.file, sourceMode, cueStyle)}
                    />
                  ) : (
                    <ExportStudio
                      cues={cues}
                      projectTitle={media.file.name}
                      selectedFormat={selectedFormat}
                      onSelectFormat={setSelectedFormat}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        isSignedIn={Boolean(user)}
        isExpired={Boolean(expiredFromPlan) || subscriptionEval.reason === 'plan_expired'}
        expiredFromPlan={expiredFromPlan ?? subscriptionEval.expiredFromPlan}
        trialExhausted={subscriptionEval.reason === 'trial_exhausted'}
        profile={profile}
        onClose={() => setUpgradeModalOpen(false)}
        onRequireSignIn={() => {
          setUpgradeModalOpen(false);
          authSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
        onSubmitTelebirr={handleSubmitTelebirr}
      />
    </div>
  );
}
