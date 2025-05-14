-- Supabase Porsche Mining GameFi Veritabanı Şeması
-- Versiyon: Konsolide edilmiş ve düzeltilmiş - 2

-- ÖNEMLİ: Bu script tabloları silip yeniden oluşturur.
-- car_models ve garages (template) verilerini korumak için
-- ilgili DROP TABLE satırlarını çalıştırmadan önce silin veya veriyi yedekleyin.

-- =====================================================================
-- Tablo Tanımları
-- =====================================================================

-- Önce mevcut olabilecek eski tabloları temizleyelim (ilişkili verilerle)
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.user_tasks CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.mining_sessions CASCADE;
DROP TABLE IF EXISTS public.user_cars CASCADE;
-- DROP TABLE IF EXISTS public.garages CASCADE; -- Template'leri korumak için bu satırı sil/yorumla
-- DROP TABLE IF EXISTS public.car_models CASCADE; -- Modelleri korumak için bu satırı sil/yorumla
DROP TABLE IF EXISTS public.users CASCADE;

-- users tablosu
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  balance BIGINT DEFAULT 1000 NOT NULL, -- Başlangıç bakiyesi 1000
  ton_coins NUMERIC(18, 9) DEFAULT 0 NOT NULL,
  xp BIGINT DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  last_bonus_collected_at TIMESTAMP WITH TIME ZONE,
  selected_car_id INTEGER, -- user_cars.id SERIAL
  selected_garage_id INTEGER -- garages.id SERIAL
);
COMMENT ON COLUMN public.users.balance IS 'NMFP Puanı';
COMMENT ON COLUMN public.users.ton_coins IS 'TON Coin miktarı (9 ondalık hassasiyet)';
COMMENT ON COLUMN public.users.last_bonus_collected_at IS 'Günlük bonus toplama zamanı';

-- car_models tablosu (ID: UUID)
CREATE TABLE IF NOT EXISTS public.car_models ( -- IF NOT EXISTS eklendi (eğer DROP yapmadıysan)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- İsim unique olsun ki ON CONFLICT kullanabilelim
  description TEXT,
  image_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'Common',
  mining_power INTEGER NOT NULL DEFAULT 100,
  max_fuel INTEGER NOT NULL DEFAULT 100,
  max_health INTEGER NOT NULL DEFAULT 100,
  nmfp_price BIGINT NOT NULL DEFAULT 10000,
  ton_price NUMERIC(18, 9) NOT NULL DEFAULT 1.0,
  nft_mint_price NUMERIC(18, 9) NOT NULL DEFAULT 0.5,
  refill_cost BIGINT DEFAULT 500,
  repair_cost BIGINT DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
COMMENT ON COLUMN public.car_models.rarity IS 'Common, Uncommon, Rare, Epic, Legendary';
COMMENT ON COLUMN public.car_models.mining_power IS 'HP gücü = saatlik mining hızı';

-- garages tablosu (ID: SERIAL, Template ID: TEXT)
CREATE TABLE IF NOT EXISTS public.garages ( -- IF NOT EXISTS eklendi
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  template_id TEXT UNIQUE, -- Sadece template garajlar için dolu olacak (user_id IS NULL iken)
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL DEFAULT 1,
  daily_bonus BIGINT NOT NULL DEFAULT 100,
  value BIGINT NOT NULL DEFAULT 0, -- Template için NMFP fiyatı
  purchase_type TEXT, -- Template için 'NMFP' veya 'TON'
  location TEXT DEFAULT 'İstanbul',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  -- Aynı kullanıcının aynı isimde garajı olamasın
  UNIQUE (user_id, name)
);
COMMENT ON COLUMN public.garages.value IS 'Template için NMFP satın alma maliyeti';

-- user_cars tablosu (ID: SERIAL, car_model_id: UUID)
CREATE TABLE public.user_cars (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  car_model_id UUID NOT NULL REFERENCES public.car_models(id),
  name TEXT NOT NULL,
  purchase_type TEXT NOT NULL,
  mining_multiplier NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
  fuel INTEGER NOT NULL DEFAULT 100 CHECK (fuel >= 0 AND fuel <= 100),
  condition INTEGER NOT NULL DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  status TEXT NOT NULL DEFAULT 'active',
  mining_tour_count INTEGER NOT NULL DEFAULT 0,
  repair_end_time TIMESTAMP WITH TIME ZONE,
  garage_id INTEGER REFERENCES public.garages(id) ON DELETE SET NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  UNIQUE (user_id, car_model_id) -- Başlangıçta aynı modelden 1 tane olsun
);

-- mining_sessions tablosu
CREATE TABLE public.mining_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  car_id INTEGER NOT NULL REFERENCES public.user_cars(id) ON DELETE CASCADE,
  garage_id INTEGER REFERENCES public.garages(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_reward BIGINT NOT NULL,
  actual_reward BIGINT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);

-- tasks tablosu
CREATE TABLE public.tasks (
  id SERIAL PRIMARY KEY,
  title TEXT UNIQUE NOT NULL,
  description TEXT,
  total INTEGER NOT NULL DEFAULT 1,
  reward INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);

-- user_tasks tablosu
CREATE TABLE public.user_tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, task_id)
);

-- transactions tablosu
CREATE TABLE public.transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  item TEXT,
  source TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_cars_user_id ON public.user_cars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cars_status ON public.user_cars(status);
CREATE INDEX IF NOT EXISTS idx_garages_user_id ON public.garages(user_id);
CREATE INDEX IF NOT EXISTS idx_garages_template_id ON public.garages(template_id) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_mining_sessions_user_id_status ON public.mining_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mining_sessions_car_id ON public.mining_sessions(car_id);
CREATE INDEX IF NOT EXISTS idx_mining_sessions_end_time ON public.mining_sessions(end_time) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- RLS Politikaları (Supabase Auth UUID'si kullandığını varsayarak)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own" ON public.users;
DROP POLICY IF EXISTS "Allow users update own" ON public.users;
CREATE POLICY "Allow users read own" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Allow users update own" ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_models FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.car_models;
CREATE POLICY "Allow authenticated read" ON public.car_models FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.user_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cars FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own cars" ON public.user_cars;
CREATE POLICY "Allow users read own cars" ON public.user_cars FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own garages" ON public.garages;
DROP POLICY IF EXISTS "Allow auth read template garages" ON public.garages;
CREATE POLICY "Allow users read own garages" ON public.garages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow auth read template garages" ON public.garages FOR SELECT USING (user_id IS NULL AND auth.role() = 'authenticated');

ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own mining" ON public.mining_sessions;
CREATE POLICY "Allow users read own mining" ON public.mining_sessions FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth read active tasks" ON public.tasks;
CREATE POLICY "Allow auth read active tasks" ON public.tasks FOR SELECT USING (is_active = TRUE AND auth.role() = 'authenticated');

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own tasks progress" ON public.user_tasks;
CREATE POLICY "Allow users read own tasks progress" ON public.user_tasks FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users read own transactions" ON public.transactions;
CREATE POLICY "Allow users read own transactions" ON public.transactions FOR SELECT USING (user_id = auth.uid());
