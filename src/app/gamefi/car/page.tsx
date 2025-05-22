'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';
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
  const [timeLeft, setTimeLeft] = useState<{[key: number]: string}>({});
  const [progress, setProgress] = useState<{[key: number]: number}>({});
  const [timerRefs, setTimerRefs] = useState<{[key: number]: NodeJS.Timeout | null}>({});
  const [lastUpdateTime, setLastUpdateTime] = useState(0); // Son güncelleme zamanı için state

  // Yerel mining oturumlarını saklamak için bir state
  const [localMiningSessions, setLocalMiningSessions] = useState<{[key: number]: {endTime: number, startTime: number, status: string}}>({});

  // Yeni state ekliyoruz
  const [shouldCleanup, setShouldCleanup] = useState(false);

  // Fetch user cars when user context is available
  useEffect(() => {
    const fetchUserCars = async () => {
      if (!user || !user.id) { 
          console.warn('>>> car/page.tsx - fetchUserCars - Kullanıcı veya ID yok, API çağrısı atlanıyor.');
          return; 
      } // Wait for user data
      
      console.log(`>>> car/page.tsx - fetchUserCars - API çağrısı yapılacak kullanıcı ID: ${user.id}`);

      try {
        // --- AUTH KONTROL BLOĞU KALDIRILDI ---
        // supabase.auth.getSession(), supabase.auth.getUser() ve ID karşılaştırması kaldırıldı.
        // Artık sadece context'ten gelen user nesnesine güveniyoruz.
        
        setIsLoading(true);
        setError(null);
        const cars = await userCarService.getUserCars(user.id); // Pass user.id
        console.log('>>> car/page.tsx - fetchUserCars - Gelen Araçlar:', cars);
        setUserCars(cars);
        
        // Mining oturumlarını güncelle
        fetchMiningSessions();
      } catch (err: any) {
        console.error('Araç yükleme hatası:', err);
        setError(err.message || 'Araçlarım yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user && !isUserLoading) {
    fetchUserCars();
    }
  }, [user, isUserLoading]); // Re-fetch when user changes
  
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
          let adjustedModel = { ...model };
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

  const handlePurchase = async (model: CarModel, purchaseType: 'NMFP' | 'TON' | 'NFT') => {
    if (!user || !user.id) {
      toast.error('Satın alma işlemi için kullanıcı bilgisi gerekli.');
        return;
      }
    if (!model || !model.id) {
        toast.error('Geçersiz model bilgisi.');
        return;
      }
      
    const loadingKey = `${purchaseType}-${model.id}`;
    setPurchaseLoading(loadingKey);
    const toastId = toast.loading(`${purchaseType} ile ${model.name} satın alma işlemi başlatılıyor...`);

    try {
        let purchasePrice: number;
        let currency: string;

        switch (purchaseType) {
            case 'NMFP':
                purchasePrice = model.nmfp_price;
                currency = 'NMFP';
                if (user.balance < purchasePrice) {
                    throw new Error(`Yetersiz ${currency}. Gerekli: ${purchasePrice}, Mevcut: ${user.balance}`);
                }
                break;
            case 'TON':
                purchasePrice = model.ton_price;
                currency = 'TON';
                // TON bakiye kontrolü
                if (user.ton_coins < purchasePrice) {
                    throw new Error(`Yetersiz ${currency}. Gerekli: ${purchasePrice}, Mevcut: ${user.ton_coins}`);
                }
                
                // TON transaction logic
                if (tonConnectUI.connected && tonConnectUI.account?.address) {
                    // Nano TON formatına dönüştür
                    const nanoTonAmount = toNano(purchasePrice.toString()).toString();
                    
                    // Oyun cüzdan adresi (doğrula)
                    const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY';
                    
                    // İşlem geçerlilik süresi (20 dakika)
                    const validUntil = Math.floor(Date.now() / 1000) + 60 * 20;
                    
                    // Basitleştirilmiş işlem yapısı - minimum işlem yapısı kullanılıyor
                    const transaction = {
                        validUntil: validUntil,
                        messages: [
                            {
                                address: gameWalletAddress,
                                amount: nanoTonAmount
                                // payload alanı veya diğer karmaşık yapılar kaldırıldı
                            }
                        ]
                    };
                    
                    toast.loading('TON işlemi onaylanıyor...', { id: toastId });
                    
                    try {
                        // İşlemi gönder ve sonucu bekle
                        const result = await tonConnectUI.sendTransaction(transaction);
                        
                        if (result && result.boc) {
                            console.log('TON işlem sonucu başarılı:', { 
                                bocLength: result.boc.length,
                                hasValidBoc: true
                            });
                            
                            // İşlem başarılı, API'ye doğrulama için gönder
                            toast.loading('TON işlemi gönderildi, RPC bekleniyor...', { id: toastId });
                            
                            // 5 saniyelik bekleme süresi ekleyin - işlemin yayılması için
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        } else {
                            console.error('TON işlemi başarısız - geçersiz boc:', result);
                            toast.error("İşlem başarısız oldu! Geçersiz işlem sonucu.", { id: toastId });
                            throw new Error("Geçersiz işlem sonucu");
                        }
                    } catch (txError) {
                        console.error('TON işlem gönderme hatası:', txError);
                        
                        let txErrorMessage = "İşlem gönderilemedi";
                        if (txError instanceof Error) {
                            if (txError.message?.includes("magic")) {
                                txErrorMessage = "İşlem oluşturulurken hata oluştu. Lütfen TON cüzdanınızı kontrol edip tekrar deneyin.";
                            } else if (txError.message?.includes("reject") || txError.message?.includes("cancel")) {
                                txErrorMessage = "İşlem kullanıcı tarafından iptal edildi.";
                            } else if (txError.message?.includes("emulate")) {
                                txErrorMessage = "İşlem simülasyonu başarısız oldu. Lütfen TON bakiyenizi kontrol edin.";
                            }
                        }
                        
                        toast.error(txErrorMessage, { id: toastId });
                        throw new Error(txErrorMessage);
                    }
                } else {
                    throw new Error('TON ile satın almak için cüzdanınızı bağlayın.');
                }
                break;
            case 'NFT':
                purchasePrice = model.nft_mint_price;
                currency = 'TON'; // Minting usually costs TON
                 // TODO: Add TON balance check
                if (user.ton_coins < purchasePrice) {
                    throw new Error(`Yetersiz ${currency} (Mint için). Gerekli: ${purchasePrice}, Mevcut: ${user.ton_coins}`);
                }
                // TON transaction logic for minting (if not handled solely by RPC)
                if (tonConnectUI.connected && tonConnectUI.account?.address) {
                    const nanoTonAmount = toNano(purchasePrice.toString()).toString();
                    const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY'; 
                    
                    // İşlem geçerlilik süresi (20 dakika)
                    const validUntil = Math.floor(Date.now() / 1000) + 60 * 20;
                    
                    // NFT minteleme için basit transaction yapısı
                    const transaction = {
                        validUntil: validUntil,
                        messages: [
                            {
                                address: gameWalletAddress,
                                amount: nanoTonAmount
                                // karmaşık payload yapısından kaçınılıyor
                            }
                        ]
                    };
                    
                    toast.loading('NFT Mint işlemi için TON onayı bekleniyor...', { id: toastId });
                    
                    try {
                        // İşlemi gönder ve sonucu bekle
                        const result = await tonConnectUI.sendTransaction(transaction);
                        
                        if (result && result.boc) {
                            console.log('NFT Mint TON işlem sonucu başarılı:', { 
                                bocLength: result.boc.length,
                                hasValidBoc: true
                            });
                            
                            toast.loading('TON işlemi gönderildi, RPC bekleniyor...', { id: toastId });
                            
                            // 5 saniyelik bekleme süresi ekleyin - işlemin yayılması için
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        } else {
                            console.error('NFT Mint TON işlemi başarısız - geçersiz boc:', result);
                            toast.error("İşlem başarısız oldu! Geçersiz işlem sonucu.", { id: toastId });
                            throw new Error("Geçersiz işlem sonucu");
                        }
                    } catch (txError) {
                        console.error('NFT Mint TON işlem gönderme hatası:', txError);
                        
                        let txErrorMessage = "İşlem gönderilemedi";
                        if (txError instanceof Error) {
                            if (txError.message?.includes("magic")) {
                                txErrorMessage = "İşlem oluşturulurken hata oluştu. Lütfen TON cüzdanınızı kontrol edip tekrar deneyin.";
                            } else if (txError.message?.includes("reject") || txError.message?.includes("cancel")) {
                                txErrorMessage = "İşlem kullanıcı tarafından iptal edildi.";
                            } else if (txError.message?.includes("emulate")) {
                                txErrorMessage = "İşlem simülasyonu başarısız oldu. Lütfen TON bakiyenizi kontrol edin.";
                            }
                        }
                        
                        toast.error(txErrorMessage, { id: toastId });
                        throw new Error(txErrorMessage);
                    }
                } else {
                    throw new Error('NFT mintlemek için cüzdanınızı bağlayın.');
                }
                break;
            default:
                throw new Error('Geçersiz satın alma tipi');
        }

        toast.loading(`Sunucu ile ${purchaseType} işlemi doğrulanıyor...`, { id: toastId });

        // Call the RPC function AFTER potential TON transaction
        const newCarId = await userCarService.purchaseCar(user.id, model.id, purchaseType);

        if (newCarId !== null) {
            toast.success(`${model.name} (${purchaseType}) başarıyla satın alındı! ID: ${newCarId}`, { id: toastId });
            // Refresh user cars list
            const updatedCars = await userCarService.getUserCars(user.id);
            setUserCars(updatedCars);
            // selectedCar referansını kaldıralım - kullanılmıyor
            setActiveTab('my-cars'); // Switch to my cars tab
        } else {
            throw new Error(`${purchaseType} ile araç satın alma işlemi başarısız oldu (RPC).`);
        }

    } catch (error: any) {
      console.error(`${purchaseType} ile satın alma hatası:`, error);
      toast.error(error.message || `${purchaseType} ile satın alma sırasında hata oluştu.`, { id: toastId });
    } finally {
      setPurchaseLoading(null);
      // toast.dismiss(toastId); // Keep success/error message
    }
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
        toast.success(`${car.name} ile mining başarıyla başlatıldı!`, { id: toastId });
        
        // Araç listesi state'ini güncelle
        setUserCars(prevCars => prevCars.map(c => 
            c.id === car.id ? { ...c, status: CarStatus.MINING } : c
        ));
        
        // Mining oturumlarını yenile
        fetchMiningSessions();
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
      
      const toastId = toast.loading(`${car.name} tamir ediliyor...`);
      try {
          const success = await userCarService.repairCar(user.id, car.id);
          if (success) {
              toast.success(`${car.name} tamire alındı!`, { id: toastId });
              // Araçları yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
              // Mining oturumlarını yenile
              fetchMiningSessions();
                } else {
              throw new Error('Tamir işlemi başarısız oldu.');
          }
      } catch (error: any) {
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
      
      const toastId = toast.loading(`${car.name} yakıtı dolduruluyor...`);
      try {
          const success = await userCarService.refillCar(user.id, car.id);
          if (success) {
              toast.success(`${car.name} yakıtı dolduruldu!`, { id: toastId });
              // Araçları yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
              // Mining oturumlarını yenile
              fetchMiningSessions();
        } else {
              throw new Error('Yakıt doldurma işlemi başarısız oldu.');
          }
      } catch (error: any) {
          toast.error(error.message || 'Yakıt doldurma sırasında hata.', { id: toastId });
      }
  };

  // Tüm zamanlayıcıları temizle
  const clearAllTimers = useCallback(() => {
    Object.entries(timerRefs).forEach(([sessionId, timer]) => {
      if (timer) {
        clearInterval(timer);
      }
    });
    setTimerRefs({});
  }, []);

  // Mining oturumlarını ve zamanlayıcıları kur
  const setupMiningTimers = useCallback((sessions: MiningSession[]) => {
    // Temizlik için state kullan
    setShouldCleanup(true);
    
    // Her session için yeni timer kur
    const newTimerRefs: {[key: number]: NodeJS.Timeout | null} = {};
    const newTimeLeft: {[key: number]: string} = {};
    const newProgress: {[key: number]: number} = {};
    const newLocalSessions: {[key: number]: {endTime: number, startTime: number, status: string}} = {};
    
    sessions.forEach(session => {
      if (session.status === MiningStatus.ACTIVE) {
        // Yerel oturum bilgilerini kaydet
        newLocalSessions[session.id] = {
          endTime: new Date(session.end_time).getTime(),
          startTime: new Date(session.start_time).getTime(),
          status: session.status
        };
        
        const timer = setupTimer(
          new Date(session.end_time),
          (formattedTimeLeft, progressValue) => {
            setTimeLeft(prev => ({...prev, [session.id]: formattedTimeLeft}));
            setProgress(prev => ({...prev, [session.id]: progressValue}));
          },
          async () => {
            console.log(`Mining tamamlandı: Session ID ${session.id}`);
            // Yerel state'i güncelle, ekstra API çağrısı yapmak yerine
            setLocalMiningSessions(prev => {
              const updated = {...prev};
              if (updated[session.id]) {
                updated[session.id].status = MiningStatus.COMPLETED;
              }
              return updated;
            });
            
            // Sadece minimum gerekli güncellemeleri yap
            // Diğer API çağrılarını burada çağırmak yerine kullanıcı aksiyonu bekle
            // Veya setInterval ile daha uzun aralıklarla yap
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
    
    // Önce clearAllTimers çağırmak yerine, shouldCleanup true olduğunda useEffect içinde çağrılacak
    setTimerRefs(newTimerRefs);
    setTimeLeft(newTimeLeft);
    setProgress(newProgress);
    setLocalMiningSessions(prev => ({...prev, ...newLocalSessions}));
    
    // Temizlik yapıldı
    setShouldCleanup(false);
  }, [shouldCleanup]);

  // Temizlik için useEffect
  useEffect(() => {
    // shouldCleanup true olduğunda temizlik yap
    if (shouldCleanup) {
      clearAllTimers();
    }
  }, [shouldCleanup, clearAllTimers]);

  // LocalStorage'dan mining oturumlarını yükle
  useEffect(() => {
    const savedSessions = localStorage.getItem('miningSessionsData');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        setLocalMiningSessions(parsedSessions);
      } catch (e) {
        console.error('Kaydedilen mining oturumları çözümlenemedi:', e);
      }
    }
  }, []);

  // LocalStorage'a mining oturumlarını kaydet
  useEffect(() => {
    if (Object.keys(localMiningSessions).length > 0) {
      localStorage.setItem('miningSessionsData', JSON.stringify(localMiningSessions));
    }
  }, [localMiningSessions]);

  // Aktif mining oturumlarını getir - artık daha az sıklıkta
  const fetchMiningSessions = useCallback(async () => {
    if (!user?.id) return;
    
    const now = Date.now();
    // Son API çağrısından bu yana en az 60 saniye geçmiş mi kontrol et
    if (now - lastUpdateTime < 60000) {
      console.log('[CarPage] Son API çağrısından bu yana 60 saniye geçmedi, çağrı atlanıyor');
      return;
    }
    
    try {
      const sessions = await miningService.getAllActiveMiningSessions(user.id);
      console.log('[CarPage] Mining oturumları:', sessions);
      setActiveMiningSessions(sessions);
      setupMiningTimers(sessions);
      setLastUpdateTime(now);
    } catch (err) {
      console.error('[CarPage] Mining oturumları yüklenirken hata:', err);
    }
  }, [user?.id, setupMiningTimers, lastUpdateTime]);

  // Mining oturumlarını sayfa yüklendiğinde ve kullanıcı değiştiğinde getir
  useEffect(() => {
    if (user?.id && !isUserLoading) {
      fetchMiningSessions();
      
      // Düzenli kontrol için 5 dakikalık interval
      const checkInterval = setInterval(() => {
        fetchMiningSessions();
      }, 300000); // 5 dakika
      
      return () => {
        clearInterval(checkInterval);
        // useEffect temizlik fonksiyonunda doğrudan callbackleri çağırmak yerine state kullan
        setShouldCleanup(true);
      };
    }
  }, [user?.id, isUserLoading, fetchMiningSessions]);

  // Araç mining'de mi kontrol et
  const isCarMining = (carId: number) => {
    // Aktif session'lardan kontrol et
    const isActiveInSessions = activeMiningSessions.some(session => 
      session.car_id === carId && 
      session.status === MiningStatus.ACTIVE
    );
    
    // Eğer aktif session'larda yoksa, yerel state'ten kontrol et
    if (!isActiveInSessions) {
      // LocalSessions'da bu araç ID'sine sahip bir session var mı?
      const carSessions = Object.entries(localMiningSessions).filter(([_, session]) => {
        const associatedSession = activeMiningSessions.find(s => s.id === parseInt(_));
        return associatedSession && associatedSession.car_id === carId && session.status === MiningStatus.ACTIVE;
      });
      
      return carSessions.length > 0;
    }
    
    return isActiveInSessions;
  };

  // Araç için mining oturumunu bul
  const getMiningSessionForCar = (carId: number) => {
    return activeMiningSessions.find(session => 
      session.car_id === carId
    );
  };

  // Yükleme durumu
  if (isUserLoading || (isLoading && (!userCars.length || !availableModels.length))) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7b2ff7]"></div>
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
          className="mt-3 bg-[#7b2ff7] text-white px-4 py-2 rounded-lg"
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
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Araç Yönetimi</h1>
      </div>
      
      <div className="space-y-5">
        {/* Sekme Butonları */}
        <div className="flex justify-between bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-1.5 shadow-lg border border-[#2a3855]">
          {/* Buttons remain the same */}
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'my-cars' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
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
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'market' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
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
            <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] bg-opacity-80 rounded-xl p-5 shadow-lg border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Araçlarım ({userCars.length})</h3>
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
                  const isCarMiningNow = isCarMining(car.id);
                  const miningSession = getMiningSessionForCar(car.id);
                  
                  return (
                    <div 
                      key={car.id} 
                      className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-lg overflow-hidden transition-all duration-300 hover:translate-y-[-2px] border border-[#2a3855] hover:border-[#3a497a]"
                    >
                      <div className="flex flex-col">
                        {/* Araç Görseli (Use image_url) */}
                        <div className="relative w-full aspect-[16/9]">
                          {/* Mining durumu için ek badge */}
                          {isCarMiningNow && miningSession && (
                            <div className="absolute top-2 right-2 z-10 bg-[#0f3460]/80 rounded-full px-2 py-1 text-xs flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-[#2ff7c1] font-mono">{timeLeft[miningSession.id] || '--:--:--'}</span>
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
                              <div className="w-full bg-[#2a3855] rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#2ff7c1] via-[#6af7c1] to-[#a5f7c1] h-full rounded-full transition-all duration-500" style={{ width: `${car.fuel}%` }}></div>
                              </div>
                            </div>
                             {/* Condition bar ... */}
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Durum</span>
                                <span>%{car.condition}</span>
                              </div>
                              <div className="w-full bg-[#2a3855] rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#2f7bf7] via-[#4f6cf8] to-[#7b2ff7] h-full rounded-full transition-all duration-500" style={{ width: `${car.condition}%` }}></div>
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
                                    className="h-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7]"
                                    style={{ width: `${progress[miningSession.id] || 0}%` }}
                                  ></div>
                          </div>
                        </div>
                            )}
                      </div>
              </div>
            </div>
            
                      {/* Araç Kontrol Butonları - Her araç için göster */}
                      <div className="p-3 border-t border-[#2a3855]/30 flex flex-wrap gap-2">
                        {/* Mining Başlat Butonu */}
                        {car.status === CarStatus.ACTIVE && (
                          <button
                            onClick={() => handleStartMining(car.id)}
                            disabled={car.fuel < 25 || car.condition < 10 || isMiningStarting[car.id]}
                            className={`flex-1 py-2 text-xs rounded-lg font-medium transition-all duration-300 
                              ${car.fuel < 25 || car.condition < 10 ? 
                                'bg-[#1a1a2e] text-gray-500 cursor-not-allowed' : 
                                'bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7] text-white hover:shadow-md hover:shadow-[#7b2ff7]/20'
                              }`}
                          >
                            {isMiningStarting[car.id] ? 'Başlatılıyor...' : 'Mining Başlat'}
                          </button>
                        )}
                        
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
                        
                        {/* Araç Mining'de ise durum bilgisi */}
                        {car.status === CarStatus.MINING && (
                          <div className="w-full py-2 text-xs rounded-lg font-medium bg-[#1a1a2e]/70 text-[#2ff7c1] text-center flex flex-col items-center justify-center">
                      <div className="flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                              <span>Mining Yapıyor</span>
                    </div>
                    
                            {/* Kalan süre bilgisi */}
                            {(() => {
                              const session = getMiningSessionForCar(car.id);
                              if (session && session.status === MiningStatus.ACTIVE) {
                                return (
                                  <div className="mt-1 flex flex-col">
                                    <span className="font-mono text-[#2ff7c1]">
                                      {timeLeft[session.id] || '--:--:--'}
                                    </span>
                                    <div className="w-full h-1.5 bg-[#0d1423] rounded-full overflow-hidden mt-1">
                                      <div 
                                        className="h-full bg-gradient-to-r from-[#2f7bf7] to-[#7b2ff7]"
                                        style={{ width: `${progress[session.id] || 0}%` }}
                                      ></div>
                          </div>
                          </div>
                                );
                              }
                              return null;
                            })()}
                      </div>
                      )}
                        
                        {/* Tamir edilme durumunda */}
                        {car.status === CarStatus.REPAIRING && (
                          <div className="w-full py-2 text-xs rounded-lg font-medium bg-[#1a1a2e]/70 text-yellow-500 text-center flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            Tamirde...
                    </div>
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
            <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl p-5 shadow-lg border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Araç Modelleri</h3>
              <p className="text-gray-400 text-sm mb-4">
                 Farklı nadirliklerdeki araçları NMFP, TON ile satın alabilir veya NFT olarak mintleyebilirsiniz.
              </p>
              
              {/* Market Filtresi (Series mantığı gözden geçirilmeli) */}
              <div className="flex overflow-x-auto pb-2 mb-4 space-x-2 scrollbar-hide">
                 {/* Filter buttons ... (Logic might need change based on how series is handled) */}
                <button
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${ activeSeriesFilter === null ? 'bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white' : 'bg-[#16213e] text-gray-300 hover:bg-[#1a253a]' }`}
                  onClick={() => setActiveSeriesFilter(null)}
                >
                  Tüm Modeller
                </button>
                  {/* Example static filters (replace with dynamic if needed) */}
                 {['911', 'Taycan', 'Cayenne', 'Panamera', 'Macan', '718'].map(series => (
                  <button
                    key={series}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${ activeSeriesFilter === series ? 'bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white' : 'bg-[#16213e] text-gray-300 hover:bg-[#1a253a]' }`}
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
                      className="bg-gradient-to-r from-[#0f3460]/90 to-[#0a1936]/90 rounded-xl overflow-hidden border border-[#2a3855] transition-all duration-300 hover:border-[#4a5886] shadow-lg flex flex-col"
                    >
                      {/* Araç Görseli */}
                      <div className="relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-r from-[#16213e] to-[#0f3460]">
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
                      <div className="p-5 border-t border-b border-[#2a3855] bg-gradient-to-r from-[#0f3460]/50 to-[#1a1a2e]/50">
                         {/* ... Model name, mining power, rarity display (using model.mining_power, model.rarity) ... */}
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                          <div>
                            <h3 className="font-bold text-2xl text-white mb-3">{model.name}</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Madencilik Gücü</p>
                                <p className="font-medium text-white flex items-center">
                                  {/* ... icon ... */}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#7b2ff7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      
                      {/* NFT Limit Bilgisi */}
                      <div className="px-5 py-3 border-b border-[#2a3855] bg-gradient-to-r from-[#0f3460]/30 to-[#1a1a2e]/30">
                         {/* NFT Limit display using model.nft_limit */}
                        <p className="text-gray-400 text-xs mb-1">NFT Limiti</p>
                        <div className="flex items-center">
                          <div className="w-full bg-[#2a3855] rounded-full h-2 mr-3">
                            {/* TODO: Need current minted count from somewhere if progress bar is desired */}
                            <div 
                              className="bg-gradient-to-r from-[#2f7bf7] to-[#5f40f8] h-full rounded-full" 
                              style={{ width: `0%` }} // Placeholder, need minted count
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-white">0 / {model.nft_limit ?? '∞'}</span>
                        </div>
                      </div>
                      
                      {/* Satın Alma Butonları */}
                      <div className="p-5 flex flex-col gap-3">
                        {/* Buy with NMFP Button */}
                        <button 
                          className={`bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30 flex items-center justify-between ${purchaseLoading === `NMFP-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
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
                        {/* Buy with TON Button */}
                        <button 
                          type="button"
                          className={`bg-gradient-to-r from-[#0088cc] to-[#00a2e0] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#0088cc]/30 flex items-center justify-between ${purchaseLoading === `TON-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
                          onClick={() => handlePurchase(model, 'TON')}
                          disabled={purchaseLoading === `TON-${model.id}` || !tonConnectUI.connected}
                        >
                           {purchaseLoading === `TON-${model.id}` ? 'İşleniyor...' : (
                              <>
                          <div className="flex items-center">
                                  {/* ... icon ... */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                                  <span>{tonConnectUI.connected ? 'TON ile Satın Al' : 'Cüzdan Bağla'}</span>
                          </div>
                                <span className="font-semibold">{model.ton_price}</span>
                              </>
                            )}
                        </button>
                        {/* Mint NFT Button */}
                        <button 
                          className={`bg-gradient-to-r from-[#00ff88] to-[#00cc88] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#00ff88]/30 flex items-center justify-between ${purchaseLoading === `NFT-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
                           onClick={() => handlePurchase(model, 'NFT')}
                           disabled={purchaseLoading === `NFT-${model.id}` || !tonConnectUI.connected}
                        >
                           {purchaseLoading === `NFT-${model.id}` ? 'İşleniyor...' : (
                            <>
                              <div className="flex items-center">
                                  {/* ... icon ... */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                  <span>{tonConnectUI.connected ? 'NFT Olarak Mintle' : 'Cüzdan Bağla'}</span>
                              </div>
                                <span className="font-semibold">{model.nft_mint_price} TON</span>
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