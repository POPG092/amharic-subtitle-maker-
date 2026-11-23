import React from 'react';
import { Crown, Download, LogIn, Upload } from 'lucide-react';

export type ActiveView = 'studio' | 'history' | 'export' | 'approvals';

interface TopBarProps {
  isSignedIn: boolean;
  isOwner: boolean;
  isProActive: boolean;
  hasMedia: boolean;
  hasCues: boolean;
  historyCount: number;
  pendingApprovalCount: number;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onOpenPricing: () => void;
  onLoadSample: () => void;
  onTriggerUpload: () => void;
  onQuickExport: () => void;
  onSignOut: () => void;
  onFocusAuth: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isSignedIn,
  isOwner,
  isProActive,
  hasMedia,
  hasCues,
  historyCount,
  pendingApprovalCount,
  activeView,
  onSelectView,
  onOpenPricing,
  onLoadSample,
  onTriggerUpload,
  onQuickExport,
  onSignOut,
  onFocusAuth,
}) => {
  return (
    <header className="border-b border-white/10 bg-[#09090B]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('studio');
          }}
          className="font-display text-lg font-bold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
        >
          FidelSub
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
        >
          {isSignedIn ? (
            <>
              <button
                type="button"
                onClick={() => onSelectView('studio')}
                className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1 ${
                  activeView === 'studio'
                    ? 'text-zinc-50 underline decoration-amber-400 underline-offset-8'
                    : ''
                }`}
              >
                Studio
              </button>

              <button
                type="button"
                onClick={() => onSelectView('history')}
                className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1 ${
                  activeView === 'history'
                    ? 'text-zinc-50 underline decoration-amber-400 underline-offset-8'
                    : ''
                }`}
              >
                History ({historyCount})
              </button>

              {hasMedia && (
                <button
                  type="button"
                  onClick={() => onSelectView('export')}
                  className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1 ${
                    activeView === 'export'
                      ? 'text-zinc-50 underline decoration-amber-400 underline-offset-8'
                      : ''
                  }`}
                >
                  Export Center
                </button>
              )}

              <button
                type="button"
                onClick={onLoadSample}
                className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
              >
                Sample Project
              </button>

              <button
                type="button"
                onClick={onOpenPricing}
                className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
              >
                {isProActive ? 'Pro Plan' : 'Upgrade'}
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => onSelectView('approvals')}
                  className={`whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1 ${
                    activeView === 'approvals'
                      ? 'text-zinc-50 underline decoration-amber-400 underline-offset-8'
                      : ''
                  }`}
                >
                  {pendingApprovalCount > 0 ? `Approvals (${pendingApprovalCount})` : 'Approvals'}
                </button>
              )}

              <button
                type="button"
                onClick={onSignOut}
                className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenPricing}
              className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
            >
              Pricing
            </button>
          )}
        </nav>

        <div className="flex items-center shrink-0">
          {!isSignedIn ? (
            <button
              type="button"
              onClick={onFocusAuth}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          ) : hasMedia && hasCues ? (
            <button
              type="button"
              onClick={onQuickExport}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export SRT</span>
            </button>
          ) : !isProActive ? (
            <button
              type="button"
              onClick={onTriggerUpload}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Media</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onTriggerUpload}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
            >
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Media</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
