import React from 'react';
import { Lock, LogIn, LogOut, ShieldAlert } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserAccountRecord } from '../firebase';

interface AuthGateProps {
  authLoading: boolean;
  user: User | null;
  account: UserAccountRecord | null;
  authError: string | null;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  authLoading,
  user,
  account,
  authError,
  isSigningIn,
  onSignIn,
  onSignOut,
}) => {
  if (authLoading) {
    return (
      <section className="mx-auto max-w-[680px] px-6 py-20">
        <div className="rounded-xl border border-slate-800 bg-[#121824] p-8 text-center">
          <p className="text-sm text-slate-400">Checking account session…</p>
        </div>
      </section>
    );
  }

  // Signed-in user awaiting approval or blocked
  if (user) {
    const isBlocked = account?.accessStatus === 'blocked';
    return (
      <section className="mx-auto max-w-[680px] px-6 py-16">
        <div className="rounded-xl border border-slate-800 bg-[#121824] p-8">
          <div className="flex items-center gap-3">
            {isBlocked ? (
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5 text-amber-400 shrink-0" aria-hidden="true" />
            )}
            <h1 className="font-display text-xl font-bold text-slate-100">
              {isBlocked ? 'Account Access Paused' : 'Waiting for Owner Approval'}
            </h1>
          </div>

          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Signed in as <span className="font-medium text-slate-100">{user.email}</span>.
          </p>

          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            {isBlocked
              ? 'Access for this account has been paused by the FidelSub owner.'
              : 'Your sign-in has been recorded. Once the owner approves your account or grants temporary video access (for example, 1 or 2 videos), this studio will unlock automatically.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
            <span className="text-xs text-slate-400">
              Status: {isBlocked ? 'Blocked' : 'Pending approval'}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Unauthenticated Sign-In screen
  return (
    <section className="mx-auto max-w-[760px] px-6 py-14 lg:py-20">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-slate-400">
          Video &amp; Audio Subtitling <span aria-hidden="true">·</span> Ge’ez Script (አማርኛ)
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-50 sm:text-5xl text-balance">
          Amharic subtitles from any video or audio
        </h1>
        <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-xl mx-auto">
          Sign in with your Google account to request studio access and generate, edit, and export
          time-synced Amharic (Ge’ez) subtitles.
        </p>
      </div>

      <div className="mt-9 mx-auto max-w-md rounded-xl border border-slate-800 bg-[#121824] p-7 text-center">
        <h2 className="font-display text-lg font-semibold text-slate-100">
          Sign in to continue
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
          Access is managed by the studio owner with full free access for the owner and approved or
          temporary video allowances for guests.
        </p>

        {authError && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {authError}
          </p>
        )}

        <button
          type="button"
          disabled={isSigningIn}
          onClick={onSignIn}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <span>{isSigningIn ? 'Signing in…' : 'Sign in with Google'}</span>
        </button>
      </div>
    </section>
  );
};
