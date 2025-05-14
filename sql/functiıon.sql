-- Supabase Porsche Mining GameFi Fonksiyonları
-- Versiyon: Konsolide edilmiş ve düzeltilmiş - 7 (update_task_progress RAISE hatası düzeltildi)

-- =====================================================================
-- HELPER FONKSİYONLAR
-- =====================================================================

CREATE OR REPLACE FUNCTION get_utc_now()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN NOW() AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calc_time_remaining(p_end_time TIMESTAMP WITH TIME ZONE)
RETURNS JSON AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
  v_remaining_seconds INTEGER;
  v_hours INTEGER;
  v_minutes INTEGER;
  v_seconds INTEGER;
  v_is_completed BOOLEAN;
BEGIN
  v_remaining_seconds := EXTRACT(EPOCH FROM (p_end_time - v_now))::INTEGER;

  IF v_remaining_seconds <= 0 THEN
    v_is_completed := TRUE;
    v_hours := 0;
    v_minutes := 0;
    v_seconds := 0;
    v_remaining_seconds := 0;
  ELSE
    v_is_completed := FALSE;
    v_hours := v_remaining_seconds / 3600;
    v_minutes := (v_remaining_seconds % 3600) / 60;
    v_seconds := v_remaining_seconds % 60;
  END IF;

  RETURN json_build_object(
    'hours', v_hours,
    'minutes', v_minutes,
    'seconds', v_seconds,
    'total_seconds', v_remaining_seconds,
    'is_completed', v_is_completed
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- KULLANICI YÖNETİMİ
-- =====================================================================

CREATE OR REPLACE FUNCTION get_or_create_user(
    p_telegram_id TEXT,
    p_username TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_user_uuid UUID;
    v_is_new BOOLEAN := FALSE;
    v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
    v_result JSONB;
BEGIN
    RAISE NOTICE '[get_or_create_user - Basitlestirilmis] Basladi: telegram_id=%, username=%', p_telegram_id, p_username;

    SELECT id INTO v_user_uuid
    FROM public.users
    WHERE telegram_id = p_telegram_id;

    IF FOUND THEN
        RAISE NOTICE '[get_or_create_user - Basitlestirilmis] Kullanici bulundu: uuid=%', v_user_uuid;
        UPDATE public.users
        SET username = COALESCE(p_username, username),
            last_login = v_now
        WHERE id = v_user_uuid;
        v_is_new := FALSE;
    ELSE
        RAISE NOTICE '[get_or_create_user - Basitlestirilmis] Yeni kullanici olusturuluyor.';
        v_is_new := TRUE;
        INSERT INTO public.users (telegram_id, username, created_at, last_login)
        VALUES ( p_telegram_id, p_username, v_now, v_now )
        ON CONFLICT (telegram_id) DO UPDATE
        SET last_login = v_now, username = COALESCE(p_username, users.username)
        RETURNING id INTO v_user_uuid;

        IF v_user_uuid IS NULL THEN
            RAISE NOTICE '[get_or_create_user - Basitlestirilmis] ON CONFLICT durumu olustu, tekrar ID aliniyor.';
            SELECT id INTO v_user_uuid FROM public.users WHERE telegram_id = p_telegram_id;
            IF v_user_uuid IS NULL THEN
                 RAISE EXCEPTION '[get_or_create_user - Basitlestirilmis] ON CONFLICT sonrasi kullanici ID alinamadi!';
            END IF;
            v_is_new := FALSE; 
        END IF;

        IF v_is_new THEN
            RAISE NOTICE '[get_or_create_user - Basitlestirilmis] Yeni kullanıcı için grant_initial_assets çağrılıyor: user_id=%', v_user_uuid;
            -- grant_initial_assets çağrısını tekrar etkinleştir
            BEGIN 
                 PERFORM grant_initial_assets(v_user_uuid, FALSE); 
                 RAISE NOTICE '[get_or_create_user - Basitlestirilmis] grant_initial_assets çağrısı tamamlandı.';
             EXCEPTION
                 WHEN OTHERS THEN
                     RAISE WARNING '[get_or_create_user - Basitlestirilmis] grant_initial_assets çağrılırken hata oluştu: %', SQLERRM;
             END; 
        END IF;
    END IF; 

    -- Sonuç JSON'ını sadece user_id ve is_new ile oluştur
    v_result := jsonb_build_object(
        'user_id', v_user_uuid,
        'is_new', v_is_new
    );

    RAISE NOTICE '[get_or_create_user - Basitlestirilmis] Sonuc: %', v_result::text;
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[get_or_create_user - Basitlestirilmis] HATA: %', SQLERRM;
        -- Hata durumunda sadece null ID ve false is_new döndür
        RETURN jsonb_build_object(
            'user_id', NULL, 
            'is_new', FALSE, 
            'error', SQLERRM
        );
END;
$$;

CREATE OR REPLACE FUNCTION grant_initial_assets(
    p_user_id UUID,
    p_is_premium BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_car_model_id UUID;
    v_garage_template_id TEXT := 'nmfp-1';
    v_initial_balance BIGINT;
    v_car_name TEXT;
    v_garage_name TEXT;
    v_garage_capacity INTEGER;
    v_garage_daily_bonus BIGINT;
    v_garage_image_url TEXT;
    v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
    v_car_inserted BOOLEAN := FALSE;
    v_garage_inserted BOOLEAN := FALSE;
    v_balance_updated BOOLEAN := FALSE;
    v_final_balance BIGINT; -- Moved declaration here
BEGIN
    RAISE NOTICE '[grant_initial_assets] Basladi: user_id=%, is_premium=%', p_user_id, p_is_premium;

    IF p_is_premium THEN v_initial_balance := 25000; ELSE v_initial_balance := 10000; END IF;
    RAISE NOTICE '[grant_initial_assets] Baslangic bakiye eklentisi: %', v_initial_balance;

    -- 1. Başlangıç Aracı
    BEGIN
        SELECT id, name INTO v_car_model_id, v_car_name
        FROM public.car_models WHERE rarity = 'Common' ORDER BY nmfp_price ASC LIMIT 1;
        IF NOT FOUND THEN
            RAISE WARNING '[grant_initial_assets] Baslangic araci modeli bulunamadi.';
        ELSE
            RAISE NOTICE '[grant_initial_assets] Baslangic araci bulundu: ID=%, Name=%', v_car_model_id, v_car_name;
            INSERT INTO public.user_cars (user_id, car_model_id, name, purchase_type, level, fuel, condition, status, created_at, updated_at)
            VALUES ( p_user_id, v_car_model_id, v_car_name || ' (Başlangıç)', 'NMFP', 1, 100, 100, 'active', v_now, v_now )
            ON CONFLICT (user_id, car_model_id) DO NOTHING;
            SELECT EXISTS (SELECT 1 FROM user_cars WHERE user_id = p_user_id AND car_model_id = v_car_model_id) INTO v_car_inserted;
            IF v_car_inserted THEN RAISE NOTICE '[grant_initial_assets] user_cars kaydi eklendi/mevcut.'; ELSE RAISE WARNING '[grant_initial_assets] user_cars INSERT basarisiz!'; END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Arac ekleme hatasi: %', SQLERRM;
    END;

    -- 2. Başlangıç Garajı
    BEGIN
        SELECT name, image_url, capacity, daily_bonus
        INTO v_garage_name, v_garage_image_url, v_garage_capacity, v_garage_daily_bonus
        FROM public.garages WHERE template_id = v_garage_template_id AND user_id IS NULL; -- Assuming template garages have NULL user_id
        IF NOT FOUND THEN
            RAISE WARNING '[grant_initial_assets] Baslangic garaj sablonu bulunamadi: template_id=%', v_garage_template_id;
        ELSE
            RAISE NOTICE '[grant_initial_assets] Baslangic garaj sablonu bulundu: Name=%', v_garage_name;
            INSERT INTO public.garages (user_id, name, image_url, capacity, daily_bonus, level, value, created_at, template_id)
            VALUES ( p_user_id, v_garage_name || ' (Başlangıç)', v_garage_image_url, v_garage_capacity, v_garage_daily_bonus, 1, 0, v_now, NULL ) -- User garages dont have template_id
            ON CONFLICT (user_id, name) DO NOTHING; -- Maybe a different constraint is needed? Check schema.
            SELECT EXISTS (SELECT 1 FROM garages WHERE user_id = p_user_id AND name = v_garage_name || ' (Başlangıç)') INTO v_garage_inserted;
            IF v_garage_inserted THEN RAISE NOTICE '[grant_initial_assets] garages kaydi eklendi/mevcut.'; ELSE RAISE WARNING '[grant_initial_assets] garages INSERT basarisiz!'; END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Garaj ekleme hatasi: %', SQLERRM;
    END;

    -- 3. Bakiye Güncelleme
    BEGIN
        UPDATE public.users SET balance = balance + v_initial_balance WHERE id = p_user_id;
        RAISE NOTICE '[grant_initial_assets] UPDATE users balance denendi: user_id=%, eklenecek_bakiye=%', p_user_id, v_initial_balance;
        SELECT balance INTO v_final_balance FROM users WHERE id = p_user_id; -- Check balance *after* update
        RAISE NOTICE '[grant_initial_assets] Son bakiye kontrol: user_id=%, final_balance=% (Beklenen ~1000+%)', p_user_id, v_final_balance, v_initial_balance;
        IF v_final_balance >= (1000 + v_initial_balance) THEN -- Assuming default is 1000 from schema.
             RAISE NOTICE '[grant_initial_assets] Bakiye güncellendi: % -> %', v_final_balance - v_initial_balance, v_final_balance;
             v_balance_updated := TRUE;
        ELSE
             RAISE WARNING '[grant_initial_assets] Bakiye güncellemesi basarisiz! Son bakiye: %', v_final_balance;
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Bakiye güncelleme hatasi: %', SQLERRM;
    END;

    IF NOT v_car_inserted AND NOT v_garage_inserted AND NOT v_balance_updated THEN
         RAISE WARNING '[grant_initial_assets] Hicbir baslangic varligi eklenemedi/güncellenemedi!';
    END IF;
    RAISE NOTICE '[grant_initial_assets] Tamamlandi: user_id=%', p_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[grant_initial_assets] GENEL HATA: %', SQLERRM;
        RAISE;
END;
$$;


-- =====================================================================
-- ARAÇ YÖNETİMİ
-- =====================================================================

CREATE OR REPLACE FUNCTION purchase_car(
  p_user_id UUID,
  p_model_id UUID,
  p_purchase_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_user_record RECORD; v_car_model_record RECORD; v_multiplier NUMERIC;
  v_price_nmfp BIGINT; v_price_ton NUMERIC; v_price_nft_mint NUMERIC;
  v_price_paid NUMERIC; v_new_user_car_id INTEGER; v_currency TEXT;
  v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  RAISE NOTICE '[purchase_car] Basladi: user_id=%, model_id=%, type=%', p_user_id, p_model_id, p_purchase_type;
  SELECT * INTO v_user_record FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_car] Kullanici bulunamadi: %', p_user_id; END IF;
  SELECT * INTO v_car_model_record FROM car_models WHERE id = p_model_id;
  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_car] Arac modeli bulunamadi: %', p_model_id; END IF;
  RAISE NOTICE '[purchase_car] Arac modeli: %', v_car_model_record.name;

  -- *** CASE yerine IF/ELSIF kullanıldı ***
  IF p_purchase_type = 'NMFP' THEN
      v_price_nmfp := v_car_model_record.nmfp_price; v_price_paid := v_price_nmfp; v_multiplier := 1.0; v_currency := 'NMFP';
      RAISE NOTICE '[purchase_car] NMFP ile alim: Fiyat=%', v_price_paid;
      IF v_user_record.balance < v_price_nmfp THEN RAISE EXCEPTION '[purchase_car] Yetersiz NMFP puani (Gerekli: %, Mevcut: %)', v_price_nmfp, v_user_record.balance; END IF;
      UPDATE users SET balance = balance - v_price_nmfp WHERE id = p_user_id;
  ELSIF p_purchase_type = 'TON' THEN
      v_price_ton := v_car_model_record.ton_price; v_price_paid := v_price_ton; v_multiplier := 2.0; v_currency := 'TON';
      RAISE NOTICE '[purchase_car] TON ile alim: Fiyat=%', v_price_paid;
      IF v_user_record.ton_coins < v_price_ton THEN RAISE EXCEPTION '[purchase_car] Yetersiz TON coin (Gerekli: %, Mevcut: %)', v_price_ton, v_user_record.ton_coins; END IF;
      UPDATE users SET ton_coins = ton_coins - v_price_ton WHERE id = p_user_id;
  ELSIF p_purchase_type = 'NFT' THEN
      v_price_nft_mint := v_car_model_record.nft_mint_price; v_price_paid := v_price_nft_mint; v_multiplier := 3.0; v_currency := 'TON'; -- Assuming NFT mint costs TON
      RAISE NOTICE '[purchase_car] NFT mintleme: Fiyat=% TON', v_price_paid;
      IF v_user_record.ton_coins < v_price_nft_mint THEN RAISE EXCEPTION '[purchase_car] NFT mintlemek için yetersiz TON coin (Gerekli: %, Mevcut: %)', v_price_nft_mint, v_user_record.ton_coins; END IF;
      UPDATE users SET ton_coins = ton_coins - v_price_nft_mint WHERE id = p_user_id;
  ELSE
      RAISE EXCEPTION '[purchase_car] Gecersiz satin alma tipi: %', p_purchase_type;
  END IF;
  RAISE NOTICE '[purchase_car] Bakiye dusuldu.';

  INSERT INTO user_cars ( user_id, car_model_id, name, purchase_type, mining_multiplier, fuel, condition, mining_tour_count, status, level, created_at, updated_at )
  VALUES ( p_user_id, p_model_id, v_car_model_record.name, p_purchase_type, v_multiplier, 100, 100, 0, 'active', 1, v_now, v_now )
  RETURNING id INTO v_new_user_car_id;
  RAISE NOTICE '[purchase_car] Yeni user_car eklendi: id=%', v_new_user_car_id;
  INSERT INTO transactions ( user_id, type, amount, currency, status, item, date )
  VALUES ( p_user_id, 'purchase_car', -v_price_paid, v_currency, 'confirmed', v_car_model_record.name || ' (' || p_purchase_type || ')', v_now );
  RAISE NOTICE '[purchase_car] Islem kaydedildi.'; RETURN v_new_user_car_id;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[purchase_car] HATA: %', SQLERRM; RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION repair_car( p_user_id UUID, p_car_id INTEGER )
RETURNS BOOLEAN AS $$
DECLARE
  v_user_car RECORD; v_user_record RECORD; v_repair_cost BIGINT;
  v_repair_time INTERVAL := INTERVAL '30 minutes'; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  RAISE NOTICE '[repair_car] Basladi: user_id=%, car_id=%', p_user_id, p_car_id;
  SELECT uc.*, cm.repair_cost, cm.max_health INTO v_user_car FROM user_cars uc JOIN car_models cm ON uc.car_model_id = cm.id
  WHERE uc.id = p_car_id AND uc.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[repair_car] Kullanici araci bulunamadi: id=%', p_car_id; END IF;
  RAISE NOTICE '[repair_car] Arac durumu: %, Kondisyon: %', v_user_car.status, v_user_car.condition;
  IF v_user_car.status != 'active' THEN RAISE EXCEPTION '[repair_car] Arac tamir edilemez (Durum: %)', v_user_car.status; END IF;
  IF v_user_car.condition >= 80 THEN RAISE EXCEPTION '[repair_car] Aracin bakim ihtiyaci yok (Kondisyon >= 80)'; END IF;
  SELECT * INTO v_user_record FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[repair_car] Kullanici bulunamadi: %', p_user_id; END IF;
  v_repair_cost := COALESCE(v_user_car.repair_cost, (v_user_car.max_health - v_user_car.condition) * 10); -- Fallback calculation
  RAISE NOTICE '[repair_car] Hesaplanan tamir maliyeti: %', v_repair_cost;
  IF v_user_record.balance < v_repair_cost THEN RAISE EXCEPTION '[repair_car] Yetersiz NMFP puani (Gerekli: %, Mevcut: %)', v_repair_cost, v_user_record.balance; END IF;
  UPDATE users SET balance = balance - v_repair_cost WHERE id = p_user_id; RAISE NOTICE '[repair_car] Bakiye dusuldu.';
  UPDATE user_cars SET status = 'repairing', repair_end_time = v_now + v_repair_time, updated_at = v_now WHERE id = p_car_id;
  RAISE NOTICE '[repair_car] Arac tamire alindi, bitis: %', v_now + v_repair_time;
  INSERT INTO transactions (user_id, type, amount, currency, status, item, date)
  VALUES (p_user_id, 'expense', -v_repair_cost, 'NMFP', 'confirmed', 'Araç Tamiri (ID: ' || p_car_id || ')', v_now);
  RAISE NOTICE '[repair_car] Islem kaydedildi.'; RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[repair_car] HATA: %', SQLERRM; RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refill_car( p_user_id UUID, p_car_id INTEGER )
RETURNS BOOLEAN AS $$
DECLARE
  v_user_car RECORD; v_user_record RECORD; v_refill_cost BIGINT; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
   RAISE NOTICE '[refill_car] Basladi: user_id=%, car_id=%', p_user_id, p_car_id;
  SELECT uc.*, cm.refill_cost, cm.max_fuel INTO v_user_car FROM user_cars uc JOIN car_models cm ON uc.car_model_id = cm.id
  WHERE uc.id = p_car_id AND uc.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[refill_car] Kullanici araci bulunamadi: id=%', p_car_id; END IF;
  RAISE NOTICE '[refill_car] Arac durumu: %, Yakit: %', v_user_car.status, v_user_car.fuel;
  IF v_user_car.status != 'active' THEN RAISE EXCEPTION '[refill_car] Arac yakit doldurulamaz (Durum: %)', v_user_car.status; END IF;
  IF v_user_car.fuel >= 80 THEN RAISE EXCEPTION '[refill_car] Aracin yakit ihtiyaci yok (Yakit >= 80)'; END IF;
  SELECT * INTO v_user_record FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[refill_car] Kullanici bulunamadi: %', p_user_id; END IF;
  v_refill_cost := COALESCE(v_user_car.refill_cost, (v_user_car.max_fuel - v_user_car.fuel) * 5); -- Fallback calculation
  RAISE NOTICE '[refill_car] Hesaplanan yakit maliyeti: %', v_refill_cost;
  IF v_user_record.balance < v_refill_cost THEN RAISE EXCEPTION '[refill_car] Yetersiz NMFP puani (Gerekli: %, Mevcut: %)', v_refill_cost, v_user_record.balance; END IF;
  UPDATE users SET balance = balance - v_refill_cost WHERE id = p_user_id; RAISE NOTICE '[refill_car] Bakiye dusuldu.';
  UPDATE user_cars SET fuel = v_user_car.max_fuel, updated_at = v_now WHERE id = p_car_id; RAISE NOTICE '[refill_car] Yakit dolduruldu.';
  INSERT INTO transactions (user_id, type, amount, currency, status, item, date)
  VALUES (p_user_id, 'expense', -v_refill_cost, 'NMFP', 'confirmed', 'Yakıt Dolumu (Araç ID: ' || p_car_id || ')', v_now);
  RAISE NOTICE '[refill_car] Islem kaydedildi.'; RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[refill_car] HATA: %', SQLERRM; RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- GARAJ YÖNETİMİ
-- =====================================================================

CREATE OR REPLACE FUNCTION purchase_garage(
  p_user_id UUID,
  p_garage_template_id TEXT,
  p_purchase_type TEXT -- 'NMFP' or 'TON' matching the template
) RETURNS INTEGER AS $$
DECLARE
  v_user_record RECORD; v_garage_template RECORD; v_price_nmfp BIGINT; v_price_ton NUMERIC;
  v_price_paid NUMERIC; v_new_garage_id INTEGER; v_currency TEXT; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  RAISE NOTICE '[purchase_garage] Basladi: user_id=%, template_id=%, type=%', p_user_id, p_garage_template_id, p_purchase_type;
  SELECT * INTO v_user_record FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_garage] Kullanici bulunamadi: %', p_user_id; END IF;
  -- Retrieve the template garage (assuming user_id is NULL for templates)
  SELECT * INTO v_garage_template FROM garages WHERE template_id = p_garage_template_id AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_garage] Garaj modeli bulunamadi: template_id=%', p_garage_template_id; END IF;
  RAISE NOTICE '[purchase_garage] Garaj sablonu: %', v_garage_template.name;

  -- *** CASE yerine IF/ELSIF kullanıldı ***
  IF p_purchase_type = 'NMFP' THEN
     IF v_garage_template.purchase_type != 'NMFP' THEN RAISE EXCEPTION '[purchase_garage] Garaj sablonu (%s) NMFP ile satilamaz.', v_garage_template.template_id; END IF;
     v_price_nmfp := v_garage_template.value; v_price_paid := v_price_nmfp; v_currency := 'NMFP';
     RAISE NOTICE '[purchase_garage] NMFP ile alim: Fiyat=%', v_price_paid;
     IF v_user_record.balance < v_price_nmfp THEN RAISE EXCEPTION '[purchase_garage] Yetersiz NMFP puani (Gerekli: %, Mevcut: %)', v_price_nmfp, v_user_record.balance; END IF;
     UPDATE users SET balance = balance - v_price_nmfp WHERE id = p_user_id;
  ELSIF p_purchase_type = 'TON' THEN
     IF v_garage_template.purchase_type != 'TON' THEN RAISE EXCEPTION '[purchase_garage] Garaj sablonu (%s) TON ile satilamaz.', v_garage_template.template_id; END IF;
     v_price_ton := v_garage_template.value; v_price_paid := v_price_ton; v_currency := 'TON';
     RAISE NOTICE '[purchase_garage] TON ile alim: Fiyat=%', v_price_paid;
     IF v_user_record.ton_coins < v_price_ton THEN RAISE EXCEPTION '[purchase_garage] Yetersiz TON coin (Gerekli: %, Mevcut: %)', v_price_ton, v_user_record.ton_coins; END IF;
     UPDATE users SET ton_coins = ton_coins - v_price_ton WHERE id = p_user_id;
  ELSE
     RAISE EXCEPTION '[purchase_garage] Gecersiz satin alma tipi: %', p_purchase_type;
  END IF;
  RAISE NOTICE '[purchase_garage] Bakiye dusuldu.';

  -- Create a new garage for the user based on the template, user_id is NOT NULL, template_id is NULL
  INSERT INTO garages ( user_id, name, image_url, capacity, level, daily_bonus, value, location, created_at, template_id, purchase_type )
  VALUES ( p_user_id, v_garage_template.name, v_garage_template.image_url, v_garage_template.capacity, 1, v_garage_template.daily_bonus, 0, v_garage_template.location, v_now, NULL, p_purchase_type )
  RETURNING id INTO v_new_garage_id;
  RAISE NOTICE '[purchase_garage] Yeni garaj eklendi: id=%', v_new_garage_id;
  INSERT INTO transactions (user_id, type, amount, currency, status, item, date)
  VALUES (p_user_id, 'purchase_garage', -v_price_paid, v_currency, 'confirmed', v_garage_template.name, v_now);
  RAISE NOTICE '[purchase_garage] Islem kaydedildi.'; RETURN v_new_garage_id;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[purchase_garage] HATA: %', SQLERRM; RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION collect_garage_bonuses( p_user_id UUID )
