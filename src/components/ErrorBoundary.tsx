import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F6F8FA] dark:bg-[#0B131E] p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Something went wrong · کچھ غلط ہو گیا
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-[#0B3C5D] text-white text-sm font-medium hover:bg-[#092f4a] transition-colors"
            >
              Reload Saans · دوبارہ لوڈ کریں
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
