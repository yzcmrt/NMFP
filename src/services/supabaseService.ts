import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, 
  UserCar, 
  Garage, 
  MiningSession,
  Task,
  Transaction, 
  CarModel,
  CarStatus,
  MiningStatus
} from '@/types';

// Supabase'den gelen potansiyel hataları işlemek için yardımcı fonksiyon
function handleSupabaseError(error: PostgrestError | null, context: string): void {
  if (error) {
    console.error(`Supabase Error (${context}):`, error);
    // PostgreSQL'den gelen özel hata mesajlarını yakalamaya çalışalım
    if (error.message.includes('exception')) {
      // Mesajı daha temiz hale getirelim (Örn: "Exception: Yetersiz NMFP puanı")
      const match = error.message.match(/Exception: (.*)/);
      if (match && match[1]) {
        throw new Error(`İşlem Başarısız: ${match[1].trim()}`);
      }
    }
    // Genel hata mesajı
    throw new Error(`Sunucu hatası (${context}): ${error.message}`);
  }
}

// Kullanıcı servisleri
export const userService = {
  /**
   * Kullanıcı bilgilerini getirir
   */
  getUserData: async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      return data as User;
    } catch (error) {
      console.error('Kullanıcı bilgisi alınırken hata:', error);
      return null;
    }
  },

  /**
   * Telegram ID ve kullanıcı adı ile kullanıcıyı getir veya oluştur (RPC kullanarak)
   */
  async getOrCreateUser(telegramId: string, username?: string): Promise<User> {
    console.log(`[supabaseService] getOrCreateUser called with telegramId: ${telegramId}, username: ${username}`);
    // RPC fonksiyonunu çağır (SQL fonksiyonu TEXT telegram_id bekliyor)
    const { data: result, error: rpcError } = await supabase.rpc('get_or_create_user', {
      p_telegram_id: telegramId, // TEXT olarak gönder
      p_username: username,
    });

    handleSupabaseError(rpcError, 'getOrCreateUser RPC');
    console.log('[supabaseService] getOrCreateUser RPC result:', result);
    
    // RPC'den dönen JSON objesini kontrol et
    if (!result || typeof result !== 'object' || !result.user_id || typeof result.user_id !== 'string') {
      throw new Error('Kullanıcı ID alınamadı veya geçersiz formatta.');
    }

    const userId = result.user_id; // Bu artık UUID (string)
    const isNew = result.is_new;
    console.log(`[supabaseService] getOrCreateUser User ID: ${userId}, Is New: ${isNew}`);

    // Kullanıcı detaylarını UUID ile çek
    const { data: userDetails, error: fetchError } = await supabase
      .from('users')
      .select('*') // Gerekli tüm sütunları seçtiğinden emin ol
      .eq('id', userId) // UUID (string) ile filtrele
      .single();

    handleSupabaseError(fetchError, 'getOrCreateUser fetch details');
    if (!userDetails) {
      throw new Error('Kullanıcı detayları RPC sonrası alınamadı.');
    }
    console.log('[supabaseService] getOrCreateUser Fetched User Details:', userDetails);

    // Veritabanı verisini User tipine map et (User tipi id: string beklemeli)
    return {
      id: userDetails.id, // users.id UUID (string) olmalı
      username: userDetails.username,
      walletAddress: userDetails.wallet_address || '',
      balance: userDetails.balance,
      xp: userDetails.xp,
      level: userDetails.level,
      lastLogin: userDetails.last_login, // Ekledim
      createdAt: userDetails.created_at, // Ekledim
      selectedCarId: userDetails.selected_car_id, // Ekledim (number olabilir)
      selectedGarageId: userDetails.selected_garage_id, // Ekledim (number olabilir)
      isNew: isNew // isNew bilgisini de döndürelim
    };
  },

  /**
   * Kullanıcı bilgilerini (username, wallet, seçili araç/garaj) RPC kullanarak günceller.
   */
  async updateUser(userId: string, userData: {
       username?: string | null; 
       walletAddress?: string | null;
       selectedCarId?: number | null; // Bunlar SERIAL ID'ler, number kalmalı
       selectedGarageId?: number | null; // Bunlar SERIAL ID'ler, number kalmalı
  }): Promise<boolean> {
    // SQL fonksiyonu UUID (TEXT) userId ve diğer opsiyonel parametreleri bekliyor.
    const { data, error } = await supabase.rpc('update_user_profile', { // Varsayım: update_user_profile RPC'si var
      p_user_id: userId,          // String UUID olarak gönder
      p_username: userData.username,
      p_wallet_address: userData.walletAddress,
      p_selected_car_id: userData.selectedCarId,
      p_selected_garage_id: userData.selectedGarageId
    });

    handleSupabaseError(error, 'updateUser RPC');

    if (typeof data !== 'boolean') {
        console.error('updateUser RPC beklenmeyen dönüş tipi:', data);
        throw new Error("Kullanıcı güncellenirken geçersiz yanıt alındı");
    }

    return data;
  },

  /**
   * Sadece kullanıcı ID'sine göre kullanıcı bilgilerini getirir
   */
   async getUserById(userId: string): Promise<User | null> {
    try {
      console.log('[supabaseService] getUserById called for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId) // String UUID ile filtrele
        .maybeSingle(); // Use maybeSingle to avoid PGRST116 error

      if (error) { 
        console.error('[supabaseService] getUserById error:', error);
        handleSupabaseError(error, 'getUserById');
        return null; 
      } 
      
      if (!data) {
        console.warn('[supabaseService] No user found for ID:', userId);
        return null;
      }

      console.log('[supabaseService] User found successfully:', {
        id: data.id,
        username: data.username,
        balance: data.balance
      }); 

    return {
      id: data.id, // string UUID
      username: data.username,
      walletAddress: data.wallet_address || '',
      balance: data.balance,
      xp: data.xp,
      level: data.level,
      lastLogin: data.last_login,
      createdAt: data.created_at,
      selectedCarId: data.selected_car_id,
      selectedGarageId: data.selected_garage_id,
      isNew: false // Bu fonksiyon isNew bilgisini döndürmez
    };
  },

  /**
   * Kullanıcının bakiyesini güncelle (RPC kullanarak)
   * amount pozitif ise ekleme, negatif ise çıkarma yapar.
   */
  async updateBalance(userId: string, amount: number): Promise<number> { // Dönüş tipi yeni bakiye (number)
    // SQL fonksiyonu UUID (TEXT) userId ve DECIMAL amount bekliyor
    const { data: newBalance, error } = await supabase.rpc('adjust_user_balance', { // Varsayım: adjust_user_balance RPC'si var
      p_user_id: userId, // String UUID olarak gönder
      p_amount: amount 
    });

    handleSupabaseError(error, 'updateBalance RPC');

    if (typeof newBalance !== 'number') {
      console.error('updateBalance RPC beklenmeyen dönüş tipi:', newBalance);
      throw new Error('Bakiye güncellenirken geçersiz yanıt alındı.');
    }

    return newBalance;
  }
};

// Araç servisleri
export const carService = {
  /**
   * Kullanıcının araçlarını getirir
   */
  getUserCars: async (userId: string): Promise<UserCar[]> => {
    try {
      const { data, error } = await supabase
        .from('user_cars')
        .select(`
          *,
          model:car_models(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data as UserCar[];
    } catch (error) {
      console.error('Araç bilgileri alınırken hata:', error);
      return [];
    }
  },

  /**
   * RPC kullanarak araç satın alır
   */
  async purchaseCar(userId: string, modelId: string, purchaseType: 'NMFP' | 'TON' | 'NFT'): Promise<number> {
    // SQL fonksiyonu UUID (TEXT) user_id ve UUID (TEXT) model_id bekliyor.
    const { data: newUserCarId, error } = await supabase.rpc('purchase_car', {
      p_user_id: userId,        // String UUID olarak gönder
      p_model_id: modelId,      // String UUID olarak gönder
      p_purchase_type: purchaseType,
    });

    handleSupabaseError(error, 'purchaseCar RPC');

    // RPC, yeni user_car INTEGER ID'sini döndürür
    if (typeof newUserCarId !== 'number' || newUserCarId <= 0) {
      console.error('purchaseCar RPC beklenmeyen dönüş tipi veya geçersiz ID:', newUserCarId);
      throw new Error('Araç satın alınırken bir hata oluştu, geçersiz yanıt.');
    }

    return newUserCarId;
  },

  /**
   * RPC kullanarak aracı tamir eder.
   */
  async repairCar(userId: string, carId: number): Promise<boolean> {
    // SQL fonksiyonu UUID (TEXT) userId ve INTEGER carId bekliyor.
    const { data, error } = await supabase.rpc('repair_car', { 
      p_user_id: userId, // String UUID olarak gönder
      p_car_id: carId    // INTEGER olarak gönder
    });
    handleSupabaseError(error, 'repairCar RPC');

    // RPC boolean döndürür.
    if (typeof data !== 'boolean') {
        console.error('repairCar RPC beklenmeyen dönüş tipi:', data);
        // Hata handleSupabaseError tarafından yakalanmadıysa, yine de hata fırlat.
        throw new Error("Araç tamir edilirken geçersiz yanıt alındı");
    }

    // Fonksiyon boolean döndürdüğü için ek kontrol yapmaya gerek yok,
    // hata varsa handleSupabaseError zaten fırlatacaktır.
    // Önceki manuel kontrol kaldırıldı: if (!data) throw new Error(...);
    return data;
  },

  /**
   * RPC kullanarak araca yakıt doldurur.
   */
  async refillCar(userId: string, carId: number): Promise<boolean> {
    // SQL fonksiyonu UUID (TEXT) userId ve INTEGER carId bekliyor.
    const { data, error } = await supabase.rpc('refill_car', { 
      p_user_id: userId, // String UUID olarak gönder
      p_car_id: carId    // INTEGER olarak gönder
    });
    handleSupabaseError(error, 'refillCar RPC');
    
    // RPC boolean döndürür.
    if (typeof data !== 'boolean') {
        console.error('refillCar RPC beklenmeyen dönüş tipi:', data);
        throw new Error("Araç yakıtı doldurulurken geçersiz yanıt alındı");
    }
    
    // Hata varsa handleSupabaseError fırlatacaktır.
    return data;
  },

  // Araç seçimi gibi basit güncellemeler için ayrı fonksiyon
  async selectCar(userId: string, carId: number | null): Promise<boolean> {
     const { error } = await supabase
      .from('users')
      .update({ selected_car_id: carId })
      .eq('id', userId);
    
    handleSupabaseError(error, 'selectCar');
    return !error;
  },

  /**
   * Tüm araçları bakıma alır ve yakıt doldurur
   */
  maintainAllCars: async (userId: string, maintenanceCost: number, fuelCost: number): Promise<boolean> => {
    try {
      // Veritabanı işlemlerini transaction içinde yap
      const { data, error } = await supabase.rpc('maintain_all_user_cars', {
        user_id_input: userId,
        maintenance_cost_input: maintenanceCost,
        fuel_cost_input: fuelCost
      });
      
      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Araç bakımı yapılırken hata:', error);
      return false;
    }
  }
};

// Garaj servisleri
export const garageService = {
  /**
   * Kullanıcının garajlarını getirir
   */
  getUserGarages: async (userId: string): Promise<Garage[]> => {
    try {
      const { data, error } = await supabase
        .from('garages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data as Garage[];
    } catch (error) {
      console.error('Garaj bilgileri alınırken hata:', error);
      return [];
    }
  },

  /**
   * RPC kullanarak garaj satın alır.
   */
  async purchaseGarage(userId: string, garageTemplateId: string, purchaseType: 'NMFP' | 'TON'): Promise<number> {
    // SQL fonksiyonu UUID (TEXT) userId ve TEXT templateId bekliyor.
    const { data: newGarageId, error } = await supabase.rpc('purchase_garage', {
      p_user_id: userId,            // String UUID olarak gönder
      p_garage_template_id: garageTemplateId, // TEXT olarak gönder
      p_purchase_type: purchaseType
    });

    handleSupabaseError(error, 'purchaseGarage RPC');

    // RPC yeni garage INTEGER ID'sini döndürür
    if (typeof newGarageId !== 'number' || newGarageId <= 0) {
      console.error('purchaseGarage RPC beklenmeyen dönüş tipi veya geçersiz ID:', newGarageId);
      throw new Error('Garaj satın alınırken bir hata oluştu, geçersiz yanıt.');
    }
    return newGarageId;
  },

  /**
   * RPC kullanarak günlük garaj bonuslarını toplar.
   */
  async collectGarageBonuses(userId: string): Promise<number> {
    // SQL fonksiyonu UUID (TEXT) userId bekliyor.
    const { data: totalBonus, error } = await supabase.rpc('collect_garage_bonuses', {
      p_user_id: userId // String UUID olarak gönder
    });

    handleSupabaseError(error, 'collectGarageBonuses RPC');

    // RPC toplam bonusu (BIGINT -> number) döndürür
    if (typeof totalBonus !== 'number') {
      console.error('collectGarageBonuses RPC beklenmeyen dönüş tipi:', totalBonus);
      // Fonksiyon 0 dönebilir, o yüzden sadece tipini kontrol et
      throw new Error('Garaj bonusları toplanırken geçersiz yanıt alındı.');
    }
    return totalBonus;
  }
};

// Mining servisleri
export const miningService = {
  /**
   * Kullanıcının aktif mining oturumunu getirir
   */
  getActiveMiningSession: async (userId: string): Promise<MiningSession | null> => {
    try {
      const { data, error } = await supabase
        .from('mining_sessions')
        .select('*')
        .eq('user_id', userId)
        .or(`status.eq.${MiningStatus.ACTIVE},status.eq.${MiningStatus.COMPLETED}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          // Veri bulunamadı hatası, bu durumda null döndür
          return null;
        }
        throw error;
      }
      
      return data as MiningSession;
    } catch (error) {
      console.error('Mining oturumu bilgileri alınırken hata:', error);
      return null;
    }
  },
  
  /**
   * Mining oturumu başlatır
   */
  startMiningSession: async (
    userId: string,
    carId: string,
    garageId: string,
    startTime: Date,
    endTime: Date,
    expectedReward: number
  ): Promise<MiningSession | null> => {
    try {
      // Önce araç durumunu güncelle
      const { error: carError } = await supabase
        .from('user_cars')
        .update({ status: CarStatus.MINING })
        .eq('id', carId)
        .eq('user_id', userId);
        
      if (carError) throw carError;
      
      // Mining oturumu oluştur
      const { data, error } = await supabase
        .from('mining_sessions')
        .insert({
          user_id: userId,
          car_id: carId,
          garage_id: garageId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          expected_reward: expectedReward,
          status: MiningStatus.ACTIVE,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      return data as MiningSession;
    } catch (error) {
      console.error('Mining oturumu başlatılırken hata:', error);
      return null;
    }
  },
  
  /**
   * Mining oturumunu tamamlar
   */
  completeMiningSession: async (sessionId: string): Promise<MiningSession | null> => {
    try {
      // Mining oturumunu güncelle
      const { data, error } = await supabase.rpc('complete_mining_session', {
        session_id_input: sessionId
      });
      
      if (error) throw error;
      
      // Güncellenmiş oturumu getir
      const { data: sessionData, error: sessionError } = await supabase
        .from('mining_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (sessionError) throw sessionError;
      
      return sessionData as MiningSession;
    } catch (error) {
      console.error('Mining oturumu tamamlanırken hata:', error);
      return null;
    }
  },
  
  /**
   * Mining ödüllerini toplar
   */
  claimMiningRewards: async (sessionId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('claim_mining_rewards', {
        session_id_input: sessionId
      });
      
      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Mining ödülleri toplanırken hata:', error);
      return false;
    }
  }
};

// Görev servisleri
export const taskService = {
  /**
   * Kullanıcının aktif görevlerini getirir.
   */
  async getActiveTasks(userId: string): Promise<Task[]> {
    // Aktif görevleri (tasks) ve kullanıcının bu görevlerdeki ilerlemesini (user_tasks)
    // birleştirerek getirelim.
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        total,
        reward,
        is_active,
        created_at,
        user_tasks!left (
          id,
          user_id,
          progress,
          is_completed,
          completed_at
        )
      `)
      .eq('is_active', true)
      .eq('user_tasks.user_id', userId); // user_tasks üzerindeki user_id'ye göre filtrele

    // handleSupabaseError(error, 'getActiveTasks');
    if (error) {
      console.error('Error fetching active tasks:', error);
      throw error;
    }
    console.log(`[supabaseService] getActiveTasks for ${userId}:`, data);

    if (!data) return [];

    return data.map(item => {
      // user_tasks bir array dönecek (left join nedeniyle), ilki (varsa) alınmalı
      const userTask = item.user_tasks && item.user_tasks.length > 0 ? item.user_tasks[0] : null;
      return {
        id: item.id, // tasks.id SERIAL (number)
        title: item.title,
        description: item.description,
        total: item.total,
        reward: item.reward, // NMFP puanı
        isActive: item.is_active,
        createdAt: item.created_at,
        userProgress: userTask ? {
          id: userTask.id, // user_tasks.id SERIAL (number)
          userId: userTask.user_id, // string UUID
          progress: userTask.progress,
          isCompleted: userTask.is_completed,
          completedAt: userTask.completed_at
        } : undefined
      };
    });
  },

  /**
   * Kullanıcının tamamlanmış görevlerini getirir.
   */
  async getCompletedTasks(userId: string): Promise<Task[]> {
    // Sadece tamamlanmış user_tasks kayıtlarını çekip ilişkili task bilgilerini alalım.
    const { data, error } = await supabase
      .from('user_tasks')
      .select(`
        id,
        user_id,
        progress,
        is_completed,
        completed_at,
        tasks (*)
      `)
      .eq('user_id', userId) // String UUID ile filtrele
      .eq('is_completed', true);

    // handleSupabaseError(error, 'getCompletedTasks');
     if (error) {
      console.error('Error fetching completed tasks:', error);
      throw error;
    }
    console.log(`[supabaseService] getCompletedTasks for ${userId}:`, data);

    if (!data) return [];

    return data.map(item => {
      // tasks ilişkisi null olabilir mi kontrol et
      if (!item.tasks) {
        console.warn(`User task ID ${item.id} missing task details.`);
        return null;
      }
      return {
        id: item.tasks.id, // tasks.id SERIAL (number)
        title: item.tasks.title,
        description: item.tasks.description,
        total: item.tasks.total,
        reward: item.tasks.reward,
        isActive: item.tasks.is_active,
        createdAt: item.tasks.created_at,
        userProgress: {
          id: item.id, // user_tasks.id SERIAL (number)
          userId: item.user_id, // string UUID
          progress: item.progress,
          isCompleted: item.is_completed,
          completedAt: item.completed_at
        }
      }
    }).filter(task => task !== null) as Task[]; // Null olanları filtrele
  },

  /**
   * RPC kullanarak görev ilerlemesini günceller.
   * SQL Fonksiyonu INTEGER task_id bekliyor olabilir, kontrol et!
   */
  async updateTaskProgress(userId: string, taskId: number, progressAmount: number): Promise<boolean> {
    // SQL fonksiyonu UUID (TEXT) userId ve INTEGER taskId bekliyor.
    const { data, error } = await supabase.rpc('update_task_progress', {
      p_user_id: userId,        // String UUID olarak gönder
      p_task_id: taskId,        // INTEGER olarak gönder
      p_progress_amount: progressAmount // INTEGER olarak gönder
    });

    handleSupabaseError(error, 'updateTaskProgress RPC');

    // RPC boolean döndürür (görev tamamlandı mı?)
    if (typeof data !== 'boolean') {
      console.error('updateTaskProgress RPC beklenmeyen dönüş tipi:', data);
      throw new Error('Görev ilerlemesi güncellenirken geçersiz yanıt alındı.');
    }
    return data;
  },

  // TODO: claimTaskReward için bir RPC fonksiyonu var mı? 
  // Yoksa, update_task_progress zaten ödülü veriyor mu kontrol et.
  // Şimdilik yorum satırı:
  /*
  async claimTaskReward(userId: string, userTaskId: number): Promise<boolean> {
    // SQL fonksiyonu UUID (TEXT) userId ve INTEGER userTaskId bekliyor (varsayım).
    const { data, error } = await supabase.rpc('claim_task_reward', {
      p_user_id: userId,
      p_user_task_id: userTaskId
    });
    handleSupabaseError(error, 'claimTaskReward RPC');
    if (typeof data !== 'boolean') {
      console.error('claimTaskReward RPC beklenmeyen dönüş tipi:', data);
      throw new Error('Görev ödülü alınırken geçersiz yanıt alındı.');
    }
    return data;
  }
  */
};

// İşlem (Transaction) servisleri
export const transactionService = {
  /**
   * Kullanıcının son işlemlerini getirir.
   */
  async getUserTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId) // String UUID ile filtrele
      .order('date', { ascending: false })
      .limit(limit);

    // handleSupabaseError(error, 'getUserTransactions');
    if (error) {
      console.error('Error fetching user transactions:', error);
      throw error;
    }
    console.log(`[supabaseService] getUserTransactions for ${userId}:`, data);

    if (!data) return [];

    return data.map(item => ({
      id: item.id, // SERIAL (number)
      userId: item.user_id, // string UUID
      type: item.type,
      amount: item.amount, // number (NUMERIC)
      currency: item.currency,
      status: item.status,
      item: item.item,
      source: item.source,
      // date: formatDate(item.date) // formatDate fonksiyonu yok
      date: item.date // string
    }));
  },

  /**
   * Yeni bir işlem kaydı oluşturur (Doğrudan INSERT, RPC değil)
   */
  async createTransaction(userId: string, txData: {
      type: string; 
      amount: number; 
      currency: string;
      status?: string; 
      item?: string | null;
      source?: string | null;
      // description?: string | null; // Veritabanında yok
  }): Promise<number> { 
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId, // String UUID
        type: txData.type,
        amount: txData.amount,
        currency: txData.currency,
        status: txData.status ?? 'confirmed',
        item: txData.item,
        source: txData.source,
        // date: otomatik atanır
      }])
      .select('id') // Yeni eklenen kaydın ID'sini al
      .single();

    // handleSupabaseError(error, 'createTransaction');
    if (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }

    if (!data || !data.id) {
        throw new Error('İşlem oluşturuldu ancak ID alınamadı.');
    }
    
    return data.id; // SERIAL (number)
  }
};

// Zaman hesaplama vb. yardımcı fonksiyonlar (gerekirse)
/*
function calculateRepairTimeLeft(repairEndTime: string): string {
  // ... implementasyon ...
  return "";
}

function calculateTaskTimeLeft(expireAt: string): string {
  // ... implementasyon ...
  return "";
}

function formatDate(dateString: string): string {
  // ... implementasyon ...
  return "";
}
*/

// Tüm modelleri çekmek için fonksiyon
export const getAvailableCarModels = async (): Promise<CarModel[]> => {
  const { data, error } = await supabase
    .from('car_models')
    .select('*')
    .order('nmfp_price', { ascending: true }); // Fiyata göre sırala

  if (error) {
    console.error('Error fetching car models:', error);
    throw error;
  }
  if (!data) return [];

  // Veriyi CarModel tipine map et
  return data.map(item => ({
      id: item.id, // UUID string
      name: item.name,
      description: item.description,
      imageUrl: item.image_url,
      rarity: item.rarity,
      miningPower: item.mining_power,
      maxFuel: item.max_fuel,
      maxHealth: item.max_health,
      nmfpPrice: item.nmfp_price,
      tonPrice: item.ton_price,
      nftMintPrice: item.nft_mint_price,
      refillCost: item.refill_cost,
      repairCost: item.repair_cost,
      createdAt: item.created_at,
  }));
};

// Tüm garaj şablonlarını çekmek için fonksiyon
export const getAvailableGarageTemplates = async (): Promise<Garage[]> => {
  const { data, error } = await supabase
    .from('garages')
    .select('*')
    .is('user_id', null) // Sadece şablonları al (user_id IS NULL)
    .order('value', { ascending: true }); // Fiyata göre sırala (value NMFP fiyatıydı)

  if (error) {
    console.error('Error fetching garage templates:', error);
    throw error;
  }
  if (!data) return [];

  // Veriyi Garage tipine map et
  return data.map(item => ({
    id: item.id, // SERIAL number
    userId: item.user_id, // null
    templateId: item.template_id, // TEXT string
    name: item.name,
    description: item.description,
    imageUrl: item.image_url,
    capacity: item.capacity,
    level: item.level,
    dailyBonus: item.daily_bonus,
    value: item.value, // NMFP fiyatı
    purchaseType: item.purchase_type, // 'NMFP' or 'TON'
    location: item.location,
    createdAt: item.created_at
  }));
};

export const supabaseService = {
  userService,
  carService,
  garageService,
  miningService,
  taskService,
  transactionService
}; 