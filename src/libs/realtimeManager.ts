import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useBalanceStore } from '@/store/balanceStore';

interface ConnectionMetrics {
  activeConnections: number;
  maxConnections: number;
  lastUpdateTime: number;
}

interface QueuedUpdate {
  userId: string;
  type: 'balance' | 'mining_progress' | 'transaction';
  data: any;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

export class RealtimeManager {
  private static instance: RealtimeManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private updateQueue: QueuedUpdate[] = [];
  private metrics: ConnectionMetrics = {
    activeConnections: 0,
    maxConnections: 1000, // Supabase default limit
    lastUpdateTime: 0
  };

  // Connection pooling için queue
  private connectionQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.startBatchProcessor();
    this.startMetricsCollection();
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Kullanıcı için balance real-time subscription
   * Connection pooling ile optimize edilmiş
   */
  async subscribeToUserBalance(userId: string): Promise<RealtimeChannel | null> {
    const channelName = `user_balance:${userId}`;
    
    // Duplicate subscription kontrolü
    if (this.channels.has(channelName)) {
      console.log(`[RealtimeManager] Already subscribed to ${channelName}`);
      return this.channels.get(channelName)!;
    }

    // Connection limit kontrolü
    if (this.metrics.activeConnections >= this.metrics.maxConnections) {
      console.warn(`[RealtimeManager] Connection limit reached, queueing subscription for ${userId}`);
      return this.queueConnection(() => this.subscribeToUserBalance(userId));
    }

    try {
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false }, // Kendi gönderdiğin mesajları alma
            presence: { key: userId }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            this.handleBalanceUpdate(userId, payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            this.handleTransactionInsert(userId, payload);
          }
        );

      await channel.subscribe((status) => {
        console.log(`[RealtimeManager] Subscription status for ${channelName}:`, status);
        
        if (status === 'SUBSCRIBED') {
          this.metrics.activeConnections++;
          this.channels.set(channelName, channel);
          console.log(`[RealtimeManager] Successfully subscribed to ${channelName}, active connections: ${this.metrics.activeConnections}`);
        } else if (status === 'CLOSED') {
          this.metrics.activeConnections--;
          this.channels.delete(channelName);
          console.log(`[RealtimeManager] Connection closed for ${channelName}, active connections: ${this.metrics.activeConnections}`);
        }
      });

