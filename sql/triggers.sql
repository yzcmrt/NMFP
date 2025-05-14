-- Supabase Porsche Mining GameFi Tetikleyicileri
-- Versiyon: Konsolide edilmiş - 2 (Sondaki RAISE NOTICE kaldırıldı)

-- =====================================================================
-- TETİKLEYİCİ FONKSİYONLARI
-- =====================================================================

-- user_cars tablosundaki updated_at sütununu otomatik günceller
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = get_utc_now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mining süresi dolan oturumları tamamlar (Bu fonksiyonun doğrudan tetikleyici ile kullanılması önerilmez, zamanlanmış görev daha iyi olabilir)
-- Ancak burada referans olarak bırakıldı.
CREATE OR REPLACE FUNCTION complete_finished_mining_sessions()
RETURNS void AS $$
DECLARE
  session_record RECORD;
  reward BIGINT;
BEGIN
  FOR session_record IN (SELECT id FROM mining_sessions WHERE status = 'active' AND end_time <= get_utc_now()) LOOP
    BEGIN
      SELECT complete_mining(session_record.id) INTO reward;
      RAISE NOTICE '[auto_complete_mining] session_id=% tamamlandi, odul=%', session_record.id, reward;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_complete_mining] Hata session_id=%: %', session_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tamir süresi dolan arabaları aktif hale getirir (Bu fonksiyonun doğrudan tetikleyici ile kullanılması önerilmez, zamanlanmış görev daha iyi olabilir)
-- Ancak burada referans olarak bırakıldı.
CREATE OR REPLACE FUNCTION complete_finished_repairs()
RETURNS void AS $$
DECLARE
  car_record RECORD;
BEGIN
  FOR car_record IN (SELECT id FROM user_cars WHERE status = 'repairing' AND repair_end_time <= get_utc_now()) LOOP
    BEGIN
      UPDATE user_cars SET status = 'active', condition = 100, repair_end_time = NULL WHERE id = car_record.id;
      RAISE NOTICE '[auto_complete_repairs] car_id=% tamiri tamamlandi.', car_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_complete_repairs] Hata car_id=%: %', car_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- TETİKLEYİCİLER
-- =====================================================================

-- user_cars tablosuna trigger ekleniyor
DROP TRIGGER IF EXISTS set_timestamp ON public.user_cars; -- Önce varsa kaldır
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.user_cars
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Sondaki RAISE NOTICE satırı kaldırıldı.
