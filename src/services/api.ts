import { supabase } from '@/lib/supabaseClient'; // <-- Paylaşılan istemciyi import et

import {
  CarModel,
  UserCar,
  Transaction,
  Garage,
  MiningSession,
  Task,
  User,
  UserTask, // Add UserTask import
  CarStatus,
  TransactionType,
  TransactionStatus, // Add TransactionStatus import
  GarageTemplate
} from '@/types';

// Genel API hata sınıfı
export class ApiError extends Error {
  statusCode: number;
  details?: any; // Add details for Supabase errors
  
  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

// Supabase hata işleyici
const handleSupabaseError = (error: any, context: string = 'Supabase isteği') => {
  console.error(`[${context}] Supabase Hatası:`, error);
  // PostgrestError tipini kontrol et
  if (error && typeof error.message === 'string') {
      // Daha spesifik hata mesajları ayıklama
      let message = error.message;
      if (error.details) {
          message += ` Detay: ${error.details}`;
      }
      if (error.hint) {
          message += ` İpucu: ${error.hint}`;
      }
       // Kısıtlama ihlalleri için
      if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint violation codes start with 23
          if (error.message.includes('unique constraint')) {
              message = 'Benzersizlik kısıtlaması ihlal edildi. Bu kayıt zaten mevcut olabilir.';
          } else if (error.message.includes('foreign key constraint')) {
              message = 'İlişkisel veri hatası. İlgili kayıt bulunamadı.';
          } else if (error.message.includes('check constraint')) {
              message = 'Veri doğrulama hatası.';
  }
      }
      // RPC fonksiyon hataları (PL/pgSQL RAISE EXCEPTION)
      if (error.message.includes('raise exception')) {
          // Genellikle mesajın kendisi yeterince açıklayıcıdır.
          // İsteğe bağlı olarak: message = error.message.split('ERROR: ')[1]?.split('CONTEXT:')[0]?.trim() || message;
          message = error.message; // Keep original message with context
      }
    throw new ApiError(message, 500, error); // Rethrow as ApiError
  }
  // Diğer hatalar
  throw new ApiError(`${context} başarısız oldu.`, 500, error);
};

// Araç model API servisleri
export const carModelService = {
  // Tüm modelleri getir
  getAllModels: async (): Promise<CarModel[]> => {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('*')
        .order('rarity', { ascending: false }) // Örnek sıralama
        .order('mining_power', { ascending: false });

      if (error) throw error;
      return data as CarModel[];
    } catch (error) {
      handleSupabaseError(error, 'getAllModels');
      return []; // Hata durumunda boş dizi döndür
    }
  },
  
  // Tek bir modeli ID'ye göre getir
  getModelById: async (modelId: string): Promise<CarModel | null> => {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
          if (error.code === 'PGRST116') return null; // Bulunamadı
          throw error;
      };
      return data as CarModel | null;
    } catch (error) {
      handleSupabaseError(error, 'getModelById');
      return null;
    }
  },
  
  // Seriye göre modelleri getir (DB'de series sütunu olmadığı için bu çalışmaz, name üzerinden filtreleme yapılabilir veya şema güncellenebilir)
  // getModelsBySeries: async (series: string): Promise<CarModel[]> => { ... }
};

