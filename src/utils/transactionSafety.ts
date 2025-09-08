/**
 * Transaction Safety Utilities
 * Kullanıcı puan kaybını önlemek için güvenli transaction management
 */

import { useBalanceStore } from '@/store/balanceStore';
import { supabase } from '@/lib/supabaseClient';

interface TransactionSafetyConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutMs: number;
  enableDuplicateCheck: boolean;
}

const defaultConfig: TransactionSafetyConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeoutMs: 30000,
  enableDuplicateCheck: true
};

/**
 * Transaction state tracking
 */
class TransactionTracker {
  private activeTransactions = new Set<string>();
  private completedTransactions = new Set<string>();
  private retryCount = new Map<string, number>();

  isActive(txId: string): boolean {
    return this.activeTransactions.has(txId);
  }

  isCompleted(txId: string): boolean {
    return this.completedTransactions.has(txId);
  }

  startTransaction(txId: string): boolean {
    if (this.isActive(txId) || this.isCompleted(txId)) {
      console.warn(`[TransactionSafety] Duplicate transaction attempt: ${txId}`);
      return false;
    }
    
    this.activeTransactions.add(txId);
    this.retryCount.set(txId, 0);
    console.log(`[TransactionSafety] Transaction started: ${txId}`);
    return true;
  }

  completeTransaction(txId: string): void {
    this.activeTransactions.delete(txId);
    this.completedTransactions.add(txId);
    this.retryCount.delete(txId);
    console.log(`[TransactionSafety] Transaction completed: ${txId}`);
  }

  failTransaction(txId: string): void {
    this.activeTransactions.delete(txId);
    this.retryCount.delete(txId);
    console.log(`[TransactionSafety] Transaction failed: ${txId}`);
  }

  canRetry(txId: string, maxRetries: number): boolean {
    const currentRetries = this.retryCount.get(txId) || 0;
    return currentRetries < maxRetries;
  }

  incrementRetry(txId: string): number {
    const currentRetries = this.retryCount.get(txId) || 0;
    const newCount = currentRetries + 1;
    this.retryCount.set(txId, newCount);
    return newCount;
  }

  cleanup(): void {
    // 5 dakikadan eski completed transaction'ları temizle
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    Array.from(this.completedTransactions).forEach(txId => {
      const timestamp = this.extractTimestamp(txId);
      if (timestamp && timestamp < fiveMinutesAgo) {
        this.completedTransactions.delete(txId);
      }
    });
  }

  private extractTimestamp(txId: string): number | null {
    const match = txId.match(/_(\d+)$/);
    return match ? parseInt(match[1]) : null;
  }
}

const transactionTracker = new TransactionTracker();

/**
 * Safe transaction wrapper
 * Optimistic updates ile güvenli transaction management
 */
