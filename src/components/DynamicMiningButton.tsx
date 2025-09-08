'use client';

import React from 'react';
import { UserCar, MiningSession, MiningStatus, CarStatus } from '@/types';
import { formatCurrency } from '@/app/utils/formatters';

export enum MiningButtonState {
  READY = 'ready',           // Mining başlatılabilir
  STARTING = 'starting',     // Mining başlatılıyor
  MINING = 'mining',         // Mining yapılıyor
  COMPLETED = 'completed',   // Mining tamamlandı, claim edilebilir
  CLAIMING = 'claiming',     // Claim işlemi yapılıyor
  DISABLED = 'disabled'      // Buton disable (yakıt/kondisyon yetersiz)
}

interface MiningButtonProps {
  car: UserCar;
  miningSession?: MiningSession | null;
  timeLeft?: string;
  progress?: number;
  isLoading?: boolean;
  isClaimLoading?: boolean;
  canStartMining?: boolean;
  onStartMining: (carId: number) => Promise<void>;
  onClaimReward: (sessionId: number) => Promise<void>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function DynamicMiningButton({
  car,
  miningSession,
  timeLeft = '--:--:--',
  progress = 0,
  isLoading = false,
  isClaimLoading = false,
  canStartMining = true,
  onStartMining,
  onClaimReward,
  className = '',
  size = 'md'
}: MiningButtonProps) {

  // Mining button state'ini hesapla
  const getMiningButtonState = (): MiningButtonState => {
    // Debug logging (sadece development'ta)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DynamicMiningButton] State calculation:', {
        carId: car.id,
        carStatus: car.status,
        fuel: car.fuel,
        condition: car.condition,
        canStartMining,
        miningSession: miningSession ? {
          id: miningSession.id,
          status: miningSession.status,
          end_time: miningSession.end_time
        } : null,
        isLoading,
        isClaimLoading
      });
    }
    
    // Loading states
    if (isLoading) return MiningButtonState.STARTING;
    if (isClaimLoading) return MiningButtonState.CLAIMING;
    
    // Mining session status check (öncelikli)
    if (miningSession) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Has mining session:', miningSession.status);
      }
      
      if (miningSession.status === MiningStatus.COMPLETED) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[DynamicMiningButton] Session completed, showing claim button');
        }
        return MiningButtonState.COMPLETED;
      } else if (miningSession.status === MiningStatus.ACTIVE) {
        // Check if mining time has expired
        const now = Date.now();
        const endTime = new Date(miningSession.end_time).getTime();
        
        if (now >= endTime) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[DynamicMiningButton] Mining time expired, showing claim button');
          }
          return MiningButtonState.COMPLETED;
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('[DynamicMiningButton] Mining in progress, showing mining state');
          }
          return MiningButtonState.MINING;
        }
      }
    }
    
    // Car status check
    if (car.status === CarStatus.REPAIRING || car.status === 'repairing') {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Car is repairing');
      }
      return MiningButtonState.DISABLED;
    }
    if (car.fuel < 25) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Insufficient fuel:', car.fuel);
      }
      return MiningButtonState.DISABLED;
    }
    if (car.condition < 10) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Poor condition:', car.condition);
      }
      return MiningButtonState.DISABLED;
    }
    if (!canStartMining) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Cannot start mining (external condition)');
      }
      return MiningButtonState.DISABLED;
    }
    
    // Araç aktif ve mining yapılabilir durumda
    if (car.status === CarStatus.ACTIVE || car.status === 'active') {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicMiningButton] Car ready for mining');
      }
      return MiningButtonState.READY;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[DynamicMiningButton] Default disabled state, car status:', car.status);
    }
    return MiningButtonState.DISABLED;
  };

  // Size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          button: 'py-1.5 px-3 text-xs',
          icon: 'h-3 w-3',
          progress: 'h-1'
        };
      case 'lg':
        return {
          button: 'py-4 px-6 text-lg',
          icon: 'h-6 w-6',
          progress: 'h-3'
        };
      default: // md
        return {
          button: 'py-2 px-4 text-sm',
          icon: 'h-4 w-4',
          progress: 'h-2'
        };
    }
  };

  const currentState = getMiningButtonState();
  const sizeClasses = getSizeClasses();

  // Button configuration per state
  const getButtonConfig = () => {
    switch (currentState) {
      case MiningButtonState.READY:
        return {
          text: 'Mining Başlat',
          bgClass: 'bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] hover:shadow-lg hover:shadow-[#7b2ff7]/30',
          textClass: 'text-white',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          disabled: false,
          onClick: () => onStartMining(car.id)
        };

      case MiningButtonState.STARTING:
        return {
          text: 'Mining Başlatılıyor...',
          bgClass: 'bg-gradient-to-r from-[#7b2ff7]/70 to-[#2f7bf7]/70',
          textClass: 'text-white',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2 animate-spin`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          disabled: true,
          onClick: () => {}
        };

      case MiningButtonState.MINING:
        return {
          text: (
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2 animate-spin`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Mining Yapılıyor</span>
              </div>
              <div className="w-full mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Kalan Süre:</span>
                  <span className="font-mono text-[#2ff7c1]">{timeLeft}</span>
                </div>
                <div className={`w-full bg-[#0d1423] rounded-full overflow-hidden ${sizeClasses.progress}`}>
                  <div
                    className="h-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-center mt-1 text-[#2ff7c1]">
                  Beklenen Ödül: {formatCurrency(miningSession?.expected_reward || 0)} NMFP
                </div>
              </div>
            </div>
          ),
          bgClass: 'bg-gradient-to-r from-[#7b2ff7]/60 to-[#2f7bf7]/60 border border-[#7b2ff7]/50',
          textClass: 'text-white',
          icon: null,
          disabled: true,
          onClick: () => {}
        };

      case MiningButtonState.COMPLETED:
        return {
          text: 'Ödülü Topla',
          bgClass: 'bg-gradient-to-r from-[#2ff7c1] to-[#5ff7d5] hover:shadow-lg hover:shadow-[#2ff7c1]/30',
          textClass: 'text-[#0d253f]',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          disabled: false,
          onClick: () => {
            if (miningSession) {
              onClaimReward(miningSession.id);
            }
          }
        };

      case MiningButtonState.CLAIMING:
        return {
          text: 'Ödül Toplanıyor...',
          bgClass: 'bg-gradient-to-r from-[#2ff7c1]/70 to-[#5ff7d5]/70',
          textClass: 'text-[#0d253f]',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2 animate-spin`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          disabled: true,
          onClick: () => {}
        };

      case MiningButtonState.DISABLED:
      default:
        let disabledText = 'Uygun Değil';
        
        // Detailed disabled reason
        if (car.status === CarStatus.REPAIRING || car.status === 'repairing') {
          disabledText = 'Tamirde';
        } else if (car.fuel < 25) {
          disabledText = `Yakıt: ${car.fuel}% (Min: 25%)`;
        } else if (car.condition < 10) {
          disabledText = `Kondisyon: ${car.condition}% (Min: 10%)`;
        } else if (!canStartMining) {
          disabledText = 'Garaj Dolu';
        } else if (car.status === CarStatus.MINING || car.status === 'mining') {
          // Car status mining ama session yok - veri uyumsuzluğu
          disabledText = 'Senkronize Ediliyor...';
        } else if (car.status !== CarStatus.ACTIVE && car.status !== 'active') {
          disabledText = `Durum: ${car.status}`;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[DynamicMiningButton] Disabled reason:', disabledText);
        }
        
        return {
          text: disabledText,
          bgClass: 'bg-[#1a1a2e]/70 border border-[#2a3855]',
          textClass: 'text-gray-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className={`${sizeClasses.icon} mr-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          ),
          disabled: true,
          onClick: () => {}
        };
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <button
      onClick={buttonConfig.onClick}
      disabled={buttonConfig.disabled}
      className={`
        w-full rounded-lg font-medium transition-all duration-300 
        ${sizeClasses.button}
        ${buttonConfig.bgClass} 
        ${buttonConfig.textClass}
        ${buttonConfig.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
        ${className}
      `}
    >
      <div className="flex items-center justify-center">
        {typeof buttonConfig.text === 'string' ? (
          <>
            {buttonConfig.icon}
            <span>{buttonConfig.text}</span>
          </>
        ) : (
          buttonConfig.text
        )}
      </div>
    </button>
  );
}

