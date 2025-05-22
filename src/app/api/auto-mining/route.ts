import { NextRequest, NextResponse } from 'next/server';
import { TonClient } from '@ton/ton';
import { Address, Cell } from '@ton/core';
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

// İşlem doğrulama fonksiyonu (geliştirilmiş)
async function verifyTransaction(
  txHash: string,
  address: string,
  amount: string = '1000000000', // 1 TON = 10^9 nanoTON
  maxAttempts: number = 10,
  retryDelay: number = 2000
): Promise<boolean> {
  console.log('İşlem doğrulama başladı:', { txHash, address, amount });
  
  // txHash veri tipi kontrolü
  if (!txHash || typeof txHash !== 'string') {
    console.error('Geçersiz txHash formatı:', txHash);
    return false;
  }
  
  // Base64 to hex dönüştürme denemesi (eğer txHash Cell.fromBoc olarak geldiyse)
  let normalizedTxHash: string;
  try {
    // txHash BOC formatında mı kontrol et
    if (txHash.startsWith('b64') || txHash.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      // boc içeriğini Cell'e dönüştürmeyi dene
      const cells = Cell.fromBoc(Buffer.from(txHash, 'base64'));
      normalizedTxHash = cells[0].hash().toString('hex');
      console.log('txHash BOC formatından hex\'e dönüştürüldü:', normalizedTxHash);
    } else {
      // Zaten hash formatında
      normalizedTxHash = txHash;
    }
  } catch (error) {
    console.warn('txHash dönüştürme hatası, orijinal değer kullanılacak:', error);
    normalizedTxHash = txHash;
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // İşlem sonucunu kontrol et
      const transactions = await tonClient.getTransactions(Address.parse(address), {
        limit: 10
      });
      
      console.log(`Kontrol edilen işlemler (${attempt + 1}/${maxAttempts}):`, 
        transactions.map(tx => ({
          hash: tx.hash.toString('hex'),
          lt: tx.lt.toString(),
          time: tx.time,
          inAmount: tx.inMessage?.value.toString() || '0'
        }))
      );
      
      // İşlemleri hash'e göre filtrele - hem orijinal hem de normalize edilmiş hash'i kontrol et
      const matchingTx = transactions.find(tx => 
        tx.hash.toString('hex') === normalizedTxHash || 
        tx.hash.toString() === txHash ||
        tx.hash.toString('hex') === txHash
      );
      
      if (matchingTx) {
        console.log('İşlem doğrulandı:', matchingTx.hash.toString('hex'));
        
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
    console.log('Auto-mining API çağrısı alındı');
    
    // Request body'den veri al
    const requestData = await request.json();
    const { txHash, walletAddress, userId } = requestData;
    
    console.log('İstek verileri:', { 
      txHashLength: txHash ? txHash.length : 'yok', 
      walletAddress, 
      userId 
    });
    
    // Gerekli alanları kontrol et
    if (!txHash || !walletAddress || !userId) {
      console.error('Eksik parametreler:', { txHash, walletAddress, userId });
      return NextResponse.json(
        { success: false, message: 'Eksik parametreler: txHash, walletAddress ve userId gerekli' },
        { status: 400 }
      );
    }
    
    // Kullanıcıyı kontrol et
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, premium_active, premium_until')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('Kullanıcı veritabanında bulunamadı:', userError);
      return NextResponse.json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      }, { status: 404 });
    }
    
    // Kullanıcı zaten premium ise kontrol et
    if (userData.premium_active && userData.premium_until) {
      const premiumUntil = new Date(userData.premium_until);
      if (premiumUntil > new Date()) {
        console.log('Kullanıcı zaten premium:', userId);
        return NextResponse.json({
          success: true,
          message: 'Kullanıcı zaten premium üyeliğe sahip',
          isAlreadyPremium: true
        });
      }
    }
    
    // Oyun cüzdan adresi
    const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 'UQAC6bB2_GD_CMnBRBTO8HNomIdsH7mID1nk4Pc_NTiVquD3';
    
    // İşlemi doğrula
    console.log('İşlem doğrulanıyor:', txHash);
    const isVerified = await verifyTransaction(txHash, gameWalletAddress, '1000000000'); // 1 TON
    
    if (!isVerified) {
      console.error('İşlem doğrulanamadı:', txHash);
      return NextResponse.json({
        success: false,
        message: 'İşlem doğrulanamadı veya miktar yetersiz'
      });
    }
    
    // Premium özelliği aktifleştir
    console.log('Premium özelliği aktifleştiriliyor:', userId);
    const activationResult = await activateAutoMining(userId);
    
    return NextResponse.json({
      success: activationResult.success,
      message: activationResult.message,
      txHash,
      debug: {
        verificationSuccess: isVerified,
        activationCalled: true
      }
    });
    
  } catch (error: any) {
    console.error('Otomatik mining aktivasyon hatası:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `İşlem sırasında hata: ${error.message}`,
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 