import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { SubtitleCue } from '../utils/subtitles';
import {
  computeExpiryIso,
  evaluateSubscriptionState,
  type PaidPlanType,
  type UserProfile,
} from '../utils/subscription';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const rawAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

export const isSupabaseConfigured =
  Boolean(rawUrl) &&
  Boolean(rawAnonKey) &&
  !rawUrl.includes('your-project-id') &&
  !rawAnonKey.includes('your-supabase-anon');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface SubtitleHistoryRow {
  id: string;
  user_id: string;
  file_name: string;
  media_kind: 'video' | 'audio';
  source_mode: string;
  detected_language: string | null;
  cues: SubtitleCue[];
  srt_content: string;
  cue_count: number;
  created_at: string;
}

function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.',
    );
  }
  return supabase;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmailPassword(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session) {
    const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInErr && signInData.session) {
      return signInData;
    }
  }
  return data;
}

export async function signInWithGoogleOAuth() {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchAndEnforceProfile(user: User): Promise<{
  profile: UserProfile;
  justExpiredPlan: 'monthly' | 'yearly' | null;
}> {
  const client = requireSupabase();
  const { data: existing, error: selectErr } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectErr) {
    throw new Error(selectErr.message);
  }

  let profile = existing as UserProfile | null;

  if (!profile) {
    const newRow = {
      id: user.id,
      email: user.email ?? '',
      plan_type: 'free' as const,
      videos_used: 0,
      is_pro: false,
      pro_expires_at: null,
      payment_status: 'none' as const,
    };
    const { data: inserted, error: insertErr } = await client
      .from('profiles')
      .upsert(newRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (insertErr) {
      throw new Error(insertErr.message);
    }
    profile = inserted as UserProfile;
  }

  // Enforce automatic expiration on load / login / check
  const evaluation = evaluateSubscriptionState(profile, new Date());
  if (evaluation.needsExpirationTermination && evaluation.terminationPatch) {
    const { data: updated, error: updateErr } = await client
      .from('profiles')
      .update({
        ...evaluation.terminationPatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return {
      profile: updated as UserProfile,
      justExpiredPlan: evaluation.expiredFromPlan,
    };
  }

  return {
    profile,
    justExpiredPlan: evaluation.reason === 'plan_expired' ? evaluation.expiredFromPlan : null,
  };
}

export async function submitTelebirrPaymentRequest(
  userId: string,
  plan: PaidPlanType,
  telebirrReference: string,
): Promise<UserProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({
      payment_status: 'pending',
      telebirr_reference: telebirrReference,
      requested_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as UserProfile;
}

export async function fetchUserSubtitleHistory(userId: string): Promise<SubtitleHistoryRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subtitles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as SubtitleHistoryRow[];
}

export async function saveSubtitleToHistory(params: {
  userId: string;
  fileName: string;
  mediaKind: 'video' | 'audio';
  sourceMode: string;
  detectedLanguage: string | null;
  cues: SubtitleCue[];
  srtContent: string;
}): Promise<SubtitleHistoryRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subtitles')
    .insert({
      user_id: params.userId,
      file_name: params.fileName.slice(0, 220),
      media_kind: params.mediaKind,
      source_mode: params.sourceMode,
      detected_language: params.detectedLanguage,
      cues: params.cues,
      srt_content: params.srtContent,
      cue_count: params.cues.length,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as SubtitleHistoryRow;
}

export async function deleteSubtitleHistoryRow(id: string, userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('subtitles')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAllProfilesForOwner(): Promise<UserProfile[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as UserProfile[];
}

export async function approveUserPlanByOwner(
  targetUserId: string,
  plan: PaidPlanType,
): Promise<UserProfile> {
  const client = requireSupabase();
  const expiresAt = computeExpiryIso(plan, new Date());
  const { data, error } = await client
    .from('profiles')
    .update({
      is_pro: true,
      plan_type: plan,
      pro_expires_at: expiresAt,
      payment_status: 'approved',
      requested_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as UserProfile;
}

export async function resetUserToFreeByOwner(targetUserId: string): Promise<UserProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({
      is_pro: false,
      plan_type: 'free',
      pro_expires_at: null,
      payment_status: 'none',
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as UserProfile;
}
