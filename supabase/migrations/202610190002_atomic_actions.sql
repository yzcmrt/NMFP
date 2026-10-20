BEGIN;
CREATE OR REPLACE FUNCTION public.complete_mining(p_mining_session_id integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_session mining_sessions%ROWTYPE;
    v_car user_cars%ROWTYPE;
    v_actual_reward bigint;
    v_mining_duration integer;
    v_fuel_consumption integer;
    v_condition_loss integer;
BEGIN
    -- Mining session'ı kontrol et
    SELECT * INTO v_session FROM mining_sessions WHERE id = p_mining_session_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mining session bulunamadı: %', p_mining_session_id;
    END IF;
    
    IF v_session.status = 'completed' THEN RETURN 0; END IF;
    IF v_session.end_time > NOW() THEN RAISE EXCEPTION 'NMFP:Mining is still in progress.'; END IF;
    IF v_session.status != 'active' THEN
        RAISE EXCEPTION 'Mining session zaten tamamlanmış veya iptal edilmiş';
    END IF;
    
    -- Araç bilgilerini al
    SELECT * INTO v_car FROM user_cars WHERE id = v_session.car_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Araç bulunamadı: %', v_session.car_id;
    END IF;
    
    -- Mining süresini hesapla (saat olarak)
    v_mining_duration := EXTRACT(EPOCH FROM (NOW() - v_session.start_time)) / 3600;
    
    -- Yakıt tüketimini hesapla (saat başına %5)
    v_fuel_consumption := LEAST(100, GREATEST(0, (v_mining_duration * 5)::integer));
    
    -- Kondisyon kaybını hesapla (saat başına %2)
    v_condition_loss := LEAST(100, GREATEST(0, (v_mining_duration * 2)::integer));
    
    -- Ödülü hesapla
    v_actual_reward := v_session.expected_reward;
    
    -- Transaction kaydı oluştur
    INSERT INTO transactions (user_id, type, amount, currency, status, source, item, date)
    VALUES (v_session.user_id, 'mining_reward', v_actual_reward, 'NMFP', 'confirmed', 
            'Mining Completion', v_car.name, NOW());
    
    -- Kullanıcı bakiyesini güncelle
    UPDATE users SET balance = balance + v_actual_reward WHERE id = v_session.user_id;
    
    -- Araç durumunu güncelle
    UPDATE user_cars 
    SET 
        fuel = GREATEST(0, fuel - v_fuel_consumption),
        condition = GREATEST(0, condition - v_condition_loss),
        status = 'active', -- Mining tamamlandıktan sonra araç aktif olsun
        updated_at = NOW()
    WHERE id = v_session.car_id;
    
    -- Mining session'ını güncelle
    UPDATE mining_sessions 
    SET 
        status = 'completed',
        actual_reward = v_actual_reward,
        completed_at = NOW()
    WHERE id = p_mining_session_id;
    
    -- Sonucu döndür
    RETURN v_actual_reward;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_user(p_telegram_id text, p_username text DEFAULT NULL::text, p_is_premium boolean DEFAULT false, p_force_create boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_uuid UUID;
    v_is_new BOOLEAN := FALSE;
    v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
    v_result JSONB;
    v_user_record RECORD;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_telegram_id, 0));
    IF p_force_create THEN RAISE EXCEPTION 'Account reset is disabled'; END IF;
    RAISE NOTICE '[get_or_create_user] Başladı: telegram_id=%, username=%, is_premium=%, force_create=%', 
                 p_telegram_id, p_username, p_is_premium, p_force_create;

    -- Kullanıcıyı id ile ara
    SELECT id INTO v_user_uuid
    FROM public.users
    WHERE telegram_id = p_telegram_id;

    IF FOUND AND NOT p_force_create THEN
        RAISE NOTICE '[get_or_create_user] Kullanıcı bulundu: uuid=%', v_user_uuid;
        
        -- Kullanıcıyı güncelle (username ve premium bilgisi)
        UPDATE public.users
        SET username = COALESCE(p_username, username),
            last_login = v_now,
            is_premium = p_is_premium -- Premium durumunu güncelle
        WHERE id = v_user_uuid;
        
        v_is_new := FALSE;
    ELSE
        -- Kullanıcı bulunamadı veya force_create isteği geldi
        IF p_force_create AND FOUND THEN
            RAISE NOTICE '[get_or_create_user] Kullanıcı force create ile yeniden oluşturuluyor: uuid=%', v_user_uuid;
            -- Mevcut kullanıcı kayıtlarını temizle (bağlı tablolardaki ilişkileri de temizlemek gerekebilir)
            DELETE FROM public.users WHERE id = v_user_uuid;
        END IF;
        
        RAISE NOTICE '[get_or_create_user] Yeni kullanıcı oluşturuluyor. Premium: %', p_is_premium;
        v_is_new := TRUE;
        
        -- Yeni kullanıcı oluştur
        INSERT INTO public.users (
            telegram_id, 
            username, 
            created_at, 
            last_login,
            is_premium
        )
        VALUES (
            p_telegram_id, 
            p_username, 
            v_now, 
            v_now,
            p_is_premium
        )
        RETURNING id INTO v_user_uuid;

        -- Başlangıç varlıklarını ver
        IF v_user_uuid IS NULL THEN
            RAISE NOTICE '[get_or_create_user] Kullanıcı oluşturulamadı';
            v_is_new := FALSE;
        ELSE
            RAISE NOTICE '[get_or_create_user] Yeni kullanıcı için grant_initial_assets çağrılıyor: user_id=%, is_premium=%', v_user_uuid, p_is_premium;
            
            -- Premium durumunu grant_initial_assets fonksiyonuna geçir
            BEGIN 
                PERFORM grant_initial_assets(v_user_uuid, p_is_premium); 
                RAISE NOTICE '[get_or_create_user] grant_initial_assets çağrısı tamamlandı.';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING '[get_or_create_user] grant_initial_assets çağrılırken hata oluştu: %', SQLERRM;
            END;
        END IF;
    END IF;

    -- Kullanıcı detaylarını al
    SELECT * INTO v_user_record FROM users WHERE id = v_user_uuid;

    -- Sonuç JSON'ını oluştur
    v_result := jsonb_build_object(
        'user_id', v_user_uuid,
        'is_new', v_is_new,
        'user', row_to_json(v_user_record)
    );

    RAISE NOTICE '[get_or_create_user] Sonuç: %', v_result::text;
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[get_or_create_user] HATA: %', SQLERRM;
        RETURN jsonb_build_object(
            'user_id', NULL, 
            'is_new', FALSE, 
            'error', SQLERRM
        );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_mining(p_user_id uuid, p_car_id integer, p_garage_id integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_car_status TEXT;
  v_car_fuel INTEGER;
  v_car_condition INTEGER;
  v_car_model_id UUID;
  v_mining_power INTEGER;
  v_garage_capacity INTEGER := 0;
  v_used_garage_slots INTEGER := 0;
  v_new_session_id INTEGER;
  v_mining_duration INTERVAL := INTERVAL '8 hours'; -- Standart mining süresi: 8 saat
  v_start_time TIMESTAMP WITH TIME ZONE := NOW();
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_reward_amount BIGINT;
  v_is_user_premium BOOLEAN;
BEGIN
    PERFORM 1 FROM users WHERE id=p_user_id FOR UPDATE;
  -- Kullanıcı premium durumunu kontrol et
  SELECT is_premium INTO v_is_user_premium
  FROM users
  WHERE id = p_user_id;

  -- Araç durumunu kontrol et
  SELECT 
    status, 
    fuel, 
    condition, 
    car_model_id
  INTO 
    v_car_status, 
    v_car_fuel, 
    v_car_condition, 
    v_car_model_id
  FROM user_cars
  WHERE id = p_car_id AND user_id = p_user_id;
  
  -- Araç bulunamadı veya kullanıcıya ait değil
  IF v_car_status IS NULL THEN
    RAISE EXCEPTION 'Araç bulunamadı veya bu kullanıcıya ait değil';
  END IF;
  
  -- Araç zaten mining yapıyor mu?
  IF v_car_status = 'mining' THEN
    RAISE EXCEPTION 'Bu araç zaten mining yapıyor';
  END IF;
  
  -- Araç mining için uygun durumda mı?
  IF v_car_status != 'active' THEN
    RAISE EXCEPTION 'Bu araç mining için uygun değil (Durum: %)', v_car_status;
  END IF;
  
  -- Yakıt yeterli mi? (en az %25 yakıt gerekli)
  IF v_car_fuel < 25 THEN
    RAISE EXCEPTION 'Araçta yeterli yakıt yok';
  END IF;
  
  -- Araç kondisyonu yeterli mi? (en az %10 kondisyon gerekli)
  IF v_car_condition < 10 THEN
    RAISE EXCEPTION 'Araç kondisyonu yetersiz';
  END IF;
  
  -- Aracın mining gücünü al
  SELECT round(cm.mining_power * coalesce(uc.mining_multiplier,1)) INTO v_mining_power
  FROM car_models cm JOIN user_cars uc ON uc.car_model_id=cm.id
  WHERE uc.id=p_car_id;
  
  -- Garaj kapasitesi kontrolü
  -- Kullanıcının tüm garajlarının toplam kapasitesini hesapla
  SELECT COALESCE(SUM(capacity), 0) INTO v_garage_capacity
  FROM garages
  WHERE user_id = p_user_id;
  
  -- Şu anda aktif mining oturumu olan araç sayısını bul
  SELECT COUNT(*) INTO v_used_garage_slots
  FROM mining_sessions
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Garaj kapasitesi yeterli mi?
  IF v_used_garage_slots >= v_garage_capacity THEN
    RAISE EXCEPTION 'Garaj kapasitesi dolu';
  END IF;
  
  -- Mining bitiş zamanını ve ödül miktarını hesapla
  v_end_time := v_start_time + v_mining_duration;
  v_reward_amount := (v_mining_power * 8); -- Her saat başına mining gücü kadar kazanç
  
  -- Premium kullanıcılar için bonus işlemi
  IF v_is_user_premium IS TRUE THEN
    v_reward_amount := v_reward_amount * 1.2; -- %20 fazla ödül
  END IF;
  
  -- Aracın durumunu mining olarak güncelle
  UPDATE user_cars
  SET 
    status = 'mining',
    updated_at = NOW()
  WHERE id = p_car_id;
  
  -- Mining oturumu oluştur
  INSERT INTO mining_sessions (
    user_id,
    car_id,
    garage_id,
    start_time,
    end_time,
    expected_reward,
    status,
    is_premium_applied,
    premium_bonus
  ) VALUES (
    p_user_id,
    p_car_id,
    p_garage_id,
    v_start_time,
    v_end_time,
    v_reward_amount,
    'active',
    COALESCE(v_is_user_premium, FALSE),
    CASE WHEN COALESCE(v_is_user_premium, FALSE) IS TRUE THEN 20 ELSE 0 END -- Premium bonus yüzdesi
  ) RETURNING id INTO v_new_session_id;
  
  -- Yeni oluşturulan mining oturumu ID'sini döndür
  RETURN v_new_session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_telegram_task(p_user_id uuid, p_telegram_id text, p_task_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public,pg_temp
AS $function$
DECLARE
  v_task RECORD;
  v_user_task RECORD;
  v_result JSONB;
  v_now TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'UTC');
  v_is_completed BOOLEAN := FALSE;
  v_message TEXT := 'Görev doğrulama başarısız';
  v_success BOOLEAN := FALSE;
  v_reward INTEGER := 0;
BEGIN
    PERFORM 1 FROM users WHERE id=p_user_id FOR UPDATE;
  -- Görevi getir
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'message', 'Görev bulunamadı');
  END IF;
  
  -- Kullanıcı görevini getir
  SELECT * INTO v_user_task 
  FROM user_tasks 
  WHERE user_id = p_user_id AND task_id = p_task_id
  FOR UPDATE;
  
  -- Kullanıcı görevi daha önce yoksa oluştur
  IF NOT FOUND THEN
    INSERT INTO user_tasks (user_id, task_id, progress, is_completed)
    VALUES (p_user_id, p_task_id, 0, FALSE)
    RETURNING * INTO v_user_task;
  END IF;
  
  -- Görev zaten tamamlanmışsa bilgi dön
  IF v_user_task.is_completed THEN
    RETURN json_build_object(
      'success', TRUE,
      'message', 'Bu görev zaten tamamlanmış',
      'reward', 0,
      'completed', TRUE
    );
  END IF;
  
  -- Doğrulama tipine göre görev ilerlemesini güncelle
  CASE v_task.verification_type
    WHEN 'mining_complete' THEN
      -- Şu anki mining sayısını kontrol et
      DECLARE
        v_mining_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_mining_count
        FROM mining_sessions
        WHERE user_id = p_user_id AND status = 'completed';
        
        IF v_mining_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'Mining görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := format('Mining ilerlemesi: %s/%s', v_mining_count, v_task.total);
          v_success := TRUE;
          
          -- İlerlemeyi güncelle
          UPDATE user_tasks SET 
            progress = v_mining_count,
            updated_at = v_now
          WHERE id = v_user_task.id;
        END IF;
      END;
    
    WHEN 'car_repair' THEN
      -- Bakım yapılmış mı kontrol et
      DECLARE
        v_repair_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_repair_count
        FROM transactions
        WHERE user_id = p_user_id AND type = 'expense' AND item LIKE 'Araç Tamiri%';
        
        IF v_repair_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'Araç tamir görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz bir aracı tamir etmemişsiniz';
          v_success := FALSE;
        END IF;
      END;
    
    WHEN 'car_refill' THEN
      -- Yakıt doldurulmuş mu kontrol et
      DECLARE
        v_refill_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_refill_count
        FROM transactions
        WHERE user_id = p_user_id AND type = 'expense' AND item LIKE 'Yakıt Dolumu%';
        
        IF v_refill_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'Yakıt doldurma görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz bir araca yakıt doldurmamışsınız';
          v_success := FALSE;
        END IF;
      END;
    
    WHEN 'car_purchase_nmfp' THEN
      -- NMFP ile araç alınmış mı kontrol et
      DECLARE
        v_purchase_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_purchase_count
        FROM user_cars
        WHERE user_id = p_user_id AND purchase_type = 'NMFP';
        
        IF v_purchase_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'NMFP ile araç alma görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz NMFP ile araç almamışsınız';
          v_success := FALSE;
        END IF;
      END;
    
    WHEN 'car_purchase_ton' THEN
      -- TON ile araç alınmış mı kontrol et
      DECLARE
        v_purchase_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_purchase_count
        FROM user_cars
        WHERE user_id = p_user_id AND purchase_type = 'TON';
        
        IF v_purchase_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'TON ile araç alma görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz TON ile araç almamışsınız';
          v_success := FALSE;
        END IF;
      END;
    
    WHEN 'car_mint_nft' THEN
      -- NFT mint yapılmış mı kontrol et
      DECLARE
        v_mint_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_mint_count
        FROM user_cars
        WHERE user_id = p_user_id AND purchase_type = 'NFT';
        
        IF v_mint_count >= v_task.total THEN
          v_is_completed := TRUE;
          v_message := 'NFT mint görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz NFT mint yapmamışsınız';
          v_success := FALSE;
        END IF;
      END;
    
    WHEN 'collect_bonus' THEN
      -- Günlük bonus toplanmış mı kontrol et
      DECLARE
        v_collected BOOLEAN;
      BEGIN
        SELECT 
          CASE WHEN last_bonus_collected_at IS NOT NULL THEN TRUE ELSE FALSE END INTO v_collected
        FROM users
        WHERE id = p_user_id;
        
        IF v_collected THEN
          v_is_completed := TRUE;
          v_message := 'Günlük bonus toplama görevi tamamlandı';
          v_success := TRUE;
        ELSE
          v_message := 'Henüz günlük bonus toplamamışsınız';
          v_success := FALSE;
        END IF;
      END;
    
    -- Diğer verification_type değerleri için ek kontroller
    ELSE
      -- Manuel doğrulama için varsayılan olarak başarılı kabul et
      v_is_completed := TRUE;
      v_message := 'Görev manuel olarak doğrulandı';
      v_success := TRUE;
  END CASE;
  
  -- Eğer görev tamamlandıysa ve daha önce tamamlanmamışsa, ödülü ver
  IF v_is_completed AND NOT v_user_task.is_completed THEN
    -- Görev ilerlemesini güncelle
    UPDATE user_tasks SET 
      progress = v_task.total,
      is_completed = TRUE,
      completed_at = v_now
    WHERE id = v_user_task.id;
    
    -- Ödülü ver
    UPDATE users SET 
      balance = balance + v_task.reward,
      xp = xp + GREATEST(10, v_task.reward / 5)
    WHERE id = p_user_id;
    
    -- Ödül transaction kaydı oluştur
    INSERT INTO transactions (
      user_id, type, amount, currency, status, source, date
    ) VALUES (
      p_user_id, 'reward', v_task.reward, 'NMFP', 'confirmed', 
      'Görev Ödülü: ' || v_task.title, v_now
    );
    
    v_reward := v_task.reward;
  END IF;
  
  -- Sonucu oluştur
  RETURN json_build_object(
    'success', v_success,
    'message', v_message,
    'reward', v_reward,
    'completed', v_is_completed,
    'progress', COALESCE(v_user_task.progress, 0),
    'total', v_task.total
  );
END;
$function$;
COMMIT;
