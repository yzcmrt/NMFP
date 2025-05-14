'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { toast } from 'react-hot-toast';
import { toNano } from '@ton/core';
import { UserCar, Garage, CarStatus } from '@/types';
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
import { supabaseService } from '@/services/supabaseService';

export default function AutoMining() {
  const { user } = useTelegram();
  const [selectedCars, setSelectedCars] = useState<UserCar[]>([]);
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoMiningActive, setAutoMiningActive] = useState(false);
  const [autoRenewActive, setAutoRenewActive] = useState(false);
  const [totalMiningPower, setTotalMiningPower] = useState(0);
  const [estimatedReward, setEstimatedReward] = useState(0);
  const [maintenanceCost, setMaintenanceCost] = useState(0);
  const [fuelCost, setFuelCost] = useState(0);
  const [timeLeft, setTimeLeft] = useState('08:00:00');
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [tonConnectUI] = useTonConnectUI();

  // Zamanlayıcı referansı
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);

  // Veri çekme işlemi
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        // Kullanıcı ID'si henüz yoksa veya geçerli değilse bekleyebiliriz veya hata verebiliriz
        // Şimdilik yükleniyor durumunda kalmasını sağlayalım
        console.log('Kullanıcı ID bekleniyor...');
        setIsLoading(true); // ID yoksa yükleniyor göster
        return; 
      }

      setIsLoading(true);
      setError(null);
      try {
        console.log(`Veriler çekiliyor: Kullanıcı ID ${user.id}`);
        // Paralel veri çekme
        const [carsData, garagesData] = await Promise.all([
          supabaseService.carService.getUserCars(user.id),
          supabaseService.garageService.getUserGarages(user.id)
        ]);
        
        console.log('Çekilen Araçlar:', carsData);
        console.log('Çekilen Garajlar:', garagesData);

        setUserCars(carsData || []); // API null dönerse boş dizi ata
        setGarages(garagesData || []); // API null dönerse boş dizi ata

      } catch (err: any) {
        console.error('Veri çekme hatası:', err);
        setError('Veriler yüklenirken bir hata oluştu: ' + err.message);
        toast.error('Veriler yüklenemedi: ' + err.message);
        setUserCars([]); // Hata durumunda listeleri boşalt
        setGarages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]); // user nesnesi değiştiğinde (özellikle user.id geldiğinde) tekrar çalışır

  // Toplam garaj kapasitesini hesapla
  const totalGarageCapacity = garages.reduce((total, garage) => total + garage.capacity, 0);
  
  // Kullanılabilir araçları filtrele (aktif ve bakım/yakıt gerektirenler)
  const availableCars = userCars.filter(car => car.status === CarStatus.ACTIVE);
  
  // En güçlü araçları sırala
  const sortedCars = [...availableCars].sort((a, b) => {
    const powerA = a.model?.miningPower || 0;
    const powerB = b.model?.miningPower || 0;
    return powerB - powerA;
  });

  // İlk yüklemede en güçlü araçları garaj kapasitesi kadar seç
  useEffect(() => {
    // userCars ve garages yüklendikten sonra çalışmalı
    if (!isLoading && userCars.length > 0 && garages.length > 0) {
        const availableCars = userCars.filter(car => car.status !== CarStatus.MINING && car.status !== CarStatus.REPAIRING); // Sadece uygun durumdaki araçlar
        const sortedCars = [...availableCars].sort((a, b) => {
            const powerA = a.model?.miningPower || 0;
            const powerB = b.model?.miningPower || 0;
            return powerB - powerA;
        });
        const capacity = garages.reduce((total, garage) => total + garage.capacity, 0);
        const optimalCars = sortedCars.slice(0, capacity);
    setSelectedCars(optimalCars);
    }
  }, [userCars, garages, isLoading]); // isLoading durumu da bağımlılıklara eklendi

  // Seçili araçların mining gücünü ve tahmini kazancı hesapla
  useEffect(() => {
    const power = selectedCars.reduce((total, car) => {
      return total + (car.model?.miningPower || 0);
    }, 0);
    
    setTotalMiningPower(power);
    
    // Tahmini 8 saatlik kazanç (yardımcı fonksiyonu kullan)
    const estimatedReward = calculateMiningReward(power, 8);
    setEstimatedReward(estimatedReward);
    
    // Bakım ve yakıt maliyetlerini hesapla
    calculateCosts();
  }, [selectedCars]);

  // Bakım ve yakıt maliyetlerini hesapla
  const calculateCosts = useCallback(() => {
    let totalMaintenance = 0;
    let totalFuel = 0;
    
    selectedCars.forEach(car => {
      // Yardımcı fonksiyonları kullan
      totalMaintenance += calculateMaintenanceCost(car.condition);
      totalFuel += calculateFuelCost(car.fuel);
    });
    
    setMaintenanceCost(totalMaintenance);
    setFuelCost(totalFuel);
  }, [selectedCars]);

  // Önceki zamanlayıcıyı temizle
  useEffect(() => {
    return () => {
      if (timerRef) {
        clearInterval(timerRef);
      }
    };
  }, [timerRef]);

  // Mining başlat
  const startAutoMining = async () => {
    if (selectedCars.length === 0) {
      toast.error("Lütfen en az bir araç seçin!");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Bakım ve yakıt doldurma işlemleri
      const updatedCars = [...userCars];
      
      for (const car of selectedCars) {
        const carIndex = updatedCars.findIndex(c => c.id === car.id);
        if (carIndex !== -1) {
          updatedCars[carIndex] = {
            ...updatedCars[carIndex],
            condition: 100,
            fuel: 100
          };
        }
      }
      
      setUserCars(updatedCars);
      
      // Mining başlatma
      setAutoMiningActive(true);
      
      // Mining zamanlayıcısı başlat - 8 saat
      const endTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
      const startTime = new Date();
      
      // Yardımcı zamanlayıcı fonksiyonunu kullan
      const timer = setupTimer(
        endTime,
        (formattedTimeLeft, progress) => {
          setTimeLeft(formattedTimeLeft);
          setProgress(progress);
        },
        () => {
          // Mining tamamlandı
          setAutoMiningActive(false);
          
          // Ödülleri topla
          collectRewards();
          
          // Otomatik yenileme aktifse yeni döngü başlat
          if (autoRenewActive) {
            setTimeout(startAutoMining, 1000);
          }
        },
        startTime
      );
      
      // Zamanlayıcı referansını sakla
      setTimerRef(timer);
      
      // Başarı mesajı göster
      toast.success(createMiningToastMessage('start'));
    } catch (error) {
      console.error('Mining başlatma hatası:', error);
      toast.error("Mining başlatılırken bir hata oluştu!");
    } finally {
      setIsLoading(false);
    }
  };

  // TON ile AutoMining satın al
  const purchaseAutoMiningWithTon = async () => {
    if (!tonConnectUI.connected) {
      toast.error("TON cüzdanınız bağlı değil!");
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading("TON ile otomatik mining satın alınıyor...");
    
    try {
      // Oyun cüzdan adresi
      const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY';
      
      // 1 TON transfer işlemi
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 dakika geçerli
        messages: [
          {
            address: gameWalletAddress,
            amount: toNano('1').toString(),
            payload: 'Auto Mining Purchase'
          }
        ]
      };
      
      const result = await tonConnectUI.sendTransaction(transaction);
      
      if (result) {
        // İşlem başarılı
        toast.success("Otomatik mining satın alındı!", { id: toastId });
        
        // Otomatik yenileme aktif et
        setAutoRenewActive(true);
        
        // Mining başlat
        await startAutoMining();
      } else {
        toast.error("İşlem başarısız oldu!", { id: toastId });
      }
    } catch (error) {
      console.error('TON işlem hatası:', error);
      
      let errorMessage = "İşlem sırasında bir hata oluştu";
      if (error instanceof Error) {
        if (error.message.includes("rejected")) {
          errorMessage = "İşlem kullanıcı tarafından reddedildi";
        } else if (error.message.includes("insufficient")) {
          errorMessage = "Yetersiz bakiye. Satın alma için yeterli TON yok.";
        }
      }
      
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  // Ödülleri topla
  const collectRewards = useCallback(() => {
    toast.success(createMiningToastMessage('collect', estimatedReward));
  }, [estimatedReward]);

  // Renk sınıflarını al
  const statusClasses = getMiningStatusClasses(autoMiningActive ? 'mining' : 'idle');

  return (
    <div className={`${statusClasses.bg} rounded-xl p-4 mb-5 shadow-md border ${statusClasses.border} transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7]">
          Otomatik Mining
        </h3>
        {autoRenewActive && (
          <div className="flex items-center bg-[#2ff7c1]/20 text-[#2ff7c1] px-2 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium">Otomatik Yenileme Aktif</span>
          </div>
        )}
      </div>
      
      {!autoMiningActive ? (
        <div>
          <div className="bg-[#1a1a2e]/70 p-4 rounded-lg mb-4 border border-[#2a3855]/50">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-white font-medium">En Güçlü Araçlar</p>
                <p className="text-xs text-gray-400">Toplam {totalGarageCapacity} garaj kapasitesi</p>
              </div>
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs bg-[#7b2ff7]/20 text-[#7b2ff7] px-2 py-1 rounded-full"
              >
                {showDetails ? 'Gizle' : 'Detaylar'}
              </button>
            </div>
            
            {showDetails && (
              <div className="space-y-2 mb-3">
                {selectedCars.map(car => (
                  <div key={car.id} className="flex items-center justify-between bg-[#16213e]/70 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#2a3855] rounded-md">
                        <span className="text-xs">{car.id}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{car.name}</p>
                        <div className="flex items-center text-xs text-gray-400">
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-1"></div>
                          <span className="mr-2">%{car.fuel}</span>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1"></div>
                          <span>%{car.condition}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-[#2ff7c1]">{car.model?.miningPower || 0}</p>
                      <p className="text-xs text-gray-400">Mining Gücü</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#16213e]/70 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Toplam Mining Gücü</p>
                <p className="text-xl font-bold text-[#2ff7c1]">{formatNumber(totalMiningPower)}</p>
              </div>
              <div className="bg-[#16213e]/70 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Tahmini Kazanç (8s)</p>
                <p className="text-xl font-bold text-[#7b2ff7]">{formatCurrency(estimatedReward)}</p>
              </div>
            </div>
            
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Bakım Maliyeti:</span>
                <span>{formatCurrency(maintenanceCost)} NMFP</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-3">
                <span>Yakıt Maliyeti:</span>
                <span>{formatCurrency(fuelCost)} NMFP</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Toplam Maliyet:</span>
                <span>{formatCurrency(maintenanceCost + fuelCost)} NMFP</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={startAutoMining}
              disabled={isLoading}
              className="bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] text-white py-3 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>İşleniyor...</span>
                </span>
              ) : (
                <span>Mining Başlat</span>
              )}
            </button>
            
            <button
              onClick={purchaseAutoMiningWithTon}
              disabled={isLoading}
              className="bg-gradient-to-r from-[#0d253f] to-[#2a3855] border border-[#2ff7c1] text-[#2ff7c1] py-3 px-4 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#2ff7c1]/20 disabled:opacity-50"
            >
              <div className="flex flex-col items-center justify-center">
                <span>1 TON ile</span>
                <span className="text-xs">Otomatik Yenile</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-[#1a1a2e]/70 p-4 rounded-lg mb-4 border border-[#2a3855]/50">
            <div className="flex justify-between text-sm mb-2">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Kalan Süre</span>
              </div>
              <span className="font-mono text-[#2ff7c1]">{timeLeft}</span>
            </div>
            
            <div className="w-full h-3 bg-[#16213e] rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-[#2f7bf7] via-[#5f40f8] to-[#7b2ff7]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#16213e]/70 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Aktif Araçlar</p>
                <p className="text-xl font-bold text-white">{selectedCars.length}</p>
              </div>
              <div className="bg-[#16213e]/70 p-3 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Kazanılacak</p>
                <p className="text-xl font-bold text-[#2ff7c1]">{formatCurrency(estimatedReward)}</p>
              </div>
            </div>
            
            {autoRenewActive && (
              <div className="mt-3 text-center bg-[#16213e]/70 p-2 rounded-lg border border-[#2ff7c1]/20">
                <p className="text-xs text-[#2ff7c1]">
                  Döngü tamamlandığında otomatik olarak yenilenecek
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 