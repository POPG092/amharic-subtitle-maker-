export type PlanType = 'free' | 'monthly' | 'yearly' | 'lifetime';
export type PaidPlanType = 'monthly' | 'yearly' | 'lifetime';
export type PaymentStatus = 'none' | 'pending' | 'approved';

export interface UserProfile {
  id: string;
  email: string;
  plan_type: PlanType;
  videos_used: number;
  is_pro: boolean;
  pro_expires_at: string | null;
  payment_status: PaymentStatus;
  telebirr_reference?: string | null;
  requested_plan?: PaidPlanType | null;
  created_at?: string;
  updated_at?: string;
}

export interface PackageOption {
  id: PaidPlanType;
  name: string;
  audience: string;
  priceEtb: number;
  priceFormatted: string;
  cadence: string;
  durationDays: number | null;
  highlight?: string;
  description: string;
}

export const FREE_TRIAL_VIDEO_LIMIT = 1;
export const TELEBIRR_PHONE = '0951084993';
export const TELEBIRR_ACCOUNT_NAME = 'Kalab Wubshet';
export const STUDIO_OWNER_EMAIL = 'djelawebshet@gmail.com';

export const SUBSCRIPTION_PACKAGES: PackageOption[] = [
  {
    id: 'monthly',
    name: 'Monthly Package',
    audience: 'For active creators & editors',
    priceEtb: 1000,
    priceFormatted: '1,000 ETB',
    cadence: '/ month',
    durationDays: 30,
    description: 'Unlimited Amharic subtitle generation and studio exports for 30 days.',
  },
  {
    id: 'yearly',
    name: 'Yearly Package',
    audience: 'For studios & regular channels',
    priceEtb: 8000,
    priceFormatted: '8,000 ETB',
    cadence: '/ year',
    durationDays: 365,
    highlight: 'Best Value — Save 4,000 ETB',
    description: 'Full studio access for 12 months at a 33% savings over monthly billing.',
  },
  {
    id: 'lifetime',
    name: 'Lifetime Package',
    audience: 'For permanent unlimited production',
    priceEtb: 15000,
    priceFormatted: '15,000 ETB',
    cadence: '/ one-time',
    durationDays: null,
    highlight: 'Unlimited Forever',
    description: 'One-time Telebirr payment for permanent Pro access with zero renewals.',
  },
];

export interface SubscriptionEvaluation {
  canGenerate: boolean;
  isProActive: boolean;
  needsExpirationTermination: boolean;
  expiredFromPlan: 'monthly' | 'yearly' | null;
  reason: 'active_pro' | 'free_trial' | 'trial_exhausted' | 'plan_expired';
  remainingFreeVideos: number;
  terminationPatch: {
    is_pro: false;
    plan_type: 'free';
    payment_status: 'none';
  } | null;
}

export function isOwnerEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === STUDIO_OWNER_EMAIL;
}

export function getPackageById(id: PaidPlanType): PackageOption {
  return SUBSCRIPTION_PACKAGES.find((p) => p.id === id) ?? SUBSCRIPTION_PACKAGES[0];
}

export function evaluateSubscriptionState(
  profile: Pick<
    UserProfile,
    'plan_type' | 'videos_used' | 'is_pro' | 'pro_expires_at' | 'payment_status'
  >,
  now: Date = new Date(),
): SubscriptionEvaluation {
  const used = Math.max(0, Number(profile.videos_used) || 0);

  // 1. Check automatic plan expiration for monthly & yearly plans
  if (
    (profile.plan_type === 'monthly' || profile.plan_type === 'yearly') &&
    profile.pro_expires_at
  ) {
    const expiresMs = Date.parse(profile.pro_expires_at);
    if (Number.isFinite(expiresMs) && expiresMs <= now.getTime()) {
      return {
        canGenerate: false,
        isProActive: false,
        needsExpirationTermination: true,
        expiredFromPlan: profile.plan_type,
        reason: 'plan_expired',
        remainingFreeVideos: 0,
        terminationPatch: {
          is_pro: false,
          plan_type: 'free',
          payment_status: 'none',
        },
      };
    }
  }

  // 2. Lifetime Pro never expires
  if (profile.plan_type === 'lifetime' && profile.is_pro) {
    return {
      canGenerate: true,
      isProActive: true,
      needsExpirationTermination: false,
      expiredFromPlan: null,
      reason: 'active_pro',
      remainingFreeVideos: 0,
      terminationPatch: null,
    };
  }

  // 3. Active Monthly or Yearly Pro (not expired)
  if (
    (profile.plan_type === 'monthly' || profile.plan_type === 'yearly') &&
    profile.is_pro
  ) {
    return {
      canGenerate: true,
      isProActive: true,
      needsExpirationTermination: false,
      expiredFromPlan: null,
      reason: 'active_pro',
      remainingFreeVideos: 0,
      terminationPatch: null,
    };
  }

  // 4. Free Trial Limit (1 Video)
  const remaining = Math.max(0, FREE_TRIAL_VIDEO_LIMIT - used);
  if (used < FREE_TRIAL_VIDEO_LIMIT) {
    return {
      canGenerate: true,
      isProActive: false,
      needsExpirationTermination: false,
      expiredFromPlan: null,
      reason: 'free_trial',
      remainingFreeVideos: remaining,
      terminationPatch: null,
    };
  }

  return {
    canGenerate: false,
    isProActive: false,
    needsExpirationTermination: false,
    expiredFromPlan: null,
    reason: 'trial_exhausted',
    remainingFreeVideos: 0,
    terminationPatch: null,
  };
}

export function validateTelebirrReference(rawRef: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = rawRef.trim();
  if (cleaned.length < 5) {
    return {
      valid: false,
      cleaned,
      error: 'Please enter a valid Telebirr Transaction ID / Reference Number (at least 5 characters).',
    };
  }
  if (cleaned.length > 64) {
    return {
      valid: false,
      cleaned,
      error: 'Transaction reference must be 64 characters or fewer.',
    };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Transaction reference may only contain letters, numbers, dots, underscores, or hyphens.',
    };
  }
  return { valid: true, cleaned };
}

export function computeExpiryIso(plan: PaidPlanType, from: Date = new Date()): string | null {
  if (plan === 'lifetime') return null;
  const days = plan === 'yearly' ? 365 : 30;
  const target = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return target.toISOString();
}

export function formatPlanLabel(profile: UserProfile | null): string {
  if (!profile) return 'Free Trial · 1 video';
  const evalState = evaluateSubscriptionState(profile);
  if (evalState.reason === 'plan_expired') {
    return 'Plan Expired';
  }
  if (evalState.isProActive) {
    if (profile.plan_type === 'lifetime') return 'Lifetime Pro · Unlimited';
    const expDate = profile.pro_expires_at
      ? new Date(profile.pro_expires_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Active';
    return `${profile.plan_type === 'yearly' ? 'Yearly Pro' : 'Monthly Pro'} · Ends ${expDate}`;
  }
  if (profile.payment_status === 'pending') {
    return 'Telebirr Payment Pending Approval';
  }
  return evalState.remainingFreeVideos > 0
    ? `Free Trial · ${evalState.remainingFreeVideos} free video left`
    : 'Free Trial Used · Upgrade Required';
}
