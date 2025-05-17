-- Otomatik mining sistemi için gerekli SQL fonksiyonları

-- 1. Mining tamamlandığında yakıt ve bakım değerlerini azaltma
CREATE OR REPLACE FUNCTION update_car_stats_after_mining()
RETURNS TRIGGER AS $$
BEGIN
  -- Mining tamamlandıysa araç durumunu güncelle
  IF OLD.status = 'active' AND NEW.status = 'completed' THEN
    -- Araç yakıtını %25 azalt, durumunu %10 azalt (condition değeri)
    UPDATE user_cars
    SET 
      fuel = GREATEST(fuel - 25, 0), -- Minimum 0 olabilir
      condition = GREATEST(condition - 10, 0), -- Minimum 0 olabilir
      status = 'active' -- Araç durumunu aktif yap
    WHERE id = OLD.car_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger oluştur
DROP TRIGGER IF EXISTS after_mining_completion ON mining_sessions;
CREATE TRIGGER after_mining_completion
AFTER UPDATE ON mining_sessions
FOR EACH ROW
EXECUTE FUNCTION update_car_stats_after_mining();

-- 3. Premium kullanıcılar için otomatik mining yenileme
CREATE OR REPLACE FUNCTION auto_renew_premium_mining()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  completed_session RECORD;
  available_slots INTEGER;
  car_record RECORD;
  garage_record RECORD;
  new_session_id INTEGER;
BEGIN
  -- Premium aktif kullanıcıları bul
  FOR user_record IN 
    SELECT id FROM users WHERE premium_active = true AND premium_until > NOW()
  LOOP
    -- Tamamlanan ve henüz yenilenmemiş mining oturumlarını bul
    FOR completed_session IN 
      SELECT ms.* 
      FROM mining_sessions ms
      WHERE ms.user_id = user_record.id 
        AND ms.status = 'completed'
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
      
      -- Araç aktif durumda ve yeterli yakıt/bakıma sahipse yeni mining oturumu başlat
      IF car_record.status = 'active' AND car_record.fuel >= 25 AND car_record.condition >= 10 THEN
        -- Otomatik tamir ve yakıt doldurma
        UPDATE user_cars
        SET 
          fuel = 100,
          condition = 100
        WHERE id = car_record.id;
        
        -- Bakım ve yakıt maliyetlerini hesapla ve kullanıcı bakiyesinden düş
        UPDATE users
        SET balance = balance - (
          (100 - car_record.fuel) * 5 + -- Yakıt maliyeti: %1 için 5 NMFP
          (100 - car_record.condition) * 10 -- Bakım maliyeti: %1 için 10 NMFP
        )
        WHERE id = user_record.id;
        
        -- Garage ID al (eski mining oturumundaki garajı kullan)
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
      END IF;
    END LOOP;
    
    -- Garaj kapasitesi kontrolü ve en verimli araçları ekleme
    -- Toplam garaj kapasitesini hesapla
    SELECT COALESCE(SUM(capacity), 0) INTO available_slots 
    FROM garages 
    WHERE user_id = user_record.id;
    
    -- Aktif mining oturumu sayısını çıkar
    available_slots := available_slots - (
      SELECT COUNT(*) FROM mining_sessions 
      WHERE user_id = user_record.id AND status = 'active'
    );
    
    -- Eğer boş slot varsa, en iyi araçları ekle
    IF available_slots > 0 THEN
      -- En iyi mining gücüne sahip ve şu an mining yapmayan araçları bul
      FOR car_record IN 
        SELECT uc.* 
        FROM user_cars uc
        JOIN car_models cm ON uc.car_model_id = cm.id
        WHERE uc.user_id = user_record.id 
          AND uc.status = 'active' 
          AND uc.fuel >= 25 
          AND uc.condition >= 10
          AND NOT EXISTS (
            SELECT 1 FROM mining_sessions 
            WHERE car_id = uc.id AND status = 'active'
          )
        ORDER BY cm.mining_power DESC
        LIMIT available_slots
      LOOP
        -- Otomatik tamir ve yakıt doldurma
        UPDATE user_cars
        SET 
          fuel = 100,
          condition = 100
        WHERE id = car_record.id;
        
        -- Bakım ve yakıt maliyetleri için kullanıcı bakiyesinden düş
        UPDATE users
        SET balance = balance - (
          (100 - car_record.fuel) * 5 + -- Yakıt maliyeti
          (100 - car_record.condition) * 10 -- Bakım maliyeti
        )
        WHERE id = user_record.id;
        
        -- Kullanılabilir bir garaj bul
        SELECT g.id INTO garage_record.id
        FROM garages g
        WHERE g.user_id = user_record.id
        LIMIT 1;
        
        IF garage_record.id IS NOT NULL THEN
          -- Yeni mining oturumu başlat
          INSERT INTO mining_sessions (
            user_id, car_id, garage_id, start_time, end_time,
            expected_reward, status, created_at, is_premium_cycle
          )
          VALUES (
            user_record.id, car_record.id, garage_record.id,
            NOW(), NOW() + INTERVAL '8 hours',
            -- Beklenen ödül hesaplaması
            (SELECT mining_power FROM car_models WHERE id = car_record.car_model_id) * 10, 
            'active', NOW(), true
          );
          
          -- Araç durumunu mining yapıyor olarak işaretle
          UPDATE user_cars
          SET status = 'mining'
          WHERE id = car_record.id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Cron job için otomatik mining tamamlama fonksiyonu
CREATE OR REPLACE FUNCTION cron_auto_complete_mining()
RETURNS void AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Tamamlanması gereken mining oturumları
  FOR session_record IN 
    SELECT * FROM mining_sessions 
    WHERE status = 'active' AND end_time <= NOW()
  LOOP
    -- Ödülü hesapla ve mining oturumunu tamamla
    UPDATE mining_sessions
    SET 
      status = 'completed',
      completed_at = NOW(),
      actual_reward = expected_reward -- Basitlik için beklenen ödülü olduğu gibi kabul ediyoruz
    WHERE id = session_record.id;

    -- Kullanıcı bakiyesini güncelle
    UPDATE users
    SET 
      balance = balance + session_record.expected_reward,
      xp = xp + (session_record.expected_reward / 10)::bigint -- XP kazancı
    WHERE id = session_record.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Cron job ekle (her 5 dakikada bir)
SELECT cron.schedule(
  'auto-complete-mining', -- job adı
  '*/5 * * * *',  -- her 5 dakikada bir
  $$SELECT cron_auto_complete_mining()$$
);

-- 6. Premium kullanıcılar için otomatik yenileme (her 10 dakikada bir)
SELECT cron.schedule(
  'auto-renew-premium-mining', -- job adı
  '*/10 * * * *',  -- her 10 dakikada bir
  $$SELECT auto_renew_premium_mining()$$
); 