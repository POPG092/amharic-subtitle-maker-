import React, { useState } from 'react';
import { Check, Clock, Copy, Crown, Loader2, ShieldAlert, X } from 'lucide-react';
import {
  getPackageById,
  SUBSCRIPTION_PACKAGES,
  TELEBIRR_ACCOUNT_NAME,
  TELEBIRR_PHONE,
  validateTelebirrReference,
  type PaidPlanType,
  type UserProfile,
} from '../utils/subscription';

interface UpgradeModalProps {
  isOpen: boolean;
  isSignedIn: boolean;
  isExpired: boolean;
  expiredFromPlan: 'monthly' | 'yearly' | null;
  trialExhausted: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onRequireSignIn: () => void;
  onSubmitTelebirr: (plan: PaidPlanType, reference: string) => Promise<void>;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  isSignedIn,
  isExpired,
  expiredFromPlan,
  trialExhausted,
  profile,
  onClose,
  onRequireSignIn,
  onSubmitTelebirr,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanType>(
    profile?.requested_plan ?? 'yearly',
  );
  const [txRef, setTxRef] = useState(profile?.telebirr_reference ?? '');
  const [copiedField, setCopiedField] = useState<'phone' | 'name' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const activePackage = getPackageById(selectedPlan);
  const isPendingReview = profile?.payment_status === 'pending' || submittedSuccess;

  const copyText = async (value: string, field: 'phone' | 'name') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Clipboard ignored if blocked
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isSignedIn) {
      onRequireSignIn();
      return;
    }

    const validation = validateTelebirrReference(txRef);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid Telebirr Transaction ID.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitTelebirr(selectedPlan, validation.cleaned);
      setSubmittedSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit payment reference.');
    } finally {
      setSubmitting(false);
    }
  };

  const headingTitle = isExpired
    ? 'Plan Expired — Renew Your Pro Access'
    : trialExhausted
      ? 'Free Trial Complete — Upgrade to Pro'
      : 'Upgrade to FidelSub Pro';

  const headingSubtitle = isExpired
    ? `Your ${expiredFromPlan === 'yearly' ? 'Yearly' : 'Monthly'} Pro subscription reached its expiration timestamp and has been automatically downgraded to the free tier. Select a Telebirr package below to restore unlimited Amharic subtitling.`
    : trialExhausted
      ? 'You have used your 1 free video subtitle generation. Choose a Telebirr package below to unlock unlimited Amharic transcription, translation, and cloud history.'
      : 'Unlock unlimited Amharic subtitle generation and SRT cloud history with instant Telebirr transfer.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="luxury-border-frame my-auto w-full max-w-4xl rounded-2xl p-[1px] shadow-2xl shadow-black/80">
        <div className="luxury-surface rounded-[15px] p-5 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium">
                {isExpired ? (
                  <>
                    <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />
                    <span className="text-rose-300">Plan Expired</span>
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    <span className="text-amber-300">FidelSub Pro Membership</span>
                  </>
                )}
              </div>
              <h2
                id="upgrade-modal-title"
                className="font-display text-xl sm:text-2xl font-bold text-zinc-50 text-balance"
              >
                {headingTitle}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                {headingSubtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close upgrade modal"
              className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* 3 Selectable Tier Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {SUBSCRIPTION_PACKAGES.map((pkg) => {
              const selected = selectedPlan === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPlan(pkg.id)}
                  className={`text-left rounded-xl p-[1px] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    selected
                      ? 'bg-gradient-to-br from-amber-400 via-amber-500/70 to-violet-500'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <div className="h-full rounded-[11px] bg-[#0D0D11] p-4 sm:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-zinc-100">
                          {pkg.name}
                        </span>
                        {selected && (
                          <Check className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{pkg.audience}</p>

                      <div className="mt-4 flex items-baseline gap-1.5 font-mono tabular-nums">
                        <span className="text-2xl font-bold text-zinc-50">{pkg.priceFormatted}</span>
                        <span className="text-xs text-zinc-400">{pkg.cadence}</span>
                      </div>

                      <p className={`mt-1.5 text-xs font-medium ${pkg.highlight ? 'text-amber-300' : 'text-zinc-500'}`}>
                        {pkg.highlight ?? '30-day Pro access'}
                      </p>
                    </div>

                    <p className="mt-4 pt-3 border-t border-white/10 text-xs text-zinc-400 leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Telebirr Payment Screen & Reference Confirmation */}
          <div className="mt-6 grid gap-5 lg:grid-cols-12 border-t border-white/10 pt-6">
            {/* Exact Telebirr Transfer Details */}
            <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#0D0D11] p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-amber-300">Telebirr Transfer Details</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Send <span className="font-mono font-semibold text-zinc-100">{activePackage.priceFormatted}</span>{' '}
                  for the <span className="text-zinc-200">{activePackage.name}</span> to:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
                  <span className="text-zinc-400">Payment Method</span>
                  <span className="font-semibold text-zinc-100">Telebirr</span>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="block text-zinc-400">Phone Number</span>
                    <span className="font-mono text-sm font-semibold text-zinc-50 tabular-nums">
                      {TELEBIRR_PHONE}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(TELEBIRR_PHONE, 'phone')}
                    aria-label="Copy Telebirr phone number"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                  >
                    {copiedField === 'phone' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-zinc-400">Account Name</span>
                    <span className="text-sm font-semibold text-zinc-50">{TELEBIRR_ACCOUNT_NAME}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(TELEBIRR_ACCOUNT_NAME, 'name')}
                    aria-label="Copy Telebirr account name"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                  >
                    {copiedField === 'name' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Confirmation Form */}
            <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#0D0D11] p-5">
              {isPendingReview && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-amber-100">
                      Payment Pending Approval ({profile?.requested_plan ?? selectedPlan})
                    </p>
                    <p className="mt-1 text-amber-200/80">
                      Reference{' '}
                      <span className="font-mono text-amber-100">
                        {profile?.telebirr_reference || txRef}
                      </span>{' '}
                      has been recorded. Your Pro access unlocks as soon as the transfer is verified.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleConfirmSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="telebirr-package-select"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Package Paid For
                  </label>
                  <select
                    id="telebirr-package-select"
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as PaidPlanType)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <option value="monthly">Monthly Package — 1,000 ETB / month</option>
                    <option value="yearly">Yearly Package — 8,000 ETB / year</option>
                    <option value="lifetime">Lifetime Package — 15,000 ETB / one-time</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="telebirr-tx-ref"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Telebirr Transaction ID / Reference Number
                  </label>
                  <input
                    id="telebirr-tx-ref"
                    type="text"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    placeholder="e.g. B7K910421A"
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3.5 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-zinc-400">
                    Selected total:{' '}
                    <span className="font-mono font-semibold text-zinc-100">
                      {activePackage.priceFormatted}
                    </span>
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Submitting…</span>
                      </>
                    ) : (
                      <span>
                        {isSignedIn
                          ? isPendingReview
                            ? 'Update Telebirr Reference'
                            : 'Submit Payment Confirmation'
                          : 'Sign In to Submit Payment'}
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
