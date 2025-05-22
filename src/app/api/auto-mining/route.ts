import { NextRequest, NextResponse } from 'next/server';
import { TonClient } from '@ton/ton';
import { Address, Cell, BOC } from '@ton/core';
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

// BOC formatı doğrulama yardımcı fonksiyonu
function isValidBoc(bocString: string): boolean {
  try {
    if (!bocString || typeof bocString !== 'string') return false;
    
    // Standard base64 check
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Regex.test(bocString)) return false;
    
    // Basit uzunluk kontrolü (geçerli BOC en az belirli bir uzunlukta olmalı)
    if (bocString.length < 24) return false;
    
    // Ciddi bir BOC doğrulama denemesi
    try {
      const buffer = Buffer.from(bocString, 'base64');
      
      // BOC'nin "magic bytes" ile başlayıp başlamadığını kontrol et (b5ee9c72)
      // Bu, BOC formatının standart başlangıç bytes'larıdır
      if (buffer.length >= 4) {
        const magicBytes = buffer.slice(0, 4).toString('hex');
        // BOC magic bytes kontrolü
        if (magicBytes !== 'b5ee9c72') {
          console.warn('BOC magic bytes kontrolü başarısız, geçersiz imza:', magicBytes);
          return false;
        }
      }
      
      // Tam doğrulama için BOC parsing denemesi
      Cell.fromBoc(buffer);
      return true;
    } catch (error) {
      console.error('BOC doğrulama hatası:', error);
      return false;
    }
  } catch (error) {
    console.error('BOC doğrulama dış hatası:', error);
    return false;
  }
}

// İşlem doğrulama fonksiyonu (geliştirilmiş)
async function verifyTransaction(
  txHash: string,
  address: string,
  amount: string = '1000000000', // 1 TON = 10^9 nanoTON
  maxAttempts: number = 10,
  retryDelay: number = 2000
): Promise<boolean> {
  console.log('İşlem doğrulama başladı:', { 
    txHashLength: txHash ? txHash.length : 0,
    address, 
    amount 
  });
  
  // txHash veri tipi ve format kontrolü
  if (!txHash || typeof txHash !== 'string') {
    console.error('Geçersiz txHash formatı (null veya string değil):', txHash);
    return false;
  }
  
  // BOC formatını doğrula
  if (!isValidBoc(txHash)) {
    console.error('Geçersiz BOC formatı:', { 
      length: txHash.length,
      firstChars: txHash.slice(0, 20) + '...',
      isBase64: /^[A-Za-z0-9+/]+={0,2}$/.test(txHash)
    });
    return false;
  }
  
  // Base64 to hex dönüştürme
  let normalizedTxHash: string;
  let transactionId: string | null = null;
  
  try {
    // Safer BOC parsing
    let cellFromBoc: Cell;
    try {
      // İlk olarak standart yöntemi dene
      const cells = Cell.fromBoc(Buffer.from(txHash, 'base64'));
      cellFromBoc = cells[0];
    } catch (bocError) {
      // Alternatif yöntemler
      try {
        console.log('Standart BOC çözümleme başarısız, alternatif yöntem deneniyor...');
        // Bazı durumlarda formatlar farklı olabilir, BOC sınıfını doğrudan kullanarak dene
        const cells = BOC.fromStandard(Buffer.from(txHash, 'base64'));
        cellFromBoc = cells[0];
      } catch (alternativeBocError) {
        console.error('BOC çözümleme tamamıyla başarısız:', { 
          initialError: bocError,
          alternativeError: alternativeBocError 
        });
        return false;
      }
    }
    
    // Hash'i al
    normalizedTxHash = cellFromBoc.hash().toString('hex');
    transactionId = normalizedTxHash;
    console.log('BOC başarıyla çözümlendi, hash:', normalizedTxHash);
  } catch (error) {
    console.error('BOC çözümleme ve hash alma hatası:', error);
    // Orijinal txHash'i kullanmaya devam et
    normalizedTxHash = txHash;
  }
  
  // Blockchain'de işlemi kontrol et
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // İşlem sonucunu kontrol et
      const transactions = await tonClient.getTransactions(Address.parse(address), {
        limit: 10
      });
      
      console.log(`Blockchain işlem kontrolü (${attempt + 1}/${maxAttempts}):`, 
        transactions.length > 0 
          ? `${transactions.length} işlem bulundu`
          : 'İşlem bulunamadı'
      );
      
      // İşlem eşleşme kontrolü
      const matchingTx = transactions.find(tx => {
        const txHashHex = tx.hash.toString('hex');
        const matches = [
          // Çeşitli olası eşleşme yöntemleri
          txHashHex === normalizedTxHash,
          txHashHex === txHash,
          transactionId && txHashHex === transactionId,
          tx.inMessage?.body?.text === 'Auto Mining Purchase'
        ];
        
        return matches.some(match => match === true);
      });
      
      if (matchingTx) {
        console.log('İşlem doğrulandı:', {
          hash: matchingTx.hash.toString('hex'),
          time: matchingTx.time,
          lt: matchingTx.lt.toString()
        });
        
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
      
      console.log(`İşlem kontrolü (${attempt + 1}/${maxAttempts}): Henüz işlem bulunamadı, yeniden deneniyor...`);
      
      // Bekle ve tekrar dene
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.warn(`İşlem kontrol hatası (${attempt + 1}/${maxAttempts}):`, error);
      // Bekle ve tekrar dene
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  // Maksimum deneme sayısına ulaşıldı, işlem doğrulanamadı
  console.error('İşlem doğrulanamadı, maksimum deneme sayısına ulaşıldı:', {
    txHash: normalizedTxHash.substring(0, 20) + '...',
    attempts: maxAttempts,
    totalWaitMs: maxAttempts * retryDelay
  });
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
    console.log('İşlem doğrulanıyor:', txHash ? `${txHash.substring(0, 20)}...` : 'yok');
    
    try {
      const isVerified = await verifyTransaction(txHash, gameWalletAddress, '1000000000'); // 1 TON
      
      if (!isVerified) {
        console.error('İşlem doğrulanamadı:', txHash ? `${txHash.substring(0, 20)}...` : 'yok');
        return NextResponse.json({
          success: false,
          message: 'İşlem doğrulanamadı veya miktar yetersiz. Lütfen daha sonra tekrar deneyin.'
        });
      }
      
      // Premium özelliği aktifleştir
      console.log('Premium özelliği aktifleştiriliyor:', userId);
      const activationResult = await activateAutoMining(userId);
      
      return NextResponse.json({
        success: activationResult.success,
        message: activationResult.message,
        txHash: txHash ? `${txHash.substring(0, 20)}...` : 'yok',
        debug: {
          verificationSuccess: isVerified,
          activationCalled: true
        }
      });
    } catch (verifyError: any) {
      console.error('İşlem doğrulama hatası:', verifyError);
      return NextResponse.json({
        success: false,
        message: `İşlem doğrulama hatası: ${verifyError.message || 'Bilinmeyen hata'}`,
        error: process.env.NODE_ENV === 'development' ? verifyError.toString() : undefined
      }, { status: 500 });
    }
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