RETURNS BIGINT AS $$
DECLARE
  v_total_bonus BIGINT := 0; v_garage RECORD; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
  v_last_collected_time TIMESTAMP WITH TIME ZONE; v_update_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[collect_garage_bonuses] Basladi: user_id=%', p_user_id;
  SELECT last_bonus_collected_at INTO v_last_collected_time FROM users WHERE id = p_user_id;
  RAISE NOTICE '[collect_garage_bonuses] Son toplama: %', v_last_collected_time;
  IF v_last_collected_time IS NOT NULL AND v_last_collected_time > v_now - INTERVAL '23 hour 59 minutes' THEN
    RAISE EXCEPTION '[collect_garage_bonuses] Gunluk bonus zaten toplandi (Sonraki: ~%)', v_last_collected_time + INTERVAL '24 hour';
  END IF;
  FOR v_garage IN (SELECT daily_bonus FROM garages WHERE user_id = p_user_id) LOOP v_total_bonus := v_total_bonus + COALESCE(v_garage.daily_bonus, 0); END LOOP;
  RAISE NOTICE '[collect_garage_bonuses] Toplam bonus hesaplandi: %', v_total_bonus;
  IF v_total_bonus > 0 THEN
    UPDATE users SET balance = balance + v_total_bonus, last_bonus_collected_at = v_now WHERE id = p_user_id RETURNING 1 INTO v_update_count;
    IF v_update_count > 0 THEN
       RAISE NOTICE '[collect_garage_bonuses] Kullanici bakiyesi güncellendi.';
      INSERT INTO transactions (user_id, type, amount, currency, status, source, date)
      VALUES (p_user_id, 'reward', v_total_bonus, 'NMFP', 'confirmed', 'Garaj Günlük Bonus', v_now); RAISE NOTICE '[collect_garage_bonuses] Islem kaydedildi.';
    ELSE RAISE WARNING '[collect_garage_bonuses] Kullanici güncellenemedi! user_id=%', p_user_id; RETURN 0; END IF;
  ELSE
     RAISE NOTICE '[collect_garage_bonuses] Toplanacak bonus bulunamadi veya 0.';
     -- Still update the timestamp to prevent immediate re-collection attempts if bonus is 0
     UPDATE users SET last_bonus_collected_at = v_now WHERE id = p_user_id; RETURN 0;
  END IF;
  RETURN v_total_bonus;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[collect_garage_bonuses] HATA: %', SQLERRM; RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- MINING YÖNETİMİ
