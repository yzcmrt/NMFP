'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import MiningArea from './components/MiningArea';
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
  const { telegramUser, user: contextUser, isLoading: providerLoading, error: providerError, refreshUserData } = useTelegram();
  const [userCars, setUserCars] = useState<UserCar[]>([]);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [activeMiningSessions, setActiveMiningSessions] = useState<MiningSession[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Local user state for balance updates
  const [localUserBalance, setLocalUserBalance] = useState<number | null>(null);
  const [localUserLevel, setLocalUserLevel] = useState<number | null>(null);
  const [localUserXP, setLocalUserXP] = useState<number | null>(null);
  
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
        // Hepsini try-catch'e alıp ayrı ayrı hata yönetimi
        let cars: UserCar[] = [];
        let userGarages: Garage[] = [];
        let activeSessions: MiningSession[] = [];
        let recentTransactions: Transaction[] = [];
        
        try {
          cars = await userCarService.getUserCars(userId);
      console.log('Çekilen Araçlar:', cars);
        } catch (carError) {
          console.error('Araç verilerini çekerken hata:', carError);
          toast.error('Araç bilgileri yüklenemedi');
        }
        
        try {
          userGarages = await garageService.getUserGarages(userId);
      console.log('Çekilen Garajlar:', userGarages);
        } catch (garageError) {
          console.error('Garaj verilerini çekerken hata:', garageError);
          toast.error('Garaj bilgileri yüklenemedi');
        }
        
        try {
          activeSessions = await miningService.getAllActiveMiningSessions(userId);
      console.log('Aktif Mining Oturumları:', activeSessions);
        } catch (sessionError) {
          console.error('Mining oturumlarını çekerken hata:', sessionError);
          toast.error('Mining oturumları yüklenemedi');
        }
        
        try {
          recentTransactions = await transactionService.getUserTransactions(userId, 5);
      console.log('Son İşlemler:', recentTransactions);
        } catch (transactionError) {
          console.error('İşlem verilerini çekerken hata:', transactionError);
          toast.error('İşlem geçmişi yüklenemedi');
        }
        
        // Verileri set et
        setUserCars(cars);
        setGarages(userGarages);
      setActiveMiningSessions(activeSessions);
        setTransactions(recentTransactions);
        
        // Kullanıcı verisini de tazeleyelim
        await refreshUserData();
        
      console.log('✅ fetchInitialData tamamlandı.');
    } catch (err: any) {
      console.error('❌ fetchInitialData hatası:', err);
      toast.error(`İlişkili veriler yüklenirken bir hata oluştu: ${err.message}`);
      } finally {
        setDataLoading(false);
      }
  }, [refreshUserData]);

  // Local user bilgilerini context'ten başlat
  useEffect(() => {
    if (contextUser) {
      setLocalUserBalance(contextUser.balance);
      setLocalUserLevel(contextUser.level);
      setLocalUserXP(contextUser.xp);
    }
  }, [contextUser]);

  // Balance güncelleme fonksiyonu
  const updateLocalUserBalance = async (newBalance?: number) => {
    if (newBalance !== undefined) {
      setLocalUserBalance(newBalance);
    } else {
      // Context'ten güncel bilgiyi al
      const updatedUser = await userService.getUserById(contextUser!.id);
      if (updatedUser) {
        setLocalUserBalance(updatedUser.balance);
        setLocalUserLevel(updatedUser.level);
        setLocalUserXP(updatedUser.xp);
      }
    }
  };

  useEffect(() => {
    console.log('GameFiPage: contextUser durumu değişti:', contextUser);
    if (contextUser) {
      console.log('GameFiPage: contextUser mevcut, veri çekiliyor.');
      fetchInitialData(contextUser.id);
    } else {
      console.log('GameFiPage: contextUser null, veriler temizleniyor.');
      setUserCars([]);
      setGarages([]);
      setActiveMiningSessions([]);
      setTransactions([]);
      setDataLoading(false);
    }
  }, [contextUser, fetchInitialData]);

  // Sayfalar arası geçişlerde otomatik veri yenileme için
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && contextUser?.id) {
        console.log('Sayfa görünür oldu, veriler yenileniyor...');
        fetchInitialData(contextUser.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [contextUser, fetchInitialData]);

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
    if (!contextUser || !contextUser.id) {
      toast.error('İşlemi başlatmak için kullanıcı bilgisi gerekli.');
      return;
    }

    setIsPreparingCars(true);
    setPrepareResult(null); // Önceki sonucu temizle
    const toastId = toast.loading('Uygun araçlar hazırlanıyor ve mining başlatılıyor...');

    try {
      const result = await miningService.prepareAndStartEligibleCars(contextUser.id, autoPayMaintenance);
      setPrepareResult(result); // Dönen sonucu state'e kaydet

      if (result && result.error) {
         throw new Error(result.error); // SQL fonksiyonu içinden dönen hatayı fırlat
      }
       
      if (result && result.started_cars && result.started_cars > 0) {
        toast.success(`${result.started_cars} adet araç mining için başlatıldı!`, { id: toastId });
        
        // Uyarıları göster (varsa)
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 5000 });
          });
        }
        
        // Araç ve garaj listelerini güncelle
        fetchInitialData(contextUser.id);
        
        // Kullanıcı bakiyesini güncelle (bakım için ödeme yapıldıysa)
        refreshUserData();
          
        console.log('Mining toplu başlatma sonucu:', result);
      } else if (result && result.started_cars === 0) {
        // Araç başlatılamadı
        let message = 'Hiçbir araç mining için başlatılamadı.';
        
        // Uyarıları mesaja ekle
        if (result.warnings && result.warnings.length > 0) {
          message += ' Nedenleri:';
          result.warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 5000 });
          });
        } else {
          message += ' Yakıt/kondisyon durumu veya yeterli garaj kapasitesi olup olmadığını kontrol edin.';
        }
        
        toast.warn(message, { id: toastId, duration: 5000 });
      } else {
        // Diğer hata durumları
        toast.error('Mining başlatma işlemi sırasında bir hata meydana geldi.', { id: toastId });
      }
    } catch (error: any) {
      console.error('Hazırla ve başlat hatası:', error);
      let errorMessage = 'Mining başlatma işlemi sırasında bir hata meydana geldi.';
      
      // Hata mesajını kontrol et, bilinen hataları daha anlaşılır mesajlarla göster
      if (error.message) {
        if (error.message.includes('yetersiz bakiye') || error.message.includes('insufficient balance')) {
          errorMessage = 'Bakım için yetersiz bakiye. Lütfen daha sonra tekrar deneyin veya bakım ödeme seçeneğini kapatın.';
        } else if (error.message.includes('uygun araç yok') || error.message.includes('no eligible cars')) {
          errorMessage = 'Mining için uygun durumda araç bulunamadı. Araçlarınızın durumunu kontrol edin.';
        } else if (error.message.includes('garaj kapasitesi') || error.message.includes('garage capacity')) {
          errorMessage = 'Yeterli garaj kapasitesi yok. Yeni garaj satın alın veya aktif mining işlemlerinizi tamamlayın.';
        } else if (error.message.includes('bulunamadi') || error.message.includes('not found')) {
          errorMessage = 'Bazı araçlar bulunamadı veya bu kullanıcıya ait değil.';
        } else if (error.message.includes('zaten mining')) {
          errorMessage = 'Bazı araçlar zaten mining yapıyor!';
        } else {
          // Diğer hataları olduğu gibi göster
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, { id: toastId, duration: 5000 });
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
    <div className="pb-20 px-4">
      {/* Kullanıcı kartı - Context verilerini doğrudan kullanıyor */}
      <div className="bg-[#1a1a2e]/70 p-4 rounded-xl mb-5 shadow-md border border-[#2a3855]/50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#16213e] rounded-full flex items-center justify-center">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#2ff7c1] to-[#7b2ff7]">
              {contextUser?.username?.charAt(0) || telegramUser?.first_name?.charAt(0) || '?'}
            </span>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-white">{contextUser?.username || telegramUser?.first_name || 'Oyuncu'}</h2>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <span>Seviye {localUserLevel ?? contextUser?.level ?? 1}</span>
              <span className="text-xs mx-1">•</span>
              <span>XP: {formatNumber(localUserXP ?? contextUser?.xp ?? 0)}</span>
            </div>
            <div className="mt-1">
              <span className="text-[#2ff7c1] font-medium">{formatCurrency(localUserBalance ?? contextUser?.balance ?? 0)} NMFP</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Ana içerik alanı */}
      <div className="space-y-5">
        {/* Otomatik Mining Bileşeni */}
        <AutoMining onBalanceUpdate={updateLocalUserBalance} />
        
        {/* Mevcut MiningArea Bileşeni */}
        <MiningArea onBalanceUpdate={updateLocalUserBalance} currentBalance={localUserBalance} />
        
        {/* Son İşlemler */}
        <div className="bg-[#1a1a2e]/70 p-4 rounded-xl shadow-md border border-[#2a3855]/50">
          <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
            Son İşlemler
          </h3>
          
          {transactions.length === 0 ? (
            <div className="text-center py-5 text-gray-400">
              <p>Henüz işlem kaydı bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(transaction => (
                <div 
                  key={transaction.id} 
                  className={`p-3 rounded-lg ${getTransactionBgClass(transaction.type)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTransactionBgClass(transaction.type)}`}>
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{getTransactionLabel(transaction)}</p>
                        <p className="text-xs text-gray-400">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className={`text-right font-medium ${getTransactionAmountClass(transaction.type)}`}>
                      {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
                      {formatCurrency(transaction.amount)} NMFP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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