export async function safeTransaction<T>(
  transactionId: string,
  operation: () => Promise<T>,
  optimisticUpdate: {
    userId: string;
    amount: number;
    type: 'purchase' | 'mining_reward' | 'repair' | 'refill' | 'garage_purchase';
    description: string;
  },
  config: Partial<TransactionSafetyConfig> = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  
  const finalConfig = { ...defaultConfig, ...config };
  const { addOptimisticTransaction, commitTransaction, rollbackTransaction } = useBalanceStore.getState();

  // Duplicate check
  if (!transactionTracker.startTransaction(transactionId)) {
    return { 
      success: false, 
      error: 'Duplicate transaction detected - transaction ignored for user safety' 
    };
  }

  // Optimistic update
  addOptimisticTransaction(optimisticUpdate.userId, {
    id: transactionId,
    ...optimisticUpdate
  });

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      console.log(`[TransactionSafety] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} for ${transactionId}`);

      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout')), finalConfig.timeoutMs);
      });

      const operationPromise = operation();
      
      // Race between operation and timeout
      const result = await Promise.race([operationPromise, timeoutPromise]);

      // Success
      transactionTracker.completeTransaction(transactionId);
      commitTransaction(optimisticUpdate.userId, transactionId);
      
      console.log(`[TransactionSafety] Transaction successful: ${transactionId}`);
      return { success: true, data: result };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[TransactionSafety] Attempt ${attempt + 1} failed for ${transactionId}:`, lastError.message);

      // Check if we can retry
      if (attempt < finalConfig.maxRetries && transactionTracker.canRetry(transactionId, finalConfig.maxRetries)) {
        transactionTracker.incrementRetry(transactionId);
        
        // Exponential backoff
        const delay = finalConfig.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`[TransactionSafety] Retrying in ${delay}ms...`);
        continue;
      }
      
      // All retries exhausted
      break;
    }
  }

  // Transaction failed - rollback
  transactionTracker.failTransaction(transactionId);
  rollbackTransaction(optimisticUpdate.userId, transactionId);
  
  console.error(`[TransactionSafety] Transaction failed after all retries: ${transactionId}`);
  return { 
    success: false, 
    error: lastError?.message || 'Transaction failed after all retries' 
  };
}

/**
 * Safe purchase wrapper
 */
export async function safePurchase(
  userId: string,
  purchaseOperation: () => Promise<any>,
  purchaseDetails: {
    amount: number;
    type: 'car' | 'garage';
    itemName: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  
  const transactionId = `purchase_${purchaseDetails.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return safeTransaction(
    transactionId,
    purchaseOperation,
    {
      userId,
      amount: -Math.abs(purchaseDetails.amount), // Always negative for purchases
      type: purchaseDetails.type === 'car' ? 'purchase' : 'garage_purchase',
      description: `${purchaseDetails.itemName} satın alındı`
    },
    {
      maxRetries: 2, // Purchase için sadece 2 deneme
      timeoutMs: 20000 // 20 saniye timeout
    }
  );
}

/**
 * Safe mining reward claim
 */
export async function safeMiningClaim(
  userId: string,
  sessionId: number,
  expectedReward: number,
  claimOperation: () => Promise<number>
): Promise<{ success: boolean; actualReward?: number; error?: string }> {
  
  const transactionId = `mining_claim_${sessionId}_${Date.now()}`;
  
  const result = await safeTransaction(
    transactionId,
    claimOperation,
    {
      userId,
      amount: expectedReward,
      type: 'mining_reward',
      description: `Mining ödülü (Session #${sessionId})`
    },
    {
      maxRetries: 3, // Mining claim için 3 deneme
      timeoutMs: 15000
    }
  );

  return {
    success: result.success,
    actualReward: result.data,
    error: result.error
  };
}

/**
 * Balance validation before expensive operations
 */
export function validateBalance(currentBalance: number, requiredAmount: number, operation: string): boolean {
  if (currentBalance < requiredAmount) {
    console.error(`[TransactionSafety] Insufficient balance for ${operation}:`, {
      current: currentBalance,
      required: requiredAmount,
      shortfall: requiredAmount - currentBalance
    });
    return false;
  }
  return true;
}

/**
 * Transaction cleanup (call periodically)
 */
export function cleanupTransactions(): void {
  transactionTracker.cleanup();
}

/**
 * Emergency balance recovery (son çare)
 */
export async function emergencyBalanceRecovery(userId: string): Promise<void> {
  console.warn(`[TransactionSafety] Emergency balance recovery for user: ${userId}`);
  
  // Clear all pending transactions
  useBalanceStore.getState().clearAllPending(userId);
  
  // Force balance refresh from server
  try {
    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    if (data) {
      useBalanceStore.getState().setBalance(userId, data.balance);
      console.log(`[TransactionSafety] Balance recovered: ${data.balance}`);
    }
  } catch (error) {
    console.error(`[TransactionSafety] Balance recovery failed:`, error);
  }
}

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupTransactions, 5 * 60 * 1000);
}
