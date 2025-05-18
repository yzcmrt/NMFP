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
  const { user } = useTelegram();
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [userGarages, setUserGarages] = useState<Garage[]>([]);
  const [activeMiningSession, setActiveMiningSession] = useState<MiningSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [progress, setProgress] = useState(0);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);
  const [totalMaintenanceCost, setTotalMaintenanceCost] = useState(0);
  const [totalFuelCost, setTotalFuelCost] = useState(0);
  const [totalEstimatedReward, setTotalEstimatedReward] = useState(0);
  const [totalMiningPower, setTotalMiningPower] = useState(0);
  const [availableGarageSlots, setAvailableGarageSlots] = useState(0);
  const [userBalance, setUserBalance] = useState(0);
  const [expandedCar, setExpandedCar] = useState<string | null>(null);

  // Verileri getir
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Her API çağrısını ayrı try-catch bloklarında yaparak hataya dayanıklı hale getiriyoruz
        let carsData: UserCar[] = [];
        let garagesData: Garage[] = [];
        let activeSessionData: MiningSession | null = null;
        let userData = user; // Varsayılan olarak context'ten gelen kullanıcı verisini kullan
        
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
          // getActiveMiningSession yerine getAllActiveMiningSessions kullanıyoruz ve ilk öğeyi alıyoruz
          const activeSessions = await miningService.getAllActiveMiningSessions(user.id);
          activeSessionData = activeSessions.length > 0 ? activeSessions[0] : null;
          console.log('[MiningArea] Aktif mining oturumu:', activeSessionData);
        } catch (sessionError) {
          console.error('[MiningArea] Mining oturumu çekerken hata:', sessionError);
        }
        
        // Kullanıcı bilgilerini güncellemeye gerek yok, context'ten alıyoruz
        // user nesnesini direk kullanabiliyoruz (balance içeriyor)
        
        setUserCars(carsData || []);
        setUserGarages(garagesData || []);
        setActiveMiningSession(activeSessionData);
        setUserBalance(user.balance || 0); 
        
        // Garaj kapasitesi hesapla
        const totalCapacity = (garagesData || []).reduce((total, garage) => total + garage.capacity, 0);
        const usedSlots = carsData?.filter(car => car.status === CarStatus.MINING).length || 0;
        setAvailableGarageSlots(totalCapacity - usedSlots);
        
        // Mining gücünü ve kazancı hesapla
        calculateTotalMiningPower(carsData || []);
        
        // Bakım ve yakıt maliyetlerini hesapla
        calculateTotalCosts(carsData || []);
        
        // Aktif mining oturumu varsa zamanlayıcıyı kur
        if (activeSessionData) {
          setupMiningTimer(
            new Date(activeSessionData.end_time), 
            new Date(activeSessionData.start_time)
          );
        }
      } catch (err: any) {
        console.error('[MiningArea] Veri getirme hatası:', err);
        setError('Veriler yüklenirken bir hata oluştu: ' + err.message);
        toast.error('Veriler yüklenemedi.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Component unmount olduğunda zamanlayıcıyı temizle
    return () => {
      if (timerRef) {
        clearInterval(timerRef);
      }
    };
  }, [user]);
  
  // Mining zamanlayıcısını kur
  const setupMiningTimer = useCallback((endTime: Date, startTime: Date) => {
    // Eğer daha önce bir zamanlayıcı kurulmuşsa temizle
    if (timerRef) {
      clearInterval(timerRef);
    }
    
    const timer = setupTimer(
      endTime,
      (formattedTimeLeft, progressValue) => {
        setTimeLeft(formattedTimeLeft);
        setProgress(progressValue);
      },
      async () => {
        // Mining tamamlandı, durumu güncelle
        if (activeMiningSession) {
          await completeMiningSession(activeMiningSession.id);
        }
      },
      startTime
    );
    
    setTimerRef(timer);
  }, [activeMiningSession, timerRef]);
  
  // Mining oturumunu tamamla
  const completeMiningSession = async (sessionId: number) => {
    try {
      // miningService.completeMining fonksiyonunu kullanıyoruz
      const reward = await miningService.completeMining(sessionId);
      
      if (reward > 0) {
        setActiveMiningSession(null);
        toast.success(`Mining tamamlandı! ${formatNumber(reward)} NMFP kazandınız.`);
        
        // Araçları güncelle (yakıt ve durumları değişmiş olacak)
        if (user?.id) {
          const updatedCars = await userCarService.getUserCars(user.id);
          if (updatedCars) {
            setUserCars(updatedCars);
            // Maliyetleri yeniden hesapla
            calculateTotalCosts(updatedCars);
          }
        }
      }
    } catch (err) {
      console.error('[MiningArea] Mining tamamlama hatası:', err);
      toast.error('Mining tamamlanırken bir hata oluştu.');
    }
  };
  
  // Mining ödüllerini topla - Bu fonksiyon artık doğrudan completeMining içinde yapılıyor
  // Bu yüzden ayrı bir fonksiyona gerek yok, tüm mantık completeMining'de
  
  // Tüm araçları bakım ve yakıt doldur
  const maintainAllCars = async () => {
    if (!user || !user.id) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    if (userBalance < totalMaintenanceCost + totalFuelCost) {
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
  
  // Mining başlat
  const startMining = async () => {
    if (!user || !user.id) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    if (activeMiningSession) {
      toast.error('Zaten aktif bir mining oturumu var!');
      return;
    }
    
    // Mining yapılabilecek araçları bul (bakım ve yakıtı yeterli olanlar)
    const miningReadyCars = userCars.filter(
      car => car.status === CarStatus.ACTIVE && car.fuel >= 25 && car.condition >= 10
    );
    
    if (miningReadyCars.length === 0) {
      toast.error('Mining yapabilecek uygun araç yok! Araçlarınızı tamir edin ve yakıt doldurun.');
      return;
    }
    
    // Garaj kapasitesi kontrolü
    if (availableGarageSlots <= 0) {
      toast.error('Kullanılabilir garaj kapasitesi yok!');
      return;
    }
    
    // En güçlü araçları al (garaj kapasitesi kadar)
    const sortedCars = [...miningReadyCars].sort((a, b) => {
      const powerA = a.car_model?.mining_power || 0;
      const powerB = b.car_model?.mining_power || 0;
      return powerB - powerA;
    });
    
    const selectedCar = sortedCars[0]; // En güçlü aracı seç
    const selectedGarage = userGarages.length > 0 ? userGarages[0].id : null; // İlk garajı kullan
    
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
        
        // Mining oturumları ve araçları güncelle
        const [activeSessions, updatedCars] = await Promise.all([
          miningService.getAllActiveMiningSessions(user.id),
          userCarService.getUserCars(user.id)
        ]);
        
        const newSession = activeSessions.length > 0 ? activeSessions[0] : null;
        
        if (newSession) {
          setActiveMiningSession(newSession);
          setupMiningTimer(
            new Date(newSession.end_time),
            new Date(newSession.start_time)
          );
        }
        
        if (updatedCars) {
          setUserCars(updatedCars);
          // Araç durumları değiştiği için maliyet ve slot hesaplamalarını güncelle
          calculateTotalCosts(updatedCars);
          const usedSlots = updatedCars.filter(car => car.status === CarStatus.MINING).length;
          setAvailableGarageSlots(userGarages.reduce((total, garage) => total + garage.capacity, 0) - usedSlots);
        }
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
  const miningClasses = getMiningStatusClasses(
    activeMiningSession 
      ? activeMiningSession.status === MiningStatus.COMPLETED 
        ? 'completed' 
        : 'mining'
      : 'idle'
  );

  return (
    <div className="space-y-4">
      {/* Bakım ve Yakıt Özeti */}
      <div className={`${miningClasses.bg} rounded-xl p-4 shadow-md border ${miningClasses.border}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7]">
            Araç Durumu ve Bakım
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Bakiye:</span>
            <span className="text-sm font-medium text-[#2ff7c1]">{formatCurrency(userBalance)} NMFP</span>
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
            disabled={isLoading || userBalance < (totalMaintenanceCost + totalFuelCost)}
            className="w-full bg-gradient-to-r from-orange-500 to-blue-500 text-white py-2 px-4 rounded-lg font-medium transition-all duration-300 disabled:opacity-50"
          >
            {isLoading ? 'İşleniyor...' : 'Tüm Araçları Bakım Yap'}
          </button>
        )}
      </div>
      
      {/* Araç Listesi */}
      <div className={`${miningClasses.bg} rounded-xl p-4 shadow-md border ${miningClasses.border}`}>
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
          Araçlarım
        </h3>
        
        {userCars.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Henüz araç satın almadınız.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userCars.map(car => (
              <div key={car.id} className={`bg-[#16213e]/70 p-3 rounded-lg ${car.status === CarStatus.MINING ? 'border border-[#2ff7c1]/30' : ''}`}>
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
                    <div className="flex justify-between items-center">
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Mining Alanı */}
      <div className={`${miningClasses.bg} rounded-xl p-4 shadow-md border ${miningClasses.border}`}>
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
          Mining İşlemi
        </h3>
        
        {!activeMiningSession ? (
          <div>
            <div className="bg-[#16213e]/70 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Toplam Mining Gücü</p>
                  <p className="text-xl font-bold text-[#2ff7c1]">{formatNumber(totalMiningPower)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">8 Saatlik Tahmin</p>
                  <p className="text-xl font-bold text-[#7b2ff7]">{formatCurrency(totalEstimatedReward)}</p>
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Garaj Kapasitesi:</span>
                <span>{userGarages.reduce((total, garage) => total + garage.capacity, 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-3">
                <span>Kullanılabilir Slot:</span>
                <span>{availableGarageSlots}</span>
              </div>
            </div>
            
            <button
              onClick={startMining}
              disabled={isLoading || availableGarageSlots <= 0}
              className="w-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] text-white py-3 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30 disabled:opacity-50"
            >
              {isLoading ? 'İşleniyor...' : 'Mining Başlat'}
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-[#16213e]/70 p-4 rounded-lg mb-4">
              {activeMiningSession.status === MiningStatus.ACTIVE ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Kalan Süre</span>
                    </div>
                    <span className="font-mono text-[#2ff7c1]">{timeLeft}</span>
                  </div>
                  
                  <div className="w-full h-3 bg-[#1a1a2e] rounded-full overflow-hidden mb-3">
                    <div 
                      className={`h-full bg-gradient-to-r ${miningClasses.progress}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </>
              ) : (
                <div className="text-center mb-3">
                  <p className="text-[#2ff7c1] font-medium">Mining Tamamlandı!</p>
                  <p className="text-sm text-gray-400">Ödülünüzü toplayabilirsiniz.</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Araç</p>
                  <p className="text-sm font-medium">
                    {userCars.find(car => car.id === activeMiningSession.car_id)?.name || 'Araç #1'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Ödül</p>
                  <p className="text-lg font-bold text-[#2ff7c1]">
                    {formatCurrency(activeMiningSession.expected_reward)} NMFP
                  </p>
                </div>
              </div>
            </div>
            
            {activeMiningSession.status === MiningStatus.COMPLETED ? (
              <button
                onClick={completeMiningSession}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#2ff7c1] to-[#5ff7d5] text-[#0d253f] py-3 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#2ff7c1]/30 disabled:opacity-50"
              >
                {isLoading ? 'İşleniyor...' : 'Ödülü Topla'}
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-[#1a1a2e] text-gray-400 py-3 px-4 rounded-lg font-medium cursor-not-allowed"
              >
                Mining Devam Ediyor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 