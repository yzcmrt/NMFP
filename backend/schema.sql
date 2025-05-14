  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('NMFP', 'TON', 'NFT')), -- Satın alma türü
  mining_multiplier DECIMAL(5, 2) DEFAULT 1.00, -- Mining çarpanı (NFT/Özel araçlar için)
  fuel INTEGER DEFAULT 100 NOT NULL CHECK (fuel BETWEEN 0 AND 100), -- Yakıt durumu
  condition INTEGER DEFAULT 100 NOT NULL CHECK (condition BETWEEN 0 AND 100), -- Kondisyon durumu
  status car_status DEFAULT 'idle' NOT NULL, -- Araç durumu (idle, mining, repairing)
  mining_tour_count INTEGER DEFAULT 0 NOT NULL, -- Mining turu sayısı
  repair_end_time TIMESTAMP WITH TIME ZONE, -- Tamirin biteceği zaman
  garage_id INTEGER REFERENCES garages(id) ON DELETE SET NULL, -- Bağlı olduğu garaj ID'si
  last_refill_time TIMESTAMP WITH TIME ZONE, -- Son yakıt dolum zamanı
  last_repair_time TIMESTAMP WITH TIME ZONE, -- Son tamir zamanı
  UNIQUE(user_id, car_model_id) -- Bir kullanıcı aynı modelden birden fazla alamasın? Veya isimle mi unique olmalı?
  -- İsimle unique olması daha mantıklı olabilir: UNIQUE(user_id, name)
); 

CREATE TABLE garages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Garaj sahibi kullanıcı (NULL ise şablondur)
  name TEXT NOT NULL,
  image_url TEXT,
  capacity INTEGER NOT NULL DEFAULT 1, -- Garaj kapasitesi
  daily_bonus DECIMAL(10, 2) DEFAULT 0.00, -- Günlük bonus (varsa)
  "level" INTEGER DEFAULT 1 NOT NULL, -- Garaj seviyesi
  value DECIMAL(12, 2), -- Garajın değeri (satın alma/satma için)
  location TEXT, -- Garajın konumu (örn: İstanbul)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name) -- Bir kullanıcının aynı isimde birden fazla garajı olamaz
); 