/**
 * Mining State Synchronization Hook
 * Frontend-Backend state mismatch'leri çözmek için
 */

import { useEffect, useCallback, useRef } from 'react';
import { MiningSession, MiningStatus } from '@/types';
import { miningService } from '@/services/api';

interface UseMiningStateSyncProps {
  userId: string;
  sessions: MiningSession[];
  onSessionsUpdated: (sessions: MiningSession[]) => void;
}

export function useMiningStateSync({
  userId,
  sessions,
  onSessionsUpdated
}: UseMiningStateSyncProps) {
  const lastSyncRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);

  /**
   * Completed session'ları temizle ve server'dan fresh data al
   */
  const syncWithServer = useCallback(async () => {
    if (!userId || isCheckingRef.current) return;
    
    const now = Date.now();
    // Rate limiting: 5 saniyede bir
    if (now - lastSyncRef.current < 5000) {
      return;
    }
    
    isCheckingRef.current = true;
    lastSyncRef.current = now;
    
    try {
      console.log('[MiningStateSync] Syncing with server...');
      
      // Server'dan fresh session'ları al
      const freshSessions = await miningService.getAllActiveMiningSessions(userId);
      console.log('[MiningStateSync] Fresh sessions from server:', freshSessions.length);
      
      // Completed session'ları kontrol et
      const completedSessions = sessions.filter(localSession => {
        const serverSession = freshSessions.find(s => s.id === localSession.id);
        
        // Server'da yoksa completed olmuş
        if (!serverSession) {
          console.log(`[MiningStateSync] Session ${localSession.id} completed (not found on server)`);
          return true;
        }
        
        // Server'da completed olarak işaretlenmişse
        if (serverSession.status === MiningStatus.COMPLETED) {
          console.log(`[MiningStateSync] Session ${localSession.id} completed on server`);
          return true;
        }
        
        // Time check: End time geçmişse
        const endTime = new Date(localSession.end_time).getTime();
        if (now >= endTime && localSession.status === MiningStatus.ACTIVE) {
          console.log(`[MiningStateSync] Session ${localSession.id} expired by time`);
          return true;
        }
        
        return false;
      });
      
      if (completedSessions.length > 0) {
        console.log(`[MiningStateSync] Found ${completedSessions.length} completed sessions, updating state...`);
        
        // Local state'i server data ile sync et
        onSessionsUpdated(freshSessions);
      }
      
    } catch (error) {
      console.error('[MiningStateSync] Sync error:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId, sessions, onSessionsUpdated]);

  /**
   * Session state mismatch detection
   */
  const detectStateMismatch = useCallback(() => {
    const now = Date.now();
    let hasMismatch = false;
    
    sessions.forEach(session => {
      const endTime = new Date(session.end_time).getTime();
      
      // Frontend'te active görünen ama zamanı dolmuş session'lar
      if (session.status === MiningStatus.ACTIVE && now >= endTime) {
        console.warn(`[MiningStateSync] State mismatch detected: Session ${session.id} should be completed`);
        hasMismatch = true;
      }
    });
    
    if (hasMismatch) {
      console.log('[MiningStateSync] Triggering sync due to state mismatch...');
      syncWithServer();
    }
  }, [sessions, syncWithServer]);

  // Auto sync on mount and when sessions change
  useEffect(() => {
    if (userId && sessions.length > 0) {
      // İlk mount'ta state mismatch kontrol et
      detectStateMismatch();
      
      // Düzenli sync (2 dakikada bir)
      const interval = setInterval(() => {
        detectStateMismatch();
      }, 120000); // 2 dakika
      
      return () => clearInterval(interval);
    }
  }, [userId, sessions.length, detectStateMismatch]); // sessions.length dependency - sadece sayı değişirse

  // Manual sync trigger
  const forcSync = useCallback(async () => {
    lastSyncRef.current = 0; // Reset rate limit
    await syncWithServer();
  }, [syncWithServer]);

  return {
    syncWithServer,
    detectStateMismatch,
    forcSync,
    isChecking: isCheckingRef.current
  };
}
