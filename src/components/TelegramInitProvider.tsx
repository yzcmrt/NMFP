'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User } from '@/types';
import { toast } from 'react-hot-toast';
import { userService } from '@/services/api';
import { supabase } from '@/lib/supabaseClient';

const crypto = require('crypto-browserify');
// Supabase istemcisini oluştur
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// const supabase = createClient(supabaseUrl, supabaseKey);

// BOT_TOKEN değişkeni - Client tarafında erişilebilmesi için NEXT_PUBLIC_ ön ekiyle olmalı
// Not: Bu bir güvenlik riski oluşturabilir, üretim ortamında daha güvenli yöntemler kullanmalısınız
const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
console.log('NEXT_PUBLIC_TELEGRAM_BOT_TOKEN:', process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ? 'tanımlı' : 'tanımlı değil');

// Telegram Web App context tipi
interface TelegramContextType {
  telegramUser: TelegramUser | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  rawInitData: string | null;
  parsedInitData: TelegramInitData | null;
  refreshUserData: () => Promise<void>;
}

// Telegram kullanıcı tipi (WebAppUser)
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
}

// Telegram initData içeriği - Döküman WebAppInitData'ya göre
interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: TelegramChat;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

// Telegram Chat tipi
interface TelegramChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

// Context oluştur
const TelegramContext = createContext<TelegramContextType>({
  telegramUser: null,
  user: null,
  isLoading: true,
  error: null,
  rawInitData: null,
  parsedInitData: null,
  refreshUserData: async () => {},
});

// Hook
export const useTelegram = () => useContext(TelegramContext);

