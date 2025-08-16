'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTelegram } from '@/components/TelegramInitProvider';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import { formatCurrency } from '@/app/utils/formatters';
import axios from 'axios';

export default function AutoMining() {
  const { user, refreshUserData } = useTelegram();
  const [tonConnectUI] = useTonConnectUI();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPurchased, setIsPurchased] = useState<boolean>(false);
  const [premiumEndsAt, setPremiumEndsAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("--:--:--");
  
  // Premium durumunu kontrol et
  const checkPremiumStatus = useCallback(() => {
    if (!user) return;
    
    setIsPurchased(user.premium_active || false);
    setPremiumEndsAt(user.premium_until || null);
    
    // Kalan süreyi hesapla (eğer premium aktifse)
    if (user.premium_active && user.premium_until) {
      const now = new Date();
      const endDate = new Date(user.premium_until);
      
      // Gün cinsinden kalan süre
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        setTimeLeft(`${daysLeft} gün`);
      } else {
        setTimeLeft("Sona erdi");
      }
    }
  }, [user]);
  
  // Component yüklendiğinde ve kullanıcı değiştiğinde premium durumunu kontrol et
  useEffect(() => {
    checkPremiumStatus();
  }, [checkPremiumStatus]);
  
  // İşlem sonucunu API'ye gönderme ve doğrulama
  const verifyTransaction = async (boc: string, toastId: string) => {
    try {
      // İşlem sonrası biraz bekleyerek ağda yayılma süresi tanı
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const apiResponse = await axios.post('/api/auto-mining', {
        txHash: boc,
        walletAddress: tonConnectUI.account?.address,
        userId: user?.id
      });
      
      if (apiResponse.data.success) {
        toast.success("Otomatik mining özelliği aktifleştirildi!", { id: toastId });
        setIsPurchased(true);
        // refreshUserData kaldırıldı - realtime sistem otomatik güncelleme yapacak
        return true;
      } else {
        const errorMessage = apiResponse.data.message || 'Bilinmeyen hata';
        toast.error(`İşlem doğrulanamadı: ${errorMessage}`, { id: toastId });
        
        if (errorMessage.includes('doğrulanamadı')) {
          toast.error(
            "İşlem blockchain'de henüz görünmüyor. Lütfen biraz bekleyip tekrar deneyin.",
            { id: toastId, duration: 6000 }
          );
        }
        return false;
      }
    } catch (error: any) {
      console.error('API doğrulama hatası:', error);
      toast.error(`Sunucu hatası: ${error.message}`, { id: toastId });
      return false;
    }
  };
  
  // TON ile premium mining satın al
  const handlePurchasePremium = async () => {
    // Bağlantı kontrolü
    if (!tonConnectUI || !tonConnectUI.connected) {
      toast.error("TON cüzdanınız bağlı değil!");
      return;
    }
    
    // Kullanıcı kontrolü
    if (!user || !user.id) {
      toast.error("Kullanıcı bilgileri eksik, lütfen tekrar giriş yapın.");
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading("TON ile otomatik mining satın alınıyor...");
    
    try {
      // Oyun cüzdan adresi (çift kontrol)
      const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'UQAC6bB2_GD_CMnBRBTO8HNomIdsH7mID1nk4Pc_NTiVquD3';
      
      // İşlem tutarı (1 TON)
      const amount = toNano('1').toString();
      
      // İşlem son geçerlilik zamanı (20 dakika)
      const validUntil = Math.floor(Date.now() / 1000) + 60 * 20;
      
      // İşlem bilgisi
      const comment = "Auto Mining Purchase";
      
      // TON Transfer işlemi (basitleştirilmiş, minimum veri)
      const transaction = {
        validUntil,
        messages: [
          {
            address: gameWalletAddress,
            amount: amount
            // payload belirtilmeden bırakılmış - bazı cüzdanların işlem başarısızlıklarına neden olabilir
          }
        ]
      };
      
      toast.loading("TON cüzdanı onay penceresi bekleniyor...", { id: toastId });
      
      // İşlem gönderilirken try-catch bloğu ekstra kontrol için
      try {
        const result = await tonConnectUI.sendTransaction(transaction);
        
        if (result && result.boc) {
          console.log('TON işlem sonucu (boc başarıyla alındı):', { 
            bocLength: result.boc.length,
            hasValidBoc: !!result.boc
          });
          
          toast.loading("İşlem onaylandı, sunucu doğrulaması bekleniyor...", { id: toastId });
          await verifyTransaction(result.boc, toastId);
        } else {
          console.error('TON işlemi başarısız - geçersiz boc:', result);
          toast.error("İşlem başarısız oldu! Geçersiz işlem bilgisi alındı.", { id: toastId });
        }
      } catch (txError: any) {
        console.error('İşlem gönderme hatası:', txError);
        
        let txErrorMessage = "İşlem gönderilemedi";
        if (txError.message?.includes("magic")) {
          txErrorMessage = "İşlem kodlanırken hata oluştu. Lütfen TON cüzdanınızı kontrol edip tekrar deneyin.";
        } else if (txError.message?.includes("emulate")) {
          txErrorMessage = "İşlem ağ tarafından reddedildi. Lütfen TON bakiyenizi kontrol edin.";
        }
        
        toast.error(txErrorMessage, { id: toastId });
      }
    } catch (error: any) {
      console.error('TON işlem hazırlık hatası:', error);
      
      let errorMessage = "İşlem sırasında beklenmeyen bir hata oluştu";
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("cancel")) {
          errorMessage = "İşlem kullanıcı tarafından reddedildi";
        } else if (error.message.includes("insufficient") || error.message.includes("balance")) {
          errorMessage = "Yetersiz bakiye. Satın alma için yeterli TON yok.";
        } else if (error.message.includes("magic")) {
          errorMessage = "Cüzdan ile iletişimde hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "İşlem zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.";
        }
      }
      
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-[#1a1a2e]/70 p-4 rounded-xl shadow-md border border-[#2a3855]/50 mb-5">
      <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7b2ff7] mb-3">
        Otomatik Mining Sistemi
      </h3>
      
      <div className="space-y-4">
        {!isPurchased ? (
          <>
            <div className="p-3 rounded-lg bg-gradient-to-r from-[#2f7bf7]/30 to-[#2f7bf7]/10">
              <h4 className="text-white font-semibold mb-2">Premium Otomatik Mining Sistemi</h4>
              <p className="text-sm text-gray-300 mb-3">
                Sadece 1 TON karşılığında, araçlarınızın bakım ve yakıt ihtiyaçları otomatik olarak karşılanarak
                kesintisiz madencilik yapmasını sağlayabilirsiniz. Mining tamamlandığında puanlar otomatik toplanır
                ve yeni mining işlemi başlatılır.
              </p>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1 mb-3">
                <li>Otomatik bakım ve yakıt doldurma</li>
                <li>Ödüllerin otomatik toplanması</li>
                <li>8 saatlik döngülerle kesintisiz mining</li>
                <li>1 yıl boyunca geçerli premium</li>
              </ul>
              <button
                onClick={handlePurchasePremium}
                disabled={isLoading || !tonConnectUI.connected}
                className="w-full py-2 mt-2 bg-gradient-to-r from-[#7b2ff7] to-[#2f7bf7] text-white rounded-md font-medium hover:from-[#6522d5] hover:to-[#1e6be6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'İşleniyor...' : !tonConnectUI.connected ? 'TON Cüzdanınızı Bağlayın' : '1 TON ile Satın Al'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-gradient-to-r from-[#2ff7c1]/30 to-[#2ff7c1]/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-semibold">Premium Otomatik Mining Aktif</h4>
                <span className="px-2 py-1 bg-[#2ff7c1]/20 text-[#2ff7c1] text-xs font-medium rounded-full">
                  Aktif
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Premium otomatik mining sisteminiz aktif. Araçlarınız kesintisiz mining yapıyor, 
                bakım ve yakıt ihtiyaçları otomatik karşılanıyor.
              </p>
              
              {premiumEndsAt && (
                <div className="bg-[#1a1a2e]/50 p-2 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Premium süreniz:</span>
                    <span className="text-xs font-medium text-[#2ff7c1]">{timeLeft}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 