-- =====================================================================

CREATE OR REPLACE FUNCTION start_mining( p_user_id UUID, p_car_id INTEGER, p_garage_id INTEGER DEFAULT NULL )
RETURNS INTEGER AS $$
DECLARE
  v_user_car RECORD; v_expected_reward BIGINT; v_mining_duration INTERVAL := INTERVAL '8 hour';
  v_end_time TIMESTAMP WITH TIME ZONE; v_mining_session_id INTEGER; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
  v_fuel_cost INTEGER := 20; v_condition_cost INTEGER := 10;
BEGIN
  RAISE NOTICE '[start_mining] Basladi: user_id=%, car_id=%, garage_id=%', p_user_id, p_car_id, p_garage_id;
  SELECT uc.*, cm.mining_power INTO v_user_car FROM user_cars uc JOIN car_models cm ON uc.car_model_id = cm.id
  WHERE uc.id = p_car_id AND uc.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[start_mining] Kullanici araci bulunamadi: id=%', p_car_id; END IF;
  RAISE NOTICE '[start_mining] Arac durumu: %, Yakit: %, Kondisyon: %', v_user_car.status, v_user_car.fuel, v_user_car.condition;
  IF v_user_car.status != 'active' THEN RAISE EXCEPTION '[start_mining] Arac mining için uygun degil (Durum: %)', v_user_car.status; END IF;
  IF v_user_car.fuel < v_fuel_cost THEN RAISE EXCEPTION '[start_mining] Yetersiz yakit (Gerekli: %, Mevcut: %)', v_fuel_cost, v_user_car.fuel; END IF;
  IF v_user_car.condition < v_condition_cost THEN RAISE EXCEPTION '[start_mining] Yetersiz kondisyon (Gerekli: %, Mevcut: %)', v_condition_cost, v_user_car.condition; END IF;
  IF EXISTS (SELECT 1 FROM mining_sessions WHERE user_id = p_user_id AND status = 'active') THEN RAISE EXCEPTION '[start_mining] Zaten aktif bir mining oturumu var.'; END IF;
  v_expected_reward := v_user_car.mining_power * v_user_car.mining_multiplier * EXTRACT(EPOCH FROM v_mining_duration) / 3600;
  v_end_time := v_now + v_mining_duration; RAISE NOTICE '[start_mining] Beklenen ödül: %, Bitis: %', v_expected_reward, v_end_time;
  INSERT INTO mining_sessions (user_id, car_id, garage_id, start_time, end_time, expected_reward, status, created_at)
  VALUES (p_user_id, p_car_id, p_garage_id, v_now, v_end_time, v_expected_reward, 'active', v_now) RETURNING id INTO v_mining_session_id;
  RAISE NOTICE '[start_mining] Mining session olusturuldu: id=%', v_mining_session_id;
  UPDATE user_cars SET status = 'mining', fuel = fuel - v_fuel_cost, condition = condition - v_condition_cost, updated_at = v_now WHERE id = p_car_id;
  RAISE NOTICE '[start_mining] Arac durumu güncellendi.'; RETURN v_mining_session_id;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[start_mining] HATA: %', SQLERRM; RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_mining_details(p_session_id INTEGER)
