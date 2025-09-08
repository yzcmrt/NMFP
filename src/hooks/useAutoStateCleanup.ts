/**
 * Auto State Cleanup Hook
 * Frontend'te kalan stale session'ları otomatik temizlemek için
 */

import { useEffect, useRef, useCallback } from 'react';
import { MiningSession, MiningStatus } from '@/types';
import { miningService } from '@/services/api';

interface UseAutoStateCleanupProps {
  userId: string;
  localSessions: MiningSession[];
  onSessionsCleanup: (cleanSessions: MiningSession[]) => void;
  onBalanceRefresh?: () => Promise<void>;
}

export function useAutoStateCleanup({
  userId,
  localSessions,
  onSessionsCleanup,
  onBalanceRefresh
}: UseAutoStateCleanupProps) {
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCleanupRef = useRef<number>(0);

  const performCleanup = useCallback(async () => {
    if (!userId || localSessions.length === 0) return;
    
    const now = Date.now();
    
    // Rate limiting: 30 saniyede bir
    if (now - lastCleanupRef.current < 30000) {
      return;
    }
    lastCleanupRef.current = now;

    try {
      console.log('[AutoStateCleanup] Performing state cleanup check...');
      
      // Backend'ten fresh session'ları al
      const freshSessions = await miningService.getAllActiveMiningSessions(userId);
      const freshSessionIds = new Set(freshSessions.map(s => s.id));
      
      console.log('[AutoStateCleanup] Fresh sessions from backend:', freshSessionIds);
      console.log('[AutoStateCleanup] Local sessions:', localSessions.map(s => s.id));
      
      // Frontend'te olan ama backend'te olmayan session'ları bul
      const staleSessions = localSessions.filter(localSession => {
        const isStale = !freshSessionIds.has(localSession.id);
        
        if (isStale) {
          console.log(`[AutoStateCleanup] Stale session detected: ${localSession.id} (status: ${localSession.status})`);
        }
        
        return isStale;
      });
      
      // Time-expired session'ları bul
      const expiredSessions = localSessions.filter(localSession => {
        const endTime = new Date(localSession.end_time).getTime();
        const isExpired = now >= endTime && localSession.status === MiningStatus.ACTIVE;
        
        if (isExpired) {
          console.log(`[AutoStateCleanup] Expired session detected: ${localSession.id}`);
        }
        
        return isExpired;
      });
      
      // Cleanup gerekli mi?
      if (staleSessions.length > 0 || expiredSessions.length > 0) {
        console.log(`[AutoStateCleanup] Cleaning up ${staleSessions.length} stale + ${expiredSessions.length} expired sessions`);
        
        // Clean session'ları hesapla
        const cleanSessions = freshSessions;
        
        // Frontend state'i güncelle
        onSessionsCleanup(cleanSessions);
        
        // Balance'ı refresh et (ödüller otomatik verilmiş olabilir)
        if (onBalanceRefresh) {
          await onBalanceRefresh();
        }
        
        // Notification
        const totalCleaned = staleSessions.length + expiredSessions.length;
        if (totalCleaned > 0) {
          console.log(`[AutoStateCleanup] ✅ Cleaned up ${totalCleaned} outdated mining sessions`);
        }
      }
      
    } catch (error) {
      console.error('[AutoStateCleanup] Cleanup failed:', error);
    }
  }, [userId, localSessions, onSessionsCleanup, onBalanceRefresh]);

  // Auto cleanup on mount and periodic
  useEffect(() => {
    if (userId && localSessions.length > 0) {
      // İlk cleanup'ı hemen yap
      performCleanup();
      
      // Düzenli cleanup (2 dakikada bir)
      cleanupIntervalRef.current = setInterval(performCleanup, 120000); // 2 dakika
      
      return () => {
        if (cleanupIntervalRef.current) {
          clearInterval(cleanupIntervalRef.current);
          cleanupIntervalRef.current = null;
        }
      };
    }
  }, [userId, localSessions.length]); // Sadece userId ve session count değişirse

  // Manual cleanup trigger
  const triggerCleanup = useCallback(async () => {
    lastCleanupRef.current = 0; // Reset rate limit
    await performCleanup();
  }, [performCleanup]);

  return {
    triggerCleanup,
    performCleanup
  };
}
