'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import AutoMining from './components/AutoMining';
import { useTelegram } from '@/components/TelegramInitProvider';
import { supabase } from '@/lib/supabaseClient';
import { 
    userCarService, 
    garageService, 
    miningService, 
    transactionService 
} from '@/services/api';
import { User, UserCar, Garage, MiningSession, Transaction } from '@/types';
import { toast } from 'react-hot-toast';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// PrepareResult için geçici tip tanımı (idealde types/index.ts içine taşınmalı)
interface PrepareResult {
  started_count: number;
  available_slots_before?: number;
  total_capacity?: number;
  maintenance_cost_calculated?: number;
  maintenance_paid?: boolean;
  skipped_maintenance_count?: number;
  total_expected_reward?: number;
  warnings?: string[];
  error?: string;
}

export default function GameFiPage() {
  const { telegramUser, user: contextUser, isLoading: providerLoading, error: providerError } = useTelegram();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isCompletingMining, setIsCompletingMining] = useState(false); // Bu hala bireysel tamamlama için gerekli olabilir, şimdilik kalsın
  
  // Yeni state'ler
  const [isPreparingCars, setIsPreparingCars] = useState<boolean>(false);
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [autoPayMaintenance, setAutoPayMaintenance] = useState<boolean>(true);
  // Yeni state: Dinamik kalan süre gösterimi için
  const [nextFinishTimeString, setNextFinishTimeString] = useState<string>("--:--:--");

  const fetchInitialData = useCallback(async (userId: string) => {
    if (!userId) {
        console.error('fetchInitialData çağrıldı ancak userId eksik veya geçersiz.');
        toast.error("Kullanıcı ID'si olmadan veri çekilemiyor.");
        setDataLoading(false);
        return;
    }
    console.log(`🔄 fetchInitialData çağrıldı: Kullanıcı ID ${userId}`);
      setDataLoading(true);
      try {
      const [
        cars,
        userGarages,
        activeSessions,
        recentTransactions
      ] = await Promise.all([
        userCarService.getUserCars(userId),
        garageService.getUserGarages(userId),
        miningService.getAllActiveMiningSessions(userId),
        transactionService.getUserTransactions(userId, 5)
      ]);
      
      console.log('Çekilen Araçlar:', cars);
      console.log('Çekilen Garajlar:', userGarages);
      console.log('Aktif Mining Oturumları:', activeSessions);
      console.log('Son İşlemler:', recentTransactions);
        
        setUserCars(cars);
        setGarages(userGarages);
      setActiveMiningSessions(activeSessions);
        setTransactions(recentTransactions);
      console.log('✅ fetchInitialData tamamlandı.');
    } catch (err: any) {
      console.error('❌ fetchInitialData hatası:', err);
      toast.error(`İlişkili veriler yüklenirken bir hata oluştu: ${err.message}`);
      setUserCars([]);
      setGarages([]);
      setActiveMiningSessions([]);
      setTransactions([]);
      } finally {
        setDataLoading(false);
      }
  }, []);

  useEffect(() => {
    console.log('GameFiPage: contextUser durumu değişti:', contextUser);
    if (contextUser) {
      console.log('GameFiPage: contextUser mevcut, currentUser güncelleniyor ve fetchInitialData çağrılıyor.');
      setCurrentUser(contextUser);
      fetchInitialData(contextUser.id);
    } else {
      console.log('GameFiPage: contextUser null, currentUser temizleniyor.');
      setCurrentUser(null);
      setUserCars([]);
      setGarages([]);
      setActiveMiningSessions([]);
      setTransactions([]);
      setDataLoading(false);
    }
  }, [contextUser, fetchInitialData]);

  useEffect(() => {
    const userId = contextUser?.id;

    // --- YENİ KONTROL --- 
    // Hem kullanıcı ID hem de supabase istemcisi hazır olmadan devam etme
    if (!userId || !supabase) { 
      console.log('Realtime: Abone olmak için kullanıcı ID veya Supabase istemcisi bekleniyor.');
      return;
    }
    // --- KONTROL BİTTİ ---

    console.log(`Realtime: Kullanıcı ${userId} için abonelik oluşturuluyor...`);
    
    let channel: RealtimeChannel | null = null; // channel değişkenini dışarıda tanımla

    try {
      channel = supabase 
        .channel(`public:users:id=eq.${userId}`)
        .on<
        { [key: string]: any; } & { 
            schema: 'public'; 
            table: 'users'; 
            commit_timestamp: string;
            eventType: 'UPDATE';
            new: User;
            old: Partial<User>;
            errors: null | any;
        }
      >(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload: any) => {
          console.log('User data changed via Realtime:', payload);
          if (payload.eventType === 'UPDATE' && payload.new && typeof payload.new === 'object') {
            setCurrentUser(prev => {
                if (!prev) return payload.new as unknown as User; 
                const updatedUser = { ...prev, ...payload.new }; 
                return updatedUser as unknown as User; 
            });
            toast.success('Kullanıcı bilgileri güncellendi!');
          } else {
            console.warn('Realtime payload formatı beklenenden farklı:', payload);
          }
        }
      )
      .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Users Realtime kanalına abone olundu (Kullanıcı: ${userId})!`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`Realtime abonelik hatası (Users): ${status}`, err);
          toast.error('Profil güncellemeleri alınamıyor.');
        } else {
          console.log(`Realtime durumu (Users): ${status}`);
        }
      });
    } catch (error) {
        console.error("Realtime aboneliği kurulurken hata oluştu:", error);
        toast.error("Realtime bağlantısı kurulamadı.");
    }

    // Cleanup fonksiyonu
    return () => {
      if (channel) {
        console.log(`Realtime aboneliği kaldırılıyor (Users: ${userId})`);
        supabase.removeChannel(channel).catch((err: Error) => console.error("Realtime kanalı kaldırılırken hata:", err));
      } else {
          console.log("Realtime kanalı zaten kaldırılmış veya hiç kurulmamış.");
      }
    };
  }, [contextUser?.id]); // supabase bağımlılığı eklemeye gerek yok, sabit olmalı

  // --- Dinamik Kalan Süre Hesaplama için useEffect ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // En yakın bitiş zamanını hesapla (Bu mantık zaten vardı)
    const nextFinishingSession = activeMiningSessions.reduce((earliest, current) => {
      const earliestTime = earliest ? new Date(earliest.end_time).getTime() : Infinity;
      const currentTime = new Date(current.end_time).getTime();
      return currentTime < earliestTime ? current : earliest;
    }, null as MiningSession | null);

    const nextFinishTime = nextFinishingSession ? nextFinishingSession.end_time : null;

    if (nextFinishTime) {
      const updateRemainingTime = () => {
        const remainingString = calculateRemainingTimeString(nextFinishTime);
        setNextFinishTimeString(remainingString);
        // Eğer süre dolduysa interval'i durdur (opsiyonel, ama performansı artırır)
        if (remainingString === "Tamamlandı") {
           if (intervalId) clearInterval(intervalId);
        }
      };

      // İlk hesaplamayı hemen yap
      updateRemainingTime();

      // Her saniye güncellemek için interval başlat
      intervalId = setInterval(updateRemainingTime, 1000);

    } else {
       // Aktif oturum yoksa, varsayılan değere dön
       setNextFinishTimeString("--:--:--");
    }

    // Cleanup: Component unmount olduğunda veya activeMiningSessions değiştiğinde interval'i temizle
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeMiningSessions]); // Sadece activeMiningSessions değiştiğinde çalışsın

  // --- Mining Tamamlama Fonksiyonu (Şimdilik kalsın, ileride bireysel tamamlama eklenirse kullanılır) ---
  const handleCompleteMining = async (sessionId: number) => { 
    // ... (içerik aynı, sadece çağrıldığı yer değişecek veya kaldırılacak) ...
    // Başarı durumunda fetchInitialData çağrısı güncellenmeli (zaten var)
  };

  // --- YENİ: Hazırla ve Toplu Başlat Fonksiyonu ---
  const handlePrepareAndStart = async () => {
    if (!currentUser || !currentUser.id) {
      toast.error('İşlemi başlatmak için kullanıcı bilgisi gerekli.');
      return;
    }

    setIsPreparingCars(true);
    setPrepareResult(null); // Önceki sonucu temizle
    const toastId = toast.loading('Uygun araçlar hazırlanıyor ve mining başlatılıyor...');

    try {
      const result = await miningService.prepareAndStartEligibleCars(currentUser.id, autoPayMaintenance);
      setPrepareResult(result); // Dönen sonucu state'e kaydet

      if (result && result.error) {
         throw new Error(result.error); // SQL fonksiyonu içinden dönen hatayı fırlat
      }
       
      if (result && result.started_count > 0) {
        toast.success(`${result.started_count} araç başarıyla mininge gönderildi!`, { id: toastId });
        // Verileri yenile
        fetchInitialData(currentUser.id);
      } else if (result) {
         // Hiç araç başlamadıysa bile mesaj gösterilebilir
         toast.success(`İşlem tamamlandı, ancak mininge gönderilecek uygun araç bulunamadı. ${result.warnings?.join(' ') || ''}`, { id: toastId, duration: 5000 });
          // Yine de verileri yenile (belki bakım yapılmıştır)
          fetchInitialData(currentUser.id);
      } else {
         // RPC null döndürdüyse
          throw new Error('Araç hazırlama ve başlatma işlemi başarısız oldu (API yanıtı yok).');
      }
      
      // Uyarıları ayrıca göster
      if (result?.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => toast.error(warning, { duration: 6000 }));
      }

    } catch (error: any) {
      console.error('Hazırla ve başlatma hatası:', error);
      toast.error(error.message || 'Araç hazırlama ve başlatma sırasında bir hata oluştu.', { id: toastId });
      setPrepareResult({ error: error.message } as PrepareResult); // Hata mesajını sonuca ekle
    } finally {
      setIsPreparingCars(false);
    }
  };

  if (providerLoading || (contextUser && dataLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-[#7b2ff7] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400">Veriler yükleniyor...</p>
      </div>
    );
  }
  
  if (providerError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-red-500 mb-2">Bağlantı Hatası</h2>
        <p className="text-center text-gray-400 mb-4">{providerError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-6 py-2 rounded-md font-medium"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }
  
  if (!providerLoading && !providerError && !contextUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold text-yellow-500 mb-2">Kullanıcı Bilgisi Yok</h2>
        <p className="text-center text-gray-400 mb-4">Uygulamaya erişmek için Telegram üzerinden giriş yapmalısınız veya verileriniz alınamadı.</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">NMFP GameFi</h1>
      </div>
      
      <AutoMining />
      
      {currentUser && (
        <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-4 mb-5 shadow-md border border-[#2a3855]">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-[#7b2ff7]/30 via-[#5f40f8]/30 to-[#2f7bf7]/30 w-10 h-10 rounded-full flex items-center justify-center mr-3 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Hoş geldin, {currentUser.username}!</p>
              <p className="text-xs text-gray-400">Seviye {currentUser.level} • {formatNumber(currentUser.xp)} XP</p>
              <p className="text-xs text-gray-400">Bakiye: {formatCurrency(currentUser.balance)} NMFP</p>
            </div>
          </div>
        </div>
      )}
      
      {/* --- YENİ: Toplu Mining Başlatma Bölümü --- */}
      <div className="bg-gradient-to-r from-[#16213e] via-[#1a1a2e] to-[#16213e] rounded-xl p-4 mb-5 shadow-md border border-[#2a3855]">
          <h3 className="font-semibold text-white mb-3">Toplu Mining Yönetimi</h3>
          
          {/* Otomatik Bakım Seçeneği */} 
          <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg mb-3 border border-white/10">
              <label htmlFor="autoPay" className="text-sm text-gray-300 flex-grow mr-2">Uygun araçların yakıt/tamir masrafları NMFP ile otomatik ödensin mi?</label>
              <input 
                  type="checkbox" 
                  id="autoPay" 
                  checked={autoPayMaintenance}
                  onChange={(e) => setAutoPayMaintenance(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-[#7b2ff7] bg-gray-700 border-gray-600 rounded focus:ring-[#7b2ff7] focus:ring-offset-gray-800 cursor-pointer"
              />
          </div>

          {/* Başlatma Butonu */} 
          <button
            onClick={handlePrepareAndStart}
            disabled={isPreparingCars || activeMiningSessions.length >= (garages.reduce((sum, g) => sum + g.capacity, 0))}
            className={`w-full px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center 
                        ${activeMiningSessions.length >= (garages.reduce((sum, g) => sum + g.capacity, 0)) 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white hover:shadow-lg hover:shadow-[#7b2ff7]/30'} 
                        ${isPreparingCars ? 'opacity-50 cursor-wait' : ''}`}
          >
              {isPreparingCars ? (
                  <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Hazırlanıyor...
                  </>
              ) : activeMiningSessions.length >= (garages.reduce((sum, g) => sum + g.capacity, 0)) ? (
                  'Tüm Slotlar Dolu'
              ) : (
                   'Uygun Araçları Hazırla & Mining Başlat'
              )}
          </button>

          {/* Sonuç Alanı */} 
          {prepareResult && !isPreparingCars && (
              <div className={`mt-4 p-3 rounded-lg border ${prepareResult.error ? 'bg-red-900/30 border-red-500/50' : 'bg-green-900/30 border-green-500/50'} text-xs`}>
                  {prepareResult.error ? (
                      <p className="text-red-400">Hata: {prepareResult.error}</p>
                  ) : (
                      <ul className="space-y-1">
                          <li>✅ Başlatılan Araç Sayısı: <span className="font-semibold text-white">{prepareResult.started_count}</span></li>
                          {prepareResult.maintenance_cost_calculated !== undefined && (
                              <li>💰 Hesaplanan Bakım Maliyeti: <span className="font-semibold text-white">{formatCurrency(prepareResult.maintenance_cost_calculated)} NMFP</span> ({prepareResult.maintenance_paid ? 'Ödendi' : 'Ödenmedi/Yetersiz Bakiye'})</li>
                          )}
                          {prepareResult.total_expected_reward !== undefined && (
                               <li>🚀 Toplam Tahmini Ödül: <span className="font-semibold text-white">{formatCurrency(prepareResult.total_expected_reward)} NMFP</span></li>
                          )}
                          {prepareResult.warnings && prepareResult.warnings.length > 0 && (
                              <li>⚠️ Uyarılar: {prepareResult.warnings.join(', ')}</li>
                          )}
                      </ul>
                  )}
              </div>
          )}
      </div>
      {/* --- Toplu Mining Bölümü Bitti --- */}

      {/* Aktif Mining Oturumları Gösterimi (Güncellendi) */}
      {activeMiningSessions.length > 0 ? (
        (() => {
          // En yakın bitiş zamanını bulma mantığı kaldırıldı, useEffect içinde yapılıyor
          // const nextFinishingSession = ...
          // const nextFinishTime = ...

          return (
            <div className="bg-gradient-to-r from-[#1a1a2e]/70 via-[#16213e]/70 to-[#0f3460]/70 rounded-xl p-4 mb-5 shadow-md border border-[#2a3855]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-white flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                   </svg>
                   {activeMiningSessions.length} Araç Miningde
                </h3>
                <span className="text-xs text-gray-400">Toplam Kapasite: {garages.reduce((sum, g) => sum + g.capacity, 0)}</span>
              </div>

              {/* En Yakın Bitiş Süresi (Dinamik state'i kullan) */} 
              <div className="text-center text-sm text-gray-300 mb-2">
                   Sonraki Bitiş: <span className="font-semibold text-white tabular-nums">{nextFinishTimeString}</span>
              </div>

               {/* İsteğe bağlı: Aktif oturumların küçük bir listesi veya özet bilgisi buraya eklenebilir */} 
               {/* Şimdilik sadece sayı gösteriyoruz */} 
               <p className="text-xs text-center text-gray-400 mt-2">Detaylar ve ödül toplama için Araçlarım sayfasına gidin.</p> 
               {/* Eski Ödül Topla butonu kaldırıldı */}
            </div>
          );
        })()
      ) : (
         // Aktif mining yoksa...
         <div className="text-center p-4 mb-5 text-gray-500 text-sm">
             Şu anda aktif mining görevi yok. Yukarıdan uygun araçları başlatabilirsiniz.
         </div>
      )}
      {/* --- Aktif Mining Gösterimi Bitti --- */}

      <div className="grid gap-4 grid-cols-2 mb-5">
        <Link href="/gamefi/wallet" className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 shadow-md border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
          <p className="text-xs text-gray-400">Toplam Bakiye</p>
          <h3 className="text-xl font-bold text-[#2ff7c1]">{currentUser ? formatCurrency(currentUser.balance) : '0.00'}</h3>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs bg-[#2ff7c1]/20 text-[#2ff7c1] px-2 py-0.5 rounded-full">
              {transactions.length > 0 && transactions[0].type === 'reward' ? '+' : ''}
              {transactions.length > 0 ? transactions[0].amount.toFixed(2) : '0.00'}
            </span>
            <span className="text-xs text-gray-400">son işlem</span>
          </div>
        </Link>
        
        <Link href="/gamefi/stats" className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 shadow-md border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
          <p className="text-xs text-gray-400">Toplam XP</p>
          <h3 className="text-xl font-bold text-[#7b2ff7]">{currentUser ? formatNumber(currentUser.xp) : '0'}</h3>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs bg-[#7b2ff7]/20 text-[#7b2ff7] px-2 py-0.5 rounded-full">
              {currentUser ? `Seviye ${currentUser.level}` : 'Seviye 1'}
            </span>
          </div>
        </Link>
      </div>
      
      <div className="grid gap-4 grid-cols-2 mb-5">
        <Link href="/gamefi/car" className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 flex flex-col items-center border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
          <div className="mb-2 bg-gradient-to-r from-[#7b2ff7]/30 to-[#2f7bf7]/30 w-14 h-14 rounded-full flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="font-semibold text-white">Araçlarım</p>
          <p className="text-xs text-gray-400 mt-1">{userCars.length} Araç</p>
        </Link>
        
        <Link href="/gamefi/garage" className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 flex flex-col items-center border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
          <div className="mb-2 bg-gradient-to-r from-[#7b2ff7]/30 to-[#2f7bf7]/30 w-14 h-14 rounded-full flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="font-semibold text-white">Garajlarım</p>
          <p className="text-xs text-gray-400 mt-1">{garages.length} Garaj</p>
        </Link>
      </div>
      
      <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 shadow-md border border-[#2a3855]">
        <h3 className="text-lg font-semibold mb-3 text-white">Son İşlemler</h3>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between bg-[#1a1a2e]/80 p-3 rounded-lg border border-[#2a3855]/50 transition-all duration-300 hover:shadow-sm hover:shadow-[#7b2ff7]/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md shadow-md ${getTransactionBgClass(transaction.type)}`}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{getTransactionLabel(transaction)}</p>
                    <p className="text-xs text-gray-400">{formatDate(transaction.date)}</p>
                  </div>
                </div>
                <span className={getTransactionAmountClass(transaction.type)}>
                  {transaction.type === 'reward' || transaction.type === 'deposit' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-[#1a1a2e]/80 rounded-lg border border-[#2a3855]/50">
            <p className="text-gray-400 mb-2">Henüz işlem bulunmuyor</p>
            <Link 
              href="/gamefi/wallet"
              className="text-sm text-[#2ff7c1] hover:underline"
            >
              İşlem geçmişine git
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function calculateProgress(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const now = Date.now();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  const totalDuration = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, Math.floor((elapsed / totalDuration) * 100)));
}

function getTransactionIcon(type: string): React.ReactNode {
  switch (type) {
    case 'reward':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'deposit':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    case 'withdraw':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#7b2ff7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    case 'purchase':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#7b2ff7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
  }
}

function getTransactionLabel(transaction: Transaction): string {
  switch (transaction.type) {
    case 'reward':
      return transaction.item || 'Mining Kazancı';
    case 'deposit':
      return 'Para Yükleme';
    case 'withdraw':
      return 'Para Çekme';
    case 'purchase':
      return transaction.item ? `${transaction.item} Satın Alındı` : 'Satın Alma';
    default:
      return 'İşlem';
  }
}

function getTransactionBgClass(type: string): string {
  switch (type) {
    case 'reward':
    case 'deposit':
      return 'bg-gradient-to-r from-[#2ff7c1]/30 to-[#2ff7c1]/10';
    case 'withdraw':
    case 'purchase':
      return 'bg-gradient-to-r from-[#7b2ff7]/30 to-[#7b2ff7]/10';
    default:
      return 'bg-gradient-to-r from-gray-500/30 to-gray-500/10';
  }
}

function getTransactionAmountClass(type: string): string {
  switch (type) {
    case 'reward':
    case 'deposit':
      return 'text-[#2ff7c1] font-medium';
    case 'withdraw':
    case 'purchase':
      return 'text-[#7b2ff7] font-medium';
    default:
      return 'text-gray-400 font-medium';
  }
}

// Kalan süreyi H:MM:SS formatında gösteren yardımcı fonksiyon
function calculateRemainingTimeString(endTime: string): string {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = Math.max(0, end - now); // Milisaniye farkı

    if (diff === 0) return "Tamamlandı";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
} 