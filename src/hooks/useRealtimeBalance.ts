import { useEffect, useCallback, useRef } from 'react';
import { useBalanceStore } from '@/store/balanceStore';
import { realtimeManager } from '@/libs/realtimeManager';
import { toast } from 'react-hot-toast';

interface UseRealtimeBalanceProps {
  userId: string;
  initialBalance?: number;
  onBalanceChange?: (newBalance: number, previousBalance: number) => void;
}

interface UseRealtimeBalanceReturn {
  balance: number;
  pendingAmount: number;
  isBalanceLoading: boolean;
  hasPending: boolean;
  addOptimisticTransaction: (transaction: {
    id: string;
    amount: number;
    type: 'purchase' | 'mining_reward' | 'repair' | 'refill' | 'garage_purchase';
    description: string;
  }) => void;
  commitTransaction: (transactionId: string) => void;
  rollbackTransaction: (transactionId: string) => void;
  refreshBalance: () => Promise<boolean>;
}

export function useRealtimeBalance({
  userId,
  initialBalance,
  onBalanceChange
}: UseRealtimeBalanceProps): UseRealtimeBalanceReturn {
  const isSubscribedRef = useRef(false);
  const previousBalanceRef = useRef<number>(0);
  
  const {
    getDisplayBalance,
    getPendingAmount,
    hasPendingTransactions,
    setBalance,
    addOptimisticTransaction,
    commitTransaction,
    rollbackTransaction
  } = useBalanceStore();

  // Get current values
  const balance = getDisplayBalance(userId);
  const pendingAmount = getPendingAmount(userId);
  const hasPending = hasPendingTransactions(userId);

  // Initialize balance if provided
  useEffect(() => {
    if (initialBalance !== undefined && balance === 0) {
      setBalance(userId, initialBalance);
      previousBalanceRef.current = initialBalance;
    }
  }, [initialBalance, userId, balance, setBalance]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId || isSubscribedRef.current || userId === '') return;

    console.log(`[useRealtimeBalance] Setting up realtime subscription for ${userId}`);
    
    const setupSubscription = async () => {
      try {
        await realtimeManager.subscribeToUserBalance(userId);
        isSubscribedRef.current = true;
      } catch (error) {
        console.error('[useRealtimeBalance] Subscription setup failed:', error);
        isSubscribedRef.current = false; // Reset on error
      }
    };

    setupSubscription();

    // Custom event listeners
    const handleBalanceUpdate = (event: CustomEvent) => {
      const { userId: eventUserId, balance: newBalance } = event.detail;
      
      if (eventUserId === userId) {
        const previousBalance = previousBalanceRef.current;
        previousBalanceRef.current = newBalance;
        
        // Callback trigger
        if (onBalanceChange && previousBalance !== newBalance) {
          onBalanceChange(newBalance, previousBalance);
        }
        
        // Show notification for significant changes
        const difference = newBalance - previousBalance;
        if (Math.abs(difference) >= 1000) { // 1000+ NMFP değişikliklerinde bildir
          const message = difference > 0 
            ? `+${difference} NMFP kazandınız!`
            : `${difference} NMFP harcandı`;
            
          toast.success(message, {
            position: 'top-center',
            duration: 3000,
            style: {
              background: 'rgba(26, 26, 46, 0.95)',
              color: '#fff',
              border: '1px solid rgba(42, 56, 85, 0.5)'
            }
          });
        }
      }
    };

    const handleTransactionReceived = (event: CustomEvent) => {
      const { userId: eventUserId, transaction } = event.detail;
      
      if (eventUserId === userId) {
        // Transaction confirmation
        const transactionId = `server_${transaction.id}`;
        commitTransaction(transactionId);
        
        console.log(`[useRealtimeBalance] Transaction confirmed: ${transaction.type} - ${transaction.amount}`);
      }
    };

    // Event listeners
    window.addEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    window.addEventListener('transactionReceived', handleTransactionReceived as EventListener);

    // Cleanup function
    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
      window.removeEventListener('transactionReceived', handleTransactionReceived as EventListener);
      
      if (isSubscribedRef.current) {
        realtimeManager.unsubscribeUser(userId);
        isSubscribedRef.current = false;
      }
    };
  }, [userId]); // Sadece userId dependency'si

  // Manual refresh function
  const refreshBalance = useCallback(async (): Promise<boolean> => {
    return await realtimeManager.refreshUserBalance(userId);
  }, [userId]);

  // Wrapped functions for component use
  const addOptimisticTransactionWrapped = useCallback((transaction: {
    id: string;
    amount: number;
    type: 'purchase' | 'mining_reward' | 'repair' | 'refill' | 'garage_purchase';
    description: string;
  }) => {
    addOptimisticTransaction(userId, transaction);
  }, [userId, addOptimisticTransaction]);

  const commitTransactionWrapped = useCallback((transactionId: string) => {
    commitTransaction(userId, transactionId);
  }, [userId, commitTransaction]);

  const rollbackTransactionWrapped = useCallback((transactionId: string) => {
    rollbackTransaction(userId, transactionId);
  }, [userId, rollbackTransaction]);

  return {
    balance,
    pendingAmount,
    isBalanceLoading: balance === 0 && initialBalance === undefined,
    hasPending,
    addOptimisticTransaction: addOptimisticTransactionWrapped,
    commitTransaction: commitTransactionWrapped,
    rollbackTransaction: rollbackTransactionWrapped,
    refreshBalance
  };
}
