import React from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { PaidPlanType, UserProfile } from '../utils/subscription';

interface ApprovalsPanelProps {
  profiles: UserProfile[];
  busyId: string | null;
  onApprovePlan: (userId: string, plan: PaidPlanType) => Promise<void>;
  onResetFree: (userId: string) => Promise<void>;
}

export const ApprovalsPanel: React.FC<ApprovalsPanelProps> = ({
  profiles,
  busyId,
  onApprovePlan,
  onResetFree,
}) => {
  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6">
      <div className="luxury-border-frame rounded-2xl p-[1px]">
        <div className="luxury-surface rounded-[15px] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h1 className="font-display text-lg font-bold text-zinc-50">
              Telebirr Payment Approvals &amp; User Plans
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Approve Telebirr transfers (0951084993 · Kalab Wubshet) to activate Monthly (30d),
              Yearly (365d), or Lifetime Pro access.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-950/60 text-xs font-medium text-zinc-400">
                  <th className="px-5 py-3">User Email</th>
                  <th className="px-4 py-3">Plan / Status</th>
                  <th className="px-4 py-3 text-right">Videos Used</th>
                  <th className="px-4 py-3">Telebirr Ref</th>
                  <th className="px-5 py-3 text-right">Approve / Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-zinc-400">
                      No user profiles found yet.
                    </td>
                  </tr>
                ) : (
                  profiles.map((p) => {
                    const isBusy = busyId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.03]">
                        <td className="px-5 py-3.5 text-zinc-100 font-medium">{p.email}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={p.is_pro ? 'text-emerald-400 font-medium' : 'text-zinc-300'}>
                            {p.is_pro ? `Pro (${p.plan_type})` : 'Free Tier'}
                          </span>
                          {p.payment_status === 'pending' && (
                            <span className="ml-2 text-amber-300">· Pending ({p.requested_plan})</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-200">
                          {p.videos_used}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-300">
                          {p.telebirr_reference || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void onApprovePlan(p.id, 'monthly')}
                              className="inline-flex items-center gap-1 rounded border border-white/15 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3 w-3 text-amber-400" aria-hidden="true" />
                              <span>Monthly (30d)</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void onApprovePlan(p.id, 'yearly')}
                              className="inline-flex items-center gap-1 rounded border border-white/15 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3 w-3 text-violet-400" aria-hidden="true" />
                              <span>Yearly (365d)</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void onApprovePlan(p.id, 'lifetime')}
                              className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 font-medium text-amber-200 hover:bg-amber-400/25 disabled:opacity-50 whitespace-nowrap"
                            >
                              <span>Lifetime</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void onResetFree(p.id)}
                              className="inline-flex items-center gap-1 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-50 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              <span>Reset Free</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
