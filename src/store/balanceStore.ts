import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PendingTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'mining_reward' | 'repair' | 'refill' | 'garage_purchase';
  timestamp: number;
  description: string;
}

interface BalanceState {
  // Core balance data
  balances: Map<string, number>;
  originalBalances: Map<string, number>; // Server'dan gelen gerçek bakiye
  pendingTransactions: Map<string, PendingTransaction[]>;
  
  // Actions
  setBalance: (userId: string, balance: number) => void;
  addOptimisticTransaction: (userId: string, transaction: Omit<PendingTransaction, 'timestamp'>) => void;
  commitTransaction: (userId: string, transactionId: string) => void;
  rollbackTransaction: (userId: string, transactionId: string) => void;
  clearAllPending: (userId: string) => void;
  
  // Getters
  getDisplayBalance: (userId: string) => number;
  getPendingAmount: (userId: string) => number;
  hasPendingTransactions: (userId: string) => boolean;
}

export const useBalanceStore = create<BalanceState>()(
  subscribeWithSelector((set, get) => ({
    balances: new Map(),
    originalBalances: new Map(),
    pendingTransactions: new Map(),

    setBalance: (userId: string, balance: number) => {
      set((state) => {
        const newBalances = new Map(state.balances);
        const newOriginalBalances = new Map(state.originalBalances);
        
        newBalances.set(userId, balance);
        newOriginalBalances.set(userId, balance);
        
        return { 
          balances: newBalances,
          originalBalances: newOriginalBalances 
        };
      });
    },

    addOptimisticTransaction: (userId: string, transaction: Omit<PendingTransaction, 'timestamp'>) => {
      const transactionWithTimestamp: PendingTransaction = {
        ...transaction,
        timestamp: Date.now()
      };

      set((state) => {
        const newBalances = new Map(state.balances);
        const newPendingTransactions = new Map(state.pendingTransactions);
        
        // Current balance'ı güncelle
        const currentBalance = newBalances.get(userId) || 0;
        newBalances.set(userId, currentBalance + transaction.amount);
        
        // Pending transaction'ı ekle
        const userPending = newPendingTransactions.get(userId) || [];
        newPendingTransactions.set(userId, [...userPending, transactionWithTimestamp]);
        
        return { 
          balances: newBalances,
          pendingTransactions: newPendingTransactions 
        };
      });
      
      console.log(`[BalanceStore] Optimistic update: ${transaction.description} (${transaction.amount > 0 ? '+' : ''}${transaction.amount})`);
    },

    commitTransaction: (userId: string, transactionId: string) => {
      set((state) => {
        const newPendingTransactions = new Map(state.pendingTransactions);
        const userPending = newPendingTransactions.get(userId) || [];
        
        // Transaction'ı pending'den kaldır
        const filteredPending = userPending.filter(t => t.id !== transactionId);
        newPendingTransactions.set(userId, filteredPending);
        
        return { pendingTransactions: newPendingTransactions };
      });
      
      console.log(`[BalanceStore] Transaction committed: ${transactionId}`);
    },

    rollbackTransaction: (userId: string, transactionId: string) => {
      set((state) => {
        const newBalances = new Map(state.balances);
        const newPendingTransactions = new Map(state.pendingTransactions);
        
        const userPending = newPendingTransactions.get(userId) || [];
        const transaction = userPending.find(t => t.id === transactionId);
        
        if (transaction) {
          // Balance'ı geri al
          const currentBalance = newBalances.get(userId) || 0;
          newBalances.set(userId, currentBalance - transaction.amount);
          
          // Pending'den kaldır
          const filteredPending = userPending.filter(t => t.id !== transactionId);
          newPendingTransactions.set(userId, filteredPending);
        }
        
        return { 
          balances: newBalances,
          pendingTransactions: newPendingTransactions 
        };
      });
      
      console.log(`[BalanceStore] Transaction rolled back: ${transactionId}`);
    },

    clearAllPending: (userId: string) => {
      set((state) => {
        const newBalances = new Map(state.balances);
        const newPendingTransactions = new Map(state.pendingTransactions);
        
        // Original balance'a dön
        const originalBalance = state.originalBalances.get(userId);
        if (originalBalance !== undefined) {
          newBalances.set(userId, originalBalance);
        }
        
        // Tüm pending'leri temizle
        newPendingTransactions.set(userId, []);
        
        return { 
          balances: newBalances,
          pendingTransactions: newPendingTransactions 
        };
      });
    },

    getDisplayBalance: (userId: string) => {
      const state = get();
      return state.balances.get(userId) || 0;
    },

    getPendingAmount: (userId: string) => {
      const state = get();
      const pending = state.pendingTransactions.get(userId) || [];
      return pending.reduce((total, t) => total + t.amount, 0);
    },

    hasPendingTransactions: (userId: string) => {
      const state = get();
      const pending = state.pendingTransactions.get(userId) || [];
      return pending.length > 0;
    }
  }))
);

// Balance değişikliklerini dinlemek için hook
export const useBalanceChanges = (userId: string, callback: (balance: number) => void) => {
  useBalanceStore.subscribe(
    (state) => state.balances.get(userId) || 0,
    callback
  );
};
