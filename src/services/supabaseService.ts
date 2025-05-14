import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, 
  UserCar, 
  Garage, 
  MiningSession,
  Task,
  Transaction, 
  CarModel 
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId) // String UUID ile filtrele
      .single();

    if (error && error.code !== 'PGRST116') { 
      handleSupabaseError(error, 'getUserById');
      return null; 
    } 
    if (!data) return null; 

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
   * Kullanıcının araçlarını getir
   */
  async getUserCars(userId: string): Promise<UserCar[]> {
    const { data, error } = await supabase
      .from('user_cars')
      .select(`
        id, 
        user_id,
        car_model_id,
        name, 
        purchase_type,
        mining_multiplier,
        fuel,
        condition,
        status,
        mining_tour_count,
        repair_end_time,
        garage_id,
        level,
        created_at,
        updated_at,
        car_models (*)
      `)
      .eq('user_id', userId); // String UUID ile filtrele

    // handleSupabaseError(error, 'getUserCars'); // Hata varsa aşağıda yakalanır
    if (error) {
      console.error('Error fetching user cars:', error);
      throw error;
    }
    console.log(`[supabaseService] getUserCars for ${userId}:`, data);

    // Veriyi türlerine dönüştür
    if (!data) return []; // Veri yoksa boş array döndür
    
    return data.map(item => {
      // car_models ilişkisi null olabilir mi kontrol et
      if (!item.car_models) {
        console.warn(`User car ID ${item.id} missing car_model details.`);
        return null; // Veya varsayılan bir model döndür
      }
      return {
        id: item.id, // user_cars.id SERIAL (number)
        userId: item.user_id, // string UUID
        modelId: item.car_model_id, // car_models.id UUID (string)
        name: item.name, // user_cars.name (string)
        purchaseType: item.purchase_type, // string
        miningMultiplier: item.mining_multiplier, // number
        level: item.level ?? 1,
        fuel: item.fuel,
        condition: item.condition,
        // inGarage: item.garage_id ? String(item.garage_id) : '', // garage_id SERIAL (number)
        garageId: item.garage_id, // number | null
        status: item.status,
        miningTourCount: item.mining_tour_count,
        repairEndTime: item.repair_end_time, // string | null
        createdAt: item.created_at, // string
        updatedAt: item.updated_at, // string
        // repairTimeLeft: item.repair_end_time ? calculateRepairTimeLeft(item.repair_end_time) : undefined, // calculateRepairTimeLeft fonk. yok
        model: {
          id: item.car_models.id, // car_models.id UUID (string)
          name: item.car_models.name,
          description: item.car_models.description,
          imageUrl: item.car_models.image_url,
          rarity: item.car_models.rarity,
          miningPower: item.car_models.mining_power,
          maxFuel: item.car_models.max_fuel,
          maxHealth: item.car_models.max_health,
          nmfpPrice: item.car_models.nmfp_price,
          tonPrice: item.car_models.ton_price,
          nftMintPrice: item.car_models.nft_mint_price,
          refillCost: item.car_models.refill_cost,
          repairCost: item.car_models.repair_cost,
          createdAt: item.car_models.created_at,
        }
      }
    }).filter(car => car !== null) as UserCar[]; // Null olanları filtrele
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
  }
};

