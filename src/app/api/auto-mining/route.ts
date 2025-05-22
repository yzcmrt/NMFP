import { NextRequest, NextResponse } from 'next/server';
import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlat
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// TonClient'ı başlat
const tonClient = new TonClient({
  endpoint: process.env.NEXT_PUBLIC_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.NEXT_PUBLIC_TON_API_KEY || '',
});

// İşlem doğrulama fonksiyonu
async function verifyTransaction(
  txHash: string,
  address: string,
  amount: string = '1000000000', // 1 TON = 10^9 nanoTON
  maxAttempts: number = 10,
  retryDelay: number = 2000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // İşlem sonucunu kontrol et
      const transactions = await tonClient.getTransactions(Address.parse(address), {
        limit: 10
      });
      
      // İşlemleri hash'e göre filtrele
      const matchingTx = transactions.find(tx => tx.hash.toString() === txHash);
      
      if (matchingTx) {
        console.log('İşlem doğrulandı:', txHash);
        
        // İşlem miktarını kontrol et
        const inAmount = matchingTx.inMessage?.value.toString() || '0';
        
        if (BigInt(inAmount) >= BigInt(amount)) {
          console.log(`İşlem miktarı doğrulandı: ${inAmount} >= ${amount}`);
          return true;
        } else {
          console.log(`İşlem miktarı yetersiz: ${inAmount} < ${amount}`);
          return false;
        }
      }
      
      console.log(`İşlem kontrolü (${attempt + 1}/${maxAttempts}): Henüz işlem bulunamadı`);
      
      // Bekle ve tekrar dene
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.warn(`İşlem kontrol hatası (${attempt + 1}/${maxAttempts}):`, error);
      // Bekle ve tekrar dene
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  // Maksimum deneme sayısına ulaşıldı, işlem doğrulanamadı
  console.error('İşlem doğrulanamadı:', txHash);
  return false;
}

// Premium mining özelliği aktifleştirme
async function activateAutoMining(userId: string): Promise<{success: boolean, message: string}> {
  try {
    // Önce kullanıcı premium durumunu kontrol et
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, premium_active, premium_until')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('Kullanıcı bilgisi alınamadı:', userError);
      return { success: false, message: 'Kullanıcı bilgisi alınamadı' };
    }
    
    // Kullanıcı premium özelliğini aktifleştir
    const premiumUntil = new Date();
    premiumUntil.setFullYear(premiumUntil.getFullYear() + 1); // 1 yıl geçerli
    
    const { error: updateError } = await supabase
      .from('users')
      .update({
        premium_active: true,
        premium_until: premiumUntil.toISOString()
      })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Premium özelliği aktifleştirilemedi:', updateError);
      return { success: false, message: 'Premium özelliği aktifleştirilemedi' };
    }
    
    // Aktifleştirme sonrası cron job başlat
    const { data: cronJobData, error: cronJobError } = await supabase.rpc(
      'start_auto_mining_for_user',
      { p_user_id: userId }
    );
    
    if (cronJobError) {
      console.error('Otomatik mining başlatılamadı:', cronJobError);
      return { success: false, message: 'Otomatik mining başlatılamadı' };
    }
    
    return { 
      success: true, 
      message: 'Otomatik mining özelliği başarıyla aktifleştirildi'
    };
  } catch (error) {
    console.error('Premium mining aktifleştirme hatası:', error);
    return { success: false, message: 'İşlem sırasında bir hata oluştu' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Request body'den veri al
    const requestData = await request.json();
    const { txHash, walletAddress, userId } = requestData;
    
    // Gerekli alanları kontrol et
    if (!txHash || !walletAddress || !userId) {
      return NextResponse.json(
        { success: false, message: 'Eksik parametreler: txHash, walletAddress ve userId gerekli' },
        { status: 400 }
      );
    }
    
    // Oyun cüzdan adresi
    const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'UQAC6bB2_GD_CMnBRBTO8HNomIdsH7mID1nk4Pc_NTiVquD3';
    
    // İşlemi doğrula
    const isVerified = await verifyTransaction(txHash, gameWalletAddress, '1000000000'); // 1 TON
    
    if (!isVerified) {
      return NextResponse.json({
        success: false,
        message: 'İşlem doğrulanamadı veya miktar yetersiz'
      });
    }
    
    // Premium özelliği aktifleştir
    const activationResult = await activateAutoMining(userId);
    
    return NextResponse.json({
      success: activationResult.success,
      message: activationResult.message,
      txHash
    });
    
  } catch (error: any) {
    console.error('Otomatik mining aktivasyon hatası:', error);
    return NextResponse.json(
      { success: false, message: `İşlem sırasında hata: ${error.message}` },
      { status: 500 }
    );
  }
} 