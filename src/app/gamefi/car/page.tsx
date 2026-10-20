'use client';
import { starsCheckout } from '@/lib/starsCheckout';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import { 
  CarModel, 
  UserCar, 
  Rarity,
  CarStatus,
  User, // Import User type
  MiningSession, // MiningSession tipi eklendi
  MiningStatus // Mining durumu
} from '@/types';
import { 
  carModelService, 
  userCarService,
  miningService, // miningService import edildi
  userService // Import userService if needed, or rely on context
} from '@/services/api';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { toast } from 'react-hot-toast';
// import { createMetadataJson } from "@/nft/utils/helpers"; // NFT minting logic might need review/update based on backend capabilities
import { toNano } from '@ton/core';
// import { nftService } from '@/services'; // Assuming purchaseCar with 'NFT' type handles minting via backend RPC
// import { TonClient } from '@ton/ton';
// import { stringToRarity, ensureModelIdString } from '@/utils/typeConverters'; // Type converters might be needed depending on how data is handled

// Import the context hook
import { useTelegram } from '@/components/TelegramInitProvider';
import { supabase } from '@/lib/supabaseClient';

// Import realtime balance management
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
// Import IPFS Service
// Import dynamic mining button
import DynamicMiningButton, { useMiningButtonState } from '@/components/DynamicMiningButton';
// Import real-time mining progress
import { useRealtimeMining } from '@/hooks/useRealtimeMining';
// Import debug utilities
import { debugMining, miningMetrics } from '@/utils/debugMining';
// Import transaction safety
import { safePurchase, validateBalance, safeMiningClaim } from '@/utils/transactionSafety';
// Import immediate sync
import { useImmediateSync } from '@/hooks/useImmediateSync';
// Import mining state sync
import { useMiningStateSync } from '@/hooks/useMiningStateSync';
// Import auto state cleanup
import { useAutoStateCleanup } from '@/hooks/useAutoStateCleanup';

