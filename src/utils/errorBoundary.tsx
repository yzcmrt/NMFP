/**
 * Error Boundary for Mining Components
 * JavaScript hatalarını yakalamak ve user-friendly error göstermek için
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class MiningErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Mining Error Boundary caught an error:');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      
      // Specific mining-related error tracking
      if (error.message.includes('transactionId')) {
        console.error('💰 Transaction ID scope error detected!');
      }
      if (error.message.includes('mining')) {
        console.error('⛏️ Mining operation error detected!');
      }
    }
    
    this.setState({
      error,
      errorInfo
    });

    // Optional: Send to analytics service
    // analytics.track('mining_error', { error: error.message, stack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 m-4">
          <div className="flex items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-red-500">Mining İşlemi Hatası</h2>
          </div>
          
          <p className="text-gray-300 mb-4">
            Mining işlemi sırasında bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-800/30 p-3 rounded-lg mb-4">
              <p className="text-red-300 text-sm font-mono">
                DEV ERROR: {this.state.error?.message}
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Yeniden Dene
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium border border-[#2a3855]"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MiningErrorBoundary;
