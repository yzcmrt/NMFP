/**
 * Real-time Balance ve Mining Progress Kullanım Örneği
 * 
 * Bu component nasıl real-time updates kullanılacağını gösterir
 */

'use client';

import React from 'react';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
import { useRealtimeMining } from '@/hooks/useRealtimeMining';
import { formatCurrency } from '@/app/utils/formatters';
import { MiningSession, MiningStatus } from '@/types';
import { toast } from 'react-hot-toast';

interface RealtimeExampleProps {
  userId: string;
  initialBalance?: number;
  miningSessions: MiningSession[];
}

export default function RealtimeExample({ 
  userId, 
  initialBalance,
  miningSessions 
}: RealtimeExampleProps) {
  
  // ✅ Real-time Balance Management
  const {
    balance,
    pendingAmount,
    hasPending,
    addOptimisticTransaction,
    commitTransaction,
    rollbackTransaction,
    refreshBalance
  } = useRealtimeBalance({
    userId,
    initialBalance,
    onBalanceChange: (newBalance, previousBalance) => {
      // Balance değişince çalışacak callback
      const difference = newBalance - previousBalance;
      if (Math.abs(difference) >= 1000) {
        toast.success(`Balance güncellendi: ${difference > 0 ? '+' : ''}${formatCurrency(difference)} NMFP`);
      }
    }
  });

  // ✅ Real-time Mining Progress
  const {
    progressData,
    isConnected: isMiningConnected,
    refreshProgress
  } = useRealtimeMining({
    userId,
    sessions: miningSessions,
    onProgressUpdate: (sessionId, progress) => {
      // Her progress update'inde çalışacak callback
      console.log(`Session ${sessionId} progress: ${progress.progress}%`);
    },
    onSessionCompleted: (sessionId) => {
      // Mining tamamlandığında çalışacak callback
      toast.success(`Mining Session ${sessionId} tamamlandı!`);
    }
  });

  // ✅ Örnek Purchase Fonksiyonu (Optimistic Updates ile)
  const handleExamplePurchase = async (itemName: string, cost: number) => {
    const transactionId = `example_${Date.now()}`;
    
    try {
      // 1. Optimistic Update (Hemen balance'ı güncelle)
      addOptimisticTransaction({
        id: transactionId,
        amount: -cost,
        type: 'purchase',
        description: `${itemName} satın alındı`
      });

      // 2. Insufficient balance kontrolü
      if (balance < cost) {
        rollbackTransaction(transactionId);
        toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(cost)} NMFP`);
        return;
      }

      toast.loading(`${itemName} satın alınıyor...`);

      // 3. Server Request (API call simulation)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 4. Success - Transaction'ı commit et
      commitTransaction(transactionId);
      toast.success(`${itemName} başarıyla satın alındı!`);

    } catch (error) {
      // 5. Error - Rollback optimistic update
      rollbackTransaction(transactionId);
      toast.error(`Satın alma hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  };

  return (
    <div className="bg-[#1a1a2e]/70 p-6 rounded-xl border border-[#2a3855]/50 space-y-6">
      <h2 className="text-xl font-bold text-white">Real-time Updates Demo</h2>
      
      {/* Balance Display */}
      <div className="bg-[#16213e]/70 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Balance Status</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Current Balance:</span>
            <span className="text-[#2ff7c1] font-medium">{formatCurrency(balance)} NMFP</span>
          </div>
          
          {hasPending && (
            <div className="flex justify-between">
              <span className="text-gray-400">Pending:</span>
              <span className="text-orange-400">
                {pendingAmount > 0 ? '+' : ''}{formatCurrency(pendingAmount)} NMFP
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-400">Connection:</span>
            <span className={isMiningConnected ? 'text-green-400' : 'text-red-400'}>
              {isMiningConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {/* Test Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleExamplePurchase('Test Item', 1000)}
            className="flex-1 bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white py-2 px-4 rounded-lg text-sm font-medium"
          >
            Test Purchase (1000 NMFP)
          </button>
          
          <button
            onClick={() => refreshBalance()}
            className="bg-[#2a3855] text-white py-2 px-4 rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Mining Progress */}
      {miningSessions.length > 0 && (
        <div className="bg-[#16213e]/70 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Mining Progress</h3>
          
          {miningSessions.map(session => {
            const progress = progressData[session.id];
            
            return (
              <div key={session.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Session #{session.id}</span>
                  <span className="text-[#2ff7c1]">
                    {progress?.timeLeft || 'Calculating...'}
                  </span>
                </div>
                
                <div className="w-full bg-[#0d1423] rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress?.progress || 0}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">Progress: {progress?.progress || 0}%</span>
                  <span className="text-gray-500">
                    Reward: {formatCurrency(session.expected_reward)} NMFP
                  </span>
                </div>
              </div>
            );
          })}
          
          <button
            onClick={() => refreshProgress()}
            className="w-full bg-[#2a3855] text-white py-2 px-4 rounded-lg text-sm mt-3"
          >
            Refresh Mining Progress
          </button>
        </div>
      )}
    </div>
  );
}

// ✅ Nasıl Kullanılır:

/*
// 1. Component'inizde import edin:
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';

// 2. Hook'u kullanın:
const { balance, addOptimisticTransaction, commitTransaction } = useRealtimeBalance({
  userId: user.id,
  initialBalance: user.balance
});

// 3. Purchase flow'da optimistic update yapın:
const handlePurchase = async (cost: number) => {
  const txId = `purchase_${Date.now()}`;
  
  // Optimistic update
  addOptimisticTransaction({
    id: txId,
    amount: -cost,
    type: 'purchase',
    description: 'Item satın alındı'
  });
  
  try {
    // API call
    await purchaseAPI();
    
    // Success - commit transaction
    commitTransaction(txId);
    
  } catch (error) {
    // Error - rollback
    rollbackTransaction(txId);
  }
};

// 4. Balance'ı gösterin:
<span>{formatCurrency(balance)} NMFP</span>

*/
