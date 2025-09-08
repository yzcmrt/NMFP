'use client';

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import { toast } from 'react-hot-toast';
import { UserCar, Garage, CarStatus, MiningSession, MiningStatus } from '@/types';
import { 
  formatTimeLeft,
  calculateProgress,
  setupTimer,
  calculateMiningReward,
  createMiningToastMessage,
  calculateMaintenanceCost,
  calculateFuelCost,
  getMiningStatusClasses
} from '@/app/utils/miningUtils';
import { useTelegram } from '@/components/TelegramInitProvider';
import { 
  userCarService, 
  garageService, 
  miningService, 
  userService 
} from '@/services/api'; // Yeni API servislerini kullanıyoruz
// Import realtime balance
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
// Import dynamic mining button
import DynamicMiningButton, { useMiningButtonState } from '@/components/DynamicMiningButton';
// Import realtime mining progress
import { useRealtimeMining } from '@/hooks/useRealtimeMining';
// Import immediate sync
import { useImmediateSync } from '@/hooks/useImmediateSync';
// Import mining state sync
import { useMiningStateSync } from '@/hooks/useMiningStateSync';
// Import error boundary
import MiningErrorBoundary from '@/utils/errorBoundary';

interface MiningAreaProps {
  onBalanceUpdate?: (newBalance?: number) => Promise<void>;
  currentBalance?: number | null;
}