// Kullanıcı araçları API servisleri
export const userCarService = {
  // Kullanıcının tüm araçlarını getir (ilişkili model bilgisiyle)
  getUserCars: async (userId: string): Promise<UserCar[]> => {
    try {
      // RPC fonksiyonunu kullan
      const { data, error } = await supabase
        .rpc('get_user_cars_with_models', {
          p_user_id: userId
        });

      if (error) throw error;
      
      // Gelen JSON veriyi dizi haline getir ve UserCar tipine cast et
      if (data && Array.isArray(data)) {
        console.log('getUserCars: Veri RPC fonksiyonundan başarıyla alındı', data.length);
        return data as UserCar[];
      } else if (data && typeof data === 'string') {
        // JSON string olarak gelirse
        try {
          const parsedData = JSON.parse(data);
          return Array.isArray(parsedData) ? parsedData : [];
        } catch (e) {
          console.error('getUserCars: JSON parse hatası', e);
          return [];
        }
      } else {
        console.warn('getUserCars: Beklenmeyen veri formatı', data);
        return [];
      }
    } catch (error) {
      handleSupabaseError(error, 'getUserCars');
      return [];
    }
  },
  
  // Tek bir kullanıcı aracını ID'ye göre getir (ilişkili model bilgisiyle)
  getCarById: async (carId: number): Promise<UserCar | null> => {
    try {
      const { data, error } = await supabase
        .from('user_cars')
        .select(`
          *,
          car_model:car_models(*)
        `)
        .eq('id', carId)
        .single();

      if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
      }
      return data as UserCar | null;
    } catch (error) {
      handleSupabaseError(error, 'getCarById');
      return null;
    }
  },
  
  // Araç durumunu güncelle (Doğrudan update yerine RPC fonksiyonu daha iyi olabilir, örn: repair_car)
  // updateCarStatus: async (carId: number, status: CarStatus | string): Promise<UserCar | null> => { ... }

  // Yeni araç satın al (RPC fonksiyonunu çağır)
  purchaseCar: async (userId: string, modelId: string, purchaseType: 'NMFP' | 'TON' | 'NFT'): Promise<number | null> => { // Yeni user_car ID'sini döndürür
    try {
      // Yeni v2 fonksiyonunu kullan
      const { data, error } = await supabase.rpc('purchase_car_v2', {
        p_user_id: userId,
        p_model_id: modelId,
        p_purchase_type: purchaseType
      });

      if (error) throw error;
      // Fonksiyon INTEGER döndürüyor (yeni user_car_id)
      if (typeof data === 'number') {
          return data;
      } else {
          console.warn('[purchaseCar] RPC beklenenden farklı bir tip döndürdü:', data);
          // Belki 0 veya null döndü? Hata mesajını kontrol etmek iyi olurdu.
          // throw new ApiError('Araç satın alma işlemi sonucu anlaşılamadı.');
          return null; // Veya hata fırlat
      }
    } catch (error) {
      handleSupabaseError(error, `purchaseCar (Type: ${purchaseType})`);
      return null; // veya hata fırlat
    }
  },
  
   // Araç tamirini başlat (RPC)
  repairCar: async (userId: string, carId: number): Promise<boolean> => {
      try {
          // Fonksiyon çakışmasını önlemek için fonksiyon adını spesifik olarak belirtiyoruz
          const { data, error } = await supabase.rpc('repair_car_uuid', {
              p_user_id: userId,
              p_car_id: carId
          });
          if (error) throw error;
          return data === true; // Fonksiyon BOOLEAN dönüyor
      } catch (error) {
          handleSupabaseError(error, 'repairCar');
          return false;
      }
  },

   // Araç yakıtını doldur (RPC)
  refillCar: async (userId: string, carId: number): Promise<boolean> => {
      try {
          // Fonksiyon çakışmasını önlemek için fonksiyon adını spesifik olarak belirtiyoruz
          const { data, error } = await supabase.rpc('refill_car_uuid', {
              p_user_id: userId,
              p_car_id: carId
          });
          if (error) throw error;
          return data === true; // Fonksiyon BOOLEAN dönüyor
      } catch (error) {
          handleSupabaseError(error, 'refillCar');
          return false;
      }
  }
};

// İşlem API servisleri
export const transactionService = {
  // Kullanıcının tüm işlemlerini getir
  getUserTransactions: async (userId: string, limit: number = 10): Promise<Transaction[]> => {
    console.log(`[getUserTransactions] Kullanıcı ${userId} için son ${limit} işlem çekiliyor...`);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        // Correct the column name for ordering
        .order('date', { ascending: false }) 
        .limit(limit);

      if (error) {
        console.error('[getUserTransactions] Supabase Hatası:', error);
        throw new ApiError(error.message);
      }

      console.log(`[getUserTransactions] ${data?.length ?? 0} işlem bulundu.`);
      // Ensure data matches Transaction type (basic check)
      return data || []; 
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        } else {
            console.error('[getUserTransactions] Beklenmeyen Hata:', error);
            throw new ApiError('İşlemler çekilirken beklenmeyen bir hata oluştu.');
        }
    }
  }
};

