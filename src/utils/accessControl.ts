export const OWNER_EMAIL = 'djelawebshet@gmail.com';

export type AccessStatus = 'pending' | 'approved' | 'blocked';

export interface AccessCheckInput {
  email?: string | null;
  emailVerified?: boolean | null;
  accessStatus?: AccessStatus | null;
  videoLimit?: number | null;
  usedCount?: number | null;
}

export interface AccessCheckResult {
  isOwner: boolean;
  allowed: boolean;
  remaining: number | 'unlimited';
  reason?: string;
}

export function isOwnerAccount(email?: string | null, emailVerified?: boolean | null): boolean {
  if (!email || emailVerified !== true) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

export function canGenerateSubtitles(input: AccessCheckInput): AccessCheckResult {
  if (isOwnerAccount(input.email, input.emailVerified)) {
    return {
      isOwner: true,
      allowed: true,
      remaining: 'unlimited',
    };
  }

  if (!input.email || input.emailVerified !== true) {
    return {
      isOwner: false,
      allowed: false,
      remaining: 0,
      reason: 'Please sign in with a verified Google account to generate subtitles.',
    };
  }

  const status = input.accessStatus ?? 'pending';
  const limit = typeof input.videoLimit === 'number' && Number.isFinite(input.videoLimit) ? input.videoLimit : 0;
  const used = typeof input.usedCount === 'number' && Number.isFinite(input.usedCount) ? Math.max(0, input.usedCount) : 0;

  if (status === 'blocked') {
    return {
      isOwner: false,
      allowed: false,
      remaining: 0,
      reason: 'Access for this account has been paused by the owner.',
    };
  }

  if (status !== 'approved') {
    return {
      isOwner: false,
      allowed: false,
      remaining: 0,
      reason: 'Your account is waiting for owner approval before generating subtitles.',
    };
  }

  if (limit === -1) {
    return {
      isOwner: false,
      allowed: true,
      remaining: 'unlimited',
    };
  }

  const remaining = Math.max(0, limit - used);
  if (remaining <= 0) {
    return {
      isOwner: false,
      allowed: false,
      remaining: 0,
      reason: `You have used all ${limit} allowed video${limit === 1 ? '' : 's'}. Ask the owner to extend your temporary limit.`,
    };
  }

  return {
    isOwner: false,
    allowed: true,
    remaining,
  };
}

export function formatQuotaSummary(input: AccessCheckInput): string {
  if (isOwnerAccount(input.email, input.emailVerified)) {
    return 'Owner · Free Unlimited';
  }
  const status = input.accessStatus ?? 'pending';
  if (status === 'blocked') return 'Blocked';
  if (status === 'pending') return 'Pending Approval';

  const limit = typeof input.videoLimit === 'number' ? input.videoLimit : 0;
  const used = typeof input.usedCount === 'number' ? Math.max(0, input.usedCount) : 0;
  if (limit === -1) return `Unlimited · ${used} used`;
  const remaining = Math.max(0, limit - used);
  return `${remaining} of ${limit} video${limit === 1 ? '' : 's'} left`;
}
