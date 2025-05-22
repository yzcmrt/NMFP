'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { toast } from 'react-hot-toast';
import { toNano } from '@ton/core';
import { supabase } from '@/lib/supabaseClient';

// Import types (GarageTemplate eklendi, Garage sadeleşti)
import { Garage, User, GarageTemplate } from '@/types'; 
// Import services
import { garageService } from '@/services/api';
// Import context hook
import { useTelegram } from '@/components/TelegramInitProvider';

// Mock data is removed
// const garages = [ ... ];
// const nmfpGarages = [ ... ];
// const preGarages = [ ... ];

export default function GaragePage() {
  const { user, isLoading: isUserLoading, error: userError } = useTelegram(); // Get user from context

  const [activeTab, setActiveTab] = useState('garages');
  const [storeTab, setStoreTab] = useState('nmfp'); // 'nmfp' veya 'ton'
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const [userGarages, setUserGarages] = useState<Garage[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<GarageTemplate[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null); // Loading state for purchases
  // const [userPoints, setUserPoints] = useState(10000); // Removed, use user.balance from context
  
  // Fetch user garages
  useEffect(() => {
    const fetchUserGarages = async () => {
      if (!user || !user.id) {
          console.warn('>>> garage/page.tsx - fetchUserGarages - Kullanıcı veya ID yok, API çağrısı atlanıyor.');
        return;
      }
      
      console.log(`>>> garage/page.tsx - fetchUserGarages - API çağrısı yapılacak kullanıcı ID: ${user.id}`);

      try {
        // --- AUTH KONTROL BLOĞU KALDIRILDI ---
        // supabase.auth.getSession(), supabase.auth.getUser() ve ID karşılaştırması kaldırıldı.
        // Artık sadece context'ten gelen user nesnesine güveniyoruz.

        setIsLoading(true);
        setError(null);
        const garages = await garageService.getUserGarages(user.id);
        console.log('>>> garage/page.tsx - fetchUserGarages - Gelen Garajlar:', garages);
        setUserGarages(garages);
      } catch (err: any) {
        console.error('Kullanıcı garajları yükleme hatası:', err);
        setError(err.message || 'Garajlarım yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user && !isUserLoading) {
      fetchUserGarages();
    }
  }, [user, isUserLoading]);

  // Fetch available garage templates
  useEffect(() => {
    const fetchAvailableTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const templates = await garageService.getGarageTemplates();
         // Ensure image_url starts with /
         const processedTemplates = templates.map(template => ({
          ...template,
          image: template.image && !template.image.startsWith('/') 
                       ? `/${template.image}` 
                       : template.image,
        }));
        setAvailableTemplates(processedTemplates);
      } catch (err: any) {
        console.error('Garaj şablonları yükleme hatası:', err);
        setError(err.message || 'Garaj şablonları yüklenirken bir hata oluştu.');
      } finally {
      setIsLoading(false);
    }
  };
  
    fetchAvailableTemplates();
  }, []);

  // Combined purchase handler
  const handlePurchaseGarage = async (template: GarageTemplate, purchaseType: 'nmfp' | 'ton' | string) => {
    if (!user || !user.id) {
      toast.error('Satın alma işlemi için kullanıcı bilgisi gerekli.');
        return;
      }
     if (!template || !template.id) {
        toast.error('Geçersiz garaj şablonu bilgisi.');
        return;
      }

    const loadingKey = `${purchaseType}-${template.id}`;
    setPurchaseLoading(loadingKey);
    const toastId = toast.loading(`${purchaseType.toUpperCase()} ile ${template.name} satın alma işlemi başlatılıyor...`);

    try {
        let purchasePrice: number;
        let currency: string;

        // Check purchase type based on the template's property
        if (template.purchase_type === 'nmfp') {
            purchasePrice = template.price; // Use template.price
            currency = 'NMFP';
            if (user.balance < purchasePrice) {
                throw new Error(`Yetersiz ${currency}. Gerekli: ${formatCurrency(purchasePrice)}, Mevcut: ${formatCurrency(user.balance)}`);
            }
        } else if (template.purchase_type === 'ton') {
            purchasePrice = template.price; // Use template.price
            currency = 'TON';
             // TON bakiye kontrolünü kaldırıyoruz - kullanıcı gerçek cüzdanında TON'a sahip olabilir
             
            // TON transaction logic
            if (tonConnectUI.connected && tonConnectUI.account?.address) {
                 const nanoTonAmount = toNano(purchasePrice.toString()).toString();
                 const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'EQBYLZxVdTZVmdzEHhxjZ7aY7HnXVgQCUmXQ69cmPwFTGHxY';
                 
                 // İşlem geçerlilik süresi (20 dakika)
                 const validUntil = Math.floor(Date.now() / 1000) + 60 * 20;
                 
                 // Basitleştirilmiş işlem yapısı - payload'sız sürüm
                 const transaction = {
                     validUntil: validUntil,
                     messages: [
                         {
                             address: gameWalletAddress,
                             amount: nanoTonAmount
                             // payload alanı kaldırıldı - BOC oluşturma hatasını önlemek için
                         }
                     ]
                 };
                 
                 toast.loading('TON işlemi onaylanıyor...', { id: toastId });
                 
                 try {
                     // İşlemi gönder ve sonucu bekle
                     const result = await tonConnectUI.sendTransaction(transaction);
                     
                     if (result && result.boc) {
                         console.log('TON garaj satın alma işlem sonucu başarılı:', { 
                             bocLength: result.boc.length,
                             hasValidBoc: true
                         });
                         
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
        } else {
            throw new Error('Bu garaj şablonu satın alınamaz veya geçersiz tip.');
        }

        toast.loading(`Sunucu ile ${currency} işlemi doğrulanıyor...`, { id: toastId });

        // Call the RPC function AFTER potential TON transaction
        // Pass template.id (string) and template.purchase_type
        const newGarageId = await garageService.purchaseGarage(user.id, template.id, template.purchase_type);

        if (newGarageId) {
            toast.success(`${template.name} (${template.purchase_type.toUpperCase()}) başarıyla satın alındı!`, { id: toastId });
            // Refresh user garages list
            const updatedGarages = await garageService.getUserGarages(user.id);
            setUserGarages(updatedGarages);
            setActiveTab('garages'); // Switch to my garages tab
             // Refresh user data (context doesn't auto-refresh balance yet)
             // Maybe trigger context refresh here if provider supports it
        } else {
            throw new Error(`${template.purchase_type.toUpperCase()} ile garaj satın alma işlemi başarısız oldu (RPC).`);
        }

    } catch (error: any) {
      console.error(`${template.purchase_type} ile garaj satın alma hatası:`, error);
      toast.error(error.message || `${template.purchase_type.toUpperCase()} ile garaj satın alma sırasında hata oluştu.`, { id: toastId });
      } finally {
      setPurchaseLoading(null);
      }
  };

  // Helper to filter templates by purchase method
  const getNMFPGarages = (): GarageTemplate[] => availableTemplates.filter(t => t.purchase_type === 'nmfp');
  const getTONGarages = (): GarageTemplate[] => availableTemplates.filter(t => t.purchase_type === 'ton');
  
  // Loading/Error States
   if (isUserLoading || (isLoading && (!userGarages.length || !availableTemplates.length))) {
     return (
       <div className="flex items-center justify-center min-h-[300px]">
         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7b2ff7]"></div>
       </div>
     );
   }
 
   if (userError || error) {
     return (
       <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 text-center">
         <p className="text-red-500">{userError || error}</p>
         <button
           onClick={() => window.location.reload()}
           className="mt-3 bg-[#7b2ff7] text-white px-4 py-2 rounded-lg"
         >
           Yeniden Dene
         </button>
       </div>
     );
   }
 
   if (!user) {
       return (
         <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 text-center">
           <p className="text-yellow-500">Kullanıcı bilgileri yüklenemedi. Lütfen Telegram uygulamasından tekrar deneyin.</p>
         </div>
       );
    }
  
  return (
    <div className="pb-12">
      {/* Sayfa Başlığı */}
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Garaj Yönetimi</h1>
      </div>
      
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex justify-between bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-1.5 shadow-lg border border-[#2a3855]">
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'garages' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
            onClick={() => setActiveTab('garages')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm8 8V7h2v6h-2zM9 3v2H7V3h2zm0 12v2H7v-2h2z" clipRule="evenodd" />
              </svg>
              <span>Garajlarım ({userGarages.length})</span>
            </div>
          </button>
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'store' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
            onClick={() => setActiveTab('store')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              <span>Pazar</span>
            </div>
          </button>
        </div>
        
        {activeTab === 'garages' ? (
           /* User Garages Tab */
          <div className="space-y-4">
             {userGarages.length === 0 && !isLoading && (
                 <p className="text-center text-gray-400 py-4">Henüz hiç garajınız yok. Pazar sekmesinden yeni garajlar edinebilirsiniz.</p>
             )}
            {userGarages.map(garage => (
              <div key={garage.id} className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl overflow-hidden border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
                {/* Garage Image */}
                <div className="relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-r from-[#16213e] to-[#0f3460]">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f3460] to-transparent opacity-30 z-10"></div>
                  {garage.image_url && (
                    <Image
                      src={garage.image_url}
                      alt={garage.name}
                      width={800}
                      height={450}
                      className="object-contain w-full h-full p-2 mx-auto transform scale-110"
                      quality={90}
                    />
                  )}
                   {!garage.image_url && (
                     <div className="w-full h-full flex items-center justify-center bg-gray-700/50">
                       <p className="text-gray-400">Görsel Yok</p>
                     </div>
                  )}
                </div>
                
                {/* Garage Details */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-white">{garage.name}</h3>
                     {/* TODO: Show garage value? Maybe template price? */}
                    {/* <span className="text-[#2ff7c1] font-semibold">... NMFP</span> */}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {/* Capacity */}
                    <div className="bg-[#1a1a2e] p-3 rounded-lg border border-[#2a3855]/50">
                      <p className="text-xs text-gray-400">Kapasite</p>
                       {/* occupied needs to be calculated/fetched if needed */}
                      <p className="font-medium text-white">?/{garage.capacity}</p>
                    </div>
                    {/* Daily Bonus */}
                    <div className="bg-[#1a1a2e] p-3 rounded-lg border border-[#2a3855]/50">
                      <p className="text-xs text-gray-400">Günlük Bonus</p>
                      <p className="font-medium text-[#2ff7c1]">+{formatCurrency(garage.daily_bonus ?? 0)}</p>
                    </div>
                  </div>
                  
                   {/* Bonus Collection */}
                  <div className="flex items-center justify-between">
                     {/* TODO: Add logic for last_bonus_collected_at and bonus_claimable_at */}
                    <div className="flex items-center">
                       <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse mr-2"></div>
                       <span className="text-sm text-yellow-500">Bonus Bekleniyor</span>
                    </div>
                    <button className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30">
                      Bonusu Topla
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
           /* Store Tab */
          <div className="space-y-6">
            {/* Store Header */}
            <div className="text-center mt-4 mb-6">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Garaj Pazarı</h2>
              <p className="text-gray-400 mt-2">Yeni garajlar satın alarak araç koleksiyonunuzu genişletin!</p>
            </div>
            
            {/* Store Sub-Tabs (NMFP/TON) */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex rounded-md shadow-sm p-1 bg-[#1a1a2e] border border-[#2a3855]">
                <button
                  onClick={() => setStoreTab('nmfp')}
                  className={`px-4 py-2 text-sm rounded-md ${storeTab === 'nmfp' ? 'bg-gradient-to-r from-[#7b2ff7] to-[#5f40f8] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  NMFP Garajları ({getNMFPGarages().length})
                </button>
                <button
                  onClick={() => setStoreTab('ton')}
                  className={`px-4 py-2 text-sm rounded-md ${storeTab === 'ton' ? 'bg-gradient-to-r from-[#0088cc] to-[#00a2e0] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  TON Garajları ({getTONGarages().length})
                </button>
              </div>
            </div>
            
            {/* NMFP Templates */} 
            {storeTab === 'nmfp' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#1a1a2e]/50 rounded-lg border border-[#2a3855] mb-4">
                  <div className="flex items-center gap-2 text-sm text-[#2ff7c1]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p>NMFP tokenleri ile satın alabileceğiniz garajlar</p>
                  </div>
                </div>
                
                {getNMFPGarages().map((template: GarageTemplate) => (
                  <div key={template.id} className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl overflow-hidden border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
                    {/* Template Image */}
                    <div className="relative w-full aspect-[16/9] overflow-hidden bg-gradient-to-r from-[#16213e] to-[#0f3460]">
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f3460]/60 to-transparent opacity-30 z-10"></div>
                      <Image
                        src={template.image || '/placeholder-garage.png'}
                        alt={template.name}
                        width={800}
                        height={450}
                        className="object-contain w-full h-full p-2 mx-auto transform scale-110"
                      />
                    </div>
                    
                    {/* Template Details */}
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                        <span className="font-bold text-[#7b2ff7]">{formatCurrency(template.price)} NMFP</span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mb-3">{template.description || 'Açıklama bulunmuyor.'}</p>
                      
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="inline-block px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 text-center">
                          Kapasite: {template.capacity} araç
                        </div>
                        <div className="inline-block px-3 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 text-center">
                          Günlük: +{formatCurrency(template.daily_bonus ?? 0)} NMFP
                        </div>
                      </div>
                      
                      {/* Purchase Button */}
                      <button 
                        onClick={() => handlePurchaseGarage(template, 'nmfp')}
                        disabled={purchaseLoading === `nmfp-${template.id}` || (user?.balance ?? 0) < template.price}
                        className="w-full mt-3 bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                      >
                         {purchaseLoading === `nmfp-${template.id}` ? "İşlem yapılıyor..." : "NMFP ile Satın Al"}
                      </button>
                    </div>
                  </div>
                ))}
                 {getNMFPGarages().length === 0 && !isLoading && (
                     <p className="text-center text-gray-400 py-4">Şu anda NMFP ile satın alınabilecek garaj yok.</p>
                 )}
              </div>
            )}
            
            {/* TON Templates */} 
            {storeTab === 'ton' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#0088cc]/10 rounded-lg border border-[#0088cc]/30 mb-4">
                  <div className="flex items-center gap-2 text-sm text-[#0088cc]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                     <p>TON ile satın alabileceğiniz özel garajlar</p>
                  </div>
                </div>
                
                {getTONGarages().map((template: GarageTemplate) => (
                  <div key={template.id} className="bg-gradient-to-r from-[#0d2540] to-[#0f1525] rounded-xl overflow-hidden border border-[#0088cc]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#0088cc]/20">
                    {/* Template Image */}
                      <div className="relative w-full aspect-[16/9] overflow-hidden bg-[#0f1525]">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1525]/80 to-transparent opacity-40 z-10"></div>
                        <Image
                         src={template.image || '/placeholder-garage.png'}
                         alt={template.name}
                          width={800}
                          height={450}
                          className="object-contain w-full h-full p-2 mx-auto transform scale-110"
                        />
                      </div>
                      
                    {/* Template Details */}
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                        <span className="font-bold text-[#0088cc]">{formatCurrency(template.price)} TON</span>
                        </div>
                        
                      <p className="text-sm text-gray-400 mb-3">{template.description || 'Açıklama bulunmuyor.'}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="inline-block px-3 py-2 text-xs font-medium rounded-lg bg-[#0088cc]/20 text-[#0088cc] text-center">
                           Kapasite: {template.capacity} araç
                          </div>
                          <div className="inline-block px-3 py-2 text-xs font-medium rounded-lg bg-[#0088cc]/20 text-[#0088cc] text-center">
                           Günlük: +{formatCurrency(template.daily_bonus ?? 0)} NMFP
                          </div>
                        </div>
                        
                       {/* Purchase Button */}
                        <button 
                         onClick={() => handlePurchaseGarage(template, 'ton')}
                         disabled={purchaseLoading === `ton-${template.id}` || (user?.ton_coins ?? 0) < template.price}
                          className="w-full mt-3 bg-gradient-to-r from-[#0088cc] to-[#00a2e0] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#0088cc]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                         {purchaseLoading === `ton-${template.id}` ? "İşleniyor..." : "TON ile Satın Al"}
                        </button>
                      </div>
                    </div>
                  ))}
                 {getTONGarages().length === 0 && !isLoading && (
                     <p className="text-center text-gray-400 py-4">Şu anda TON ile satın alınabilecek garaj yok.</p>
                 )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 