// Garaj API servisleri
export const garageService = {
  // Tüm garaj şablonlarını getir (garage_templates tablosundan)
  getGarageTemplates: async (): Promise<GarageTemplate[]> => {
    try {
      const { data, error } = await supabase
        .from('garage_templates') // Correct table name
        .select('*') // Select all columns from garage_templates
        .order('price', { ascending: true }); // Order by price for example

      if (error) throw error;
      // Cast data to the new GarageTemplate type
      return data as GarageTemplate[]; 
    } catch (error) {
      handleSupabaseError(error, 'getGarageTemplates');
      return [];
    }
  },

  // Kullanıcının sahip olduğu garajları getir (RPC ile)
  getUserGarages: async (userId: string): Promise<Garage[]> => {
    try {
      // RPC fonksiyonunu kullan
      const { data, error } = await supabase
        .rpc('get_user_garages_with_templates', {
          p_user_id: userId
        });

      if (error) throw error;
      
      // Gelen JSON veriyi dizi haline getir ve Garage tipine cast et
      if (data && Array.isArray(data)) {
        console.log('getUserGarages: Veri RPC fonksiyonundan başarıyla alındı', data.length);
        return data as Garage[];
      } else if (data && typeof data === 'string') {
        // JSON string olarak gelirse
        try {
          const parsedData = JSON.parse(data);
          return Array.isArray(parsedData) ? parsedData : [];
        } catch (e) {
          console.error('getUserGarages: JSON parse hatası', e);
          return [];
        }
      } else {
        console.warn('getUserGarages: Beklenmeyen veri formatı', data);
        return [];
      }
    } catch (error) {
      handleSupabaseError(error, 'getUserGarages');
      return [];
    }
  },

   // Yeni garaj satın al (RPC - v2 fonksiyonunu kullanacak şekilde güncellendi)
   purchaseGarage: async (userId: string, templateId: string, purchaseType: 'NMFP' | 'TON' | string): Promise<number | null> => { // Returns new USER garage ID (from garages table)
    try {
      // Yeni v2 fonksiyonunu kullan
      const { data, error } = await supabase.rpc('purchase_garage_v2', {
        p_user_id: userId,
        p_garage_template_id: templateId, // Pass the text template ID (e.g., 'nmfp-3')
        p_purchase_type: purchaseType
      });

      if (error) throw error;
      // Fonksiyonun INTEGER döndürmesi bekleniyor (yeni garages.id)
      if (typeof data === 'number') {
          return data;
      } else {
          console.warn('[purchaseGarage] RPC beklenenden farklı bir tip döndürdü:', data);
          return null; 
      }
    } catch (error) {
      handleSupabaseError(error, `purchaseGarage (Template: ${templateId}, Type: ${purchaseType})`);
      return null;
    }
  },

    // Günlük garaj bonuslarını topla (RPC)
    collectGarageBonuses: async (userId: string): Promise<number> => { // Toplanan bonus miktarını (BIGINT) döndürür
       try {
           const { data, error } = await supabase.rpc('collect_garage_bonuses', {
              p_user_id: userId
           });
            if (error) throw error;
           if (typeof data === 'number') {
              return data;
           } else {
              console.warn('[collectGarageBonuses] RPC beklenenden farklı bir tip döndürdü:', data);
              return 0;
           }
       } catch (error) {
           handleSupabaseError(error, 'collectGarageBonuses');
           return 0;
       }
  }
};