export default function TelegramInitProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawInitData, setRawInitData] = useState<string | null>(null);
  const [parsedInitData, setParsedInitData] = useState<TelegramInitData | null>(null);

  // Kullanıcı verisini yenileme fonksiyonu
  const refreshUserData = async () => {
    if (!user?.id) return;
    
    try {
      console.log('[TelegramInitProvider] Kullanıcı verisi yenileniyor:', user.id);
      const updatedUser = await userService.getUserById(user.id);
      if (updatedUser) {
        console.log('[TelegramInitProvider] Kullanıcı verisi güncellendi:', updatedUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('[TelegramInitProvider] Kullanıcı verisi yenilenirken hata:', error);
    }
  };

  useEffect(() => {
    // Telegram WebApp API'sini yükle
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      initTelegramApp();
    };

    script.onerror = () => {
      setError('Telegram Web App API yüklenemedi');
      setIsLoading(false);
    };

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Realtime aboneliği için useEffect
  useEffect(() => {
    if (!user?.id) return;

    let updateTimer: NodeJS.Timeout | null = null;
    
    // Debounced update fonksiyonu
    const debouncedRefreshUserData = () => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      updateTimer = setTimeout(() => {
        refreshUserData();
      }, 1000); // 1 saniye debounce
    };

    // Users tablosu için realtime kanal
    const userChannel = supabase
      .channel(`users:${user.id}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users', 
          filter: `id=eq.${user.id}` 
        }, 
        (payload) => {
          console.log('[TelegramInitProvider] Kullanıcı verisi değişti:', payload);
          
          // Yeni kullanıcı verisini state'e aktar
          if (payload.new) {
            // Tip güvenliği için tüm alanları açıkça belirt
            const updatedUser: User = {
              id: payload.new.id,
              telegram_id: payload.new.telegram_id,
              username: payload.new.username,
              wallet_address: payload.new.wallet_address,
              balance: payload.new.balance || 0,
              ton_coins: payload.new.ton_coins || '0',
              xp: payload.new.xp || 0,
              is_premium: Boolean(payload.new.is_premium),
              level: payload.new.level || 1,
              last_bonus_collected_at: payload.new.last_bonus_collected_at,
              first_login_at: payload.new.first_login_at,
              last_login: payload.new.last_login,
              created_at: payload.new.created_at,
              selected_car_id: payload.new.selected_car_id,
              selected_garage_id: payload.new.selected_garage_id
            };
            
            setUser(updatedUser);
            toast.success('Kullanıcı bilgileri güncellendi!');
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[TelegramInitProvider] Users realtime aboneliği başarılı: users:${user.id}`);
        } else {
          console.error(`[TelegramInitProvider] Users realtime aboneliği hatası:`, status, err);
        }
      });

    // Transactions tablosu için realtime kanal
    const transactionChannel = supabase
      .channel(`transactions:${user.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'transactions', 
          filter: `user_id=eq.${user.id}` 
        }, 
        (payload) => {
          console.log('[TelegramInitProvider] Yeni transaction eklendi:', payload);
          
          // Transaction tiplerine göre mesaj göster
          if (payload.new) {
            const transaction = payload.new;
            let message = '';
            
            switch (transaction.type) {
              case 'reward':
                message = `🎉 ${transaction.amount} NMFP kazandınız!`;
                break;
              case 'purchase':
                message = `💰 ${transaction.amount} NMFP harcandı`;
                break;
              case 'deposit':
                message = `💸 ${transaction.amount} NMFP yüklendi`;
                break;
              case 'withdraw':
                message = `🏦 ${transaction.amount} NMFP çekildi`;
                break;
              default:
                message = `💱 İşlem gerçekleşti: ${transaction.amount} NMFP`;
            }
            
            if (message) {
              toast.success(message, { duration: 3000 });
            }
            
            // Kullanıcı verisini debounced olarak güncelle
            debouncedRefreshUserData();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[TelegramInitProvider] Transactions realtime aboneliği başarılı: transactions:${user.id}`);
        } else {
          console.error(`[TelegramInitProvider] Transactions realtime aboneliği hatası:`, status, err);
        }
      });

    // Cleanup
    return () => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      userChannel.unsubscribe();
      transactionChannel.unsubscribe();
      console.log(`[TelegramInitProvider] Realtime abonelikleri sonlandırıldı: users:${user.id}, transactions:${user.id}`);
    };
  }, [user?.id]); // Sadece user.id değiştiğinde çalışsın

  const initTelegramApp = async () => {
    try {
      // @ts-ignore - Telegram WebApp global namespace
      const tg = window.Telegram?.WebApp;
      
      if (!tg) {
        throw new Error('Telegram WebApp API bulunamadı');
      }

      // WebApp API ve tüm özellikleri kontrol amaçlı logla
      console.log('Telegram WebApp API:', tg);
      console.log('Telegram Platform:', tg.platform);
      console.log('Telegram Version:', tg.version);
      console.log('Telegram ColorScheme:', tg.colorScheme);
      console.log('Telegram ThemeParams:', tg.themeParams);
      
      // WebApp'i başlat
      tg.expand();
      tg.ready();

      // Telegram kullanıcı bilgilerini al
      const initDataString = tg.initData;
      setRawInitData(initDataString);
      
      console.log('Raw Telegram initData:', initDataString);
      
      if (!initDataString) {
        // Geliştirme ortamındayız veya doğrudan tarayıcıdan erişildi
        console.warn('Telegram initData bulunamadı. Geliştirme modu varsayılıyor.');
        
        // Geliştirme için örnek veri
        const devUser: TelegramUser = {
          id: 12345678,
          first_name: 'Developer',
          username: 'dev_user',
        };
        
        setTelegramUser(devUser);
        
        // Test için sahte InitData
        const devInitData: TelegramInitData = {
          user: devUser,
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'test-hash'
        };
        
        setParsedInitData(devInitData);
        await fetchOrCreateUserAndUpdateState(devUser);
        return;
      }

      // initData'yı ayrıştır
      const parsedData = parseInitData(initDataString);
      setParsedInitData(parsedData);
      
      // Daha detaylı log yazdırma için
      console.log('--------------------------------------------------------');
      console.log('🔍 Telegram InitData Tam Analiz:');
      console.log('--------------------------------------------------------');
      console.log('📝 Ham InitData:', initDataString);
      console.log('📊 Ayrıştırılmış InitData:', parsedData);
      
      if (parsedData && parsedData.user) {
        console.log('👤 Telegram Kullanıcısı:');
        console.table(parsedData.user);
        
        console.log('📋 Kullanıcı Alan Bilgileri:');
        for (const [key, value] of Object.entries(parsedData.user)) {
          console.log(`${key}:`, value);
        }
      }
      
      if (parsedData && parsedData.chat) {
        console.log('💬 Telegram Sohbet:');
        console.table(parsedData.chat);
      }
      
      console.log('🔐 Auth Date:', parsedData?.auth_date ? new Date(parsedData.auth_date * 1000).toLocaleString() : 'Yok');
      console.log('🔑 Hash:', parsedData?.hash);
      console.log('--------------------------------------------------------');
      
      if (!parsedData || !parsedData.user) {
        throw new Error('Geçersiz Telegram verileri');
      }

      // Veriyi doğrula
      if (!BOT_TOKEN) {
        console.warn('BOT_TOKEN bulunamadı, veri doğrulaması yapılamıyor');
      } else {
        const isValid = validateInitData(initDataString, parsedData.hash);
        console.log('Telegram veri doğrulama sonucu:', isValid);
        
        if (!isValid) {
          console.error('Telegram verileri doğrulanamadı');
          throw new Error('Telegram verisi geçersiz - doğrulama başarısız');
        }
      }

      setTelegramUser(parsedData.user);
      console.log('Telegram User:', parsedData.user);
      
      // Kullanıcı varsa, veritabanında işlem yap
      await fetchOrCreateUserAndUpdateState(parsedData.user);
    } catch (err: any) {
      console.error('Telegram init hatası:', err);
      setError(err.message || 'Bilinmeyen başlatma hatası');
    } finally {
      setIsLoading(false);
    }
  };

  // Telegram initData'yı ayrıştır
  const parseInitData = (initDataString: string): TelegramInitData | null => {
    try {
      const urlParams = new URLSearchParams(initDataString);
      const result: Partial<TelegramInitData> = {
        auth_date: Number(urlParams.get('auth_date') || 0),
        hash: urlParams.get('hash') || '',
      };

      // Tüm parametreleri konsola logla
      console.log('Tüm URL parametreleri:');
      for (const [key, value] of urlParams.entries()) {
        console.log(`${key}:`, value);
        
        if (key !== 'user' && key !== 'receiver' && key !== 'chat' && 
            key !== 'auth_date' && key !== 'hash') {
          // @ts-ignore - Dinamik özellik atama
          result[key] = value;
        }
      }

      // Karmaşık tipleri JSON parse ile işle
      const userStr = urlParams.get('user');
      if (userStr) {
        try {
          result.user = JSON.parse(userStr);
          console.log('Parsed user:', result.user);
        } catch (e) {
          console.error('User parsing error:', e);
        }
      }
      
      const receiverStr = urlParams.get('receiver');
      if (receiverStr) {
        try {
          result.receiver = JSON.parse(receiverStr);
          console.log('Parsed receiver:', result.receiver);
        } catch (e) {
          console.error('Receiver parsing error:', e);
        }
      }
      
      const chatStr = urlParams.get('chat');
      if (chatStr) {
        try {
          result.chat = JSON.parse(chatStr);
          console.log('Parsed chat:', result.chat);
        } catch (e) {
          console.error('Chat parsing error:', e);
        }
      }
      
      return result as TelegramInitData;
    } catch (e) {
      console.error('initData ayrıştırma hatası:', e);
      return null;
    }
  };

  // Telegram initData doğrulama
  const validateInitData = (initDataString: string, receivedHash: string): boolean => {
    try {
      // BOT_TOKEN yoksa doğrulama yapılamaz
      if (!BOT_TOKEN) {
        console.warn('BOT_TOKEN bulunamadı. Doğrulama atlanıyor. Lütfen .env.local dosyanızı kontrol edin.');
        console.warn('NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ortam değişkenini tanımlayın.');
        
        // Geliştirme amaçlı: BOT_TOKEN yoksa doğrulama atlanır
        // NOT: Gerçek uygulamada, veri doğrulaması olmadan devam etmek güvenlik riski oluşturur
        return true;
      }
      
      // Gelen hash'i ayır
      const urlParams = new URLSearchParams(initDataString);
      urlParams.delete('hash');
      
      // Sıralanmış veri dizesini oluştur
      const dataCheckArr: string[] = [];
      
      for (const [key, value] of [...urlParams.entries()].sort()) {
        dataCheckArr.push(`${key}=${value}`);
      }
      
      const dataCheckString = dataCheckArr.join('\n');
      console.log('Data check string:', dataCheckString);
      
      // Secret key oluştur: HMAC-SHA256(bot_token, "WebAppData")
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(BOT_TOKEN)
        .digest();
      
      // Veri imzasını oluştur
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      console.log('Generated hash:', signature);
      console.log('Received hash:', receivedHash);
      
      // İmzayı karşılaştır
      return signature === receivedHash;
    } catch (e) {
      console.error('Veri doğrulama hatası:', e);
      return false;
    }
  };

  // Kullanıcıyı veritabanında bul veya oluştur
  const fetchOrCreateUserAndUpdateState = async (tgUser: TelegramUser) => {
    if (!tgUser || !tgUser.id) {
      console.error('fetchOrCreateUserAndUpdateState çağrıldı ancak tgUser veya tgUser.id eksik.');
      setError('Geçersiz Telegram kullanıcı bilgisi.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[TelegramInitProvider] fetchOrCreateUserAndUpdateState başladı, Telegram ID:', tgUser.id);
      
      // Premium durumunu logla
      const isPremium = tgUser.is_premium || false;
      console.log('[TelegramInitProvider] Kullanıcı premium durumu:', isPremium);
      
      // userService kullanımı öncesi userService var mı kontrol et
      if (!userService || !userService.getOrCreateUser) {
        console.error('[TelegramInitProvider] userService veya getOrCreateUser metodu bulunamadı');
        throw new Error('Servis hatası: userService bulunamadı');
      }
      
      // İlk deneme - Normal şekilde getir veya oluştur
      try {
        console.log('[TelegramInitProvider] Normal getOrCreateUser deniyor...');
        const response = await userService.getOrCreateUser(String(tgUser.id), tgUser.username, isPremium);
        
        if (response && response.user && response.user.id) {
          // Başarılı
          setUser(response.user);
          console.log('[TelegramInitProvider] User state güncellendi:', response.user);
        
          // Yeni kullanıcı ise, hoş geldin mesajı göster
          if (response.isNew) {
            console.log('[TelegramInitProvider] Yeni kullanıcı tespit edildi.');
            
            let welcomeMessage = 'Hoş geldiniz! 50.000 NMFP, 1 adet 718 Cayman ve 3 araçlık garaj hesabınıza eklendi.';
            
            if (isPremium) {
              welcomeMessage = 'Hoş geldiniz Premium üye! 100.000 NMFP, 1 adet 911 Carrera, 1 adet 718 Cayman ve 5 araçlık garaj hesabınıza eklendi.';
            }
            
            toast.success(welcomeMessage);
          }
          
          return; // Başarıyla tamamlandı
        }
        
        // Buraya gelindiyse veri alınamadı - force_create ile zorla yeniden oluştur
        console.warn('[TelegramInitProvider] Normal getOrCreateUser başarısız, force_create deneniyor...');
        
      } catch (firstTryError) {
        console.error('[TelegramInitProvider] İlk deneme başarısız:', firstTryError);
        // Devam edip zorla oluşturacak
        }
        
      // Force create ile tekrar dene
      try {
        console.log('[TelegramInitProvider] FORCE CREATE ile kullanıcı oluşturuluyor...');
        
        // Doğrudan SQL çağrısı yaparak force_create
        const { data: forceCreateData, error: forceCreateError } = await supabase.rpc('get_or_create_user', {
          p_telegram_id: String(tgUser.id),
          p_username: tgUser.username,
          p_is_premium: isPremium,
          p_force_create: true // Zorla oluşturulması için
        });
        
        if (forceCreateError) {
          console.error('[TelegramInitProvider] Force create RPC hatası:', forceCreateError);
          throw new Error('Kullanıcı zorla oluşturulamadı: ' + forceCreateError.message);
        }
        
        console.log('[TelegramInitProvider] Force create sonucu:', forceCreateData);
        
        if (!forceCreateData || !forceCreateData.user_id) {
          throw new Error('Force create işlemi geçersiz veri döndürdü');
        }
        
        // Kullanıcıyı tekrar getir
        const userData = await userService.getUserById(forceCreateData.user_id);
        
        if (!userData || !userData.id) {
          throw new Error('Force create sonrası kullanıcı getirilemedi');
        }
        
        // Başarılı
        setUser(userData);
        console.log('[TelegramInitProvider] User state güncellendi (force create sonrası):', userData);
        
        // Hoş geldin mesajı
        let welcomeMessage = 'Hoş geldiniz! Hesabınız yeniden oluşturuldu. 50.000 NMFP, 1 adet 718 Cayman ve 3 araçlık garaj hesabınıza eklendi.';
              
              if (isPremium) {
          welcomeMessage = 'Hoş geldiniz Premium üye! Hesabınız yeniden oluşturuldu. 100.000 NMFP, 1 adet 911 Carrera, 1 adet 718 Cayman ve 5 araçlık garaj hesabınıza eklendi.';
              }
              
              toast.success(welcomeMessage);
              
      } catch (forceCreateError: any) {
        console.error('[TelegramInitProvider] Force create denemesi başarısız:', forceCreateError);
        throw forceCreateError;
      }
      
    } catch (err: any) {
      console.error('[TelegramInitProvider] fetchOrCreateUser error:', err);
      setError(err.message || 'Kullanıcı getirilirken/oluşturulurken hata oluştu.');
      setUser(null); // Hata durumunda kullanıcıyı temizle
      
      // Hata mesajı göster
      toast.error('Kullanıcı bilgileriniz alınırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TelegramContext.Provider value={{ 
      telegramUser, 
      user, 
      isLoading, 
      error,
      rawInitData,
      parsedInitData,
      refreshUserData
    }}>
      {children}
    </TelegramContext.Provider>
  );
} 
