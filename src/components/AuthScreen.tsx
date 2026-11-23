import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail, Lock } from 'lucide-react';

interface AuthScreenProps {
  authLoading: boolean;
  isSupabaseConfigured: boolean;
  isSubmitting: boolean;
  authError: string | null;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignUpEmail: (email: string, password: string) => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onOpenPricing: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  authLoading,
  isSupabaseConfigured,
  isSubmitting,
  authError,
  onSignInEmail,
  onSignUpEmail,
  onSignInGoogle,
  onOpenPricing,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signin') {
      await onSignInEmail(trimmedEmail, password);
    } else {
      await onSignUpEmail(trimmedEmail, password);
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto max-w-[520px] px-6 py-24">
        <div className="luxury-border-frame rounded-2xl p-[1px]">
          <div className="luxury-surface rounded-[15px] p-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-400" aria-hidden="true" />
            <p className="mt-3 text-sm text-zinc-400">Restoring your FidelSub session…</p>
          </div>
        </div>
      </section>
    );
  }

  const displayError = localError || authError;

  return (
    <section className="mx-auto max-w-[1160px] px-6 py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-12 items-center">
        {/* Left Editorial Column */}
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs font-medium tracking-wide text-amber-300/90">
            Amharic Subtitle Studio <span aria-hidden="true">·</span> Ge’ez Script (አማርኛ)
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl leading-[1.1] text-balance">
            Precision Amharic subtitles for video and audio
          </h1>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
            Transcribe native Amharic or translate any spoken language into frame-accurate Ge’ez
            subtitles, edit timings inline, and save your complete .srt history to the cloud.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400 tabular-nums border-t border-white/10">
            <span className="text-zinc-200 font-medium">1 Free Video Trial</span>
            <span aria-hidden="true">·</span>
            <span>Pro Plans from 1,000 ETB / month</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenPricing}
              className="text-amber-300 hover:text-amber-200 underline underline-offset-4 transition-colors"
            >
              View Telebirr Packages
            </button>
          </div>
        </div>

        {/* Right Luxury Glassmorphism Auth Card */}
        <div className="lg:col-span-6">
          <div className="luxury-border-frame rounded-2xl p-[1px] shadow-2xl shadow-black/60 max-w-md mx-auto lg:ml-auto">
            <div className="luxury-surface rounded-[15px] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-zinc-50">
                    {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    {mode === 'signin'
                      ? 'Sign in to access your studio & saved subtitles.'
                      : 'Start with 1 free video subtitle generation.'}
                  </p>
                </div>

                <div className="flex items-center rounded-lg border border-white/10 bg-zinc-950/90 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setLocalError(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === 'signin'
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setLocalError(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === 'signup'
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {!isSupabaseConfigured && (
                <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
                  Add <code className="font-mono text-amber-100">VITE_SUPABASE_URL</code> and{' '}
                  <code className="font-mono text-amber-100">VITE_SUPABASE_ANON_KEY</code> in your
                  environment variables to activate live Supabase authentication.
                </div>
              )}

              {displayError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200"
                >
                  {displayError}
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-white/10 bg-zinc-950/90 py-2.5 pl-9 pr-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type="password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-lg border border-white/10 bg-zinc-950/90 py-2.5 pl-9 pr-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>{mode === 'signin' ? 'Signing In…' : 'Creating Account…'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-white/10" />
                <span>or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onSignInGoogle()}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors duration-150 hover:bg-zinc-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