// Mining API servisleri
export const miningService = {
  // Kullanıcının aktif mining oturumunu getir (TEK)
  getActiveMiningSession: async (userId: string): Promise<MiningSession | null> => {
    try {
      const { data, error } = await supabase
        .from('mining_sessions')
        .select(`
            *,
            user_car:user_cars(*, car_model:car_models(*)),
            garage:garages(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active') // Sadece aktif olanı getir
        .maybeSingle(); // Tek kayıt veya null dönebilir

      if (error) throw error;
      return data as MiningSession | null;
    } catch (error) {
      handleSupabaseError(error, 'getActiveMiningSession');
      return null;
    }
  },
  
  // YENİ: Kullanıcının TÜM aktif mining oturumlarını getir
  getAllActiveMiningSessions: async (userId: string): Promise<MiningSession[]> => { 
    try {
      console.log(`[getAllActiveMiningSessions] Kullanıcı ${userId} için aktif ve tamamlanmış mining oturumları getiriliyor...`);
      
      const { data, error } = await supabase
        .from('mining_sessions')
        .select(`
            *,
            user_car:user_cars(*, car_model:car_models(*)),
            garage:garages(*)
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'completed']) // Hem aktif hem tamamlanmış oturumları getir
        .order('created_at', { ascending: false }); // En son oluşturulanlar önce

      if (error) {
        console.error(`[getAllActiveMiningSessions] Hata:`, error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log(`[getAllActiveMiningSessions] Aktif veya tamamlanmış mining oturumu bulunamadı (Kullanıcı: ${userId})`);
        return [];
      }
      
      console.log(`[getAllActiveMiningSessions] ${data.length} adet mining oturumu bulundu`);
      return data as MiningSession[]; // Dizi olarak döndür
    } catch (error) {
      console.error(`[getAllActiveMiningSessions] Beklenmeyen hata:`, error);
      handleSupabaseError(error, 'getAllActiveMiningSessions');
      return []; // Hata durumunda boş dizi
    }
  },

  // Mining başlat (TEK ARAÇ) - SQL fonksiyonu kullanarak
  startMining: async (userId: string, carId: number, garageId?: number | null): Promise<number | null> => { // Yeni session ID'sini döndürür
    try {
        console.log(`[startMining] Başlatılıyor: userId=${userId}, carId=${carId}, garageId=${garageId}`);
        
        // RPC çağrısı yaparak SQL fonksiyonunu çağır
        const { data, error } = await supabase.rpc('start_mining', {
           p_user_id: userId,
           p_car_id: carId,
           p_garage_id: garageId // Opsiyonel
        });
        
        if (error) {
            console.error(`[startMining] RPC hatası:`, error);
            throw error;
        }
        
        console.log(`[startMining] RPC sonucu:`, data);
         
        if (typeof data === 'number') {
            return data; // Yeni session ID'si
        } else {
            console.warn('[startMining] RPC beklenenden farklı bir tip döndürdü:', data);
            return null;
        }
    } catch (error) {
        handleSupabaseError(error, 'startMining');
        return null;
    }
  },
  
  // YENİ: Süresi dolmuş mining oturumlarını güncelle
  updateExpiredMiningSessions: async (): Promise<{ updatedCount: number, sessions: any[] }> => {
    try {
      console.log('[updateExpiredMiningSessions] Süresi dolmuş mining oturumları kontrol ediliyor...');
      
      const { data, error } = await supabase.rpc('update_expired_mining_sessions');
      
      if (error) {
        console.error('[updateExpiredMiningSessions] RPC hatası:', error);
        throw error;
      }
      
      console.log('[updateExpiredMiningSessions] Güncellenen oturumlar:', data);
      
      // API yanıtını düzenle
      const updatedCount = data?.updated_count || 0;
      const sessions = data?.sessions || [];
      
      return { updatedCount, sessions };
    } catch (error) {
      handleSupabaseError(error, 'updateExpiredMiningSessions');
      return { updatedCount: 0, sessions: [] };
    }
  },
  
  // YENİ: Uygun araçları hazırla ve topluca mining başlat
  prepareAndStartEligibleCars: async (userId: string, autoPayMaintenance: boolean): Promise<any | null> => { // RPC JSONB döndürüyor, any veya daha spesifik bir tip tanımlanabilir
    try {
        const { data, error } = await supabase.rpc('prepare_and_start_eligible_cars', {
           p_user_id: userId,
           p_auto_pay_maintenance: autoPayMaintenance
        });
         if (error) throw error;
         // Fonksiyon JSONB döndürüyor
         if (data) {
            // Dönen JSON'da error alanı var mı kontrol et (SQL tarafında hata olursa)
            if (data.error) {
                throw new ApiError(data.error, 500, data);
            }
            return data; 
         } else {
            console.warn('[prepareAndStartEligibleCars] RPC beklenenden farklı bir tip veya null döndürdü:', data);
            // Belki de hiç araç başlatılamadı? Bu bir hata mı? Şimdilik null dönelim.
            return null;
         }
    } catch (error) {
        handleSupabaseError(error, 'prepareAndStartEligibleCars');
        return null;
    }
  },

   // Mining tamamla (TEK OTURUM) - SQL fonksiyonu kullanarak
  completeMining: async (sessionId: number): Promise<number> => { // Kazanılan ödül miktarını (BIGINT) döndürür
      try {
          const { data, error } = await supabase.rpc('complete_mining', {
              p_mining_session_id: sessionId
          });
           if (error) throw error;
          if (typeof data === 'number') {
             return data; // Kazanılan ödül
          } else {
             console.warn('[completeMining] RPC beklenenden farklı bir tip döndürdü:', data);
             return 0;
          }
      } catch (error) {
          handleSupabaseError(error, 'completeMining');
          return 0;
      }
  }
};

