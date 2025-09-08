/**
 * Immediate Mining Session Synchronization
 * Mining başlatıldıktan sonra session'ı hemen sync etmek için
 */

import { useCallback } from 'react';
import { miningService } from '@/services/api';
import { MiningSession } from '@/types';

export function useImmediateSync() {
  
  /**
   * Mining başlatıldıktan sonra session'ı hemen sync et
   */
  const syncMiningSession = useCallback(async (
    userId: string,
    expectedSessionId: number,
    onSuccess: (session: MiningSession) => void,
    onTimeout: () => void
  ): Promise<void> => {
    
    const maxAttempts = 5;
    const attemptDelay = 500; // Start with 500ms
    
    console.log('[ImmediateSync] Syncing mining session:', expectedSessionId);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[ImmediateSync] Attempt ${attempt}/${maxAttempts}...`);
        
        const sessions = await miningService.getAllActiveMiningSessions(userId);
        const newSession = sessions.find(s => s.id === expectedSessionId);
        
        if (newSession) {
          console.log('[ImmediateSync] ✅ Session synchronized successfully!', newSession);
          onSuccess(newSession);
          return;
        }
        
        console.log('[ImmediateSync] Session not found yet, waiting...');
        
        // Exponential backoff with max 3 seconds
        const delay = Math.min(attemptDelay * Math.pow(1.5, attempt - 1), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`[ImmediateSync] Attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          console.error('[ImmediateSync] 🚨 All sync attempts failed');
          onTimeout();
          return;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, attemptDelay * attempt));
      }
    }
    
    console.error('[ImmediateSync] 🚨 Sync timeout - session not found');
    onTimeout();
    
  }, []);

  /**
   * Car status synchronization
   */
  const syncCarStatus = useCallback(async (
    userId: string,
    carId: number,
    expectedStatus: string,
    onSuccess: (car: any) => void,
    onTimeout: () => void
  ): Promise<void> => {
    
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { userCarService } = await import('@/services/api');
        const cars = await userCarService.getUserCars(userId);
        const car = cars.find(c => c.id === carId);
        
        if (car && car.status === expectedStatus) {
          console.log('[ImmediateSync] ✅ Car status synchronized:', car.status);
          onSuccess(car);
          return;
        }
        
        console.log(`[ImmediateSync] Car status not synced yet (${car?.status} !== ${expectedStatus}), waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        
      } catch (error) {
        console.error(`[ImmediateSync] Car sync attempt ${attempt} failed:`, error);
      }
    }
    
    console.error('[ImmediateSync] 🚨 Car sync timeout');
    onTimeout();
    
  }, []);

  return {
    syncMiningSession,
    syncCarStatus
  };
}
