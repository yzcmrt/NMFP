/**
 * Edge Function olmadan client-side mining progress broadcast
 * Docker kurulmadan önce geçici çözüm
 */

import { useEffect, useRef } from 'react';
import { MiningSession, MiningStatus } from '@/types';

interface ClientSideBroadcastProps {
  sessions: MiningSession[];
  onBatchUpdate?: (updates: Record<number, any>) => void;
}

export function useClientSideMiningBroadcast({ 
  sessions, 
  onBatchUpdate 
}: ClientSideBroadcastProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const activeSessions = sessions.filter(s => s.status === MiningStatus.ACTIVE);
    
    if (activeSessions.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Client-side progress hesaplama ve broadcast
    const updateProgress = () => {
      const now = Date.now();
      
      // Rate limiting: 5 saniyede bir
      if (now - lastUpdateRef.current < 5000) {
        return;
      }
      lastUpdateRef.current = now;

      const updates: Record<number, any> = {};
      let hasCompleted = false;

      activeSessions.forEach(session => {
        const startTime = new Date(session.start_time).getTime();
        const endTime = new Date(session.end_time).getTime();
        
        let progress = 0;
        let timeLeft = 0;
        let isCompleted = false;

        if (now >= endTime) {
          progress = 100;
          isCompleted = true;
          hasCompleted = true;
        } else if (now > startTime) {
          const totalDuration = endTime - startTime;
          const elapsed = now - startTime;
          progress = Math.min(100, (elapsed / totalDuration) * 100);
          timeLeft = endTime - now;
        } else {
          timeLeft = endTime - now;
        }

        updates[session.id] = {
          progress: Math.round(progress),
          timeLeft,
          isCompleted,
          sessionId: session.id
        };
      });

      // Broadcast updates
      if (Object.keys(updates).length > 0) {
        onBatchUpdate?.(updates);
        
        // Custom event dispatch
        window.dispatchEvent(new CustomEvent('batchMiningUpdate', {
          detail: { mining_updates: updates }
        }));
      }

      // Log completed sessions
      if (hasCompleted) {
        console.log('[ClientSideBroadcast] Some sessions completed, consider refreshing from server');
      }
    };

    // İlk update'i hemen yap
    updateProgress();

    // Interval başlat
    intervalRef.current = setInterval(updateProgress, 5000); // 5 saniyede bir

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessions, onBatchUpdate]);

  // Manual refresh trigger
  const triggerUpdate = () => {
    lastUpdateRef.current = 0; // Reset rate limit
  };

  return { triggerUpdate };
}
