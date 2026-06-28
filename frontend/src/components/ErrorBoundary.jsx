import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <h2 className="text-[#e8eaf0] text-base font-semibold mb-1.5">Something went wrong</h2>
          <p className="text-zinc-500 text-sm mb-5 font-mono text-xs">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-accent hover:text-[#7b8bff] transition-colors underline underline-offset-2"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
