'use client';

import React, { useState, useEffect } from 'react';
import { useTelegram } from '@/components/TelegramInitProvider';
import { userCarService, miningService } from '@/services/api';
import { UserCar, MiningSession } from '@/types';
import DynamicMiningButton from '@/components/DynamicMiningButton';
import { debugMining } from '@/utils/debugMining';
import { formatCurrency } from '@/app/utils/formatters';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
import { useRealtimeMining } from '@/hooks/useRealtimeMining';

export default function TestMiningPage() {
  const { user } = useTelegram();
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [isLoading, setIsLoading] = useState<{[key: number]: boolean}>({});
  
  // Real-time balance
  const { balance, refreshBalance } = useRealtimeBalance({
    userId: user?.id || '',
    initialBalance: user?.balance
  });
  
  // Real-time mining progress
  const { progressData } = useRealtimeMining({
    userId: user?.id || '',
    sessions: activeMiningSessions
  });

  // Load user data
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        const [cars, sessions] = await Promise.all([
          userCarService.getUserCars(user.id),
          miningService.getAllActiveMiningSessions(user.id)
        ]);
        
        setUserCars(cars);
        setActiveMiningSessions(sessions);
        
        console.log('[TestMining] Loaded data:', {
          cars: cars.length,
          sessions: sessions.length
        });
        
        // Debug all cars and their mining states
        cars.forEach(car => {
          const miningSession = sessions.find(s => s.car_id === car.id);
          debugMining.logCarMiningState(car, miningSession);
        });
        
      } catch (error) {
        console.error('[TestMining] Data loading error:', error);
      }
    };

    loadData();
  }, [user?.id]);

  const handleStartMining = async (carId: number) => {
    if (!user?.id) return;
    
    setIsLoading(prev => ({ ...prev, [carId]: true }));
    
    try {
      console.log('[TestMining] Starting mining for car:', carId);
      const newSessionId = await miningService.startMining(user.id, carId, null);
      
      if (newSessionId) {
        // Update car status immediately
        setUserCars(prev => prev.map(car => 
          car.id === carId ? { ...car, status: 'mining' } : car
        ));
        
        // Fetch updated sessions
        const updatedSessions = await miningService.getAllActiveMiningSessions(user.id);
        setActiveMiningSessions(updatedSessions);
        
        console.log('[TestMining] Mining started successfully:', newSessionId);
      }
    } catch (error) {
      console.error('[TestMining] Mining start error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [carId]: false }));
    }
  };

  const handleClaimReward = async (sessionId: number) => {
    if (!user?.id) return;
    
    setIsLoading(prev => ({ ...prev, [sessionId]: true }));
    
    try {
      console.log('[TestMining] Claiming reward for session:', sessionId);
      const reward = await miningService.completeMining(sessionId);
      
      if (reward > 0) {
        // Update sessions
        const updatedSessions = await miningService.getAllActiveMiningSessions(user.id);
        setActiveMiningSessions(updatedSessions);
        
        // Update cars
        const updatedCars = await userCarService.getUserCars(user.id);
        setUserCars(updatedCars);
        
        // Refresh balance
        await refreshBalance();
        
        console.log('[TestMining] Reward claimed successfully:', reward);
      }
    } catch (error) {
      console.error('[TestMining] Claim reward error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-white">User data loading...</p>
      </div>
    );
  }

  return (
    <div className="pb-20 px-4">
      {/* Header */}
      <div className="mobile-app-header relative mb-6">
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">
          🧪 Mining Test
        </h1>
      </div>

      {/* Balance Display */}
      <div className="bg-[#1a1a2e]/70 p-4 rounded-xl mb-5 border border-[#2a3855]/50">
        <h2 className="text-lg font-bold text-white mb-2">User Info</h2>
        <p className="text-gray-300">User ID: {user.id}</p>
        <p className="text-gray-300">Username: {user.username}</p>
        <p className="text-[#2ff7c1] font-bold">Balance: {formatCurrency(balance)} NMFP</p>
      </div>

      {/* Mining Sessions Debug */}
      {activeMiningSessions.length > 0 && (
        <div className="bg-[#1a1a2e]/70 p-4 rounded-xl mb-5 border border-[#2a3855]/50">
          <h3 className="text-lg font-bold text-white mb-3">Active Mining Sessions ({activeMiningSessions.length})</h3>
          
          {activeMiningSessions.map(session => {
            const progressInfo = progressData[session.id];
            const car = userCars.find(c => c.id === session.car_id);
            
            return (
              <div key={session.id} className="bg-[#16213e]/70 p-3 rounded-lg mb-3">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-white font-medium">Session #{session.id}</p>
                    <p className="text-gray-400 text-sm">Car: {car?.name || `#${session.car_id}`}</p>
                    <p className="text-gray-400 text-sm">Status: {session.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#2ff7c1]">{formatCurrency(session.expected_reward)} NMFP</p>
                    {progressInfo && (
                      <p className="text-xs text-gray-400">{progressInfo.timeLeft}</p>
                    )}
                  </div>
                </div>
                
                {progressInfo && (
                  <div className="w-full bg-[#0d1423] rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressInfo.progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cars List */}
      <div className="bg-[#1a1a2e]/70 p-4 rounded-xl border border-[#2a3855]/50">
        <h3 className="text-lg font-bold text-white mb-3">User Cars ({userCars.length})</h3>
        
        {userCars.map(car => {
          const miningSession = activeMiningSessions.find(s => s.car_id === car.id);
          const progressInfo = miningSession ? progressData[miningSession.id] : null;
          
          return (
            <div key={car.id} className="bg-[#16213e]/70 p-4 rounded-lg mb-3">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="text-white font-medium">{car.name}</h4>
                  <p className="text-gray-400 text-sm">Status: {car.status}</p>
                  <p className="text-gray-400 text-sm">Fuel: {car.fuel}% | Condition: {car.condition}%</p>
                </div>
              </div>
              
              {/* Mining Session Info */}
              {miningSession && (
                <div className="bg-[#0d1423] p-2 rounded mb-3">
                  <p className="text-xs text-gray-400">Mining Session #{miningSession.id}</p>
                  <p className="text-xs text-gray-400">Status: {miningSession.status}</p>
                  <p className="text-xs text-gray-400">Start: {new Date(miningSession.start_time).toLocaleTimeString()}</p>
                  <p className="text-xs text-gray-400">End: {new Date(miningSession.end_time).toLocaleTimeString()}</p>
                  
                  {progressInfo && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress: {progressInfo.progress}%</span>
                        <span>Time Left: {progressInfo.timeLeft}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-[#2ff7c1] h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressInfo.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Dynamic Mining Button */}
              <DynamicMiningButton
                car={car}
                miningSession={miningSession}
                timeLeft={progressInfo?.timeLeft || '--:--:--'}
                progress={progressInfo?.progress || 0}
                isLoading={isLoading[car.id] || false}
                isClaimLoading={isLoading[miningSession?.id || -1] || false}
                canStartMining={car.fuel >= 25 && car.condition >= 10}
                onStartMining={handleStartMining}
                onClaimReward={handleClaimReward}
                size="md"
              />
            </div>
          );
        })}
        
        {userCars.length === 0 && (
          <p className="text-center text-gray-400 py-4">No cars found. Please buy a car first.</p>
        )}
      </div>
      
      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-red-900/20 p-4 rounded-xl mt-5 border border-red-500/30">
          <h3 className="text-red-400 font-bold mb-3">🚨 DEBUG MODE</h3>
          <p className="text-sm text-gray-300 mb-3">
            Bu sayfa mining workflow'unu test etmek için oluşturulmuştur. 
            Production'da kaldırılmalıdır.
          </p>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Cars:</span>
              <span className="text-[#2ff7c1]">{userCars.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Mining Sessions:</span>
              <span className="text-[#7b2ff7]">{activeMiningSessions.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Progress Data Keys:</span>
              <span className="text-orange-400">{Object.keys(progressData).length}</span>
            </div>
          </div>
          
          <button 
            onClick={() => {
              console.clear();
              console.log('🧪 MINING DEBUG CLEARED');
            }}
            className="w-full mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm"
          >
            Clear Console
          </button>
        </div>
      )}
    </div>
  );
}
