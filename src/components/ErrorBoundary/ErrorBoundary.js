import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to an error reporting service in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-surface-container-lowest animate-fadeIn">
          <div className="bg-red-50 border border-red-200 rounded-3xl p-10 max-w-lg shadow-xl flex flex-col items-center space-y-5">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl shadow-inner">
              ⚠️
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#041635]">Something Went Wrong</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              An unexpected application error occurred while rendering this view. Our engineering team has been notified.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre className="text-[11px] bg-red-100/50 text-red-800 p-3 rounded-lg max-w-full overflow-x-auto text-left font-mono">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                className="px-6 py-2.5 bg-[#041635] hover:bg-[#0a2351] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                Refresh Page
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.history.back(); }}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all active:scale-95"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
