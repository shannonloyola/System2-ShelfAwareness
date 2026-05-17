"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in panel:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] p-4 text-center bg-[var(--bg-base)]">
          <AlertTriangle className="w-8 h-8 mb-3" style={{ color: 'var(--accent-amber)' }} />
          <p className="text-[14px] font-bold text-white mb-1">Failed to load data</p>
          <p className="text-[11px] mb-4 max-w-[250px] truncate" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error?.message || "An unexpected error occurred in this chart"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold transition-all hover:bg-[rgba(0,163,173,0.1)]"
            style={{ 
              color: 'var(--accent-teal)',
              border: '1px solid var(--accent-teal)'
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
