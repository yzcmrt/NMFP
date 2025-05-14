CREATE OR REPLACE FUNCTION public.grant_initial_assets(
    p_user_id UUID,
    p_is_premium BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Premium Kullanıcı Varlıkları
    v_premium_car_model_id UUID := '845c6f7b-f3de-4022-a291-a2ad3065535f'; -- 911 Carrera S (Rare) ID - Güncellendi
    v_premium_garage_template_id TEXT := 'nmfp-5'; -- 5 Araçlık Garaj Template ID
    v_premium_initial_balance BIGINT := 25000;
    -- Normal Kullanıcı Varlıkları
    v_normal_car_model_id UUID := '2fbdc616-eaa7-4019-a976-75c08fac2497'; -- 718 Cayman (Common) ID - Güncellendi
    v_normal_garage_template_id TEXT := 'nmfp-3'; -- 3 Araçlık Garaj Template ID
    v_normal_initial_balance BIGINT := 10000;
    -- Seçilen Varlıklar
    v_selected_car_model_id UUID;
    v_selected_garage_template_id TEXT;
    v_selected_initial_balance BIGINT;
    -- Yardımcı Değişkenler
    v_car_name TEXT;
    v_garage_template RECORD; -- Garaj şablonu bilgilerini almak için
    v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
    v_car_inserted BOOLEAN := FALSE;
    v_garage_inserted BOOLEAN := FALSE;
    v_balance_updated BOOLEAN := FALSE;
    v_final_balance BIGINT;
BEGIN
    RAISE NOTICE '[grant_initial_assets] Basladi: user_id=%, is_premium=%', p_user_id, p_is_premium;

    -- Kullanıcı tipine göre varlıkları seç
    IF p_is_premium THEN
        v_selected_car_model_id := v_premium_car_model_id;
        v_selected_garage_template_id := v_premium_garage_template_id;
        v_selected_initial_balance := v_premium_initial_balance;
        RAISE NOTICE '[grant_initial_assets] Premium kullanıcı varlıkları seçildi.';
    ELSE
        v_selected_car_model_id := v_normal_car_model_id;
        v_selected_garage_template_id := v_normal_garage_template_id;
        v_selected_initial_balance := v_normal_initial_balance;
        RAISE NOTICE '[grant_initial_assets] Normal kullanıcı varlıkları seçildi.';
    END IF;

    -- 1. Başlangıç Aracı
    BEGIN
        -- Seçilen modelin adını al
        SELECT name INTO v_car_name FROM public.car_models WHERE id = v_selected_car_model_id;
        IF NOT FOUND THEN
            RAISE WARNING '[grant_initial_assets] Başlangıç aracı modeli IDsi (%) bulunamadı!', v_selected_car_model_id;
        ELSE
            RAISE NOTICE '[grant_initial_assets] Başlangıç aracı modeli bulundu: ID=%, Name=%', v_selected_car_model_id, v_car_name;
            -- Kullanıcıya bu arabayı ver (user_cars tablosuna ekle)
            INSERT INTO public.user_cars (
                user_id, car_model_id, name, purchase_type, level, fuel, condition, status, mining_multiplier, created_at, updated_at
            ) VALUES (
                p_user_id, v_selected_car_model_id, v_car_name || ' (Başlangıç)', 'INITIAL', 1, 100, 100, 'active', 1.0, v_now, v_now
            ) ON CONFLICT (user_id, car_model_id) DO NOTHING; -- Aynı modelden varsa ekleme

            GET DIAGNOSTICS v_car_inserted = ROW_COUNT; -- Ekleme başarılı oldu mu?
            IF v_car_inserted THEN
                 RAISE NOTICE '[grant_initial_assets] user_cars kaydi eklendi.';
                 -- İşlemi kaydet
                 INSERT INTO public.transactions (user_id, type, amount, currency, status, item, source, date)
                 VALUES (p_user_id, 'reward', 0, 'NMFP', 'confirmed', v_car_name || ' (Başlangıç)', 'Başlangıç Varlığı', v_now);
            ELSE
                 RAISE NOTICE '[grant_initial_assets] user_cars kaydi zaten mevcut veya eklenemedi.';
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Arac ekleme hatasi: %', SQLERRM;
    END;

    -- 2. Başlangıç Garajı
    BEGIN
        -- Seçilen garaj şablonunu bul (garage_templates tablosundan ID ile)
        SELECT * INTO v_garage_template 
        FROM public.garage_templates -- <--- Tablo adı düzeltildi
        WHERE id = v_selected_garage_template_id; -- <-- ID (text) ile arama
        
        IF NOT FOUND THEN
            RAISE WARNING '[grant_initial_assets] Baslangic garaj sablonu bulunamadi (garage_templates tablosunda): template_id=%', v_selected_garage_template_id;
        ELSE
            RAISE NOTICE '[grant_initial_assets] Baslangic garaj sablonu bulundu: Name=%', v_garage_template.name;
            -- Kullanıcıya bu garajı ver (garages tablosuna ekle)
            INSERT INTO public.garages (
                -- Sütun isimleri garages tablosuna uygun olmalı
                user_id, name, image_url, capacity, daily_bonus, level, value, created_at, purchase_type -- template_id ve location kaldırıldı (kullanıcı garajında anlamsız olabilir)
            ) VALUES (
                p_user_id, 
                v_garage_template.name || ' (Başlangıç)', 
                v_garage_template.image, -- garage_templates.image sütunu varsayıldı
                v_garage_template.capacity, 
                v_garage_template.daily_bonus, 
                1, -- Başlangıç seviyesi
                0, -- Başlangıç değeri
                v_now, 
                'INITIAL' -- Satın alma tipi
            ) ON CONFLICT (user_id, name) DO NOTHING; -- Aynı isimde garaj varsa ekleme

            GET DIAGNOSTICS v_garage_inserted = ROW_COUNT; -- Ekleme başarılı oldu mu?
            IF v_garage_inserted THEN
                 RAISE NOTICE '[grant_initial_assets] garages kaydi eklendi.';
                 -- İşlemi kaydet (opsiyonel)
                 INSERT INTO public.transactions (user_id, type, amount, currency, status, item, source, date)
                 VALUES (p_user_id, 'reward', 0, 'NMFP', 'confirmed', v_garage_template.name || ' (Başlangıç)', 'Başlangıç Varlığı', v_now);
            ELSE
                 RAISE NOTICE '[grant_initial_assets] garages kaydi zaten mevcut veya eklenemedi.';
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Garaj ekleme hatasi: %', SQLERRM;
    END;

    -- 3. Bakiye Ayarlama
    BEGIN
        -- Bakiyeyi doğrudan ayarla (varsayılan 1000 üzerine eklemek yerine)
        UPDATE public.users SET balance = v_selected_initial_balance WHERE id = p_user_id;
        GET DIAGNOSTICS v_balance_updated = ROW_COUNT;

        SELECT balance INTO v_final_balance FROM users WHERE id = p_user_id;
        IF v_balance_updated AND v_final_balance = v_selected_initial_balance THEN
             RAISE NOTICE '[grant_initial_assets] Bakiye ayarlandi: %', v_final_balance;
             -- İşlemi kaydet (opsiyonel)
             INSERT INTO public.transactions (user_id, type, amount, currency, status, source, date)
             VALUES (p_user_id, 'reward', v_selected_initial_balance, 'NMFP', 'confirmed', 'Başlangıç Bakiyesi', v_now);
        ELSE
             RAISE WARNING '[grant_initial_assets] Bakiye ayarlamasi basarisiz veya beklenmeyen bir deger! Son bakiye: %', v_final_balance;
             v_balance_updated := FALSE; -- Başarısız olarak işaretle
        END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING '[grant_initial_assets] Bakiye ayarlama hatasi: %', SQLERRM; v_balance_updated := FALSE;
    END;

    -- Genel kontrol
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