import { useEffect, useState, useCallback, useRef } from 'react';
import { MiningSession, MiningStatus } from '@/types';
import { realtimeManager } from '@/libs/realtimeManager';
import { miningService } from '@/services/api';

export interface MiningProgress {
  progress: number;
  timeLeft: string;
  timeLeftMs: number;
  isCompleted: boolean;
  sessionId?: number;
}

interface UseRealtimeMiningProps {
  userId: string;
  sessions: MiningSession[];
  onProgressUpdate?: (sessionId: number, progress: MiningProgress) => void;
  onSessionCompleted?: (sessionId: number) => void;
}

export function useRealtimeMining({
  userId,
  sessions,
  onProgressUpdate,
  onSessionCompleted
}: UseRealtimeMiningProps) {
  const [progressData, setProgressData] = useState<Record<number, MiningProgress>>({});
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // Format time helper
  const formatTimeLeft = useCallback((milliseconds: number): string => {
    if (milliseconds <= 0) return '00:00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress for a session
  const calculateSessionProgress = useCallback((session: MiningSession): MiningProgress => {
    const now = Date.now();
    const startTime = new Date(session.start_time).getTime();
    const endTime = new Date(session.end_time).getTime();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useRealtimeMining] Calculating progress for session ${session.id}:`, {
        now: new Date(now).toISOString(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        sessionStatus: session.status
      });
    }
    
    if (now >= endTime) {
      return {
        progress: 100,
        timeLeft: '00:00:00',
        timeLeftMs: 0,
        isCompleted: true,
        sessionId: session.id
      };
    }
    
    if (now <= startTime) {
      const timeLeftMs = endTime - now;
      return {
        progress: 0,
        timeLeft: formatTimeLeft(timeLeftMs),
        timeLeftMs,
        isCompleted: false,
        sessionId: session.id
      };
    }
    
    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;
    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const timeLeftMs = endTime - now;
    
    const result = {
      progress: Math.round(progressPercent),
      timeLeft: formatTimeLeft(timeLeftMs),
      timeLeftMs,
      isCompleted: false,
      sessionId: session.id
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useRealtimeMining] Session ${session.id} progress:`, result);
    }
    
    return result;
  }, []); // formatTimeLeft dependency kaldırıldı - stable function

  // Update progress for all active sessions
  const updateAllProgress = useCallback(() => {
    const now = Date.now();
    
    // Rate limiting: sadece 1 saniyede bir güncelle
    if (now - lastUpdateRef.current < 1000) {
      return;
    }
    lastUpdateRef.current = now;

    const newProgressData: Record<number, MiningProgress> = {};
    let hasCompletedSessions = false;

    sessions.forEach(session => {
      if (session.status === MiningStatus.ACTIVE) {
        const progress = calculateSessionProgress(session);
        newProgressData[session.id] = progress;
        
        // Check for completed sessions
        if (progress.isCompleted) {
          hasCompletedSessions = true;
          onSessionCompleted?.(session.id);
        }
        
        // Call individual progress callback
        if (onProgressUpdate) {
          onProgressUpdate(session.id, progress);
        }
      }
    });

    setProgressData(prevData => {
      // Sadece değişen session'ları güncelle
      const hasChanges = Object.keys(newProgressData).some(sessionId => {
        const prev = prevData[sessionId];
        const current = newProgressData[sessionId];
        return !prev || 
               prev.progress !== current.progress || 
               prev.timeLeft !== current.timeLeft ||
               prev.isCompleted !== current.isCompleted;
      });

      return hasChanges ? { ...prevData, ...newProgressData } : prevData;
    });

    // Completed session'lar varsa server'dan güncel durumu çek
    if (hasCompletedSessions) {
      setTimeout(() => {
        updateServerProgress();
      }, 2000); // 2 saniye sonra server'ı kontrol et
    }
  }, []); // Dependency'ler kaldırıldı - callback stabilization için

  // Server'dan güncel mining durumunu çek
  const updateServerProgress = useCallback(async () => {
    if (!userId) return;

    try {
      const updatedSessions = await miningService.getAllActiveMiningSessions(userId);
      
      // Completed olan session'ları bul ve callback'leri çağır
      updatedSessions.forEach(session => {
        if (session.status === MiningStatus.COMPLETED) {
          onSessionCompleted?.(session.id);
        }
      });
    } catch (error) {
      console.error('[useRealtimeMining] Server progress update failed:', error);
    }
  }, [userId]); // Callback dependency'leri kaldırıldı

  // Setup realtime subscriptions
  useEffect(() => {
    if (!userId || sessions.length === 0) return;

    const garageIds = [...new Set(sessions.map(s => s.garage_id).filter(Boolean))];
    
    const setupRealtime = async () => {
      try {
        await realtimeManager.subscribeToMiningUpdates(userId, garageIds);
        setIsConnected(true);
        console.log('[useRealtimeMining] Realtime subscription established');
      } catch (error) {
        console.error('[useRealtimeMining] Realtime subscription failed:', error);
        setIsConnected(false);
      }
    };

    setupRealtime();

    // Batch mining update event listener
    const handleBatchUpdate = (event: CustomEvent) => {
      const { mining_updates } = event.detail;
      if (mining_updates && typeof mining_updates === 'object') {
        setProgressData(prevData => ({
          ...prevData,
          ...mining_updates
        }));
      }
    };

    window.addEventListener('batchMiningUpdate', handleBatchUpdate as EventListener);

    return () => {
      window.removeEventListener('batchMiningUpdate', handleBatchUpdate as EventListener);
    };
  }, [userId]); // sessions dependency kaldırıldı - sadece userId değişirse subscription yenilesin

  // Client-side progress calculation as fallback
  useEffect(() => {
    const activeSessions = sessions.filter(s => s.status === MiningStatus.ACTIVE);
    
    if (activeSessions.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // İlk hesaplamayı hemen yap
    updateAllProgress();

    // Interval başlat (sadece aktif session'lar varsa)
    intervalRef.current = setInterval(updateAllProgress, 5000); // 5 saniyede bir

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Dependency array boşaltıldı - sadece mount/unmount'da çalışsın

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Manual refresh
  const refreshProgress = useCallback(async () => {
    await updateServerProgress();
    updateAllProgress();
  }, []); // Dependencies kaldırıldı - stable callbacks

  return {
    progressData,
    isConnected,
    refreshProgress,
    updateProgress: updateAllProgress
  };
}
