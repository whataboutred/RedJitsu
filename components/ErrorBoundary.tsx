'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-brand-red mx-auto" aria-hidden="true" />
            <h3 className="text-2xl font-display uppercase text-white">Something went wrong</h3>
            <p className="text-sm text-zinc-400">
              This screen hit an error. Your data is safe — reload to keep going.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm bg-brand-red text-white px-5 py-2.5 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Lightweight error boundary for non-critical sections
 */
export function SoftErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-surface border border-white/[0.07] rounded-2xl">
          <p className="text-sm text-zinc-400">This section failed to load. Try refreshing.</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