export default function MiningArea({ onBalanceUpdate, currentBalance }: MiningAreaProps) {
  const { user, refreshUserData } = useTelegram();
  
  // Real-time balance management
  const {
    balance: realtimeBalance,
    addOptimisticTransaction,
    commitTransaction,
    rollbackTransaction,
    refreshBalance
  } = useRealtimeBalance({
    userId: user?.id || '',
    initialBalance: user?.balance
  });
  
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [userGarages, setUserGarages] = useState<Garage[]>([]);
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimLoading, setIsClaimLoading] = useState<{[key: number]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const [totalMaintenanceCost, setTotalMaintenanceCost] = useState(0);
  const [totalFuelCost, setTotalFuelCost] = useState(0);
  const [totalEstimatedReward, setTotalEstimatedReward] = useState(0);
  const [totalMiningPower, setTotalMiningPower] = useState(0);
  const [availableGarageSlots, setAvailableGarageSlots] = useState(0);
  
  // Real-time mining progress tracking
  const {
    progressData: miningProgress,
    isConnected: isMiningConnected,
    refreshProgress
  } = useRealtimeMining({
    userId: user?.id || '',
    sessions: activeMiningSessions,
    onProgressUpdate: (sessionId, progressInfo) => {
      console.log(`[MiningArea] Progress update: Session ${sessionId} - ${progressInfo.progress}%`);
    },
    onSessionCompleted: (sessionId) => {
      console.log(`[MiningArea] Session ${sessionId} completed`);
      // Session tamamlandı, state'i güncelle
      setActiveMiningSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: MiningStatus.COMPLETED }
            : session
        )
      );
    }
  });
  
  // Immediate sync utilities
  const { syncMiningSession } = useImmediateSync();
  
  // Mining state sync (completed session cleanup)
  const { syncWithServer, forcSync } = useMiningStateSync({
    userId: user?.id || '',
    sessions: activeMiningSessions,
    onSessionsUpdated: (freshSessions) => {
      console.log('[MiningArea] State sync: Updating sessions from server');
      setActiveMiningSessions(freshSessions);
    }
  });
  
  // Backward compatibility için timeLeft ve progress
  const timeLeft: { [key: number]: string } = {};
  const progress: { [key: number]: number } = {};
  
  Object.entries(miningProgress).forEach(([sessionId, progressInfo]) => {
    const id = parseInt(sessionId);
    timeLeft[id] = progressInfo.timeLeft || '--:--:--';
    progress[id] = progressInfo.progress || 0;
  });

  // Fonksiyonları önce tanımla
  // Toplam mining gücünü hesapla
  const calculateTotalMiningPower = useCallback((cars: UserCar[]) => {
    let totalPower = 0;
    let estimatedReward = 0;
    
    cars.forEach(car => {
      if (car.status !== CarStatus.SOLD) {
        const miningPower = car.car_model?.mining_power || 0;
        totalPower += miningPower;
        
        // Tahmini 8 saatlik ödülü hesapla
        const hourlyReward = calculateMiningReward(miningPower, 8);
        estimatedReward += hourlyReward;
      }
    });
    
    setTotalMiningPower(totalPower);
    setTotalEstimatedReward(estimatedReward);
  }, []);
  
  // Toplam bakım ve yakıt maliyetlerini hesapla
  const calculateTotalCosts = useCallback((cars: UserCar[]) => {
    let maintenance = 0;
    let fuel = 0;
    
    cars.forEach(car => {
      if (car.status !== CarStatus.SOLD) {
        maintenance += calculateMaintenanceCost(car.condition, 10); // 10 NMFP per % condition
        fuel += calculateFuelCost(car.fuel, 5); // 5 NMFP per % fuel
      }
    });
    
    setTotalMaintenanceCost(maintenance);
    setTotalFuelCost(fuel);
  }, []);
  
  // Timer management artık useRealtimeMining hook'unda - bu fonksiyonlar kaldırıldı

  // Verileri yeniden çek (mining durumlarını günceller)
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Süresi dolmuş mining oturumlarını güncelle (backend)
      // Bu işlemi her fetchData çağrısında değil, sadece aşağıdaki durumlardan biri varsa yap:
      // 1. Aktif oturumlar varsa
      // 2. Son kontrol üzerinden belirli bir süre geçtiyse (localStorage ile takip)
      let wasUpdated = false;
      let shouldUpdateSessions = false;
      
      // localStorage'dan son kontrol zamanını al
      const lastUpdateCheck = localStorage.getItem('lastMiningUpdateCheck');
      const now = Date.now();
      
      // Son kontrol yoksa veya 5 dakikadan fazla zaman geçtiyse güncelle
      if (!lastUpdateCheck || (now - parseInt(lastUpdateCheck, 10)) > 5 * 60 * 1000) {
        shouldUpdateSessions = true;
        localStorage.setItem('lastMiningUpdateCheck', now.toString());
      }
      
      if (shouldUpdateSessions) {
        try {
          const updateResult = await miningService.updateExpiredMiningSessions();
          console.log('[MiningArea] Güncellenen oturumlar:', updateResult);
          // Eğer güncelleme yapıldıysa flag'i ayarla
          wasUpdated = updateResult.updatedCount > 0;
        } catch (err) {
          console.warn('Mining oturumları güncellenirken hata:', err);
        }
      }
      
      // Frontend verilerini güncelle
      const [cars, garages, sessions] = await Promise.all([
        userCarService.getUserCars(user.id),
        garageService.getUserGarages(user.id),
        miningService.getAllActiveMiningSessions(user.id)
      ]);
      
      if (cars) {
        setUserCars(cars);
        calculateTotalMiningPower(cars);
        calculateTotalCosts(cars);
      }
      
      if (garages) {
        setUserGarages(garages);
        
        // Toplam ve kullanılabilir garaj alanı hesapla
        const totalSlots = garages.reduce((total, garage) => total + garage.capacity, 0);
        
        // Kullanılabilir slot sayısı = Toplam kapasite - Aktif mining oturumu sayısı
        const activeSessions = sessions ? sessions.filter(s => s.status === MiningStatus.ACTIVE).length : 0;
        setAvailableGarageSlots(Math.max(0, totalSlots - activeSessions));
      }
      
      if (sessions) {
        // Mining oturumlarını state'e kaydet
        setActiveMiningSessions(sessions);
        console.log('[MiningArea] Updated active mining sessions:', sessions.length);
      }
      
      // Eğer mining oturumları güncellendiyse kullanıcı verilerini de yenile
      if (wasUpdated) {
        try {
          await refreshUserData();
        } catch (err) {
          console.warn('Kullanıcı verileri güncellenirken hata:', err);
        }
      }
      
    } catch (err) {
      console.error('[MiningArea] fetchData Hatası:', err);
      toast.error('Veriler yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
    }
  }, [user?.id, calculateTotalMiningPower, calculateTotalCosts, refreshUserData]);

  // LocalStorage'dan oturumları kontrol et
  useEffect(() => {
    // Sayfa yüklendiğinde veya yenilendiğinde LocalStorage'daki oturum bilgilerini kontrol et
    const checkStoredSessions = () => {
      // Tüm localStorage anahtarlarını tara
      const miningSessionKeys = Object.keys(localStorage).filter(key => key.startsWith('miningSession_'));
      
      if (miningSessionKeys.length > 0) {
        console.log('[MiningArea] LocalStorage\'da kaydedilmiş mining oturumları bulundu:', miningSessionKeys.length);
        
        // Her bir oturum için saat durumunu kontrol et
        miningSessionKeys.forEach(key => {
          try {
            const sessionData = localStorage.getItem(key);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              const now = new Date();
              const endTime = new Date(parsed.endTime);
              
              // Oturum süresi dolduysa ve hala "active" olarak işaretlenmişse
              if (now >= endTime && parsed.status === MiningStatus.ACTIVE) {
                // Durumu "completed" olarak güncelle
                localStorage.setItem(key, JSON.stringify({
                  ...parsed,
                  status: MiningStatus.COMPLETED
                }));
                
                console.log(`[MiningArea] Oturum süresi dolmuş: ${key}`);
              }
            }
          } catch (err) {
            console.error(`[MiningArea] LocalStorage oturum verisi işlenirken hata: ${key}`, err);
          }
        });
      }
    };
    
    // İlk çalıştırma
    checkStoredSessions();
    
    // Sayfa görünür olduğunda tekrar kontrol et
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStoredSessions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Sayfa görünür olduğunda veri yenileme için
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoading) {
        console.log('[MiningArea] Sayfa görünür oldu, veriler yenileniyor...');
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, isLoading]);
  
  // Bileşen monte edildiğinde verileri çek
  useEffect(() => {
    // İlk yükleme
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (isMounted) await fetchData();
    };
    
    loadInitialData();
    
    // İlk yükleme sonrası 5 dakikada bir kontrol et (çok daha az sıklık)
    const intervalId = setInterval(() => {
      if (isMounted && !isLoading) fetchData();
    }, 300000); // 5 dakika
    
    // Component unmount olduğunda interval temizle
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);
  
  // Mining oturumunu tamamla
  const completeMiningSession = async (sessionId: number) => {
    if (!user?.id) return;
    
    // Mining session bilgisini al
    const currentSession = activeMiningSessions.find(s => s.id === sessionId);
    if (!currentSession) {
      toast.error('Mining oturumu bulunamadı!');
      return;
    }
    
    const expectedReward = currentSession.expected_reward;
    const transactionId = `mining_claim_${sessionId}_${Date.now()}`; // Scope dışına taşındı
    
    try {
      setIsClaimLoading(prev => ({...prev, [sessionId]: true}));
      
      // Optimistic reward update
      addOptimisticTransaction({
        id: transactionId,
        amount: expectedReward,
        type: 'mining_reward',
        description: `Mining ödülü: ${currentSession.user_car?.name || 'Araç'}`
      });

      // LocalStorage'dan oturum bilgisini kaldır
      localStorage.removeItem(`miningSession_${sessionId}`);
      
      const toastId = toast.loading('Mining ödülü toplanıyor...', {
        style: {
          background: 'rgba(26, 26, 46, 0.95)',
          color: '#fff'
        }
      });
      
      // Mining tamamla
      console.log('[MiningArea] Calling miningService.completeMining for session:', sessionId);
      const actualReward = await miningService.completeMining(sessionId);
      console.log('[MiningArea] completeMining response:', actualReward);
      
      if (actualReward > 0) {
        // Transaction'ı commit et
        commitTransaction(transactionId);
        
        // Eğer beklenen ile gerçek reward farklıysa düzelt
        if (actualReward !== expectedReward) {
          const difference = actualReward - expectedReward;
          if (difference !== 0) {
            addOptimisticTransaction({
              id: `mining_adjustment_${sessionId}`,
              amount: difference,
              type: 'mining_reward',
              description: 'Mining ödül düzeltmesi'
            });
          }
        }
        
        // Oturumu tamamlanmış olarak işaretle
        setActiveMiningSessions(prev => {
          return prev.map(session => {
            if (session.id === sessionId) {
              return {...session, status: MiningStatus.COMPLETED};
            }
            return session;
          });
        });
        
        toast.success(`Mining tamamlandı! ${formatCurrency(actualReward)} NMFP kazandınız!`, { 
          id: toastId,
          style: {
            background: 'rgba(47, 247, 193, 0.1)',
            color: '#2ff7c1',
            border: '1px solid rgba(47, 247, 193, 0.3)'
          }
        });
        
        // Araçları güncelle (yakıt ve durumları değişmiş olacak)
        const updatedCars = await userCarService.getUserCars(user.id);
          if (updatedCars) {
            setUserCars(updatedCars);
            // Maliyetleri yeniden hesapla
            calculateTotalCosts(updatedCars);
          }
        
        // Real-time balance refresh
        await refreshBalance();
        
        // Parent component için callback (fallback)
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }

        // Tüm verileri yenile
        await fetchData();
        
        // Force sync to clean up completed sessions
        await forcSync();
        
      } else {
        throw new Error('Mining ödülü alınamadı.');
      }
    } catch (err) {
      console.error('[MiningArea] Mining tamamlama hatası:', err);
      console.error('[MiningArea] Error details:', {
        message: err.message,
        stack: err.stack,
        sessionId,
        transactionId: transactionId // Bu artık scope'da olmalı
      });
      
      // Rollback optimistic transaction
      rollbackTransaction(transactionId);
      
      toast.error('Mining tamamlanırken bir hata oluştu.', {
        style: {
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444'
        }
      });
    } finally {
      setIsClaimLoading(prev => ({...prev, [sessionId]: false}));
    }
  };
  
  // Tüm araçları bakım ve yakıt doldur
  const maintainAllCars = async () => {
    if (!user || !user.id) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    const totalCost = totalMaintenanceCost + totalFuelCost;
    
    if (realtimeBalance < totalCost) {
      toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(totalCost)} NMFP`);
      return;
    }
    
    // Transaction ID'si oluştur
    const transactionId = `maintenance_all_${Date.now()}`;
    
    // Optimistic update
    addOptimisticTransaction({
      id: transactionId,
      amount: -totalCost,
      type: 'repair',
      description: 'Tüm araç bakım ve yakıt'
    });
    
    setIsLoading(true);
    const toastId = toast.loading('Tüm araçlar bakım ve yakıt dolduruluyor...');
    
    try {
      let successCount = 0;
      
      // Her aracı teker teker tamir et ve yakıt doldur
      for (const car of userCars) {
        if (car.condition < 100) {
          try {
            await userCarService.repairCar(user.id, car.id);
            successCount++;
          } catch (err) {
            console.error(`Araç tamir hatası (ID: ${car.id}):`, err);
          }
        }
        
        if (car.fuel < 100) {
          try {
            await userCarService.refillCar(user.id, car.id);
            successCount++;
          } catch (err) {
            console.error(`Yakıt doldurma hatası (ID: ${car.id}):`, err);
          }
        }
      }
      
      if (successCount > 0) {
        // Transaction'ı commit et
        commitTransaction(transactionId);
        
        // Araçları yeniden yükle
        const updatedCars = await userCarService.getUserCars(user.id);
        if (updatedCars) {
          setUserCars(updatedCars);
          // Maliyetleri sıfırla
          setTotalMaintenanceCost(0);
          setTotalFuelCost(0);
          
          toast.success('Araçlar başarıyla bakım yapıldı ve yakıt dolduruldu!', { 
            id: toastId,
            style: {
              background: 'rgba(47, 247, 193, 0.1)',
              color: '#2ff7c1',
              border: '1px solid rgba(47, 247, 193, 0.3)'
            }
          });

          // Real-time balance refresh
          await refreshBalance();
          
          // Parent callback (fallback)
          if (onBalanceUpdate) {
            await onBalanceUpdate();
          }
        }
      } else {
        // Rollback transaction
        rollbackTransaction(transactionId);
        toast.error('Hiçbir araç bakım ve yakıt doldurulamadı.', { id: toastId });
      }
    } catch (err) {
      console.error('[MiningArea] Toplu bakım hatası:', err);
      
      // Rollback transaction
      rollbackTransaction(transactionId);
      
      toast.error('Araçlara bakım yapılırken bir hata oluştu.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Araç için mining başlat
  const startMining = async (carId: number) => {
    if (!user || !user.id) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    console.log(`[DEBUG] startMining çağrıldı - carId:${carId}, userId:${user.id}`);
    
    // Seçilen aracı bul
    const selectedCar = userCars.find(car => car.id === carId);
    if (!selectedCar) {
      toast.error('Seçilen araç bulunamadı!');
      console.error(`[DEBUG] Seçilen araç (ID:${carId}) userCars dizisinde bulunamadı`, userCars);
      return;
    }
    
    console.log(`[DEBUG] Seçilen araç:`, selectedCar);
    
    // Araç kontrolleri
    if (selectedCar.status !== CarStatus.ACTIVE) {
      toast.error('Bu araç mining için uygun değil!');
      console.error(`[DEBUG] Araç durumu uygun değil: ${selectedCar.status}`);
      return;
    }
    
    if (selectedCar.fuel < 25) {
      toast.error('Yeterli yakıt yok! En az %25 yakıt gerekiyor.');
      return;
    }
    
    if (selectedCar.condition < 10) {
      toast.error('Yeterli araç kondisyonu yok! En az %10 kondisyon gerekiyor.');
      return;
    }
    
    // Garaj kapasitesi kontrolü
    if (availableGarageSlots <= 0) {
      toast.error('Kullanılabilir garaj kapasitesi yok!');
      return;
    }
    
    // Garaj seç (basit olarak ilk garajı kullan)
    const selectedGarage = userGarages.length > 0 ? userGarages[0].id : null;
    
    console.log(`[DEBUG] Mining başlatılıyor - userId:${user.id}, carId:${carId}, garageId:${selectedGarage}`);
    
    setIsLoading(true);
    const toastId = toast.loading('Mining başlatılıyor...');
    
    try {
      // Mining başlat
      const newSessionId = await miningService.startMining(
        user.id,
        carId, // Direkt parametre olarak gelen carId kullan, selectedCar.id değil
        selectedGarage
      );
      
      if (newSessionId) {
        toast.success('Mining başarıyla başlatıldı!', { id: toastId });
        console.log(`[DEBUG] Mining başarıyla başlatıldı - sessionId:${newSessionId}`);

        // 1. Araç durumunu hemen local state'te güncelle
        setUserCars(prev => prev.map(car => 
          car.id === carId ? { ...car, status: CarStatus.MINING } : car
        ));
        
        // 2. Mining session'ı immediate sync ile güncelle
        syncMiningSession(
          user.id,
          newSessionId,
          // onSuccess: Session bulundu
          (newSession) => {
            setActiveMiningSessions(prev => {
              // Var olan session'ı güncelle veya ekle
              const exists = prev.find(s => s.id === newSession.id);
              if (exists) {
                return prev.map(s => s.id === newSession.id ? newSession : s);
              } else {
                return [...prev, newSession];
              }
            });
            
            console.log('[MiningArea] ✅ Mining session immediately synchronized:', newSession);
            
            // Araç durumunu server'dan da güncelle (async, non-blocking)
            setTimeout(async () => {
              try {
          const updatedCars = await userCarService.getUserCars(user.id);
          if (updatedCars) {
            setUserCars(updatedCars);
            calculateTotalMiningPower(updatedCars);
            calculateTotalCosts(updatedCars);
          }
              } catch (err) {
                console.warn('[MiningArea] Car update error:', err);
              }
            }, 1000);
          },
          // onTimeout: Session bulunamadı
          () => {
            console.error('[MiningArea] 🚨 Mining session sync timeout');
            // Emergency fallback
            setTimeout(() => fetchData(), 1000);
          }
        );
      } else {
        toast.error('Mining başlatılamadı.', { id: toastId });
      }
    } catch (err: any) {
      console.error('[MiningArea] Mining başlatma hatası:', err);
      
      // Hata mesajını daha anlaşılır yap
      let errorMessage = 'Mining başlatılırken bir hata oluştu.';
      
      if (err.message) {
        // Bilinen hata mesajlarını kontrol et
        if (err.message.includes('bulunamadi') || err.message.includes('not found')) {
          errorMessage = 'Araç bulunamadı veya bu kullanıcıya ait değil.';
        }
        else if (err.message.includes('zaten mining')) {
          errorMessage = 'Bu araç zaten mining yapıyor!';
        }
        else if (err.message.includes('garaj kapasitesi') || err.message.includes('garage capacity')) {
          errorMessage = 'Garaj kapasitesi dolu! Yeni garaj satın alın veya mevcut mining işlemlerini tamamlayın.';
        }
        else if (err.message.includes('yakit') || err.message.includes('fuel')) {
          errorMessage = 'Araçta yeterli yakıt yok.';
        }
        else if (err.message.includes('kondisyon') || err.message.includes('condition')) {
          errorMessage = 'Araç kondisyonu mining için uygun değil.';
        }
        else if (err.message.includes('uygun degil') || err.message.includes('not suitable')) {
          errorMessage = 'Araç mining için uygun durumda değil.';
        }
        else {
          // Diğer hataları aynen göster
          errorMessage = err.message;
        }
      }
      
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mining durumu stil sınıfları
  const getMiningClassesForStatus = (status: 'idle' | 'mining' | 'completed') => {
    return getMiningStatusClasses(status);
  };

  // Araç mining'de mi kontrol et
  const isCarMining = (carId: number) => {
    return activeMiningSessions.some(session => 
      session.car_id === carId && 
      session.status === MiningStatus.ACTIVE
    );
  };

  // Araç için mining oturumunu bul
  const getMiningSessionForCar = (carId: number) => {
    return activeMiningSessions.find(session => 
      session.car_id === carId
    );
  };

  // Araç bakımı yap
  const repairSingleCar = async (userId: string, carId: number) => {
    if (!userId) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    const selectedCar = userCars.find(car => car.id === carId);
    if (!selectedCar) {
      toast.error('Araç bulunamadı!');
      return;
    }
    
    const repairCost = calculateMaintenanceCost(selectedCar.condition, 10);
    const transactionId = `repair_${carId}_${Date.now()}`;
    
    // Optimistic update
    addOptimisticTransaction({
      id: transactionId,
      amount: -repairCost,
      type: 'repair',
      description: `${selectedCar.name} bakımı`
    });
    
    if (realtimeBalance < repairCost) {
      rollbackTransaction(transactionId);
      toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(repairCost)} NMFP`);
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading('Araç onarılıyor...');
    
    try {
      const success = await userCarService.repairCar(userId, carId);
      
      if (success) {
        // Transaction'ı commit et
        commitTransaction(transactionId);
        
        toast.success('Araç bakımı tamamlandı!', { 
          id: toastId,
          style: {
            background: 'rgba(47, 247, 193, 0.1)',
            color: '#2ff7c1',
            border: '1px solid rgba(47, 247, 193, 0.3)'
          }
        });

        // Araçları güncelle
        await fetchData();

        // Real-time balance refresh
        await refreshBalance();

        // Parent component'e balance güncellemesi bildir (fallback)
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }
      } else {
        throw new Error('Araç bakımı başarısız oldu.');
      }
    } catch (err) {
      console.error('[MiningArea] Araç bakım hatası:', err);
      
      // Rollback transaction
      rollbackTransaction(transactionId);
      
      toast.error('Araç bakımı sırasında bir hata oluştu.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Araç yakıt doldur
  const refillSingleCar = async (userId: string, carId: number) => {
    if (!userId) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    const selectedCar = userCars.find(car => car.id === carId);
    if (!selectedCar) {
      toast.error('Araç bulunamadı!');
      return;
    }
    
    const fuelCost = calculateFuelCost(selectedCar.fuel, 5);
    const transactionId = `refill_${carId}_${Date.now()}`;
    
    // Optimistic update
    addOptimisticTransaction({
      id: transactionId,
      amount: -fuelCost,
      type: 'refill',
      description: `${selectedCar.name} yakıt`
    });
    
    if (realtimeBalance < fuelCost) {
      rollbackTransaction(transactionId);
      toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(fuelCost)} NMFP`);
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading('Yakıt dolduruluyor...');
    
    try {
      const success = await userCarService.refillCar(userId, carId);
      
      if (success) {
        // Transaction'ı commit et
        commitTransaction(transactionId);
        
        toast.success('Yakıt doldurma işlemi tamamlandı!', { 
          id: toastId,
          style: {
            background: 'rgba(47, 247, 193, 0.1)',
            color: '#2ff7c1',
            border: '1px solid rgba(47, 247, 193, 0.3)'
          }
        });

        // Araçları güncelle
        await fetchData();

        // Real-time balance refresh
        await refreshBalance();

        // Parent component'e balance güncellemesi bildir (fallback)
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }
    } else {
        throw new Error('Yakıt doldurma başarısız oldu.');
      }
    } catch (err) {
      console.error('[MiningArea] Yakıt doldurma hatası:', err);
      
      // Rollback transaction
      rollbackTransaction(transactionId);
      
      toast.error('Yakıt doldurma sırasında bir hata oluştu.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MiningErrorBoundary>
    <div className="space-y-4">
      {/* Bakım ve Yakıt Özeti */}
      <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7]">
            Araç Durumu ve Bakım
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Bakiye:</span>
            <span className="text-sm font-medium text-[#2ff7c1]">{formatCurrency(realtimeBalance)} NMFP</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#16213e]/70 p-3 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Bakım Maliyeti</p>
            <p className="text-xl font-bold text-orange-400">{formatCurrency(totalMaintenanceCost)}</p>
          </div>
          <div className="bg-[#16213e]/70 p-3 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Yakıt Maliyeti</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(totalFuelCost)}</p>
          </div>
        </div>
        
        {(totalMaintenanceCost > 0 || totalFuelCost > 0) && (
          <button
            onClick={maintainAllCars}
            disabled={isLoading || realtimeBalance < (totalMaintenanceCost + totalFuelCost)}
            className="w-full bg-gradient-to-r from-orange-500 to-blue-500 text-white py-2 px-4 rounded-lg font-medium transition-all duration-300 disabled:opacity-50"
          >
            {isLoading ? 'İşleniyor...' : 'Tüm Araçları Bakım Yap'}
          </button>
        )}
      </div>
      
      {/* Garaj Kapasitesi */}
      <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
          Garaj Kapasitesi
        </h3>
        
        <div className="bg-[#16213e]/70 p-4 rounded-lg">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Toplam Garaj Kapasitesi:</span>
            <span>{userGarages.reduce((total, garage) => total + garage.capacity, 0)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Kullanılan Slot:</span>
            <span>{activeMiningSessions.filter(s => s.status === MiningStatus.ACTIVE).length}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Kullanılabilir Slot:</span>
            <span className="text-[#2ff7c1]">{availableGarageSlots}</span>
          </div>
        </div>
      </div>
      
      {/* Mining Oturumları - Aktif ve Tamamlanmış */}
      {activeMiningSessions.length > 0 && (
        <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
            Mining Oturumları ({activeMiningSessions.length})
          </h3>

          <div className="space-y-3">
            {activeMiningSessions.map(session => {
              const sessionCar = userCars.find(car => car.id === session.car_id);
              const miningClasses = getMiningClassesForStatus(
                session.status === MiningStatus.COMPLETED ? 'completed' : 'mining'
              );

              return (
                <div key={session.id} className={`${miningClasses.bg} rounded-lg p-3 border ${miningClasses.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-[#1a1a2e] rounded-md flex items-center justify-center">
                        <span className="text-lg font-bold">{sessionCar?.name?.substring(0, 1) || '?'}</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{sessionCar?.name || `Araç #${session.car_id}`}</p>
                        <div className="flex items-center text-xs">
                          <span className="text-[#2ff7c1]">
                            {session.status === MiningStatus.COMPLETED ? 'Tamamlandı - Ödül Hazır' : 'Mining Yapıyor'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Ödül:</p>
                      <p className="text-lg font-bold text-[#2ff7c1]">
                        {formatCurrency(session.expected_reward)} NMFP
                      </p>
                    </div>
                  </div>

                  {session.status === MiningStatus.ACTIVE && (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Kalan Süre</span>
                        </div>
                        <span className="font-mono text-[#2ff7c1]">{timeLeft[session.id] || '--:--:--'}</span>
                      </div>

                      <div className="w-full h-3 bg-[#1a1a2e] rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full bg-gradient-to-r ${miningClasses.progress}`}
                          style={{ width: `${progress[session.id] || 0}%` }}
                        ></div>
                      </div>

                      <button
                        disabled
                        className="w-full bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed opacity-75"
                      >
                        Mining Yapılıyor
                      </button>
                    </>
                  )}

                  {session.status === MiningStatus.COMPLETED && (
                    <button
                      onClick={() => completeMiningSession(session.id)}
                      disabled={isClaimLoading[session.id]}
                      className="w-full bg-gradient-to-r from-[#2ff7c1] to-[#5ff7d5] text-[#0d253f] py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#2ff7c1]/30 disabled:opacity-50"
                    >
                      {isClaimLoading[session.id] ? 'Ödül Alınıyor...' : 'Ödülü Topla'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Araç Listesi */}
      <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7]">
            Araçlarım
          </h3>
          <div className="text-xs text-gray-400">
            Dinamik Mining Butonları Aktif
          </div>
        </div>
        
        {userCars.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Henüz araç satın almadınız.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userCars.map(car => {
              const isMining = isCarMining(car.id);
              const miningSession = getMiningSessionForCar(car.id);

              // Debug için mining durumu (sadece geliştirme ortamında)
              if (process.env.NODE_ENV === 'development') {
                console.log(`[MiningArea] Araç ${car.id}: status=${car.status}, isMining=${isMining}, miningSession=${miningSession?.id || 'null'}`);
              }
              
              return (
                <div key={car.id} className={`bg-[#16213e]/70 p-4 rounded-lg ${isMining ? 'border border-[#2ff7c1]/30' : ''}`}>
                  {/* Araç üst bilgisi */}
                  <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                      <div className="w-12 h-12 bg-[#1a1a2e] rounded-md flex items-center justify-center">
                        <span className="text-lg font-bold">{car.name?.substring(0, 1)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{car.name}</p>
                        <div className="flex items-center text-xs gap-1">
                        <span className={car.status === CarStatus.MINING ? 'text-[#2ff7c1]' : 'text-gray-400'}>
                          {car.status === CarStatus.MINING ? 'Mining Yapıyor' : 'Hazır'}
                        </span>
                          
                          {/* Mining yapıyorsa kalan süreyi göster */}
                          {isMining && miningSession && miningSession.status === MiningStatus.ACTIVE && (
                            <span className="flex items-center bg-[#1a1a2e] px-2 py-0.5 rounded text-[#2ff7c1]">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeLeft[miningSession.id] || '--:--:--'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Durum göstergeleri */}
                      <div className="flex items-center gap-2 bg-[#1a1a2e] p-1.5 rounded">
                        <div className="flex flex-col items-center">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full overflow-hidden">
                          <div 
                            className="w-full bg-[#16213e]/70" 
                            style={{ height: `${100 - car.condition}%` }}
                          ></div>
                        </div>
                          <span className="text-xs text-orange-400 mt-0.5">{car.condition}%</span>
                        </div>
                        <div className="flex flex-col items-center">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full overflow-hidden">
                          <div 
                            className="w-full bg-[#16213e]/70" 
                            style={{ height: `${100 - car.fuel}%` }}
                          ></div>
                          </div>
                          <span className="text-xs text-blue-400 mt-0.5">{car.fuel}%</span>
                        </div>
                      </div>
                  </div>
                </div>
                
                  {/* Artık her zaman görünür olacak detay alanı */}
                  <div className="pt-3 border-t border-[#2a3855]/30">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="bg-[#1a1a2e]/70 p-2 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Mining Gücü</p>
                        <p className="text-sm font-medium text-[#2ff7c1]">{formatNumber(car.car_model?.mining_power || 0)}</p>
                      </div>
                      <div className="bg-[#1a1a2e]/70 p-2 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">8 Saatlik Kazanç</p>
                        <p className="text-sm font-medium text-[#7b2ff7]">
                          {formatCurrency(calculateMiningReward(car.car_model?.mining_power || 0, 8))} NMFP
                        </p>
                      </div>
                    </div>
                    
                    {/* Mining işlem alanı */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Sol panel - Bakım ve yakıt - Yan yana butonlar */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => repairSingleCar(user?.id || '', car.id)}
                          disabled={isLoading || car.condition >= 100 || realtimeBalance < calculateMaintenanceCost(car.condition, 10)}
                          className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-2 px-2 rounded-lg text-xs font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                        >
                          Bakım ({formatCurrency(calculateMaintenanceCost(car.condition, 10))})
                        </button>
                        
                        <button
                          onClick={() => refillSingleCar(user?.id || '', car.id)}
                          disabled={isLoading || car.fuel >= 100 || realtimeBalance < calculateFuelCost(car.fuel, 5)}
                          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 px-2 rounded-lg text-xs font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                        >
                          Yakıt ({formatCurrency(calculateFuelCost(car.fuel, 5))})
                        </button>
                      </div>
                      
                      {/* Sağ panel - Mining */}
                      <div className="w-full">
                        {/* Dinamik Mining Butonu */}
                        {(() => {
                          // Real-time progress data'dan değerleri al
                          const sessionProgressData = miningSession ? miningProgress[miningSession.id] : null;
                          const sessionTimeLeft = sessionProgressData?.timeLeft || '--:--:--';
                          const sessionProgress = sessionProgressData?.progress || 0;
                          
                          console.log(`[MiningArea] DynamicMiningButton props for car ${car.id}:`, {
                            miningSession: miningSession?.id,
                            sessionProgressData,
                            timeLeft: sessionTimeLeft,
                            progress: sessionProgress,
                            availableSlots: availableGarageSlots,
                            carStatus: car.status,
                            carFuel: car.fuel,
                            carCondition: car.condition
                          });
                          
                          return (
                            <DynamicMiningButton
                              car={car}
                              miningSession={miningSession}
                              timeLeft={sessionTimeLeft}
                              progress={sessionProgress}
                              isLoading={isLoading}
                              isClaimLoading={isClaimLoading[miningSession?.id || -1] || false}
                              canStartMining={availableGarageSlots > 0 && car.fuel >= 25 && car.condition >= 10}
                              onStartMining={startMining}
                              onClaimReward={completeMiningSession}
                              size="sm"
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Toplam Mining Gücü */}
      <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
          Mining Gücü
        </h3>
        
        <div className="bg-[#16213e]/70 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Toplam Mining Gücü</p>
                  <p className="text-xl font-bold text-[#2ff7c1]">{formatNumber(totalMiningPower)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">8 Saatlik Tahmin</p>
                  <p className="text-xl font-bold text-[#7b2ff7]">{formatCurrency(totalEstimatedReward)}</p>
                </div>
              </div>
          </div>
      </div>
    </div>
    </MiningErrorBoundary>
  );
} 