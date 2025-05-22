// Genel tip tanımlamaları

// --- Enum Tanımlamaları --- 
// Bunların değerlerinin veritabanındaki TEXT değerleriyle eşleştiğinden emin olun.

export enum CarStatus {
  ACTIVE = 'active',       // mining veya idle (kullanıma hazır)
  INACTIVE = 'inactive',   // Yeni alındı, garajda, vb.
  MINING = 'mining',       // Şu anda mining yapıyor
  REPAIRING = 'repairing',    // Şu anda tamirde
  SOLD = 'sold'            // Satılmış araç
  // DB Şeması:
  // CREATE TYPE car_status AS ENUM ('active', 'mining', 'repairing'); -- Eski? 
  // Veya TEXT mi? Şimdilik TEXT varsayıyoruz.
}

export enum MiningStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export enum TransactionType {
  DEPOSIT = 'deposit',                 // Para yatırma
  WITHDRAW = 'withdraw',               // Para çekme
  REWARD = 'reward',                   // Genel ödül (örn. günlük bonus)
  TASK_REWARD = 'task_reward',         // Görev ödülü (otomatik verilirse)
  TASK_REWARD_CLAIMED = 'task_reward_claimed', // Görev ödülü (manuel alındıysa)
  MINING_REWARD = 'mining_reward',       // Mining ödülü
  PURCHASE_CAR = 'purchase_car',         // Araç satın alma
  PURCHASE_GARAGE = 'purchase_garage',     // Garaj satın alma
  REPAIR_CAR = 'repair_car',           // Araç tamir masrafı
  REFILL_CAR = 'refill_car',           // Yakıt dolum masrafı
  EXPENSE = 'expense'                  // Diğer masraflar
}

export enum Rarity {
  COMMON = 'Common',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary'
}

// --- Arayüz Tanımlamaları --- 

/** 
 * Araç Modeli (car_models tablosu)
 */
export interface CarModel {
  id: string;                   // UUID Primary Key (DB: id UUID)
  name: string;                 // TEXT NOT NULL
  description: string | null;   // TEXT
  rarity: Rarity | string;      // TEXT NOT NULL (Enum ile eşleşmeli)
  image_url: string | null;     // TEXT (Görsel yolu)
  mining_power: number;         // INTEGER NOT NULL
  max_fuel: number;             // INTEGER NOT NULL
  max_health: number;           // INTEGER NOT NULL
  nmfp_price: number;           // BIGINT NOT NULL
  ton_price: number;            // NUMERIC NOT NULL
  nft_mint_price: number;       // NUMERIC NOT NULL
  refill_cost: number;          // BIGINT NOT NULL
  repair_cost: number;          // BIGINT NOT NULL
  nft_limit?: number | null;    // INTEGER
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  // brand ve series alanları kaldırıldı, name içinde yer alabilir.
}

/** 
 * Kullanıcı Aracı (user_cars tablosu)
 */
export interface UserCar {
  id: number;                   // SERIAL Primary Key
  user_id: string;              // UUID REFERENCES users(id)
  car_model_id: string;         // UUID REFERENCES car_models(id)
  name: string;                 // TEXT NOT NULL (Kullanıcının verdiği veya model adı)
  purchase_type: string;        // TEXT NOT NULL ('NMFP', 'TON', 'NFT', 'Initial')
  mining_multiplier: number;    // NUMERIC DEFAULT 1
  fuel: number;                 // NUMERIC(5, 2) DEFAULT 100
  condition: number;            // NUMERIC(5, 2) DEFAULT 100
  mining_tour_count: number;    // INTEGER DEFAULT 0
  status: CarStatus | string;   // TEXT DEFAULT 'inactive' (Enum ile eşleşmeli)
  garage_id?: number | null;    // INTEGER REFERENCES garages(id)
  repair_end_time?: string | null; // TIMESTAMP WITH TIME ZONE
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  updated_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  level: number;                // INTEGER DEFAULT 1

  // İlişkisel veri (opsiyonel, join ile gelirse)
  car_model?: CarModel;         // car_models ile ilişki (view_user_cars_with_models)
}

/** 
 * İşlem (transactions tablosu)
 */
export interface Transaction {
  id: number;                   // SERIAL Primary Key
  user_id: string;              // UUID REFERENCES users(id)
  type: TransactionType | string; // TEXT NOT NULL (Enum ile eşleşmeli)
  amount: number;               // NUMERIC(12, 2) NOT NULL (pozitif veya negatif olabilir)
  currency: string;             // TEXT NOT NULL ('NMFP', 'TON')
  status: TransactionStatus | string; // TEXT DEFAULT 'pending' (Enum ile eşleşmeli)
  source?: string | null;       // TEXT (Örn: 'Mining', 'Daily Bonus', 'Task: İlk Mining Turu')
  item?: string | null;         // TEXT (Örn: 'Porsche 911 Carrera', 'Standart Garaj')
  description?: string | null;  // TEXT (Ek açıklama)
  address?: string | null;      // TEXT (TON işlemleri için cüzdan adresi)
  date: string;                 // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
}

