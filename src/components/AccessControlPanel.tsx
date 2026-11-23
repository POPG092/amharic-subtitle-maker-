import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import type { UsageLogRecord, UserAccountRecord } from '../firebase';
import type { AccessStatus } from '../utils/accessControl';

interface AccessControlPanelProps {
  ownerEmail: string;
  users: UserAccountRecord[];
  logs: UsageLogRecord[];
  busyUid: string | null;
  onUpdateUserAccess: (
    uid: string,
    updates: {
      accessStatus: AccessStatus;
      videoLimit: number;
      usedCount?: number;
      note?: string;
    },
  ) => Promise<void>;
}

function formatTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return '—';
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return '—';
  const date = maybe.toDate();
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AccessControlPanel: React.FC<AccessControlPanelProps> = ({
  ownerEmail,
  users,
  logs,
  busyUid,
  onUpdateUserAccess,
}) => {
  const [filter, setFilter] = useState<'all' | AccessStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customLimits, setCustomLimits] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let blocked = 0;
    for (const u of users) {
      if (u.accessStatus === 'pending') pending += 1;
      else if (u.accessStatus === 'approved') approved += 1;
      else if (u.accessStatus === 'blocked') blocked += 1;
    }
    return { total: users.length, pending, approved, blocked };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== 'all' && u.accessStatus !== filter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      );
    });
  }, [users, filter, searchQuery]);

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 space-y-6">
      <div className="rounded-xl border border-slate-800 bg-[#121824] overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-100">
              Signed-In Users &amp; Video Limits
            </h1>
            <p className="mt-1 text-xs text-slate-400 tabular-nums">
              {counts.total} signed-in
              <span aria-hidden="true"> · </span>
              {counts.pending} pending
              <span aria-hidden="true"> · </span>
              {counts.approved} approved
              <span aria-hidden="true"> · </span>
              {counts.blocked} blocked
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by email or name..."
                aria-label="Filter signed-in users"
                className="w-56 rounded-lg border border-slate-800 bg-[#0B0F17] py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#0B0F17] p-1 border border-slate-800">
              {(['all', 'pending', 'approved', 'blocked'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    filter === tab
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0E141F] text-xs font-medium text-slate-400">
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usage / Limit</th>
                <th className="px-4 py-3">Last Sign-In</th>
                <th className="px-5 py-3 text-right">Access &amp; Temporary Limits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No signed-in users match the current filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isOwnerRow = u.email.toLowerCase() === ownerEmail.toLowerCase();
                  const isBusy = busyUid === u.uid;
                  const customVal = customLimits[u.uid] ?? String(u.videoLimit > 0 ? u.videoLimit : 2);
                  const statusColor =
                    u.accessStatus === 'approved'
                      ? 'text-emerald-400'
                      : u.accessStatus === 'blocked'
                        ? 'text-rose-400'
                        : 'text-amber-400';

                  return (
                    <tr key={u.uid} className="hover:bg-slate-900/40">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-100">
                          {u.displayName || 'Google User'}
                          {isOwnerRow && (
                            <span className="ml-2 text-slate-400 font-normal">(Owner)</span>
                          )}
                        </div>
                        <div className="text-slate-400 mt-0.5">{u.email}</div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`font-medium capitalize ${statusColor}`}>
                          {u.accessStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono tabular-nums whitespace-nowrap text-slate-200">
                        {isOwnerRow || u.videoLimit === -1
                          ? `${u.usedCount} / Unlimited`
                          : `${u.usedCount} / ${u.videoLimit} videos`}
                      </td>

                      <td className="px-4 py-3.5 font-mono tabular-nums whitespace-nowrap text-slate-400">
                        {formatTimestamp(u.lastSeenAt)}
                      </td>

                      <td className="px-5 py-3.5">
                        {isOwnerRow ? (
                          <div className="text-right text-slate-400">
                            Free unlimited owner access
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                onUpdateUserAccess(u.uid, {
                                  accessStatus: 'approved',
                                  videoLimit: 1,
                                  note: 'Temporary 1-video access',
                                })
                              }
                              className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              1 Video
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                onUpdateUserAccess(u.uid, {
                                  accessStatus: 'approved',
                                  videoLimit: 2,
                                  note: 'Temporary 2-video access',
                                })
                              }
                              className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              2 Videos
                            </button>

                            <div className="inline-flex items-center rounded border border-slate-800 bg-[#0B0F17]">
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                aria-label={`Custom video limit for ${u.email}`}
                                value={customVal}
                                onChange={(e) =>
                                  setCustomLimits((prev) => ({
                                    ...prev,
                                    [u.uid]: e.target.value,
                                  }))
                                }
                                className="w-12 bg-transparent px-1.5 py-1 text-center font-mono text-xs text-slate-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  const parsed = Math.max(
                                    1,
                                    Math.min(1000, Number.parseInt(customVal, 10) || 1),
                                  );
                                  void onUpdateUserAccess(u.uid, {
                                    accessStatus: 'approved',
                                    videoLimit: parsed,
                                    note: `Temporary ${parsed}-video access`,
                                  });
                                }}
                                className="border-l border-slate-800 px-2 py-1 font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 whitespace-nowrap"
                              >
                                Set
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                onUpdateUserAccess(u.uid, {
                                  accessStatus: 'approved',
                                  videoLimit: -1,
                                  note: 'Unlimited approved access',
                                })
                              }
                              title="Grant unlimited access"
                              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-medium text-emerald-300 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              <span>Unlimited</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy || u.usedCount === 0}
                              onClick={() =>
                                onUpdateUserAccess(u.uid, {
                                  accessStatus: u.accessStatus,
                                  videoLimit: u.videoLimit,
                                  usedCount: 0,
                                  note: u.note,
                                })
                              }
                              title="Reset used video count to 0"
                              className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              <span>Reset</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                onUpdateUserAccess(u.uid, {
                                  accessStatus: u.accessStatus === 'blocked' ? 'pending' : 'blocked',
                                  videoLimit: u.accessStatus === 'blocked' ? 0 : u.videoLimit,
                                  note:
                                    u.accessStatus === 'blocked'
                                      ? 'Returned to pending'
                                      : 'Paused by owner',
                                })
                              }
                              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-medium whitespace-nowrap disabled:opacity-50 ${
                                u.accessStatus === 'blocked'
                                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                                  : 'border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                              }`}
                            >
                              <ShieldOff className="h-3 w-3" aria-hidden="true" />
                              <span>{u.accessStatus === 'blocked' ? 'Unblock' : 'Block'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Subtitle Generation Activity */}
      <div className="rounded-xl border border-slate-800 bg-[#121824] overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Recent Media Processing Activity
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0E141F] text-xs font-medium text-slate-400">
                <th className="px-5 py-2.5">User</th>
                <th className="px-4 py-2.5">File</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Cues</th>
                <th className="px-5 py-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No media generations recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-2.5 text-slate-200">{log.userEmail}</td>
                    <td className="px-4 py-2.5 text-slate-300 max-w-[260px] truncate" title={log.fileName}>
                      {log.fileName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 capitalize">
                      {log.mediaKind} · {log.sourceMode}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-200">
                      {log.cueCount}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-400">
                      {formatTimestamp(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