// Nadir seviye sıralaması (UI için kalabilir)
const rarityOrder = {
  [Rarity.COMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 3,
  [Rarity.LEGENDARY]: 4
};

// Frontend price calculations are removed as prices come from DB now
// const getMintCost = (rarity: Rarity): number => { ... };
// const getTonPurchaseCost = (rarity: Rarity): number => { ... };

// Mining yardımcı fonksiyonlarını ekle
import { 
  formatTimeLeft,
  calculateProgress,
  setupTimer
} from '@/app/utils/miningUtils';

export default function CarPage() {
  const { user, isLoading: isUserLoading, error: userError } = useTelegram(); // Get user from context

  // Real-time balance management
  const {
    balance: realtimeBalance,
    pendingAmount,
    hasPending,
    addOptimisticTransaction,
    commitTransaction,
    rollbackTransaction,
    refreshBalance
  } = useRealtimeBalance({
    userId: user?.id || '',
    initialBalance: user?.balance,
    onBalanceChange: (newBalance, previousBalance) => {
      console.log(`[CarPage] Balance changed: ${previousBalance} → ${newBalance}`);
    }
  });

  const [activeTab, setActiveTab] = useState('my-cars');
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [availableModels, setAvailableModels] = useState<CarModel[]>([]);
  const [activeSeriesFilter, setActiveSeriesFilter] = useState<string | null>(null); // Series filtering might need adjustment as 'series' is not in DB schema
  const [isLoading, setIsLoading] = useState<boolean>(true); // Separate loading state for car/model data
  const [error, setError] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const [mintLoading, setMintLoading] = useState<string | null>(null); // Keep for UI feedback during mint
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null); // Keep for UI feedback during purchase
  const [isMiningStarting, setIsMiningStarting] = useState<{[carId: number]: boolean}>({});  // Her araç için ayrı loading state
  
  // Mining oturumlarını takip etmek için gerekli state'ler
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(0); // Son güncelleme zamanı için state

  // Real-time mining progress tracking
  const {
    progressData: miningProgress,
    isConnected: isMiningConnected,
    refreshProgress
  } = useRealtimeMining({
    userId: user?.id || '',
    sessions: activeMiningSessions,
    onProgressUpdate: (sessionId, progress) => {
      console.log(`[CarPage] Mining progress update: Session ${sessionId} - ${progress.progress}%`);
    },
    onSessionCompleted: (sessionId) => {
      console.log(`[CarPage] Mining session ${sessionId} completed`);
      // Session tamamlandı, UI'ı güncelle
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
  const { forcSync: forceStatSync } = useMiningStateSync({
    userId: user?.id || '',
    sessions: activeMiningSessions,
    onSessionsUpdated: (freshSessions) => {
      console.log('[CarPage] State sync: Updating sessions from server');
      setActiveMiningSessions(freshSessions);
    }
  });
  
  // Auto state cleanup (stale session removal)
  const { triggerCleanup } = useAutoStateCleanup({
    userId: user?.id || '',
    localSessions: activeMiningSessions,
    onSessionsCleanup: (cleanSessions) => {
      console.log('[CarPage] Auto cleanup: Removing stale sessions');
      setActiveMiningSessions(cleanSessions);
    },
    onBalanceRefresh: async () => { await refreshBalance(); }
  });
  
  // Backward compatibility için timeLeft ve progress helper'ları
  const timeLeft: { [key: number]: string } = {};
  const progress: { [key: number]: number } = {};
  
  Object.entries(miningProgress).forEach(([sessionId, progressInfo]) => {
    const id = parseInt(sessionId);
    timeLeft[id] = progressInfo.timeLeft || '--:--:--';
    progress[id] = progressInfo.progress || 0;
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[CarPage] Mining progress data:', {
      activeSessions: activeMiningSessions.length,
      progressDataKeys: Object.keys(miningProgress),
      timeLeftKeys: Object.keys(timeLeft),
      progressKeys: Object.keys(progress)
    });
  }

  // Subscription tracking to prevent loops  
  const isSubscribedRef = useRef(false);
  
  // Simplified state management

  // Fetch user cars when user context is available (single load)
  useEffect(() => {
    const fetchUserCars = async () => {
      if (!user || !user.id || isSubscribedRef.current) { 
          return; 
      }
      
      console.log(`[CarPage] İlk araç verisi yükleme: ${user.id}`);

      try {
        setIsLoading(true);
        setError(null);
        const cars = await userCarService.getUserCars(user.id);
        console.log('[CarPage] Gelen araçlar:', cars.length);
        setUserCars(cars);
        
        // Mining oturumlarını da yükle
        await fetchMiningSessions();
        
        // Auto cleanup trigger
        await triggerCleanup();
        
        isSubscribedRef.current = true;
        
      } catch (err: any) {
        console.error('[CarPage] Araç yükleme hatası:', err);
        setError(err.message || 'Araçlarım yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user && !isUserLoading) {
    fetchUserCars();
    }
  }, [user?.id, isUserLoading]); // Sadece user ID değişirse
  
  // Fetch available car models
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        setIsLoading(true); // Use main loading state
        setError(null);
        const models = await carModelService.getAllModels();
        console.log('>>> car/page.tsx - fetchAvailableModels - Gelen Modeller:', models);
        
        // TODO: Re-evaluate rarity and series logic if needed based on DB data
        // Rarity comes directly from DB model.rarity now
        // Series is not in DB schema, filtering/sorting might need changes
        // Visual path correction logic might still be needed if DB paths are inconsistent
        const processedModels = models.map(model => {
          const adjustedModel = { ...model };
          // Ensure image_url is usable
          if (adjustedModel.image_url && !adjustedModel.image_url.startsWith('/')) {
            adjustedModel.image_url = `/${adjustedModel.image_url}`;
          }
           // Fix specific known path issues if necessary (example)
          if (adjustedModel.id === 'UUID_for_911_s_t') { // Use actual UUID from DB if needed
             adjustedModel.image_url = '/cars/911/911-s-t.jpg';
          } 
          // ... add other specific corrections if required
          return adjustedModel;
        });

        // Sort models (example: by name)
        const sortedModels = [...processedModels].sort((a, b) => {
          // Example sort: by rarity, then by mining power
          const rarityA = typeof a.rarity === 'string' ? a.rarity : Rarity[a.rarity];
          const rarityB = typeof b.rarity === 'string' ? b.rarity : Rarity[b.rarity];
          if (rarityOrder[rarityB as Rarity] !== rarityOrder[rarityA as Rarity]) {
             return rarityOrder[rarityB as Rarity] - rarityOrder[rarityA as Rarity];
          }
          return b.mining_power - a.mining_power; 
        });
        
        setAvailableModels(sortedModels);
        console.log("Tüm modeller yüklendi:", sortedModels.length);
      } catch (err: any) {
        console.error('Model yükleme hatası:', err);
        setError(err.message || 'Araç modelleri yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAvailableModels();
  }, []); // Fetch models once on mount

  // Get CarModel data from UserCar (which includes joined car_model)
  // This replaces the old getCarModel function
  const getCarModelFromUserCar = (userCar: UserCar): CarModel | undefined => {
    return userCar.car_model;
  };
  
  // Rarity class (no changes needed, uses enum)
  const getRarityClass = (rarity: Rarity | string): string => {
     const rarityEnum = typeof rarity === 'string' ? (Rarity[rarity.toUpperCase() as keyof typeof Rarity] || Rarity.COMMON) : rarity;
    switch(rarityEnum) {
      case Rarity.COMMON: return 'bg-gradient-to-r from-gray-400 to-gray-500 shadow-gray-400/30 shadow-sm';
      case Rarity.RARE: return 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-blue-500/30 shadow-sm';
      case Rarity.EPIC: return 'bg-gradient-to-r from-purple-400 to-purple-600 shadow-purple-500/30 shadow-sm';
      case Rarity.LEGENDARY: return 'bg-gradient-to-r from-yellow-300 to-amber-500 shadow-amber-400/30 shadow-sm';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500 shadow-gray-400/30 shadow-sm';
    }
  };
  
  // Removed getRarityByNftLimit as rarity comes from DB

  // Get status info (Needs update for repair_end_time)
  const getStatusInfo = (car: UserCar): React.ReactNode => {
    switch(car.status) {
      case CarStatus.ACTIVE:
      case 'active':
        return (
          <div className="flex items-center text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-medium">Aktif</span>
          </div>
        );
      case CarStatus.REPAIRING:
      case 'repairing':
        // Calculate remaining time if repair_end_time exists
        const repairEndTime = car.repair_end_time ? new Date(car.repair_end_time).getTime() : null;
        const now = Date.now();
        const timeLeftMs = repairEndTime && repairEndTime > now ? repairEndTime - now : 0;
        const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        const timeString = timeLeftMs > 0 ? `${hours}s ${minutes}dk` : 'Bitti';
        return (
          <div className="flex items-center text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Tamir: {timeString}</span>
          </div>
        );
      case CarStatus.MINING:
      case 'mining':
         return (
           <div className="flex items-center text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">
             {/* Add a mining icon if desired */}
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
             <span className="text-xs font-medium">Mining</span>
          </div>
        );
      case CarStatus.INACTIVE:
      case 'inactive':
      default:
        return (
          <div className="flex items-center text-gray-400 bg-gray-400/10 px-2 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Garajda</span>
          </div>
        );
    }
  };

  // Get unique series (needs adjustment or removal as 'series' is not in DB)
  const getUniqueSeries = (): string[] => {
    // This needs rework. Maybe filter by name patterns or add 'series' to DB?
    // For now, return empty or predefined categories
    // const seriesSet = new Set<string>();
    // availableModels.forEach(model => {
    //   // Extract series from name? e.g., model.name.split(' ')[1]
    // });
    // return Array.from(seriesSet).sort();
    return ['911', '718', 'Taycan', 'Cayenne', 'Panamera', 'Macan']; // Placeholder
  };

  // Get filtered models (Re-enable filtering)
  const getFilteredModels = (): CarModel[] => {
    if (!activeSeriesFilter) return availableModels; // Filtre yoksa tümünü döndür

    // Filter by name: check if name starts with the series or contains it as a whole word
    // Example: '911' filter should match '911 Carrera' but not 'SuperCar911'
    // Using includes might be sufficient depending on naming conventions
    // Let's try a slightly more specific check:
    return availableModels.filter(model => 
        model.name.toLowerCase().startsWith(activeSeriesFilter.toLowerCase() + ' ') || // Başlangıçta mı? (Boşluklu)
        model.name.toLowerCase() === activeSeriesFilter.toLowerCase() || // Tam eşleşme mi?
        model.name.toLowerCase().includes(' ' + activeSeriesFilter.toLowerCase()) // Ortada kelime olarak mı?
    );
  };
  
  // --- Purchase Handlers --- 

  const handlePurchase = async (model: CarModel, purchaseType: 'NMFP' | 'STARS') => {
    if (!user?.id || purchaseLoading) return;
    setPurchaseLoading(`${purchaseType}-${model.id}`);
    const toastId=toast.loading('Satın alma hazırlanıyor…');
    try {
      if (purchaseType==='STARS') await starsCheckout('car',model.id);
      else {
        const id=await userCarService.purchaseCar(user.id,model.id,'NMFP');
        if(!id)throw new Error('Araç satın alınamadı.');
      }
      setUserCars(await userCarService.getUserCars(user.id));
      await refreshBalance(); setActiveTab('my-cars');
      toast.success(`${model.name} garajına eklendi.`,{id:toastId});
    }catch(error){toast.error(error instanceof Error?error.message:'Satın alma tamamlanamadı.',{id:toastId});}
    finally{setPurchaseLoading(null);}
  };

  // --- Mining Başlatma Fonksiyonu ---
  const handleStartMining = async (carId: number) => {
    if (!user || !user.id) {
      toast.error('Mining başlatmak için kullanıcı bilgisi gerekli.');
      return;
    }
    
    // İlgili aracı bul
    const car = userCars.find(c => c.id === carId);
    if (!car) {
      toast.error('Seçilen araç bulunamadı.');
      return;
    }
    
    // Debug mining state before start
    debugMining.logCarMiningState(car, undefined);
    miningMetrics.startMeasure('Start Mining');
    
    // Araç uygun durumda mı kontrolü (Örn: Aktif, yakıtı/kondisyonu yeterli)
    if (car.status !== CarStatus.ACTIVE && car.status !== 'active') {
        toast.error('Bu araç şu anda mining için uygun değil (Durum: ' + car.status + ').');
        return;
    }
    if (car.fuel <= 0) {
        toast.error('Mining başlatmak için aracın yakıtı olmalı.');
        return;
    }
    if (car.condition <= 0) {
        toast.error('Mining başlatmak için aracın durumu iyi olmalı.');
        return;
    }

    setIsMiningStarting(prev => ({...prev, [carId]: true}));
    const toastId = toast.loading(`${car.name} ile mining başlatılıyor...`);

    try {
      // miningService.startMining çağrısı
      const newSessionId = await miningService.startMining(user.id, car.id, car.garage_id);

      if (newSessionId !== null) {
        console.log('[CarPage] Mining başarıyla başlatıldı, sessionId:', newSessionId);
        
        // 1. Araç listesi state'ini hemen güncelle
        setUserCars(prevCars => prevCars.map(c => 
            c.id === car.id ? { ...c, status: CarStatus.MINING } : c
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
            
            console.log('[CarPage] ✅ Mining session immediately synchronized:', newSession);
          },
          // onTimeout: Session bulunamadı
          () => {
            console.error('[CarPage] 🚨 Mining session sync timeout');
            // Manual fallback
            setLastUpdateTime(0);
            setTimeout(() => fetchMiningSessions(), 1000);
          }
        );
        
        toast.success(`${car.name} mining başlatıldı!`, { id: toastId });
      } else {
        // API null döndürdüyse (beklenmedik durum veya RPC'den gelen null)
        throw new Error('Mining oturumu başlatılamadı (API den null yanıt).');
      }

    } catch (error: any) {
      console.error('Mining başlatma hatası:', error);
      toast.error(error.message || 'Mining başlatılırken bir hata oluştu.', { id: toastId });
    } finally {
      setIsMiningStarting(prev => ({...prev, [carId]: false}));
    }
  };

  // Araç tamir ve yakıt fonksiyonları - car parametresi yerine carId parametresi alacak
  const handleRepairCar = async (carId: number) => {
      if (!user || !user.id) return;
      
      // İlgili aracı bul
      const car = userCars.find(c => c.id === carId);
      if (!car) {
        toast.error('Seçilen araç bulunamadı.');
        return;
      }
      
      // Repair cost hesapla
      const repairCost = car.car_model?.repair_cost || 1000;
      const transactionId = `repair_${carId}_${Date.now()}`;
      
      // Optimistic update
      addOptimisticTransaction({
        id: transactionId,
        amount: -repairCost,
        type: 'repair',
        description: `${car.name} bakımı`
      });
      
      // Insufficient balance kontrolü
      if (realtimeBalance < repairCost) {
        rollbackTransaction(transactionId);
        toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(repairCost)} NMFP`);
        return;
      }
      
      const toastId = toast.loading(`${car.name} tamir ediliyor...`);
      try {
          const success = await userCarService.repairCar(user.id, car.id);
          if (success) {
              // Transaction'ı commit et
              commitTransaction(transactionId);
              
              toast.success(`${car.name} bakımı tamamlandı!`, { 
                id: toastId,
                style: {
                  background: 'rgba(47, 247, 193, 0.1)',
                  color: '#2ff7c1',
                  border: '1px solid rgba(47, 247, 193, 0.3)'
                }
              });
              
              // Araçları yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
              // Mining oturumlarını yenile
              fetchMiningSessions();
              
              // Real-time balance refresh
              await refreshBalance();

                } else {
              throw new Error('Tamir işlemi başarısız oldu.');
          }
      } catch (error: any) {
          // Rollback transaction
          rollbackTransaction(transactionId);
          toast.error(error.message || 'Tamir sırasında hata.', { id: toastId });
      }
  };

  const handleRefillCar = async (carId: number) => {
      if (!user || !user.id) return;
      
      // İlgili aracı bul
      const car = userCars.find(c => c.id === carId);
      if (!car) {
        toast.error('Seçilen araç bulunamadı.');
        return;
      }
      
      // Refill cost hesapla
      const refillCost = car.car_model?.refill_cost || 500;
      const transactionId = `refill_${carId}_${Date.now()}`;
      
      // Optimistic update
      addOptimisticTransaction({
        id: transactionId,
        amount: -refillCost,
        type: 'refill',
        description: `${car.name} yakıt`
      });
      
      // Insufficient balance kontrolü
      if (realtimeBalance < refillCost) {
        rollbackTransaction(transactionId);
        toast.error(`Yetersiz bakiye! Gerekli: ${formatCurrency(refillCost)} NMFP`);
        return;
      }
      
      const toastId = toast.loading(`${car.name} yakıtı dolduruluyor...`);
      try {
          const success = await userCarService.refillCar(user.id, car.id);
          if (success) {
              // Transaction'ı commit et
              commitTransaction(transactionId);
              
              toast.success(`${car.name} yakıtı dolduruldu!`, { 
                id: toastId,
                style: {
                  background: 'rgba(47, 247, 193, 0.1)',
                  color: '#2ff7c1',
                  border: '1px solid rgba(47, 247, 193, 0.3)'
                }
              });
              
              // Araçları yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
              // Mining oturumlarını yenile
              fetchMiningSessions();
              
              // Real-time balance refresh
              await refreshBalance();

        } else {
              throw new Error('Yakıt doldurma işlemi başarısız oldu.');
          }
      } catch (error: any) {
          // Rollback transaction
          rollbackTransaction(transactionId);
          toast.error(error.message || 'Yakıt doldurma sırasında hata.', { id: toastId });
      }
  };

  // Mining tamamla fonksiyonu
  const handleCompleteMining = async (sessionId: number) => {
    if (!user || !user.id) {
      toast.error('Mining tamamlamak için kullanıcı bilgisi gerekli.');
      return;
    }

    // CRITICAL: Backend'ten fresh session durumunu kontrol et
    try {
      const freshSessions = await miningService.getAllActiveMiningSessions(user.id);
      const freshSession = freshSessions.find(s => s.id === sessionId);
      
      console.log('[CarPage] Fresh session check before claim:', {
        sessionId,
        freshSession: freshSession ? {
          id: freshSession.id,
          status: freshSession.status
        } : null
      });
      
      // Session backend'te yoksa veya completed'sa
      if (!freshSession || freshSession.status === MiningStatus.COMPLETED) {
        console.warn('[CarPage] Session already completed on backend, cleaning up frontend state...');
        
        // Frontend state'i temizle
        setActiveMiningSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // Backend'te otomatik tamamlandıysa, reward zaten eklenmiştir
        // Sadece başarı mesajı göster ve balance'ı güncelle
        toast.success('Mining ödülünüz otomatik olarak eklendi! 🎉', {
          style: {
            background: 'rgba(47, 247, 193, 0.1)',
            color: '#2ff7c1',
            border: '1px solid rgba(47, 247, 193, 0.3)'
          }
        });
        
        // Force balance refresh to show the auto-added reward
        await refreshBalance();
        
        // Araçları güncelle
        const updatedCars = await userCarService.getUserCars(user.id);
        setUserCars(updatedCars);
        
        return; // Exit early
      }
      
    } catch (syncError) {
      console.error('[CarPage] Session sync check failed:', syncError);
      // Continue with normal flow
    }

    // Mining session'ı bul (local state'ten)
    const miningSession = activeMiningSessions.find(s => s.id === sessionId);
    if (!miningSession) {
      toast.error('Mining oturumu bulunamadı.');
      return;
    }

    const transactionId = `mining_reward_${sessionId}_${Date.now()}`;
    const expectedReward = miningSession.expected_reward;

    try {
      setIsMiningStarting(prev => ({...prev, [sessionId]: true}));

      // Optimistic reward update
      addOptimisticTransaction({
        id: transactionId,
        amount: expectedReward,
        type: 'mining_reward',
        description: `Mining ödülü: ${miningSession.user_car?.name || 'Araç'}`
      });

      const toastId = toast.loading('Mining ödülü toplanıyor...', {
        style: {
          background: 'rgba(26, 26, 46, 0.95)',
          color: '#fff'
        }
      });

      // Mining tamamla
      const actualReward = await miningService.completeMining(sessionId);

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
              description: `Mining ödül düzeltmesi`
            });
          }
        }
        
        toast.success(`Mining tamamlandı! ${formatCurrency(actualReward)} NMFP kazandınız!`, { 
          id: toastId,
          style: {
            background: 'rgba(47, 247, 193, 0.1)',
            color: '#2ff7c1',
            border: '1px solid rgba(47, 247, 193, 0.3)'
          }
        });

        // Araç listesini güncelle
        const updatedCars = await userCarService.getUserCars(user.id);
        setUserCars(updatedCars);

        // Mining oturumlarını yenile
        setLastUpdateTime(0); // Rate limit bypass
        await fetchMiningSessions();
        
        // Real-time balance refresh
        await refreshBalance();
        
        // Force state sync to clean up completed sessions
        await forceStatSync();

        } else {
        throw new Error('Mining ödülü alınamadı.');
      }
    } catch (error: any) {
      console.error('[CarPage] Mining tamamlama hatası:', error);
      console.error('[CarPage] Error details:', {
        message: error.message,
        stack: error.stack,
        sessionId,
        transactionId,
        miningSession: miningSession ? {
          id: miningSession.id,
          status: miningSession.status
        } : null
      });
      
      // Rollback optimistic update
      rollbackTransaction(transactionId);
      
      toast.error(error.message || 'Mining tamamlanırken bir hata oluştu.', {
        style: {
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444'
        }
      });
    } finally {
      setIsMiningStarting(prev => ({...prev, [sessionId]: false}));
    }
  };

  // Simplified mining management - timer management artık useRealtimeMining hook'unda

  // Aktif mining oturumlarını getir - simplified
  const fetchMiningSessions = useCallback(async () => {
    if (!user?.id) return;
    
    const now = Date.now();
    // Rate limiting: 10 saniye (mining start sonrası için daha hızlı)
    if (now - lastUpdateTime < 10000) {
      console.log('[CarPage] Son API çağrısından bu yana 10 saniye geçmedi, çağrı atlanıyor');
      return;
    }
    
    try {
      const sessions = await miningService.getAllActiveMiningSessions(user.id);
      console.log('[CarPage] Mining oturumları:', sessions);
      setActiveMiningSessions(sessions);
      setLastUpdateTime(now);
    } catch (err) {
      console.error('[CarPage] Mining oturumları yüklenirken hata:', err);
    }
  }, [user?.id, lastUpdateTime]);

  // Mining oturumlarını sadece ilk kez yükle
  useEffect(() => {
    if (user?.id && !isUserLoading && !isSubscribedRef.current) {
      fetchMiningSessions();
      isSubscribedRef.current = true;
      
      // Düzenli kontrol için 5 dakikalık interval (daha az sıklık)
      const checkInterval = setInterval(() => {
        fetchMiningSessions();
      }, 300000); // 5 dakika
      
      return () => {
        clearInterval(checkInterval);
        isSubscribedRef.current = false;
      };
    }
  }, [user?.id, isUserLoading]); // fetchMiningSessions dependency kaldırıldı

  // Araç için mining oturumunu bul (active veya completed)
  const getMiningSessionForCar = (carId: number): MiningSession | undefined => {
    const session = activeMiningSessions.find(session => 
      session.car_id === carId && 
      (session.status === MiningStatus.ACTIVE || session.status === MiningStatus.COMPLETED)
    );
    
    if (process.env.NODE_ENV === 'development' && session) {
      console.log(`[CarPage] Found mining session for car ${carId}:`, {
        sessionId: session.id,
        status: session.status,
        carId: session.car_id
      });
    }
    
    return session;
  };

  // Yükleme durumu
  if (isUserLoading || (isLoading && (!userCars.length || !availableModels.length))) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#43c9d6]"></div>
      </div>
    );
  }

  // Hata durumu (Kullanıcı veya veri yükleme hatası)
  if (userError || error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 text-center">
        <p className="text-red-500">{userError || error}</p>
        <button
          onClick={() => window.location.reload()} // Sayfayı yenilemeyi dene
          className="mt-3 bg-[#43c9d6] text-white px-4 py-2 rounded-lg"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  // Kullanıcı yoksa (Geliştirme modu hariç beklenmemeli)
  if (!user) {
      return (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 text-center">
          <p className="text-yellow-500">Kullanıcı bilgileri yüklenemedi. Lütfen Telegram uygulamasından tekrar deneyin.</p>
        </div>
      );
  }

  // ----- RENDER ----- 

  return (
    <div className="pb-20">
      {/* Sayfa Başlığı */}
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#43c9d6] via-[#216b9c] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#43c9d6] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Araç Yönetimi</h1>
      </div>
      
      <div className="space-y-5">
        {/* Sekme Butonları */}
        <div className="flex justify-between bg-gradient-to-r from-[#101b23] via-[#14242d] to-[#0f3460] rounded-xl p-1.5 shadow-lg border border-[#31505b]">
          {/* Buttons remain the same */}
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'my-cars' ? 'bg-gradient-to-r from-[#43c9d6] via-[#176e91] to-[#216b9c] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#14242d]/80'}`}
            onClick={() => setActiveTab('my-cars')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3a1 1 0 001-1v-6h-4a1 1 0 01-.9-.579l-2.434-4.58A1 1 0 006.764 2H3a1 1 0 00-1 1z" />
              </svg>
              <span>Arabalarım</span>
            </div>
          </button>
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'market' ? 'bg-gradient-to-r from-[#43c9d6] via-[#176e91] to-[#216b9c] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#14242d]/80'}`}
            onClick={() => setActiveTab('market')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              <span>Pazar</span>
            </div>
          </button>
        </div>
        
        {activeTab === 'my-cars' ? (
          <>
            {/* Kullanıcı Araçları Listesi */}
            <div className="bg-gradient-to-b from-[#101b23] to-[#14242d] bg-opacity-80 rounded-xl p-5 shadow-lg border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#43c9d6] to-white">Araçlarım ({userCars.length})</h3>
              {userCars.length === 0 && !isLoading && (
                  <p className="text-center text-gray-400 py-4">Henüz hiç aracınız yok. Pazar sekmesinden yeni araçlar edinebilirsiniz.</p>
              )}
              <div className="grid grid-cols-1 gap-4">
                {userCars.map(car => {
                  // Use joined car_model data directly
                  const carModel = car.car_model;
                  if (!carModel) {
                       console.warn(`UserCar ID ${car.id} için model bilgisi bulunamadı.`);
                       return (
                         <div key={car.id} className="bg-red-900 p-2 rounded text-xs">Model verisi eksik: {car.name}</div>
                       );
                  }
                  
                  // Araç için mining oturumunu ve durumunu kontrol et
                  const miningSession = getMiningSessionForCar(car.id);
                  const isCarMiningNow = !!miningSession;
                  
                  console.log(`[CarPage] Car ${car.id} (${car.name}) mining check:`, {
                    carStatus: car.status,
                    fuel: car.fuel,
                    condition: car.condition,
                    miningSession: miningSession ? {
                      id: miningSession.id,
                      status: miningSession.status,
                      car_id: miningSession.car_id
                    } : null,
                    isCarMiningNow
                  });
                  
                  return (
                    <div 
                      key={car.id} 
                      className="bg-gradient-to-r from-[#0f3460] to-[#101b23] rounded-lg overflow-hidden transition-all duration-300 hover:translate-y-[-2px] border border-[#31505b] hover:border-[#3a497a]"
                    >
                      <div className="flex flex-col">
                        {/* Araç Görseli (Use image_url) */}
                        <div className="relative w-full aspect-[16/9]">
                          {/* Mining durumu için ek badge */}
                          {isCarMiningNow && miningSession && (
                            <div className="absolute top-2 right-2 z-10 bg-[#0f3460]/80 rounded-full px-2 py-1 text-xs flex items-center">
                              {miningSession.status === MiningStatus.COMPLETED ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-[#2ff7c1] font-mono">Tamamlandı</span>
                                </>
                              ) : (
                                <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-[#2ff7c1] font-mono">{timeLeft[miningSession.id] || '--:--:--'}</span>
                                </>
                              )}
                            </div>
                          )}
                          <Image
                            src={carModel.image_url || '/placeholder-car.png'} // Use image_url
                            alt={car.name}
                            width={300}
                            height={169}
                            className="object-contain w-full h-full"
                          />
                        </div>
                        
                        {/* Araç Bilgileri */}
                        <div className="p-4 space-y-2">
                          <div>
                            <h4 className="font-semibold text-white text-lg">{car.name}</h4>
                            <div className="mt-1 flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full ${getRarityClass(carModel.rarity)} mr-2 animate-pulse`}></span>
                              <span className="text-sm text-gray-300">{formatCurrency(carModel.mining_power)} NMFP/s</span>
                            </div>
                          </div>
                          
                          {/* Fuel & Condition */}
                          <div className="grid grid-cols-1 gap-2">
                             {/* Fuel bar ... */}
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Yakıt</span>
                                <span>%{car.fuel}</span>
                              </div>
                              <div className="w-full bg-[#31505b] rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#2ff7c1] via-[#6af7c1] to-[#a5f7c1] h-full rounded-full transition-all duration-500" style={{ width: `${car.fuel}%` }}></div>
                              </div>
                            </div>
                             {/* Condition bar ... */}
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Durum</span>
                                <span>%{car.condition}</span>
                              </div>
                              <div className="w-full bg-[#31505b] rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#216b9c] via-[#4f6cf8] to-[#43c9d6] h-full rounded-full transition-all duration-500" style={{ width: `${car.condition}%` }}></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status & Garage */}
                          <div className="flex justify-between items-center">
                            <div className="text-xs">
                              {getStatusInfo(car)}
                            </div>
                            {/* Mining süreçleri için ilerleme çubuğu */}
                            {isCarMiningNow && miningSession && (
                              <div className="w-24 overflow-hidden">
                                <div className="w-full h-1 bg-[#0d1423] rounded-full overflow-hidden mt-1">
                                  <div 
                                    className="h-full bg-gradient-to-r from-[#216b9c] to-[#43c9d6] transition-all duration-300"
                                    style={{ width: `${progress[miningSession.id] || 0}%` }}
                                  ></div>
                          </div>
                        </div>
                            )}
                      </div>
              </div>
            </div>
            
                      {/* Araç Kontrol Butonları - Her araç için göster */}
                      <div className="p-3 border-t border-[#31505b]/30 flex flex-wrap gap-2">
                        {/* Dinamik Mining Butonu */}
                        <div className="flex-1">
                          {(() => {
                            // Real-time progress data'dan timeLeft ve progress al
                            const sessionProgressData = miningSession ? miningProgress[miningSession.id] : null;
                            const sessionTimeLeft = sessionProgressData?.timeLeft || timeLeft[miningSession?.id || -1] || '--:--:--';
                            const sessionProgress = sessionProgressData?.progress || progress[miningSession?.id || -1] || 0;
                            
                            if (process.env.NODE_ENV === 'development') {
                              console.log(`[CarPage] DynamicMiningButton props for car ${car.id}:`, {
                                miningSession: miningSession?.id,
                                sessionProgressData,
                                timeLeft: sessionTimeLeft,
                                progress: sessionProgress,
                                carStatus: car.status,
                                isLoading: isMiningStarting[car.id]
                              });
                              
                              // Debug car mining state  
                              debugMining.logCarMiningState(car, miningSession);
                            }
                            
                            return (
                              <DynamicMiningButton
                                car={car}
                                miningSession={miningSession}
                                timeLeft={sessionTimeLeft}
                                progress={sessionProgress}
                                isLoading={isMiningStarting[car.id] || false}
                                isClaimLoading={isMiningStarting[miningSession?.id || -1] || false}
                                canStartMining={car.fuel >= 25 && car.condition >= 10} // Proper car condition check
                                onStartMining={handleStartMining}
                                onClaimReward={handleCompleteMining}
                                size="md"
                              />
                            );
                          })()}
                        </div>
                        
                        {/* Yakıt Doldur Butonu */}
                        {car.status === CarStatus.ACTIVE && car.fuel < 100 && (
                          <button
                            onClick={() => handleRefillCar(car.id)}
                            disabled={car.fuel >= 100}
                            className="flex-1 py-2 text-xs rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-[#1976d2] to-[#2196f3] text-white hover:shadow-md hover:shadow-[#1976d2]/20"
                          >
                            Yakıt ({car.car_model?.refill_cost || 0})
                          </button>
                        )}
                        
                        {/* Bakım Yap Butonu */}
                        {car.status === CarStatus.ACTIVE && car.condition < 100 && (
                          <button
                            onClick={() => handleRepairCar(car.id)}
                            disabled={car.condition >= 100}
                            className="flex-1 py-2 text-xs rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-[#ed6c02] to-[#ff9800] text-white hover:shadow-md hover:shadow-[#ed6c02]/20"
                          >
                            Bakım ({car.car_model?.repair_cost || 0})
                          </button>
                        )}
                        
                  </div>
                </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Pazar Tabı */
          <div className="space-y-5">
            <div className="bg-gradient-to-b from-[#101b23] to-[#14242d] rounded-xl p-5 shadow-lg border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#43c9d6] to-white">Araç Modelleri</h3>
              <p className="text-gray-400 text-sm mb-4">
                 Farklı nadirliklerdeki araçları NMFP puanları veya Telegram Stars ile satın alabilirsiniz.
              </p>
              
              {/* Market Filtresi (Series mantığı gözden geçirilmeli) */}
              <div className="flex overflow-x-auto pb-2 mb-4 space-x-2 scrollbar-hide">
                 {/* Filter buttons ... (Logic might need change based on how series is handled) */}
                <button
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${ activeSeriesFilter === null ? 'bg-gradient-to-r from-[#43c9d6] to-[#216b9c] text-white' : 'bg-[#14242d] text-gray-300 hover:bg-[#1a253a]' }`}
                  onClick={() => setActiveSeriesFilter(null)}
                >
                  Tüm Modeller
                </button>
                  {/* Example static filters (replace with dynamic if needed) */}
                 {['911', 'Taycan', 'Cayenne', 'Panamera', 'Macan', '718'].map(series => (
                  <button
                    key={series}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${ activeSeriesFilter === series ? 'bg-gradient-to-r from-[#43c9d6] to-[#216b9c] text-white' : 'bg-[#14242d] text-gray-300 hover:bg-[#1a253a]' }`}
                    onClick={() => setActiveSeriesFilter(series)}
                  >
                    {series}
                  </button>
                ))}
              </div>
              
              {/* Araç Listesi */}
              <div className="grid grid-cols-1 gap-6">
                {getFilteredModels().map(model => {
                  // Removed frontend cost calculation const mintCost = getMintCost(model.rarity);
                
                  return (
                    <div 
                      key={model.id} // Use model.id (UUID)
                      className="bg-gradient-to-r from-[#0f3460]/90 to-[#0a1936]/90 rounded-xl overflow-hidden border border-[#31505b] transition-all duration-300 hover:border-[#4a5886] shadow-lg flex flex-col"
                    >
                      {/* Araç Görseli */}
                      <div className="relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-r from-[#14242d] to-[#0f3460]">
                         {/* ... gradient overlay ... */}
                        <Image
                          src={model.image_url || '/placeholder-car.png'} // Use image_url
                          alt={model.name}
                          width={800}
                          height={450}
                          className="object-contain w-full h-full p-2 mx-auto"
                          priority
                        />
                      </div>
                      
                      {/* Araç Bilgileri */}
                      <div className="p-5 border-t border-b border-[#31505b] bg-gradient-to-r from-[#0f3460]/50 to-[#101b23]/50">
                         {/* ... Model name, mining power, rarity display (using model.mining_power, model.rarity) ... */}
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                          <div>
                            <h3 className="font-bold text-2xl text-white mb-3">{model.name}</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Madencilik Gücü</p>
                                <p className="font-medium text-white flex items-center">
                                  {/* ... icon ... */}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#43c9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatCurrency(model.mining_power)} NMFP/saat
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Nadir Seviyesi</p>
                                <p className={`font-medium inline-block px-2 py-0.5 rounded-md text-sm ${ getRarityClass(model.rarity) }`}>
                                  {model.rarity}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Satın Alma Butonları */}
                      <div className="p-5 flex flex-col gap-3">
                        {/* Buy with NMFP Button */}
                        <button 
                          className={`bg-gradient-to-r from-[#43c9d6] via-[#176e91] to-[#216b9c] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#43c9d6]/30 flex items-center justify-between ${purchaseLoading === `NMFP-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
                          onClick={() => handlePurchase(model, 'NMFP')}
                          disabled={purchaseLoading === `NMFP-${model.id}`}
                        >
                           {purchaseLoading === `NMFP-${model.id}` ? 'İşleniyor...' : (
                              <>
                          <div className="flex items-center">
                                  {/* ... icon ... */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                                  <span>NMFP ile Satın Al</span>
                          </div>
                                <span className="font-semibold">{formatCurrency(model.nmfp_price)}</span>
                              </>
                           )}
                        </button>
                        {/* Buy with Telegram Stars */}
                        <button 
                          type="button"
                          className={`bg-gradient-to-r from-[#0088cc] to-[#00a2e0] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#0088cc]/30 flex items-center justify-between ${purchaseLoading === `STARS-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
                          onClick={() => handlePurchase(model, 'STARS')}
                          disabled={purchaseLoading === `STARS-${model.id}`}
                        >
                           {purchaseLoading === `STARS-${model.id}` ? 'İşleniyor...' : (
                              <>
                          <div className="flex items-center">
                                  {/* ... icon ... */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                                  <span>Stars ile Satın Al</span>
                          </div>
                                <span className="font-semibold">{model.stars_price}</span>
                              </>
                            )}
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 