// Garaj servisleri
export const garageService = {
  /**
   * Kullanıcının garajlarını getir
   */
  async getUserGarages(userId: string): Promise<Garage[]> {
    const { data, error } = await supabase
      .from('garages')
      .select(`
        id,
        user_id,
        template_id
      `)
      .eq('user_id', userId) // String UUID ile filtrele
      .is('template_id', null); 

    // handleSupabaseError(error, 'getUserGarages');
    if (error) {
      console.error('Error fetching user garages:', error);
      throw error;
    }
    console.log(`[supabaseService] getUserGarages for ${userId}:`, data);

    if (!data) return []; // Veri yoksa boş array döndür
    
    return data.map(item => ({
      id: item.id, // garages.id SERIAL (number)
      userId: item.user_id, // string UUID
      templateId: item.template_id, // string | null
      name: item.name,
      description: item.description,
      imageUrl: item.image_url,
      capacity: item.capacity,
      level: item.level,
      dailyBonus: item.daily_bonus,
      value: item.value,
      purchaseType: item.purchase_type,
      location: item.location,
      createdAt: item.created_at
    }));
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
   * RPC kullanarak mining başlatır.
   */
  async startMining(userId: string, carId: number, garageId?: number | null): Promise<number> {
    // SQL fonksiyonu UUID (TEXT) userId, INTEGER carId, INTEGER garageId bekliyor.
    const { data: sessionId, error } = await supabase.rpc('start_mining', { 
      p_user_id: userId, // String UUID olarak gönder
      p_car_id: carId,   // INTEGER olarak gönder
      p_garage_id: garageId // INTEGER olarak gönder
    });
    handleSupabaseError(error, 'startMining RPC');

    // RPC, yeni mining_sessions INTEGER ID'sini döndürür.
    if (typeof sessionId !== 'number' || sessionId <= 0) {
      console.error('startMining RPC beklenmeyen dönüş tipi veya geçersiz ID:', sessionId);
      throw new Error('Mining başlatılırken bir hata oluştu, geçersiz yanıt.');
    }

    return sessionId;
  },
  
  /**
   * Aktif mining oturumlarını getir
   */
  async getActiveMining(userId: string): Promise<MiningSession[]> {
    // Veritabanından aktif mining sessionları çek (doğrudan, RPC değil)
    const { data, error } = await supabase
      .from('mining_sessions')
      .select(`
        id,
        user_id,
        car_id,
        garage_id,
        start_time,
        end_time,
        expected_reward,
        status,
        created_at,
        car:user_cars ( id, name, car_models ( id, name, image_url ) ),
        garage:garages ( id, name, image_url )
      `)
      .eq('user_id', userId) // String UUID ile filtrele
      .eq('status', 'active');

    // handleSupabaseError(error, 'getActiveMining');
    if (error) {
      console.error('Error fetching active mining sessions:', error);
      throw error;
    }
    console.log(`[supabaseService] getActiveMining for ${userId}:`, data);

    if (!data) return [];

    // Veriyi MiningSession tipine map et
    return data.map(item => {
      // İlişkili car ve garage verilerini kontrol et
      const carInfo = item.car ? {
        id: item.car.id,
        name: item.car.name,
        model: item.car.car_models ? {
          id: item.car.car_models.id,
          name: item.car.car_models.name,
          imageUrl: item.car.car_models.image_url
        } : undefined
      } : undefined;

      const garageInfo = item.garage ? {
        id: item.garage.id,
        name: item.garage.name,
        imageUrl: item.garage.image_url
      } : undefined;

      return {
        id: item.id, // SERIAL (number)
        userId: item.user_id, // string UUID
        carId: item.car_id, // INTEGER
        garageId: item.garage_id, // INTEGER | null
        startTime: item.start_time, // string
        endTime: item.end_time, // string
        expectedReward: item.expected_reward, // number (BIGINT)
        actualReward: item.actual_reward, // number (BIGINT) | null
        status: item.status, // string
        createdAt: item.created_at, // string
        // timeRemaining: calculateTimeRemaining(item.end_time), // Fonksiyon lazım
        // progressPercent: calculateProgress(item.start_time, item.end_time), // Fonksiyon lazım
        car: carInfo,
        garage: garageInfo,
      };
    });
  },
  
  /**
   * RPC kullanarak tamamlanmış mining seansını işler.
   */
  async completeMining(sessionId: number): Promise<number> {
    // SQL fonksiyonu INTEGER sessionId bekliyor.
    // user_id kontrolü fonksiyonun içinde yapılıyor.
    const { data: reward, error } = await supabase.rpc('complete_mining', {
      p_mining_session_id: sessionId // INTEGER olarak gönder
    });

    handleSupabaseError(error, 'completeMining RPC');

    // RPC ödülü (BIGINT -> number) döndürür
    if (typeof reward !== 'number') {
      console.error('completeMining RPC beklenmeyen dönüş tipi:', reward);
      throw new Error('Mining tamamlanırken geçersiz yanıt alındı.');
    }
    return reward;
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