// Görev API servisleri
export const taskService = {
    // Aktif görev tanımlarını getir
  getActiveTasks: async (): Promise<Task[]> => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            return data as Task[];
        } catch (error) {
            handleSupabaseError(error, 'getActiveTasks');
            return [];
        }
  },
  
    // Kullanıcının görevlerini getir (görev tanımıyla birlikte)
    getUserTasks: async (userId: string): Promise<UserTask[]> => {
        try {
            const { data, error } = await supabase
                .from('user_tasks')
                .select(`
                    *,
                    task:tasks(*)
                `)
                .eq('user_id', userId);

            if (error) throw error;
            return data as UserTask[];
        } catch (error) {
            handleSupabaseError(error, 'getUserTasks');
            return [];
        }
    },

   // Görev ilerlemesini güncelle (Bu fonksiyon genellikle backend trigger'ları veya diğer fonksiyonlar tarafından çağrılır, ama gerekirse RPC eklenebilir)
   // updateTaskProgress: async (userId: string, taskTitle: string, progressAmount: number): Promise<boolean> => { ... }

   // Tamamlanmış ve ödülü alınmamış görevleri getir (Bu özel bir sorgu gerektirebilir)
   // getClaimableTasks: async (userId: string): Promise<UserTask[]> => { ... }

   // Görev ödülünü al (Bu RPC fonksiyonu gerektirebilir: claim_task_reward(user_id, user_task_id))
   // claimTaskReward: async (userTaskId: number): Promise<boolean> => { ... }
};

