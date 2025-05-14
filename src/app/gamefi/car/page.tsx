'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';
import { 
  CarModel, 
  UserCar, 
  Rarity,
  CarStatus,
  User // Import User type
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

export default function CarPage() {
  const { user, isLoading: isUserLoading, error: userError } = useTelegram(); // Get user from context

  const [activeTab, setActiveTab] = useState('my-cars');
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<UserCar | null>(null);
  const [availableModels, setAvailableModels] = useState<CarModel[]>([]);
  const [activeSeriesFilter, setActiveSeriesFilter] = useState<string | null>(null); // Series filtering might need adjustment as 'series' is not in DB schema
  const [isLoading, setIsLoading] = useState<boolean>(true); // Separate loading state for car/model data
  const [error, setError] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  // const [userNMFP, setUserNMFP] = useState(10000); // User NMFP comes from the 'user' context object now
  // const [isConnected, setIsConnected] = useState(false); // TonConnect manages connection state
  const [mintLoading, setMintLoading] = useState<string | null>(null); // Keep for UI feedback during mint
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null); // Keep for UI feedback during purchase
  const [isMiningStarting, setIsMiningStarting] = useState<boolean>(false); // Mining başlatma loading state'i

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
        if (cars.length > 0) {
            // Check if selectedCar exists and its id is valid before accessing it
            const selectedCarId = selectedCar ? selectedCar.id : null;
            // Find if the currently selected car (if any) exists in the newly fetched list
            const currentSelectedCarExists = selectedCarId !== null && cars.some((c: UserCar) => c.id === selectedCarId);

            // Select the first car only if no car is currently selected OR if the selected car is no longer in the list
            if (selectedCarId === null || !currentSelectedCarExists) {
                setSelectedCar(cars[0]);
            }
        } else {
           // If no cars are returned, clear selection
           setSelectedCar(null);
        }
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
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                 // TODO: Add TON balance check if available in 'user' object
                if (user.ton_coins < purchasePrice) {
                     throw new Error(`Yetersiz ${currency}. Gerekli: ${purchasePrice}, Mevcut: ${user.ton_coins}`);
                }
                // TON transaction logic (if not handled solely by RPC)
                if (tonConnectUI.connected && tonConnectUI.account?.address) {
                     const nanoTonAmount = toNano(purchasePrice.toString()).toString();
                     const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY'; // Use actual game wallet
                     const transaction = {
                         validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
                         messages: [
        {
          address: gameWalletAddress,
          amount: nanoTonAmount,
                                 payload: `Purchase Car TON: ${model.id}` // Include model ID
        }
                         ]
                     };
                     toast.loading('TON işlemi onaylanıyor...', { id: toastId });
                     await tonConnectUI.sendTransaction(transaction); // Wait for transaction sending
                      toast.loading('TON işlemi gönderildi, RPC bekleniyor...', { id: toastId });
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
                    const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY'; // Use actual game wallet or NFT collection address?
                    const transaction = {
                        validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
                        messages: [
                            {
                                address: gameWalletAddress, // Or Collection Address?
                                amount: nanoTonAmount,
                                payload: `Mint Car NFT: ${model.id}` // Include model ID
                                // Potentially add NFT mint specific payload if needed
                            }
                        ]
                    };
                    toast.loading('NFT Mint işlemi için TON onayı bekleniyor...', { id: toastId });
                    await tonConnectUI.sendTransaction(transaction); // Wait for transaction sending
                     toast.loading('TON işlemi gönderildi, RPC bekleniyor...', { id: toastId });
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
            // Select the first car if no car is selected, OR if the selected car is not in the new list
            if (updatedCars.length > 0) {
                 const currentSelectedCarIsInList = selectedCar ? updatedCars.some(c => c.id === selectedCar.id) : false;
                 if (!selectedCar || !currentSelectedCarIsInList) {
                     setSelectedCar(updatedCars[0]);
      }
            }
            // Optionally switch tab or update user balance display
            // const updatedUser = await userService.getUserById(user.id);
            // if (updatedUser) setUser(updatedUser); // Assumes setUser is available from context/props
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
  const handleStartMining = async () => {
    if (!user || !user.id) {
      toast.error('Mining başlatmak için kullanıcı bilgisi gerekli.');
      return;
    }
    if (!selectedCar || !selectedCar.id) {
      toast.error('Lütfen mining başlatmak için bir araç seçin.');
      return;
    }
    // Araç uygun durumda mı kontrolü (Örn: Aktif, yakıtı/kondisyonu yeterli)
    if (selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active') {
        toast.error('Bu araç şu anda mining için uygun değil (Durum: ' + selectedCar.status + ').');
        return;
    }
    if (selectedCar.fuel <= 0) {
        toast.error('Mining başlatmak için aracın yakıtı olmalı.');
        return;
    }
     if (selectedCar.condition <= 0) {
        toast.error('Mining başlatmak için aracın durumu iyi olmalı.');
        return;
    }

    setIsMiningStarting(true);
    const toastId = toast.loading(`${selectedCar.name} ile mining başlatılıyor...`);

    try {
      // miningService.startMining çağrısı
      const newSessionId = await miningService.startMining(user.id, selectedCar.id, selectedCar.garage_id);

      if (newSessionId !== null) {
        toast.success(`${selectedCar.name} ile mining başarıyla başlatıldı! Session ID: ${newSessionId}`, { id: toastId });
        
        // Arayüzü güncelle: Seçili aracın durumunu değiştir
        setSelectedCar(prev => prev ? { ...prev, status: CarStatus.MINING } : null);
        
        // Araç listesi state'ini de güncelle (daha sağlam yöntem)
        setUserCars(prevCars => prevCars.map(car => 
            car.id === selectedCar.id ? { ...car, status: CarStatus.MINING } : car
        ));
        
        // İsteğe bağlı: Kullanıcıyı mining sayfasına yönlendir veya aktif oturumu gösteren bir UI güncellemesi yap
        // Örneğin: setActiveTab('mining-status'); // Eğer böyle bir tab varsa

      } else {
        // API null döndürdüyse (beklenmedik durum veya RPC'den gelen null)
        throw new Error('Mining oturumu başlatılamadı (API den null yanıt).');
      }

    } catch (error: any) {
      console.error('Mining başlatma hatası:', error);
      toast.error(error.message || 'Mining başlatılırken bir hata oluştu.', { id: toastId });
    } finally {
      setIsMiningStarting(false);
      // toast.dismiss(toastId); // Başarı/hata mesajını tutmak daha iyi olabilir
    }
  };

  // Araç tamir ve yakıt fonksiyonları
  const handleRepairCar = async (car: UserCar) => {
      if (!user || !user.id) return;
      const toastId = toast.loading(`${car.name} tamir ediliyor...`);
      try {
          const success = await userCarService.repairCar(user.id, car.id);
          if (success) {
              toast.success(`${car.name} tamire alındı!`, { id: toastId });
              // Listeyi yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
               // Seçili aracı da güncelle
              const updatedSelected = updatedCars.find(c => c.id === car.id);
              if (updatedSelected) setSelectedCar(updatedSelected);
                } else {
              // userCarService.repairCar içinde hata zaten handleSupabaseError ile loglandı/fırlatıldı
              // toast.error içinde zaten hata mesajı gösteriliyor olmalı
              throw new Error('Tamir işlemi başarısız oldu.'); // Ensure toast shows error
          }
      } catch (error: any) {
          toast.error(error.message || 'Tamir sırasında hata.', { id: toastId });
      }
  };

   const handleRefillCar = async (car: UserCar) => {
      if (!user || !user.id) return;
      const toastId = toast.loading(`${car.name} yakıtı dolduruluyor...`);
      try {
          const success = await userCarService.refillCar(user.id, car.id);
          if (success) {
              toast.success(`${car.name} yakıtı dolduruldu!`, { id: toastId });
              // Listeyi yenile
              const updatedCars = await userCarService.getUserCars(user.id);
              setUserCars(updatedCars);
               // Seçili aracı da güncelle
              const updatedSelected = updatedCars.find(c => c.id === car.id);
              if (updatedSelected) setSelectedCar(updatedSelected);
        } else {
              throw new Error('Yakıt doldurma işlemi başarısız oldu.');
          }
      } catch (error: any) {
          toast.error(error.message || 'Yakıt doldurma sırasında hata.', { id: toastId });
      }
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
    <div className="pb-12">
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
                  
                  return (
                    <div 
                      key={car.id} 
                      className={`bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:translate-y-[-2px] ${selectedCar?.id === car.id ? 'border-2 border-[#7b2ff7] shadow-[0_0_15px_rgba(123,47,247,0.5)]' : 'border border-[#2a3855] hover:border-[#3a497a]'}`}
                      onClick={() => setSelectedCar(car)}
                    >
                      <div className="flex flex-col">
                        {/* Araç Görseli (Use image_url) */}
                        <div className="relative w-full aspect-[16/9]">
                          {/* ... gradient overlay ... */}
                          <Image
                            src={carModel.image_url || '/placeholder-car.png'} // Use image_url
                            alt={car.name}
                            width={300}
                            height={169}
                            className="object-contain w-full h-full"
                          />
                           {/* Level kaldırıldı, istersen eklenebilir */}
                           {/* <div className="absolute top-2 right-2 ...">Lvl {car.level}</div> */}
                        </div>
                        
                        {/* Araç Bilgileri */}
                        <div className="p-4 space-y-2">
                          <div>
                            <h4 className="font-semibold text-white text-lg">{car.name}</h4>
                            <div className="mt-1 flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full ${getRarityClass(carModel.rarity)} mr-2 animate-pulse`}></span>
                              {/* Series kaldırıldı, name'den alınabilir veya gösterilmeyebilir */}
                              {/* <span className="text-sm text-gray-300">{carModel.series}</span> <span className="mx-2 text-gray-500">|</span> */}
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
                            {/* Garage info (garage_id üzerinden fetch edilebilir veya gösterilmeyebilir) */}
                            {/* <div className="text-xs ...">{car.inGarage}</div> */}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Seçili Araç Detayları */}
            {selectedCar && selectedCar.car_model && ( // Ensure selectedCar and its model exist
              <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl overflow-hidden p-5 relative shadow-lg border border-[#0f3460]">
                <div className="grid grid-cols-1 gap-4">
                  {/* Araç Görseli ve İsim */}
                  <div>
                    <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden">
                      {/* ... gradient overlay ... */}
                      <Image 
                        src={selectedCar.car_model.image_url || '/placeholder-car.png'}
                        alt={selectedCar.name}
                        width={500}
                        height={281}
                        className="object-contain w-full h-full mx-auto"
                      />
                      {/* Level kaldırıldı */}
                      {/* <div className="absolute bottom-2 right-2 ...">{selectedCar.level}</div> */}
                        </div>
                    <div className="text-center mt-3">
                      <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-[#7b2ff7] to-white">{selectedCar.name}</h2>
                      {/* Brand kaldırıldı */}
                      {/* <p className="text-gray-400">{selectedCar.car_model.brand}</p> */}
                    </div>
                  </div>
                  
                  {/* Bilgiler ve Butonlar */}
                  <div className="space-y-4">
                    {/* Rarity & Mining Power */}
                    <div className="flex justify-between items-center bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-lg p-3 border border-[#2a3855]">
                      <div className="flex items-center">
                        <span className={`inline-block w-3 h-3 rounded-full ${getRarityClass(selectedCar.car_model.rarity)} mr-2 animate-pulse`}></span>
                        <span className="text-sm font-medium">{selectedCar.car_model.rarity}</span>
                      </div>
                      <div className="flex items-center text-[#7b2ff7]">
                        {/* ... icon ... */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{formatCurrency(selectedCar.car_model.mining_power)} NMFP/saat</span>
                      </div>
                    </div>
                    
                    {/* Araç Durumu (Fuel/Condition) */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">Araç Durumu</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {/* Fuel bar ... */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Yakıt</span>
                            <span>%{selectedCar.fuel}</span>
                          </div>
                          <div className="w-full bg-[#2a3855] rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-[#2ff7c1] via-[#6af7c1] to-[#a5f7c1] h-full rounded-full transition-all duration-500" style={{ width: `${selectedCar.fuel}%` }}></div>
                          </div>
                        </div>
                         {/* Condition bar ... */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Durum</span>
                            <span>%{selectedCar.condition}</span>
                          </div>
                          <div className="w-full bg-[#2a3855] rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-[#2f7bf7] via-[#4f6cf8] to-[#7b2ff7] h-full rounded-full transition-all duration-500" style={{ width: `${selectedCar.condition}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status & Garage Info */}
                    <div className="flex justify-between items-center text-sm bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-lg p-3 border border-[#2a3855]">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Durum</p>
                        <div>{getStatusInfo(selectedCar)}</div>
                      </div>
                      {/* Garage info (eğer varsa) */}
                      {selectedCar.garage_id && (
                      <div className="text-right">
                          <p className="text-gray-400 text-xs mb-1">Garaj ID</p>
                           {/* TODO: Fetch garage name based on garage_id if needed */}
                          <p className="font-medium bg-gradient-to-r from-[#7b2ff7]/20 to-[#2f7bf7]/20 px-3 py-1 rounded-full text-[#7b2ff7]">{selectedCar.garage_id}</p>
                      </div>
                      )}
                    </div>
                    
                    {/* Eylem Butonları */}
                    <div className="grid grid-cols-2 gap-4 mt-3">
                       {/* Mining Başlat butonu */}
                      <button 
                        className={`py-2.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center ${selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active' ? 'bg-[#2a3855] text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white hover:shadow-lg hover:shadow-[#7b2ff7]/30'} ${isMiningStarting ? 'opacity-50 cursor-wait' : ''}`}
                        disabled={selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active' || isMiningStarting}
                        onClick={handleStartMining}
                      >
                         {isMiningStarting ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Başlatılıyor...
                            </>
                         ) : 'Mining Başlat'} 
                      </button>
                       {/* Onar butonu (userCarService.repairCar çağrılacak) */}
                      <button 
                        className={`py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${selectedCar.condition >= 80 || (selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active') ? 'bg-[#2a3855] text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#2a3855] via-[#1a1a2e] to-[#0f3460] hover:from-[#3a497a] hover:via-[#2a3855] hover:to-[#16213e] text-white hover:shadow-lg'}`}
                        disabled={selectedCar.condition >= 80 || (selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active')}
                        onClick={() => handleRepairCar(selectedCar)}
                      >
                        Onar ({selectedCar.car_model.repair_cost} NMFP)
                      </button>
                       {/* Yakıt Doldur butonu (userCarService.refillCar çağrılacak) */}
                       <button 
                        className={`py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${selectedCar.fuel >= 80 || (selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active') ? 'bg-[#2a3855] text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#2a3855] via-[#1a1a2e] to-[#0f3460] hover:from-[#3a497a] hover:via-[#2a3855] hover:to-[#16213e] text-white hover:shadow-lg'}`}
                        disabled={selectedCar.fuel >= 80 || (selectedCar.status !== CarStatus.ACTIVE && selectedCar.status !== 'active')}
                        onClick={() => handleRefillCar(selectedCar)}
                       >
                           Yakıt Doldur ({selectedCar.car_model.refill_cost} NMFP)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                          disabled={purchaseLoading === `TON-${model.id}`}
                        >
                           {purchaseLoading === `TON-${model.id}` ? 'İşleniyor...' : (
                              <>
                          <div className="flex items-center">
                                  {/* ... icon ... */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                                  <span>TON ile Satın Al</span>
                          </div>
                                <span className="font-semibold">{model.ton_price}</span>
                              </>
                            )}
                        </button>
                        {/* Mint NFT Button */}
                        <button 
                          className={`bg-gradient-to-r from-[#00ff88] to-[#00cc88] text-white py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#00ff88]/30 flex items-center justify-between ${purchaseLoading === `NFT-${model.id}` ? 'opacity-50 cursor-wait' : ''}`}
                           onClick={() => handlePurchase(model, 'NFT')}
                           disabled={purchaseLoading === `NFT-${model.id}`}
                        >
                           {purchaseLoading === `NFT-${model.id}` ? 'İşleniyor...' : (
                            <>
                              <div className="flex items-center">
                                  {/* ... icon ... */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                  <span>NFT Olarak Mintle</span>
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