/** 
 * Garaj Şablonu (garage_templates tablosu)
 * Pazarda satılan garajları temsil eder.
 */
export interface GarageTemplate {
  id: string;                   // TEXT Primary Key (template_id, e.g., 'nmfp-1')
  name: string;                 // TEXT NOT NULL
  description: string | null;   // TEXT
  image: string | null;         // TEXT (NOT image_url based on image)
  capacity: number;             // INTEGER NOT NULL
  daily_bonus: number;          // BIGINT NOT NULL
  price: number;                // NUMERIC NOT NULL (Tek fiyat sütunu)
  purchase_type: 'nmfp' | 'ton' | string; // TEXT NOT NULL ('nmfp', 'ton')
  // location?: string | null; // Bu tabloda location var mıydı? Ekran görüntüsünde yok.
  // created_at?: string; // Ekran görüntüsünde yok.
}

/** 
 * Kullanıcı Garajı (garages tablosu)
 * Kullanıcının sahip olduğu garajları temsil eder.
 */
export interface Garage {
  id: number;                   // SERIAL Primary Key
  user_id: string;              // UUID REFERENCES users(id) (Artık null olamaz)
  template_id: string;          // TEXT REFERENCES garage_templates(id)
  name: string;                 // TEXT NOT NULL (Genellikle şablon adından türetilir)
  description?: string | null;  // TEXT
  image_url: string | null;     // TEXT (Kullanıcı garajı tablosundaki sütun adı)
  capacity: number;             // INTEGER NOT NULL
  daily_bonus: number;          // BIGINT NOT NULL
  level: number;                // INTEGER DEFAULT 1
  value: number;                // BIGINT DEFAULT 0
  purchase_type: string;        // TEXT NOT NULL
  location?: string | null;     // TEXT
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  
  // İlişkisel veri (view_garages_with_templates)
  garage_template?: GarageTemplate; // garage_templates ile ilişki
}

/** 
 * Mining Oturumu (mining_sessions tablosu)
 */
export interface MiningSession {
  id: number;                   // SERIAL Primary Key
  user_id: string;              // UUID REFERENCES users(id)
  car_id: number;               // INTEGER REFERENCES user_cars(id)
  garage_id?: number | null;    // INTEGER REFERENCES garages(id)
  start_time: string;           // TIMESTAMP WITH TIME ZONE NOT NULL
  end_time: string;             // TIMESTAMP WITH TIME ZONE NOT NULL
  expected_reward: number;      // BIGINT NOT NULL
  actual_reward?: number | null;// BIGINT
  status: string;               // TEXT DEFAULT 'active' ('active', 'completed', 'cancelled'?)
  completed_at?: string | null; // TIMESTAMP WITH TIME ZONE
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  // İlişkisel veri (opsiyonel)
  user_car?: UserCar;
  garage?: Garage;
}

/** 
 * Görev Tanımı (tasks tablosu)
 */
export interface Task { // Eski TaskDefinition yerine Task kullanabiliriz
  id: number;                   // SERIAL Primary Key
  title: string;                // TEXT UNIQUE NOT NULL
  description: string | null;   // TEXT
  total: number;                // INTEGER NOT NULL (Görevi tamamlamak için gereken sayı)
  reward: number;               // BIGINT NOT NULL (NMFP cinsinden)
  is_active: boolean;           // BOOLEAN DEFAULT true
  // SQL şemasında olmayan type ve frequency kaldırıldı
  // SQL şemasında olmayan icon ve unit kaldırıldı
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
}

/** 
 * Kullanıcı Görevi (user_tasks tablosu)
 */
export interface UserTask {
  id: number;                   // SERIAL Primary Key
  user_id: string;              // UUID REFERENCES users(id)
  task_id: number;              // INTEGER REFERENCES tasks(id)
  progress: number;             // INTEGER DEFAULT 0
  is_completed: boolean;        // BOOLEAN DEFAULT false
  completed_at?: string | null; // TIMESTAMP WITH TIME ZONE
  created_at: string;           // TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  // İlişkisel veri (opsiyonel)
  task?: Task;                // Görev tanımını içerebilir
}

// Eski Task arayüzü kaldırıldı.

/** 
 * Kullanıcı (users tablosu)
 */
export interface User {
  id: string;
  username?: string | null;
  telegram_id?: string | null;
  wallet_address?: string | null;
  balance: number;
  ton_coins?: string;
  xp: number;
  is_premium?: boolean;
  premium_active?: boolean;
  premium_until?: string;
  level: number;
  selected_car_id?: number | null;
  selected_garage_id?: number | null;
  last_bonus_collected_at?: string | null;
  first_login_at?: string;
  last_login?: string;
  created_at: string;
  updated_at?: string;
} 