// Mining button için yardımcı hook
export function useMiningButtonState(
  car: UserCar, 
  miningSession?: MiningSession | null
): {
  state: MiningButtonState;
  canStartMining: boolean;
  isCompleted: boolean;
  progress: number;
} {
  const now = Date.now();
  
  // Base conditions
  const hasEnoughFuel = car.fuel >= 25;
  const hasGoodCondition = car.condition >= 10;
  const isCarActive = car.status === CarStatus.ACTIVE || car.status === 'active';
  const canStartMining = hasEnoughFuel && hasGoodCondition && isCarActive;

  // Mining session analysis
  let state = MiningButtonState.READY;
  let isCompleted = false;
  let progress = 0;

  if (miningSession) {
    const endTime = new Date(miningSession.end_time).getTime();
    const startTime = new Date(miningSession.start_time).getTime();
    
    if (miningSession.status === MiningStatus.COMPLETED) {
      state = MiningButtonState.COMPLETED;
      isCompleted = true;
      progress = 100;
    } else if (miningSession.status === MiningStatus.ACTIVE) {
      if (now >= endTime) {
        state = MiningButtonState.COMPLETED;
        isCompleted = true;
        progress = 100;
      } else {
        state = MiningButtonState.MINING;
        const totalDuration = endTime - startTime;
        const elapsed = now - startTime;
        progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      }
    }
  } else if (!canStartMining) {
    state = MiningButtonState.DISABLED;
  }

  return {
    state,
    canStartMining,
    isCompleted,
    progress: Math.round(progress)
  };
}