// Kullanıcı API servisleri
export const userService = {
  // Kullanıcıyı getir veya oluştur
  getOrCreateUser: async (telegramId: string, username?: string | null, isPremium?: boolean, forceCreate: boolean = false): Promise<{ user: User | null, isNew: boolean }> => {
    try {
      console.log('[api.ts] getOrCreateUser called with telegramId:', telegramId, 'isPremium:', isPremium, 'forceCreate:', forceCreate);
      
      // RPC çağrısı yap
      const { data, error } = await supabase.rpc('get_or_create_user', {
        p_telegram_id: telegramId,
        p_username: username,
        p_is_premium: isPremium || false, // Premium durumunu gönder, varsayılan false
        p_force_create: forceCreate // Zorla oluşturma parametresi
      });

      if (error) {
        console.error('[api.ts] get_or_create_user RPC hatası:', error);
        throw error;
      }
      console.log('[api.ts] get_or_create_user RPC result:', data);

      // RPC sonucunu kontrol et
      if (!data) {
        throw new ApiError('get_or_create_user RPC null veri döndürdü.', 500);
      }
      
      if (!data.user_id) {
        throw new ApiError('Kullanıcı ID alınamadı.', 500, data);
      }
      
      const userId: string = data.user_id;
      const isNewUser: boolean = data.is_new;
      console.log(`[api.ts] Elde edilen kullanıcı bilgileri: ID=${userId}, isNew=${isNewUser}`);

      // Kullanıcı doğrudan RPC'den dönüyorsa onu kullan
      let userData: User | null = null;
      
      if (data.user) {
        console.log(`[getOrCreateUser] RPC kullanıcı verisi döndürdü:`, data.user);
        
        // RPC'den dönen veriyi User tipine dönüştür
        userData = {
          id: data.user.id,
          telegram_id: data.user.telegram_id,
          username: data.user.username,
          wallet_address: data.user.wallet_address || null,
          balance: data.user.balance || 0,
          ton_coins: data.user.ton_coins || '0',
          xp: data.user.xp || 0,
          is_premium: Boolean(data.user.is_premium) || false,
          level: data.user.level || 1,
          last_bonus_collected_at: data.user.last_bonus_collected_at,
          first_login_at: data.user.first_login_at,
          last_login: data.user.last_login,
          created_at: data.user.created_at,
          selected_car_id: data.user.selected_car_id,
          selected_garage_id: data.user.selected_garage_id
        } as User;
      } else {
        // Kullanıcı detaylarını ayrıca getir
        console.log(`[getOrCreateUser] RPC sonrası kullanıcı detayları çekiliyor (getUserById): ${userId}`);
        userData = await userService.getUserById(userId);
        
        // Kullanıcı verisi kontrolü
        if (!userData) {
          console.error(`[getOrCreateUser] userService.getUserById çağrısı sonrası kullanıcı verisi bulunamadı: ID ${userId}`);
          throw new ApiError(`Kullanıcı detayları alınamadı (ID: ${userId})`, 404);
        }
      }
      
      console.log(`[getOrCreateUser] Kullanıcı verisi başarıyla alındı:`, userData);
      return { user: userData, isNew: isNewUser };
    } catch (error) {
      console.error('[getOrCreateUser] Hata:', error);
      handleSupabaseError(error, 'getOrCreateUser');
      return { user: null, isNew: false };
    }
  },

  // Kullanıcı bilgilerini getir (ID ile)
  getUserById: async (userId: string): Promise<User | null> => {
    try {
        console.log(`[getUserById] Kullanıcı bilgisi alınıyor: ${userId}`);
        
        // Doğrudan eq kullan, filter yerine
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error(`[getUserById] Kullanıcı bilgisi alınırken hata: ${error.message}`);
            throw error;
        }
        
        if (!data) {
            console.warn(`[getUserById] ID için kullanıcı bulunamadı: ${userId}`);
            
            // Debug için ilave sorgu yapalım
            const debugQuery = await supabase
                .from('users')
                .select('id')
                .limit(5);
                
            console.log(`[getUserById] Debug - İlk 5 kullanıcı ID:`, 
                debugQuery.data?.map(u => u.id));
                
            return null;
        }

        console.log(`[getUserById] Kullanıcı verisi başarıyla alındı:`, data);
        
        // Veritabanından gelen veriyi User tipine dönüştür
        const user: User = {
            id: data.id,
            telegram_id: data.telegram_id,
            username: data.username,
            wallet_address: data.wallet_address || null,
            balance: data.balance || 0,
            ton_coins: data.ton_coins || '0',
            xp: data.xp || 0,
            is_premium: Boolean(data.is_premium) || false,
            level: data.level || 1,
            last_bonus_collected_at: data.last_bonus_collected_at,
            first_login_at: data.first_login_at,
            last_login: data.last_login,
            created_at: data.created_at,
            selected_car_id: data.selected_car_id,
            selected_garage_id: data.selected_garage_id
        };
        
        return user;
    } catch (error) {
        // Hata durumunu logla ve null döndür
        handleSupabaseError(error, `getUserById (ID: ${userId})`);
        return null;
    }
  },

  // Kullanıcı bakiyesini güncelle (Backend fonksiyonları bunu halletmeli, bu nadiren kullanılır)
  // updateUserBalance: async (userId: string, newBalance: number): Promise<User | null> => { ... }
}; 