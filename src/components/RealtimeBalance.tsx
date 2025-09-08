'use client';

import React from 'react';
import { formatCurrency } from '@/app/utils/formatters';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';

interface RealtimeBalanceProps {
  userId: string;
  initialBalance?: number;
  showPending?: boolean;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onBalanceChange?: (newBalance: number, previousBalance: number) => void;
}

export default function RealtimeBalance({
  userId,
  initialBalance,
  showPending = true,
  showLabel = true,
  className = '',
  size = 'md',
  onBalanceChange
}: RealtimeBalanceProps) {
  const {
    balance,
    pendingAmount,
    hasPending,
    isBalanceLoading
  } = useRealtimeBalance({
    userId,
    initialBalance,
    onBalanceChange
  });

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          balance: 'text-sm',
          pending: 'text-xs px-1.5 py-0.5',
          label: 'text-xs'
        };
      case 'lg':
        return {
          balance: 'text-2xl',
          pending: 'text-sm px-3 py-1',
          label: 'text-sm'
        };
      default: // md
        return {
          balance: 'text-lg',
          pending: 'text-xs px-2 py-1',
          label: 'text-sm'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  if (isBalanceLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse">
          <div className={`bg-gray-600/50 rounded h-4 w-20 ${sizeClasses.balance}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-col">
        {showLabel && (
          <span className={`text-gray-400 ${sizeClasses.label}`}>Bakiye</span>
        )}
        <div className="flex items-center gap-2">
          <span className={`text-[#2ff7c1] font-medium ${sizeClasses.balance}`}>
            {formatCurrency(balance)} NMFP
          </span>
          
          {showPending && hasPending && (
            <div className="flex flex-col items-end">
              <span className={`text-orange-400 bg-orange-400/10 rounded-full ${sizeClasses.pending} flex items-center`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m9-9h-4M3 12H7m12.364 6.364l-2.829-2.829M6.465 6.465L3.636 3.636m12.728 0l-2.829 2.829M6.465 17.535l-2.829 2.829" />
                </svg>
                {pendingAmount > 0 ? '+' : ''}{formatCurrency(Math.abs(pendingAmount))}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {hasPending && (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}
