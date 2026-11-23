import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center px-6">
          <div className="max-w-md w-full luxury-border-frame rounded-2xl p-[1px]">
            <div className="luxury-surface rounded-[15px] p-6">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h1 className="font-display text-base font-semibold text-zinc-100">
                  Something went wrong
                </h1>
              </div>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed break-words">
                {this.state.message}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:opacity-90"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
