-- Premium mining sistemi için gerekli SQL fonksiyonları ve cron job

-- 1. Premium kullanıcılar için otomatik mining döngü başlatma fonksiyonu
CREATE OR REPLACE FUNCTION start_auto_mining_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  car_record RECORD;
  garage_record RECORD;
  available_slots INTEGER;
  new_session_id INTEGER;
  prepared_cars INTEGER := 0;
  mining_cars INTEGER := 0;
  result JSONB;
BEGIN
  -- Kullanıcı bilgilerini kontrol et
  SELECT * INTO user_record FROM users WHERE id = p_user_id;
  
  -- Kullanıcı bulunamadıysa hata döndür
  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Kullanıcı bulunamadı'
    );
  END IF;
  
  -- Kullanıcının premium durumunu kontrol et
  IF NOT user_record.premium_active THEN
    -- Kullanıcı premium değilse, premium yap
    UPDATE users
    SET 
      premium_active = true,
      premium_until = NOW() + INTERVAL '1 year'
    WHERE id = p_user_id;
  END IF;
  
  -- Toplam garaj kapasitesini hesapla
  SELECT COALESCE(SUM(capacity), 0) INTO available_slots 
  FROM garages 
  WHERE user_id = p_user_id;
  
  -- Aktif mining oturumu sayısını çıkar
  SELECT available_slots - COUNT(*) INTO available_slots 
  FROM mining_sessions 
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Kullanıcının tüm aktif araçlarını önce bakım ve yakıt doldurma ile hazırla
  FOR car_record IN 
    SELECT uc.*, cm.mining_power
    FROM user_cars uc
    JOIN car_models cm ON uc.car_model_id = cm.id
    WHERE uc.user_id = p_user_id 
      AND uc.status = 'active'
    ORDER BY cm.mining_power DESC -- En yüksek mining gücü olanları önceliklendir
    LIMIT available_slots
  LOOP
    -- Bakım ve yakıt maliyetlerini hesapla ve uygula
    BEGIN
      -- Araç bakım ve yakıt doldurma
      UPDATE user_cars
      SET 
        condition = 100,
        fuel = 100
      WHERE id = car_record.id;
      
      prepared_cars := prepared_cars + 1;
      
      -- Bakım ve yakıt maliyeti
      -- (Burada maliyetler alınmıyor çünkü premium kullanıcılar 1 TON ödediler)
      
      -- Garaj atama (ilk boş garajı bul)
      SELECT g.id INTO garage_record.id
      FROM garages g
      WHERE g.user_id = p_user_id
        AND (
          SELECT COUNT(*) 
          FROM mining_sessions ms 
          WHERE ms.garage_id = g.id AND ms.status = 'active'
        ) < g.capacity
      LIMIT 1;
      
      IF garage_record.id IS NOT NULL THEN
        -- Yeni mining oturumu başlat
        INSERT INTO mining_sessions (
          user_id, car_id, garage_id, start_time, end_time,
          expected_reward, status, created_at, is_premium_cycle
        )
        VALUES (
          p_user_id, car_record.id, garage_record.id,
          NOW(), NOW() + INTERVAL '8 hours',
          car_record.mining_power * 10, -- Beklenen ödül hesaplama
          'active', NOW(), true
        )
        RETURNING id INTO new_session_id;
        
        -- Araç durumunu mining yapıyor olarak işaretle
        UPDATE user_cars
        SET status = 'mining'
        WHERE id = car_record.id;
        
        mining_cars := mining_cars + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Bir hata oluşursa, bu aracı atla ve devam et
      CONTINUE;
    END;
  END LOOP;
  
  -- Sonucu oluştur
  result := jsonb_build_object(
    'success', true,
    'prepared_cars', prepared_cars,
    'mining_cars', mining_cars,
    'available_slots', available_slots,
    'message', 'Premium otomatik mining başlatıldı'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Tamamlanan premium mining oturumlarını otomatik yenileme
CREATE OR REPLACE FUNCTION auto_renew_premium_mining()
RETURNS INTEGER AS $$
DECLARE
  renewed_count INTEGER := 0;
  user_record RECORD;
  completed_session RECORD;
  car_record RECORD;
  garage_record RECORD;
  new_session_id INTEGER;
BEGIN
  -- Premium aktif kullanıcıları bul
  FOR user_record IN 
    SELECT id FROM users 
    WHERE premium_active = true 
      AND premium_until > NOW()
  LOOP
    -- Tamamlanan ve henüz yenilenmemiş mining oturumlarını bul
    FOR completed_session IN 
      SELECT ms.* 
      FROM mining_sessions ms
      WHERE ms.user_id = user_record.id 
        AND ms.status = 'completed'
        AND ms.is_premium_cycle = true
        AND ms.completed_at > NOW() - INTERVAL '10 minutes'
        AND NOT EXISTS (
          -- Bu mining oturumundan sonra aynı araç için başlatılmış yeni bir oturum var mı kontrol et
          SELECT 1 FROM mining_sessions 
          WHERE car_id = ms.car_id 
            AND created_at > ms.completed_at
        )
    LOOP
      -- Araç bilgilerini al
      SELECT * INTO car_record FROM user_cars WHERE id = completed_session.car_id;
      
      -- Araç aktif durumda ise yeni mining oturumu başlat
      IF car_record.status = 'active' THEN
        -- Otomatik tamir ve yakıt doldurma
        UPDATE user_cars
        SET 
          fuel = 100,
          condition = 100
        WHERE id = car_record.id;
        
        -- Garaj kontrol et
        SELECT * INTO garage_record FROM garages WHERE id = completed_session.garage_id;
        
        -- Yeni mining oturumu başlat
        INSERT INTO mining_sessions (
          user_id, car_id, garage_id, start_time, end_time, 
          expected_reward, status, created_at, is_premium_cycle
        )
        VALUES (
          user_record.id, car_record.id, completed_session.garage_id,
          NOW(), NOW() + INTERVAL '8 hours',
          completed_session.expected_reward, 'active', NOW(), true
        )
        RETURNING id INTO new_session_id;
        
        -- Araç durumunu mining yapıyor olarak işaretle
        UPDATE user_cars
        SET status = 'mining'
        WHERE id = car_record.id;
        
        renewed_count := renewed_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN renewed_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Mining tamamlama ve ödül toplama işlemi (mevcut fonksiyonu güncelle)
-- Eğer mining_sessions tamamlandığında otomatik olarak araç ve kullanıcı verilerini güncellemeyen bir fonksiyon varsa, 
-- bu fonksiyonu ona adapte etmek gerekir.

-- 4. Premium kontrol ve cronjob ekleme
CREATE OR REPLACE FUNCTION premium_expiry_check() 
RETURNS void AS $$
BEGIN
  -- Süresi dolan premium üyelikleri pasif yap
  UPDATE users
  SET premium_active = false
  WHERE premium_active = true 
    AND premium_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. Cron job ekle (her 10 dakikada bir)
SELECT cron.schedule(
  'auto-renew-premium-mining',
  '*/10 * * * *',
  $$SELECT auto_renew_premium_mining()$$
);

-- 6. Premium kontrol cron job (her saat)
SELECT cron.schedule(
  'check-premium-expiry',
  '0 * * * *',
  $$SELECT premium_expiry_check()$$
);

-- 7. Mining oturumu tamamlandığında çalışacak trigger
CREATE OR REPLACE FUNCTION process_completed_premium_mining()
RETURNS TRIGGER AS $$
BEGIN
  -- Mining tamamlandıysa
  IF OLD.status = 'active' AND NEW.status = 'completed' AND NEW.is_premium_cycle = true THEN
    -- Ödülü kullanıcı hesabına aktar
    UPDATE users
    SET 
      balance = balance + NEW.expected_reward,
      xp = xp + (NEW.expected_reward / 10)::bigint -- XP kazancı
    WHERE id = NEW.user_id;
    
    -- Araç yakıtını %25 azalt, durumunu %10 azalt (condition değeri)
    UPDATE user_cars
    SET 
      fuel = GREATEST(fuel - 25, 0), -- Minimum 0 olabilir
      condition = GREATEST(condition - 10, 0), -- Minimum 0 olabilir
      status = 'active' -- Araç durumunu aktif yap
    WHERE id = NEW.car_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger oluştur
DROP TRIGGER IF EXISTS after_premium_mining_completion ON mining_sessions;
CREATE TRIGGER after_premium_mining_completion
AFTER UPDATE ON mining_sessions
FOR EACH ROW
WHEN ((OLD.status = 'active' AND NEW.status = 'completed' AND NEW.is_premium_cycle = true))
EXECUTE FUNCTION process_completed_premium_mining(); 