RETURNS JSON AS $$
DECLARE
  v_session RECORD; v_time_remaining JSON; v_progress NUMERIC(5,2);
  v_total_duration NUMERIC; v_elapsed_duration NUMERIC; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  SELECT * INTO v_session FROM mining_sessions WHERE id = p_session_id; IF NOT FOUND THEN RETURN NULL; END IF;
  v_time_remaining := calc_time_remaining(v_session.end_time);
  v_total_duration := EXTRACT(EPOCH FROM (v_session.end_time - v_session.start_time));
  v_elapsed_duration := EXTRACT(EPOCH FROM (v_now - v_session.start_time));
  IF v_total_duration > 0 THEN v_progress := LEAST(GREATEST((v_elapsed_duration / v_total_duration) * 100, 0), 100);
  ELSE v_progress := CASE WHEN v_elapsed_duration >= 0 THEN 100 ELSE 0 END; END IF;
  RETURN json_build_object( 'session_id', v_session.id, 'status', v_session.status, 'start_time', v_session.start_time,
    'end_time', v_session.end_time, 'expected_reward', v_session.expected_reward, 'time_remaining', v_time_remaining,
    'progress_percent', round(v_progress, 2) );
END;
$$ LANGUAGE plpgsql STABLE;


-- DROP FUNCTION IF EXISTS public.complete_mining(integer); -- Make sure this was run before executing the below
CREATE OR REPLACE FUNCTION complete_mining(p_mining_session_id INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_mining_session RECORD; v_user_id UUID; v_car_id INTEGER; v_reward BIGINT;
  v_now TIMESTAMP WITH TIME ZONE := get_utc_now(); v_update_count INTEGER := 0;
BEGIN
  RAISE NOTICE '[complete_mining] Basladi: session_id=%', p_mining_session_id;
  SELECT * INTO v_mining_session FROM mining_sessions WHERE id = p_mining_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[complete_mining] Mining seansi bulunamadi: %', p_mining_session_id; END IF;
  RAISE NOTICE '[complete_mining] Session durumu: %, Bitis zamani: %', v_mining_session.status, v_mining_session.end_time;
  IF v_mining_session.status != 'active' THEN RAISE EXCEPTION '[complete_mining] Mining seansi aktif degil (Durum: %)', v_mining_session.status; END IF;
  IF v_mining_session.end_time > v_now THEN RAISE EXCEPTION '[complete_mining] Mining seansi henüz tamamlanmadi.'; END IF;
  v_user_id := v_mining_session.user_id; v_car_id := v_mining_session.car_id; v_reward := v_mining_session.expected_reward;
  UPDATE mining_sessions SET status = 'completed', actual_reward = v_reward WHERE id = p_mining_session_id RETURNING 1 INTO v_update_count;
  IF v_update_count = 0 THEN RAISE WARNING '[complete_mining] Mining session güncellenemedi! id=%', p_mining_session_id; RETURN 0; END IF;
  RAISE NOTICE '[complete_mining] Mining session tamamlandi olarak isaretlendi.';
  UPDATE users SET balance = balance + v_reward, xp = xp + COALESCE(v_reward / 10, 0) WHERE id = v_user_id; -- Added COALESCE for safety
  RAISE NOTICE '[complete_mining] Kullanici bakiyesi ve XP güncellendi.';
  UPDATE user_cars SET status = 'active', mining_tour_count = mining_tour_count + 1, updated_at = v_now WHERE id = v_car_id;
  RAISE NOTICE '[complete_mining] Arac durumu güncellendi.';
  INSERT INTO transactions ( user_id, type, amount, currency, status, source, date )
  VALUES ( v_user_id, 'reward', v_reward, 'NMFP', 'confirmed', 'Mining Ödülü (Araç ID: ' || v_car_id || ')', v_now );
  RAISE NOTICE '[complete_mining] Islem kaydedildi.'; RETURN v_reward;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[complete_mining] HATA: %', SQLERRM; RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- GÖREV YÖNETİMİ
-- =====================================================================

CREATE OR REPLACE FUNCTION update_task_progress(
  p_user_id UUID,
  p_task_title TEXT,
  p_progress_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_task_id INTEGER; v_user_task_id INTEGER; v_current_progress INTEGER; v_total INTEGER;
  v_reward INTEGER; v_is_completed BOOLEAN; v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  SELECT id, total, reward INTO v_task_id, v_total, v_reward FROM tasks WHERE title = p_task_title AND is_active = TRUE;
  IF NOT FOUND THEN RAISE NOTICE '[update_task_progress] Aktif gorev bulunamadi: %', p_task_title; RETURN FALSE; END IF;
  SELECT id, progress, is_completed INTO v_user_task_id, v_current_progress, v_is_completed
  FROM user_tasks WHERE user_id = p_user_id AND task_id = v_task_id FOR UPDATE;
  IF v_user_task_id IS NULL THEN
    INSERT INTO user_tasks (user_id, task_id, progress, is_completed) VALUES (p_user_id, v_task_id, p_progress_amount, FALSE)
    RETURNING id, progress, is_completed INTO v_user_task_id, v_current_progress, v_is_completed;
     RAISE NOTICE '[update_task_progress] Yeni gorev ilerlemesi eklendi: user_task_id=%', v_user_task_id;
  ELSE
    IF v_is_completed THEN RAISE NOTICE '[update_task_progress] Gorev zaten tamamlanmis: user_task_id=%', v_user_task_id; RETURN TRUE; END IF;
    UPDATE user_tasks SET progress = progress + p_progress_amount WHERE id = v_user_task_id RETURNING progress INTO v_current_progress;
     -- *** Düzeltilmiş Satır ***
     RAISE NOTICE '[update_task_progress] Gorev ilerlemesi güncellendi: user_task_id=%, yeni_progress=%', v_user_task_id, v_current_progress;
  END IF;
  IF v_current_progress >= v_total AND NOT v_is_completed THEN
     RAISE NOTICE '[update_task_progress] Gorev tamamlandi: user_task_id=%', v_user_task_id;
    UPDATE user_tasks SET is_completed = TRUE, completed_at = v_now, progress = v_total WHERE id = v_user_task_id;
    UPDATE users SET balance = balance + v_reward, xp = xp + GREATEST(10, v_reward / 5) WHERE id = p_user_id;
     RAISE NOTICE '[update_task_progress] Gorev odulu verildi: user_id=%, task_id=%, odul=% NMFP', p_user_id, v_task_id, v_reward;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[update_task_progress] HATA: %', SQLERRM; RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
