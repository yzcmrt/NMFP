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

interface MiningAreaProps {
  onBalanceUpdate?: (newBalance?: number) => Promise<void>;
  currentBalance?: number | null;
}

export default function MiningArea({ onBalanceUpdate, currentBalance }: MiningAreaProps) {
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
        // LocalStorage'a session bilgilerini kaydet
        localStorage.setItem(`miningSession_${session.id}`, JSON.stringify({
          startTime: session.start_time,
          endTime: session.end_time,
          sessionId: session.id,
          status: session.status
        }));
        
        const timer = setupTimer(
          new Date(session.end_time),
          (formattedTimeLeft, progressValue) => {
            setTimeLeft(prev => ({...prev, [session.id]: formattedTimeLeft}));
            setProgress(prev => ({...prev, [session.id]: progressValue}));
          },
          async () => {
            // Mining tamamlandı, oturumu güncelle
            toast.success('Mining süresi doldu! Ödülünüzü toplamak için "Ödülü Topla" butonuna tıklayın.', {
              duration: 4000,
              position: 'top-center'
            });

            // Oturumu UI üzerinde tamamlanmış olarak işaretle
            setActiveMiningSessions(prev => {
              return prev.map(s => {
                if (s.id === session.id) {
                  return {...s, status: MiningStatus.COMPLETED};
                }
                return s;
              });
            });

            // LocalStorage'daki durumu güncelle
            const sessionData = localStorage.getItem(`miningSession_${session.id}`);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              localStorage.setItem(`miningSession_${session.id}`, JSON.stringify({
                ...parsed,
                status: MiningStatus.COMPLETED
              }));
            }

            // Veriyi yenile (backend'deki durumu da güncellemek için)
            await fetchData();
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
        setupAllTimers(sessions);
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
  }, [user?.id, calculateTotalMiningPower, calculateTotalCosts, setupAllTimers, refreshUserData]);

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
    
    // İlk yükleme sonrası 60 saniyede bir kontrol et (5 sn yerine)
    const intervalId = setInterval(() => {
      if (isMounted && !isLoading) fetchData();
    }, 60000); // 5000'den 60000'e değiştirildi (1 dakika)
    
    // Component unmount olduğunda zamanlayıcıları temizle
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      Object.values(timerRefs).forEach(timer => {
        if (timer) clearInterval(timer);
      });
    };
  }, []);
  
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

      // LocalStorage'dan oturum bilgisini kaldır
      localStorage.removeItem(`miningSession_${sessionId}`);
      
      // Mining session ve car bilgisini al
      const currentSession = activeMiningSessions.find(s => s.id === sessionId);
      if (!currentSession) {
        toast.error('Mining oturumu bulunamadı!');
        return;
      }
      
      const carId = currentSession.car_id;
      
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
        
        // Kullanıcı bakiyesini güncelle (parent component için)
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }

        // Tüm verileri yenile
        await fetchData();
        
        // Claim işlemi başarılı - araç durumu otomatik olarak ACTIVE'e dönecek
        toast.success('Ödül başarıyla hesabınıza eklendi! Tekrar mining başlatabilirsiniz.');
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

          // Kullanıcı bakiyesini güncelle (parent component için)
          if (onBalanceUpdate) {
            await onBalanceUpdate();
          }
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

        // Mining başlatıldıktan sonra hemen miningSession'ı güncelle
        try {
          const sessions = await miningService.getAllActiveMiningSessions(user.id);
          setActiveMiningSessions(sessions);
          setupAllTimers(sessions);

          // Araç durumunu da güncelle
          const updatedCars = await userCarService.getUserCars(user.id);
          if (updatedCars) {
            setUserCars(updatedCars);
            calculateTotalMiningPower(updatedCars);
            calculateTotalCosts(updatedCars);
          }
        } catch (updateError) {
          console.warn('[MiningArea] Mining başlatıldıktan sonra güncelleme hatası:', updateError);
          // Yine de fetchData'yi çağır
          await fetchData();
        }
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
    if ((user?.balance || 0) < repairCost) {
      toast.error('Yeterli bakiye yok!');
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading('Araç onarılıyor...');
    
    try {
      const success = await userCarService.repairCar(userId, carId);
      
      if (success) {
        toast.success('Araç bakımı tamamlandı!', { id: toastId });

        // Araçları güncelle
        await fetchData();

        // Parent component'e balance güncellemesi bildir
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }
      } else {
        toast.error('Araç bakımı başarısız oldu.', { id: toastId });
      }
    } catch (err) {
      console.error('[MiningArea] Araç bakım hatası:', err);
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
    if ((user?.balance || 0) < fuelCost) {
      toast.error('Yeterli bakiye yok!');
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading('Yakıt dolduruluyor...');
    
    try {
      const success = await userCarService.refillCar(userId, carId);
      
      if (success) {
        toast.success('Yakıt doldurma işlemi tamamlandı!', { id: toastId });

        // Araçları güncelle
        await fetchData();

        // Parent component'e balance güncellemesi bildir
        if (onBalanceUpdate) {
          await onBalanceUpdate();
        }
    } else {
        toast.error('Yakıt doldurma başarısız oldu.', { id: toastId });
      }
    } catch (err) {
      console.error('[MiningArea] Yakıt doldurma hatası:', err);
      toast.error('Yakıt doldurma sırasında bir hata oluştu.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
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
            <span className="text-sm font-medium text-[#2ff7c1]">{formatCurrency(currentBalance ?? user?.balance ?? 0)} NMFP</span>
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
                          disabled={isLoading || car.condition >= 100 || (user?.balance || 0) < calculateMaintenanceCost(car.condition, 10)}
                          className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-2 px-2 rounded-lg text-xs font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                        >
                          Bakım ({formatCurrency(calculateMaintenanceCost(car.condition, 10))})
                        </button>
                        
                        <button
                          onClick={() => refillSingleCar(user?.id || '', car.id)}
                          disabled={isLoading || car.fuel >= 100 || (user?.balance || 0) < calculateFuelCost(car.fuel, 5)}
                          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 px-2 rounded-lg text-xs font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                        >
                          Yakıt ({formatCurrency(calculateFuelCost(car.fuel, 5))})
                        </button>
                      </div>
                      
                      {/* Sağ panel - Mining */}
                      <div className="w-full">
                        {/* Dinamik Mining Butonu - Her durumda görünür */}
                        <div className="space-y-2">
                          {/* Mining başlat butonu (araç hazırsa) */}
                          {car.status === CarStatus.ACTIVE && (
                            <button
                              onClick={() => startMining(car.id)}
                              disabled={isLoading || availableGarageSlots <= 0 || car.fuel < 25 || car.condition < 10}
                              className="w-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] text-white py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                            >
                              {isLoading ? 'İşleniyor...' : 'Mining Başlat'}
                            </button>
                          )}

                          {/* Mining yapılıyor durumu */}
                          {car.status === CarStatus.MINING && (
                            <>
                              {miningSession && miningSession.status === MiningStatus.ACTIVE ? (
                                <>
                                  <div className="bg-[#1a1a2e]/70 p-2 rounded-lg">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-400">Kalan Süre:</span>
                                      <span className="font-mono text-[#2ff7c1]">{timeLeft[miningSession.id] || '--:--:--'}</span>
                                    </div>
                                    <div className="w-full h-2 bg-[#0d1423] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7]"
                                        style={{ width: `${progress[miningSession.id] || 0}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-center mt-1 text-[#2ff7c1]">
                                      Beklenen Ödül: {formatCurrency(miningSession.expected_reward)} NMFP
                                    </div>
                                  </div>
                                  <button
                                    disabled
                                    className="w-full bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed opacity-75"
                                  >
                                    Mining Yapılıyor
                                  </button>
                                </>
                              ) : (
                                <button
                                  disabled
                                  className="w-full bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed opacity-75"
                                >
                                  Mining Yapılıyor
                                </button>
                              )}
                            </>
                          )}

                          {/* Claim butonu (mining tamamlanmışsa) */}
                          {car.status === CarStatus.MINING && miningSession && miningSession.status === MiningStatus.COMPLETED && (
                            <button
                              onClick={() => completeMiningSession(miningSession.id)}
                              disabled={isClaimLoading[miningSession.id]}
                              className="w-full bg-gradient-to-r from-[#2ff7c1] to-[#5ff7d5] text-[#0d253f] py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#2ff7c1]/30 disabled:opacity-50"
                            >
                              {isClaimLoading[miningSession.id] ? 'Ödül Alınıyor...' : 'Ödülü Topla'}
                            </button>
                          )}
                        </div>
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
  );
} 