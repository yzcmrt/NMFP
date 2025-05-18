'use client';

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

export default function MiningArea() {
  const { user, refreshUserData } = useTelegram();
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [userGarages, setUserGarages] = useState<Garage[]>([]);
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimLoading, setIsClaimLoading] = useState<{[key: number]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<{[key: number]: string}>({});
  const [progress, setProgress] = useState<{[key: number]: number}>({});
  const [timerRefs, setTimerRefs] = useState<{[key: number]: NodeJS.Timeout | null}>({});
  const [totalMaintenanceCost, setTotalMaintenanceCost] = useState(0);
  const [totalFuelCost, setTotalFuelCost] = useState(0);
  const [totalEstimatedReward, setTotalEstimatedReward] = useState(0);
  const [totalMiningPower, setTotalMiningPower] = useState(0);
  const [availableGarageSlots, setAvailableGarageSlots] = useState(0);
  const [expandedCar, setExpandedCar] = useState<string | null>(null);

  // Verileri getir
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Her API çağrısını ayrı try-catch bloklarında yaparak hataya dayanıklı hale getiriyoruz
      let carsData: UserCar[] = [];
      let garagesData: Garage[] = [];
      let activeSessionsData: MiningSession[] = [];
      
      try {
        carsData = await userCarService.getUserCars(user.id);
        console.log('[MiningArea] Kullanıcı araçları başarıyla alındı:', carsData);
      } catch (carError) {
        console.error('[MiningArea] Araç verilerini çekerken hata:', carError);
      }
      
      try {
        garagesData = await garageService.getUserGarages(user.id);
        console.log('[MiningArea] Kullanıcı garajları başarıyla alındı:', garagesData);
      } catch (garageError) {
        console.error('[MiningArea] Garaj verilerini çekerken hata:', garageError);
      }
      
      try {
        // Tüm aktif mining oturumlarını al
        activeSessionsData = await miningService.getAllActiveMiningSessions(user.id);
        console.log('[MiningArea] Aktif mining oturumları:', activeSessionsData);
      } catch (sessionError) {
        console.error('[MiningArea] Mining oturumu çekerken hata:', sessionError);
      }
      
      // Kullanıcı bilgilerini yenileyelim
      await refreshUserData();
      
      setUserCars(carsData || []);
      setUserGarages(garagesData || []);
      setActiveMiningSessions(activeSessionsData || []);
      
      // Garaj kapasitesi hesapla
      const totalCapacity = (garagesData || []).reduce((total, garage) => total + garage.capacity, 0);
      const usedSlots = activeSessionsData?.length || 0;
      setAvailableGarageSlots(totalCapacity - usedSlots);
      
      // Mining gücünü ve kazancı hesapla
      calculateTotalMiningPower(carsData || []);
      
      // Bakım ve yakıt maliyetlerini hesapla
      calculateTotalCosts(carsData || []);
      
      // Aktif mining oturumları için zamanlayıcıları kur
      setupAllTimers(activeSessionsData || []);
    } catch (err: any) {
      console.error('[MiningArea] Veri getirme hatası:', err);
      setError('Veriler yüklenirken bir hata oluştu: ' + err.message);
      toast.error('Veriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshUserData]);

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
  
  useEffect(() => {
    fetchData();
    
    // Component unmount olduğunda zamanlayıcıları temizle
    return () => {
      Object.values(timerRefs).forEach(timer => {
        if (timer) clearInterval(timer);
      });
    };
  }, [fetchData]);
  
  // Tüm zamanlayıcıları temizle
  const clearAllTimers = useCallback(() => {
    Object.entries(timerRefs).forEach(([sessionId, timer]) => {
      if (timer) {
        clearInterval(timer);
      }
    });
    setTimerRefs({});
  }, [timerRefs]);
  
  // Tüm zamanlayıcıları kur
  const setupAllTimers = useCallback((sessions: MiningSession[]) => {
    // Önce eski timerlari temizle
    clearAllTimers();
    
    // Her session için yeni timer kur
    const newTimerRefs: {[key: number]: NodeJS.Timeout | null} = {};
    const newTimeLeft: {[key: number]: string} = {};
    const newProgress: {[key: number]: number} = {};
    
    sessions.forEach(session => {
      if (session.status === MiningStatus.ACTIVE) {
        const timer = setupTimer(
          new Date(session.end_time),
          (formattedTimeLeft, progressValue) => {
            setTimeLeft(prev => ({...prev, [session.id]: formattedTimeLeft}));
            setProgress(prev => ({...prev, [session.id]: progressValue}));
          },
          async () => {
            // Mining tamamlandı, oturumu güncelle
            await completeMiningSession(session.id);
          },
          new Date(session.start_time)
        );
        
        newTimerRefs[session.id] = timer;
        
        // İlk değerleri hesapla
        const now = new Date();
        const endTime = new Date(session.end_time);
        const startTime = new Date(session.start_time);
        
        if (now >= endTime) {
          newTimeLeft[session.id] = '00:00:00';
          newProgress[session.id] = 100;
        } else {
          const totalDuration = endTime.getTime() - startTime.getTime();
          const elapsed = now.getTime() - startTime.getTime();
          const progressValue = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          
          newTimeLeft[session.id] = formatTimeLeft(endTime.getTime() - now.getTime());
          newProgress[session.id] = progressValue;
        }
      }
    });
    
    setTimerRefs(newTimerRefs);
    setTimeLeft(newTimeLeft);
    setProgress(newProgress);
  }, [clearAllTimers]);
  
  // Mining oturumunu tamamla
  const completeMiningSession = async (sessionId: number) => {
    if (!user?.id) return;
    
    try {
      setIsClaimLoading(prev => ({...prev, [sessionId]: true}));
      
      // Zamanlayıcıyı temizle
      if (timerRefs[sessionId]) {
        clearInterval(timerRefs[sessionId]!);
        setTimerRefs(prev => {
          const newTimerRefs = {...prev};
          delete newTimerRefs[sessionId];
          return newTimerRefs;
        });
      }
      
      // Mining tamamla
      const reward = await miningService.completeMining(sessionId);
      
      if (reward > 0) {
        // Oturumu tamamlanmış olarak işaretle
        setActiveMiningSessions(prev => {
          return prev.map(session => {
            if (session.id === sessionId) {
              return {...session, status: MiningStatus.COMPLETED};
            }
            return session;
          });
        });
        
        toast.success(`Mining tamamlandı! ${formatNumber(reward)} NMFP kazandınız.`);
        
        // Araçları güncelle (yakıt ve durumları değişmiş olacak)
        const updatedCars = await userCarService.getUserCars(user.id);
        if (updatedCars) {
          setUserCars(updatedCars);
          // Maliyetleri yeniden hesapla
          calculateTotalCosts(updatedCars);
        }
        
        // Kullanıcı bakiyesini de güncelle
        await refreshUserData();
        
        // Tüm verileri yenile
        await fetchData();
      }
    } catch (err) {
      console.error('[MiningArea] Mining tamamlama hatası:', err);
      toast.error('Mining tamamlanırken bir hata oluştu.');
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
    
    if (user.balance < totalMaintenanceCost + totalFuelCost) {
      toast.error('Yeterli bakiye yok!');
      return;
    }
    
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
        // Araçları yeniden yükle
        const updatedCars = await userCarService.getUserCars(user.id);
        if (updatedCars) {
          setUserCars(updatedCars);
          // Maliyetleri sıfırla
          setTotalMaintenanceCost(0);
          setTotalFuelCost(0);
          
          toast.success('Araçlar başarıyla bakım yapıldı ve yakıt dolduruldu!', { id: toastId });
          
          // Kullanıcı bakiyesini güncelle
          await refreshUserData();
        }
      } else {
        toast.error('Hiçbir araç bakım ve yakıt doldurulamadı.', { id: toastId });
      }
    } catch (err) {
      console.error('[MiningArea] Toplu bakım hatası:', err);
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
    
    // Seçilen aracı bul
    const selectedCar = userCars.find(car => car.id === carId);
    if (!selectedCar) {
      toast.error('Seçilen araç bulunamadı!');
      return;
    }
    
    // Araç kontrolleri
    if (selectedCar.status !== CarStatus.ACTIVE) {
      toast.error('Bu araç mining için uygun değil!');
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
    
    setIsLoading(true);
    const toastId = toast.loading('Mining başlatılıyor...');
    
    try {
      // Mining başlat
      const newSessionId = await miningService.startMining(
        user.id,
        selectedCar.id,
        selectedGarage
      );
      
      if (newSessionId) {
        toast.success('Mining başarıyla başlatıldı!', { id: toastId });
        
        // Tüm verileri yenile
        await fetchData();
      } else {
        toast.error('Mining başlatılamadı.', { id: toastId });
      }
    } catch (err) {
      console.error('[MiningArea] Mining başlatma hatası:', err);
      toast.error('Mining başlatılırken bir hata oluştu.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toplam mining gücünü hesapla
  const calculateTotalMiningPower = useCallback((cars: UserCar[]) => {
    const activeCars = cars.filter(car => car.status === CarStatus.ACTIVE || car.status === CarStatus.MINING);
    const power = activeCars.reduce((total, car) => total + (car.car_model?.mining_power || 0), 0);
    setTotalMiningPower(power);
    
    // Tahmini ödül (8 saatlik)
    const reward = calculateMiningReward(power, 8);
    setTotalEstimatedReward(reward);
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
  
  // Detayları göster/gizle
  const toggleCarDetails = (carId: string) => {
    if (expandedCar === carId) {
      setExpandedCar(null);
    } else {
      setExpandedCar(carId);
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

  return (
    <div className="space-y-4">
      {/* Bakım ve Yakıt Özeti */}
      <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7]">
            Araç Durumu ve Bakım
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Bakiye:</span>
            <span className="text-sm font-medium text-[#2ff7c1]">{formatCurrency(user?.balance || 0)} NMFP</span>
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
            disabled={isLoading || (user?.balance || 0) < (totalMaintenanceCost + totalFuelCost)}
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
      
      {/* Aktif Mining Oturumları */}
      {activeMiningSessions.length > 0 && (
        <div className="bg-[#1a1a2e]/70 rounded-xl p-4 shadow-md border border-[#2a3855]/50">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
            Aktif Mining İşlemleri
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
                            {session.status === MiningStatus.COMPLETED ? 'Tamamlandı' : 'Mining Yapıyor'}
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
                    </>
                  )}
                  
                  {session.status === MiningStatus.COMPLETED ? (
                    <button
                      onClick={() => completeMiningSession(session.id)}
                      disabled={isClaimLoading[session.id]}
                      className="w-full bg-gradient-to-r from-[#2ff7c1] to-[#5ff7d5] text-[#0d253f] py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#2ff7c1]/30 disabled:opacity-50"
                    >
                      {isClaimLoading[session.id] ? 'İşleniyor...' : 'Ödülü Topla'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-[#1a1a2e] text-gray-400 py-2 px-4 rounded-lg font-medium cursor-not-allowed"
                    >
                      Mining Devam Ediyor
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
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
          Araçlarım
        </h3>
        
        {userCars.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Henüz araç satın almadınız.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userCars.map(car => {
              const isMining = isCarMining(car.id);
              const miningSession = getMiningSessionForCar(car.id);
              
              return (
                <div key={car.id} className={`bg-[#16213e]/70 p-3 rounded-lg ${isMining ? 'border border-[#2ff7c1]/30' : ''}`}>
                  <div className="flex justify-between items-center" onClick={() => toggleCarDetails(car.id)}>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-[#1a1a2e] rounded-md flex items-center justify-center">
                        <span className="text-lg font-bold">{car.name.substring(0, 1)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{car.name}</p>
                        <div className="flex items-center text-xs">
                          <span className={car.status === CarStatus.MINING ? 'text-[#2ff7c1]' : 'text-gray-400'}>
                            {car.status === CarStatus.MINING ? 'Mining Yapıyor' : 'Hazır'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-6 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full overflow-hidden">
                            <div 
                              className="w-full bg-[#16213e]/70" 
                              style={{ height: `${100 - car.condition}%` }}
                            ></div>
                          </div>
                          <div className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full overflow-hidden">
                            <div 
                              className="w-full bg-[#16213e]/70" 
                              style={{ height: `${100 - car.fuel}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${expandedCar === car.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {expandedCar === car.id && (
                    <div className="mt-3 pt-3 border-t border-[#2a3855]/50">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-400">Bakım Durumu</p>
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-orange-400">%{car.condition}</p>
                            <p className="text-xs text-gray-400">
                              {formatCurrency(calculateMaintenanceCost(car.condition, 10))} NMFP
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Yakıt Durumu</p>
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-blue-400">%{car.fuel}</p>
                            <p className="text-xs text-gray-400">
                              {formatCurrency(calculateFuelCost(car.fuel, 5))} NMFP
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="text-xs text-gray-400">Mining Gücü</p>
                          <p className="text-sm font-medium text-[#2ff7c1]">{formatNumber(car.car_model?.mining_power || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">8 Saatlik Kazanç</p>
                          <p className="text-sm font-medium text-[#7b2ff7]">
                            {formatCurrency(calculateMiningReward(car.car_model?.mining_power || 0, 8))} NMFP
                          </p>
                        </div>
                      </div>
                      
                      {/* Mining başlat butonu (eğer araç hazırsa) */}
                      {car.status === CarStatus.ACTIVE && (
                        <button
                          onClick={() => startMining(car.id)}
                          disabled={isLoading || availableGarageSlots <= 0 || car.fuel < 25 || car.condition < 10}
                          className="w-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] text-white py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30 disabled:opacity-50"
                        >
                          {isLoading ? 'İşleniyor...' : 'Mining Başlat'}
                        </button>
                      )}
                      
                      {/* Mining durumu (eğer mining yapıyorsa) */}
                      {car.status === CarStatus.MINING && miningSession && (
                        <div className="text-xs text-center text-[#2ff7c1]">
                          Bu araç şu anda mining yapıyor. 
                          Detaylar yukarıdaki Aktif Mining İşlemleri bölümünde.
                        </div>
                      )}
                    </div>
                  )}
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
  );
} 