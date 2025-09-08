/**
 * Mining Debug Utilities
 * Development ortamında mining workflow'unu debug etmek için
 */

import { UserCar, MiningSession, CarStatus, MiningStatus } from '@/types';

export const debugMining = {
  /**
   * Araç ve mining session state'ini detail'le log'la
   */
  logCarMiningState: (car: UserCar, miningSession?: MiningSession | null) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.group(`🚗 Car ${car.id} (${car.name}) Debug`);
    console.log('Car Status:', car.status);
    console.log('Fuel:', `${car.fuel}% (Min: 25%)`);
    console.log('Condition:', `${car.condition}% (Min: 10%)`);
    console.log('Created:', car.created_at);
    console.log('Updated:', car.updated_at);
    
    if (miningSession) {
      console.log('🏗️ Mining Session:', {
        id: miningSession.id,
        status: miningSession.status,
        startTime: miningSession.start_time,
        endTime: miningSession.end_time,
        expectedReward: miningSession.expected_reward,
        carId: miningSession.car_id,
        garageId: miningSession.garage_id
      });
      
      // Time calculations
      const now = Date.now();
      const startTime = new Date(miningSession.start_time).getTime();
      const endTime = new Date(miningSession.end_time).getTime();
      
      console.log('⏰ Time Analysis:', {
        now: new Date(now).toISOString(),
        startTime: new Date(startTime).toISOString(), 
        endTime: new Date(endTime).toISOString(),
        hasStarted: now >= startTime,
        hasEnded: now >= endTime,
        progressPercent: Math.round((now - startTime) / (endTime - startTime) * 100)
      });
    } else {
      console.log('❌ No Mining Session Found');
    }
    
    console.groupEnd();
  },

  /**
   * Mining sessions array'ini analiz et
   */
  logAllMiningSessions: (sessions: MiningSession[], userId: string) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.group(`📊 All Mining Sessions for User ${userId}`);
    console.log(`Total Sessions: ${sessions.length}`);
    
    const byStatus = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Sessions by Status:', byStatus);
    
    sessions.forEach(session => {
      console.log(`Session ${session.id}:`, {
        status: session.status,
        carId: session.car_id,
        startTime: new Date(session.start_time).toLocaleTimeString(),
        endTime: new Date(session.end_time).toLocaleTimeString(),
        reward: session.expected_reward
      });
    });
    
    console.groupEnd();
  },

  /**
   * Button state transition'ını log'la
   */
  logButtonStateTransition: (
    carId: number, 
    fromState: string, 
    toState: string, 
    reason?: string
  ) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.log(`🔄 Car ${carId} Button State: ${fromState} → ${toState}`, reason ? `(${reason})` : '');
  }
};

/**
 * Mining performance metrics
 */
export const miningMetrics = {
  startTime: 0,
  
  startMeasure: (operation: string) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    miningMetrics.startTime = performance.now();
    console.time(`⚡ ${operation}`);
  },
  
  endMeasure: (operation: string) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const elapsed = performance.now() - miningMetrics.startTime;
    console.timeEnd(`⚡ ${operation}`);
    console.log(`⚡ ${operation} took ${elapsed.toFixed(2)}ms`);
  }
};