      return channel;
    } catch (error) {
      console.error(`[RealtimeManager] Failed to subscribe to ${channelName}:`, error);
      return null;
    }
  }

  /**
   * Mining progress için room-based subscription
   * Aynı garage'daki kullanıcıları gruplıyor
   */
  async subscribeToMiningUpdates(userId: string, garageIds: number[]): Promise<RealtimeChannel | null> {
    // Garage'lar bazında room oluştur
    const roomId = `mining_room:${garageIds.sort().join(',')}`;
    const channelName = `${roomId}:${userId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    try {
      const channel = supabase
        .channel(roomId, {
          config: {
            broadcast: { self: false },
            presence: { key: userId }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mining_sessions',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            this.handleMiningUpdate(userId, payload);
          }
        )
        .on('broadcast', { event: 'batch_mining_progress' }, (payload) => {
          this.handleBatchMiningProgress(payload);
        });

      await channel.subscribe();
      this.channels.set(channelName, channel);
      
      return channel;
    } catch (error) {
      console.error(`[RealtimeManager] Failed to subscribe to mining updates:`, error);
      return null;
    }
  }

  /**
   * Balance güncellemelerini handle eder
   */
  private handleBalanceUpdate(userId: string, payload: any) {
    try {
      const newBalance = payload.new?.balance;
      
      if (typeof newBalance === 'number') {
        // Zustand store'u güncelle
        useBalanceStore.getState().setBalance(userId, newBalance);
        
        // Pending transaction'ları temizle (confirmed)
        useBalanceStore.getState().clearAllPending(userId);
        
        console.log(`[RealtimeManager] Balance updated for ${userId}: ${newBalance}`);
        
        // Custom event dispatch (optional)
        window.dispatchEvent(new CustomEvent('balanceUpdated', { 
          detail: { userId, balance: newBalance }
        }));
      }
    } catch (error) {
      console.error('[RealtimeManager] Error handling balance update:', error);
    }
  }

  /**
   * Transaction insert'lerini handle eder
   */
  private handleTransactionInsert(userId: string, payload: any) {
    try {
      const transaction = payload.new;
      
      // Transaction type'a göre aksiyon al
      if (transaction.type === 'mining_reward') {
        console.log(`[RealtimeManager] Mining reward received for ${userId}: ${transaction.amount}`);
        
        // Mining reward'ı optimistic olarak ekle
        useBalanceStore.getState().addOptimisticTransaction(userId, {
          id: `mining_reward_${transaction.id}`,
          amount: transaction.amount,
          type: 'mining_reward',
          description: `Mining Ödülü: ${transaction.source || 'Bilinmeyen'}`
        });
      }
      
      // UI notification
      window.dispatchEvent(new CustomEvent('transactionReceived', {
        detail: { userId, transaction }
      }));
      
    } catch (error) {
      console.error('[RealtimeManager] Error handling transaction insert:', error);
    }
  }

  /**
   * Mining progress batch updates
   */
  private handleMiningProgress(payload: any) {
    try {
      const updates = payload.progress_updates;
      
      // Mining progress'leri broadcast et
      window.dispatchEvent(new CustomEvent('miningProgressUpdated', {
        detail: { updates }
      }));
      
    } catch (error) {
      console.error('[RealtimeManager] Error handling mining progress:', error);
    }
  }

  /**
   * Batch mining progress handler
   */
  private handleBatchMiningProgress(payload: any) {
    const { mining_updates } = payload.payload;
    
    if (mining_updates) {
      window.dispatchEvent(new CustomEvent('batchMiningUpdate', {
        detail: mining_updates
      }));
    }
  }

  /**
   * Connection queue management
   */
  private async queueConnection(subscriptionFunc: () => Promise<RealtimeChannel | null>): Promise<RealtimeChannel | null> {
    return new Promise((resolve) => {
      this.connectionQueue.push(async () => {
        const channel = await subscriptionFunc();
        resolve(channel);
      });
      
      this.processConnectionQueue();
    });
  }

  /**
   * Connection queue processor
   */
  private async processConnectionQueue() {
    if (this.isProcessingQueue || this.connectionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.connectionQueue.length > 0 && this.metrics.activeConnections < this.metrics.maxConnections) {
      const nextConnection = this.connectionQueue.shift();
      if (nextConnection) {
        await nextConnection();
        // Rate limiting: her connection arasında kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Batch update processor
   * Performance için update'leri group'lar
   */
  private startBatchProcessor() {
    setInterval(() => {
      if (this.updateQueue.length > 0) {
        this.processBatchUpdates();
      }
    }, 500); // 500ms'de bir batch işle
  }

  private processBatchUpdates() {
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    // Priority'e göre sırala
    updates.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Group by user
    const userUpdates = new Map<string, QueuedUpdate[]>();
    updates.forEach(update => {
      const existing = userUpdates.get(update.userId) || [];
      userUpdates.set(update.userId, [...existing, update]);
    });

    // Process batches
    for (const [userId, userUpdateList] of userUpdates) {
      this.processUserUpdates(userId, userUpdateList);
    }
  }

  private processUserUpdates(userId: string, updates: QueuedUpdate[]) {
    const balanceUpdates = updates.filter(u => u.type === 'balance');
    const miningUpdates = updates.filter(u => u.type === 'mining_progress');
    
    // En son balance update'i al
    if (balanceUpdates.length > 0) {
      const latestBalance = balanceUpdates[balanceUpdates.length - 1];
      useBalanceStore.getState().setBalance(userId, latestBalance.data.balance);
    }

    // Mining updates'leri broadcast et
    if (miningUpdates.length > 0) {
      window.dispatchEvent(new CustomEvent('batchMiningUpdate', {
        detail: { userId, updates: miningUpdates }
      }));
    }
  }

  /**
   * Metrics collection
   */
  private startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Her dakika
  }

  private collectMetrics() {
    const now = Date.now();
    this.metrics.lastUpdateTime = now;
    
    console.log(`[RealtimeManager] Metrics - Active Connections: ${this.metrics.activeConnections}, Queue Length: ${this.connectionQueue.length}`);
    
    // Optional: Send metrics to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'realtime_metrics', {
        active_connections: this.metrics.activeConnections,
        queue_length: this.connectionQueue.length
      });
    }
  }

  /**
   * Subscription'ı temizle
   */
  async unsubscribeUser(userId: string) {
    const channelsToRemove: string[] = [];
    
    for (const [channelName, channel] of this.channels) {
      if (channelName.includes(userId)) {
        await supabase.removeChannel(channel);
        channelsToRemove.push(channelName);
        this.metrics.activeConnections--;
      }
    }
    
    channelsToRemove.forEach(channelName => {
      this.channels.delete(channelName);
    });
    
    console.log(`[RealtimeManager] Unsubscribed ${channelsToRemove.length} channels for user ${userId}`);
  }

  /**
   * Tüm connection'ları temizle
   */
  async cleanup() {
    console.log('[RealtimeManager] Cleaning up all connections...');
    
    for (const [channelName, channel] of this.channels) {
      await supabase.removeChannel(channel);
    }
    
    this.channels.clear();
    this.metrics.activeConnections = 0;
    this.updateQueue = [];
    this.connectionQueue = [];
  }

  /**
   * Health check
   */
  getHealthStatus() {
    return {
      isHealthy: this.metrics.activeConnections < this.metrics.maxConnections * 0.9,
      activeConnections: this.metrics.activeConnections,
      maxConnections: this.metrics.maxConnections,
      queueLength: this.connectionQueue.length,
      lastUpdate: this.metrics.lastUpdateTime
    };
  }

  /**
   * Manual balance refresh tetikleyicisi
   */
  async refreshUserBalance(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        useBalanceStore.getState().setBalance(userId, data.balance);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[RealtimeManager] Failed to refresh user balance:', error);
      return false;
    }
  }
}

// Singleton instance export
export const realtimeManager = RealtimeManager.getInstance();

// React hook for realtime management
export const useRealtimeManager = () => {
  return realtimeManager;
};

// Cleanup helper for React components
export const useRealtimeCleanup = (userId: string) => {
  return () => {
    realtimeManager.unsubscribeUser(userId);
  };
};
