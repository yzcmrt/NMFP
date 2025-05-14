-- Supabase Porsche Mining GameFi Başlangıç Verileri
-- Versiyon: Tamamlanmış - 4 (tasks INSERT frequency sütunu kaldırıldı)

-- =====================================================================
-- ÖNCEKİ VERİLERİ TEMİZLEME (İsteğe Bağlı ama Önerilir)
-- =====================================================================
DELETE FROM public.user_tasks;
DELETE FROM public.tasks;
DELETE FROM public.garages WHERE user_id IS NULL; -- Sadece şablonları sil
DELETE FROM public.car_models;

DO $$ BEGIN
  RAISE NOTICE 'Eski başlangıç verileri (varsa) silindi.';
END $$;

-- =====================================================================
-- ARAÇ MODELLERİ (car_models)
-- =====================================================================
INSERT INTO public.car_models (name, rarity, description, image_url, mining_power, max_fuel, max_health, nmfp_price, ton_price, nft_mint_price, refill_cost, repair_cost) VALUES
-- 911 Serisi
('Porsche 911 Carrera', 'Common', 'Porsche 911 Carrera - Common Nadirlik', '/cars/911/911-carrera.jpg', 388, 100, 100, 38800, 0.50, 0.75, 78, 194),
('Porsche 911 Carrera Cabriolet', 'Common', 'Porsche 911 Carrera Cabriolet - Common Nadirlik', '/cars/911/911-carrera-cabriolet.jpg', 388, 100, 100, 38800, 0.50, 0.75, 78, 194),
('Porsche 911 Carrera T', 'Common', 'Porsche 911 Carrera T - Common Nadirlik', '/cars/911/911-carrera-t.jpg', 388, 100, 100, 38800, 0.50, 0.75, 78, 194),
('Porsche 911 Carrera T Cabriolet', 'Common', 'Porsche 911 Carrera T Cabriolet - Common Nadirlik', '/cars/911/911-carrera-t-cabriolet.jpg', 388, 100, 100, 38800, 0.50, 0.75, 78, 194),
('Porsche 911 Carrera S', 'Rare', 'Porsche 911 Carrera S - Rare Nadirlik', '/cars/911/911-carrera-s.jpg', 473, 120, 120, 47300, 0.67, 1.00, 95, 237),
('Porsche 911 Carrera S Cabriolet', 'Rare', 'Porsche 911 Carrera S Cabriolet - Rare Nadirlik', '/cars/911/911-carrera-s-cabriolet.jpg', 473, 120, 120, 47300, 0.67, 1.00, 95, 237),
('Porsche 911 Carrera GTS', 'Epic', 'Porsche 911 Carrera GTS - Epic Nadirlik', '/cars/911/911-carrera-gts.jpg', 532, 150, 150, 53200, 1.81, 2.70, 106, 266),
('Porsche 911 Carrera GTS Cabriolet', 'Epic', 'Porsche 911 Carrera GTS Cabriolet - Epic Nadirlik', '/cars/911/911-carrera-gts-cabriolet.jpg', 532, 150, 150, 53200, 1.81, 2.70, 106, 266),
('Porsche 911 Carrera 4 GTS', 'Epic', 'Porsche 911 Carrera 4 GTS - Epic Nadirlik', '/cars/911/911-carrera-4-gts.jpg', 532, 150, 150, 53200, 1.81, 2.70, 106, 266),
('Porsche 911 Carrera 4 GTS Cabriolet', 'Epic', 'Porsche 911 Carrera 4 GTS Cabriolet - Epic Nadirlik', '/cars/911/911-carrera-4-gts-cabriolet.jpg', 532, 150, 150, 53200, 1.81, 2.70, 106, 266),
('Porsche 911 Targa 4 GTS', 'Epic', 'Porsche 911 Targa 4 GTS - Epic Nadirlik', '/cars/911/911-targa-4-gts.jpg', 532, 150, 150, 53200, 1.81, 2.70, 106, 266),
('Porsche 911 GT3', 'Epic', 'Porsche 911 GT3 - Epic Nadirlik', '/cars/911/911-gt3.jpg', 502, 150, 150, 50200, 1.81, 2.70, 100, 251),
('Porsche 911 GT3 Touring', 'Epic', 'Porsche 911 GT3 Touring - Epic Nadirlik', '/cars/911/911-gt3-touring.jpg', 502, 150, 150, 50200, 1.81, 2.70, 100, 251),
('Porsche 911 GT3 RS', 'Legendary', 'Porsche 911 GT3 RS - Legendary Nadirlik', '/cars/911/911-gt3-rs.jpg', 518, 200, 200, 51800, 1.17, 1.75, 104, 259),
('Porsche 911 S/T', 'Legendary', 'Porsche 911 S/T - Legendary Nadirlik', '/cars/911/911-s-t.jpg', 518, 200, 200, 51800, 1.17, 1.75, 104, 259),
('Porsche 911 Turbo', 'Epic', 'Porsche 911 Turbo - Epic Nadirlik', '/cars/911/911-turbo.jpg', 572, 150, 150, 57200, 1.81, 2.70, 114, 286),
('Porsche 911 Turbo Cabriolet', 'Epic', 'Porsche 911 Turbo Cabriolet - Epic Nadirlik', '/cars/911/911-turbo-cabriolet.jpg', 572, 150, 150, 57200, 1.81, 2.70, 114, 286),
('Porsche 911 Turbo S', 'Legendary', 'Porsche 911 Turbo S - Legendary Nadirlik', '/cars/911/911-turbo-s.jpg', 640, 200, 200, 64000, 1.17, 1.75, 128, 320),
('Porsche 911 Turbo S Cabriolet', 'Legendary', 'Porsche 911 Turbo S Cabriolet - Legendary Nadirlik', '/cars/911/911-turbo-s-cabriolet.jpg', 640, 200, 200, 64000, 1.17, 1.75, 128, 320),
('Porsche 911 Turbo 50 Year', 'Legendary', 'Porsche 911 Turbo 50 Year - Legendary Nadirlik', '/cars/911/911-turbo-50.jpg', 640, 200, 200, 64000, 1.17, 1.75, 128, 320),
('Porsche 911 Dakar', 'Epic', 'Porsche 911 Dakar - Epic Nadirlik', '/cars/911/911-dakar.jpg', 473, 150, 150, 47300, 1.81, 2.70, 95, 237),
-- 718 Serisi
('Porsche 718 Cayman', 'Common', 'Porsche 718 Cayman - Common Nadirlik', '/cars/718/718-cayman.jpg', 300, 100, 100, 30000, 0.50, 0.75, 60, 150),
('Porsche 718 Cayman S', 'Common', 'Porsche 718 Cayman S - Common Nadirlik', '/cars/718/718-cayman-s.jpg', 350, 100, 100, 35000, 0.50, 0.75, 70, 175),
('Porsche 718 Cayman Style Edition', 'Common', 'Porsche 718 Cayman Style Edition - Common Nadirlik', '/cars/718/718-cayman-style-edition.jpg', 300, 100, 100, 30000, 0.50, 0.75, 60, 150),
('Porsche 718 Cayman GTS 4.0', 'Rare', 'Porsche 718 Cayman GTS 4.0 - Rare Nadirlik', '/cars/718/718-cayman-gts-4.0.jpg', 394, 120, 120, 39400, 0.67, 1.00, 79, 197),
('Porsche 718 Boxster', 'Common', 'Porsche 718 Boxster - Common Nadirlik', '/cars/718/718-boxster.jpg', 300, 100, 100, 30000, 0.50, 0.75, 60, 150),
('Porsche 718 Boxster S', 'Common', 'Porsche 718 Boxster S - Common Nadirlik', '/cars/718/718-boxster-s.jpg', 350, 100, 100, 35000, 0.50, 0.75, 70, 175),
('Porsche 718 Boxster Style Edition', 'Common', 'Porsche 718 Boxster Style Edition - Common Nadirlik', '/cars/718/718-boxster-style-edition.jpg', 300, 100, 100, 30000, 0.50, 0.75, 60, 150),
('Porsche 718 Boxster GTS 4.0', 'Rare', 'Porsche 718 Boxster GTS 4.0 - Rare Nadirlik', '/cars/718/718-boxster-gts-4.0.jpg', 394, 120, 120, 39400, 0.67, 1.00, 79, 197),
('Porsche 718 Cayman GT4 RS', 'Legendary', 'Porsche 718 Cayman GT4 RS - Legendary Nadirlik', '/cars/718/718-cayman-gt4-rs.jpg', 493, 200, 200, 49300, 1.17, 1.75, 99, 247),
('Porsche 718 Spyder RS', 'Legendary', 'Porsche 718 Spyder RS - Legendary Nadirlik', '/cars/718/718-spyder-rs.jpg', 493, 200, 200, 49300, 1.17, 1.75, 99, 247),
-- Taycan Serisi
('Porsche Taycan', 'Common', 'Porsche Taycan - Common Nadirlik', '/cars/taycan/taycan.jpg', 402, 100, 100, 40200, 0.50, 0.75, 80, 201),
('Porsche Taycan 4', 'Common', 'Porsche Taycan 4 - Common Nadirlik', '/cars/taycan/taycan-4.jpg', 402, 100, 100, 40200, 0.50, 0.75, 80, 201),
('Porsche Taycan 4S', 'Rare', 'Porsche Taycan 4S - Rare Nadirlik', '/cars/taycan/taycan-4s.jpg', 536, 120, 120, 53600, 0.67, 1.00, 107, 268),
('Porsche Taycan GTS', 'Epic', 'Porsche Taycan GTS - Epic Nadirlik', '/cars/taycan/taycan-gts.jpg', 690, 150, 150, 69000, 1.81, 2.70, 138, 345),
('Porsche Taycan Turbo', 'Epic', 'Porsche Taycan Turbo - Epic Nadirlik', '/cars/taycan/taycan-turbo.jpg', 871, 150, 150, 87100, 1.81, 2.70, 174, 436),
('Porsche Taycan Turbo S', 'Legendary', 'Porsche Taycan Turbo S - Legendary Nadirlik', '/cars/taycan/taycan-turbo-s.jpg', 938, 200, 200, 93800, 1.17, 1.75, 188, 469),
('Porsche Taycan Turbo GT', 'Legendary', 'Porsche Taycan Turbo GT - Legendary Nadirlik', '/cars/taycan/taycan-turbo-gt.jpg', 1019, 200, 200, 101900, 1.17, 1.75, 204, 510),
('Porsche Taycan Turbo GT with Weissach Pack', 'Legendary', 'Porsche Taycan Turbo GT with Weissach Pack - Legendary Nadirlik', '/cars/taycan/taycan-turbo-gtwp.jpg', 1019, 200, 200, 101900, 1.17, 1.75, 204, 510),
('Porsche Taycan 4 Cross Turismo', 'Rare', 'Porsche Taycan 4 Cross Turismo - Rare Nadirlik', '/cars/taycan/taycan-4-cross-turismo.jpg', 429, 120, 120, 42900, 0.67, 1.00, 86, 215),
('Porsche Taycan 4S Cross Turismo', 'Rare', 'Porsche Taycan 4S Cross Turismo - Rare Nadirlik', '/cars/taycan/taycan-4s-cross-turismo.jpg', 590, 120, 120, 59000, 0.67, 1.00, 118, 295),
('Porsche Taycan Turbo Cross Turismo', 'Epic', 'Porsche Taycan Turbo Cross Turismo - Epic Nadirlik', '/cars/taycan/taycan-turbo-cross-turismo.jpg', 871, 150, 150, 87100, 1.81, 2.70, 174, 436),
('Porsche Taycan Turbo S Cross Turismo', 'Legendary', 'Porsche Taycan Turbo S Cross Turismo - Legendary Nadirlik', '/cars/taycan/taycan-turbo-s-cross-turismo.jpg', 938, 200, 200, 93800, 1.17, 1.75, 188, 469),
('Porsche Taycan GTS Cross Turismo', 'Epic', 'Porsche Taycan GTS Cross Turismo - Epic Nadirlik', '/cars/taycan/taycan-gts-cross-turismo.jpg', 690, 150, 150, 69000, 1.81, 2.70, 138, 345),
('Porsche Taycan Sport Turismo', 'Common', 'Porsche Taycan Sport Turismo - Common Nadirlik', '/cars/taycan/taycan-sport-turismo.jpg', 402, 100, 100, 40200, 0.50, 0.75, 80, 201),
('Porsche Taycan 4S Sport Turismo', 'Rare', 'Porsche Taycan 4S Sport Turismo - Rare Nadirlik', '/cars/taycan/taycan-4s-sport-turismo.jpg', 536, 120, 120, 53600, 0.67, 1.00, 107, 268),
('Porsche Taycan GTS Sport Turismo', 'Epic', 'Porsche Taycan GTS Sport Turismo - Epic Nadirlik', '/cars/taycan/taycan-gts-sport-turismo.jpg', 690, 150, 150, 69000, 1.81, 2.70, 138, 345),
('Porsche Taycan Turbo Sport Turismo', 'Epic', 'Porsche Taycan Turbo Sport Turismo - Epic Nadirlik', '/cars/taycan/taycan-turbo-sport-turismo.jpg', 871, 150, 150, 87100, 1.81, 2.70, 174, 436),
('Porsche Taycan Turbo S Sport Turismo', 'Legendary', 'Porsche Taycan Turbo S Sport Turismo - Legendary Nadirlik', '/cars/taycan/taycan-turbo-s-sport-turismo.jpg', 938, 200, 200, 93800, 1.17, 1.75, 188, 469),
-- 918 Serisi
('Porsche 918 Spyder', 'Legendary', 'Porsche 918 Spyder - Legendary Nadirlik', '/cars/918/918-spyder.jpg', 887, 200, 200, 88700, 1.17, 1.75, 177, 444),
-- Cayenne Serisi
('Porsche Cayenne', 'Common', 'Porsche Cayenne - Common Nadirlik', '/cars/cayenne/cayenne.jpg', 348, 100, 100, 34800, 0.50, 0.75, 70, 174),
('Porsche Cayenne Coupe', 'Common', 'Porsche Cayenne Coupe - Common Nadirlik', '/cars/cayenne/cayenne-coupe.jpg', 348, 100, 100, 34800, 0.50, 0.75, 70, 174),
('Porsche Cayenne E-Hybrid', 'Rare', 'Porsche Cayenne E-Hybrid - Rare Nadirlik', '/cars/cayenne/cayenne-e-hybrid.jpg', 463, 120, 120, 46300, 0.67, 1.00, 93, 232),
('Porsche Cayenne E-Hybrid Coupe', 'Rare', 'Porsche Cayenne E-Hybrid Coupe - Rare Nadirlik', '/cars/cayenne/cayenne-e-hybrid-coupe.jpg', 463, 120, 120, 46300, 0.67, 1.00, 93, 232),
('Porsche Cayenne S E-Hybrid', 'Epic', 'Porsche Cayenne S E-Hybrid - Epic Nadirlik', '/cars/cayenne/cayenne-s-e-hybrid.jpg', 512, 150, 150, 51200, 1.81, 2.70, 102, 256),
('Porsche Cayenne S E-Hybrid Coupe', 'Epic', 'Porsche Cayenne S E-Hybrid Coupe - Epic Nadirlik', '/cars/cayenne/cayenne-s-e-hybrid-coupe.jpg', 512, 150, 150, 51200, 1.81, 2.70, 102, 256),
('Porsche Cayenne S', 'Rare', 'Porsche Cayenne S - Rare Nadirlik', '/cars/cayenne/cayenne-s.jpg', 468, 120, 120, 46800, 0.67, 1.00, 94, 234),
('Porsche Cayenne S Coupe', 'Rare', 'Porsche Cayenne S Coupe - Rare Nadirlik', '/cars/cayenne/cayenne-s-coupe.jpg', 468, 120, 120, 46800, 0.67, 1.00, 94, 234),
('Porsche Cayenne GTS', 'Epic', 'Porsche Cayenne GTS - Epic Nadirlik', '/cars/cayenne/cayenne-gts.jpg', 493, 150, 150, 49300, 1.81, 2.70, 99, 247),
('Porsche Cayenne GTS Coupe', 'Epic', 'Porsche Cayenne GTS Coupe - Epic Nadirlik', '/cars/cayenne/cayenne-gts-coupe.jpg', 493, 150, 150, 49300, 1.81, 2.70, 99, 247),
('Porsche Cayenne Turbo GT Coupe', 'Legendary', 'Porsche Cayenne Turbo GT Coupe - Legendary Nadirlik', '/cars/cayenne/cayenne-turbo-gt-coupe.jpg', 650, 200, 200, 65000, 1.17, 1.75, 130, 325),
('Porsche Cayenne Turbo S E-Hybrid', 'Legendary', 'Porsche Cayenne Turbo S E-Hybrid - Legendary Nadirlik', '/cars/cayenne/cayenne-turbo-s-e-hybrid.jpg', 729, 200, 200, 72900, 1.17, 1.75, 146, 365),
('Porsche Cayenne Turbo S E-Hybrid Coupe', 'Legendary', 'Porsche Cayenne Turbo S E-Hybrid Coupe - Legendary Nadirlik', '/cars/cayenne/cayenne-turbo-s-e-hybrid-coupe.jpg', 729, 200, 200, 72900, 1.17, 1.75, 146, 365),
-- Panamera Serisi
('Porsche Panamera', 'Common', 'Porsche Panamera - Common Nadirlik', '/cars/panamera/panamera.jpg', 348, 100, 100, 34800, 0.50, 0.75, 70, 174),
('Porsche Panamera 4', 'Common', 'Porsche Panamera 4 - Common Nadirlik', '/cars/panamera/panamera-4.jpg', 348, 100, 100, 34800, 0.50, 0.75, 70, 174),
('Porsche Panamera 4 E-Hybrid', 'Rare', 'Porsche Panamera 4 E-Hybrid - Rare Nadirlik', '/cars/panamera/panamera-4-e-hybrid.jpg', 463, 120, 120, 46300, 0.67, 1.00, 93, 232),
('Porsche Panamera 4S E-Hybrid', 'Epic', 'Porsche Panamera 4S E-Hybrid - Epic Nadirlik', '/cars/panamera/panamera-4s-e-hybrid.jpg', 536, 150, 150, 53600, 1.81, 2.70, 107, 268),
('Porsche Panamera GTS', 'Epic', 'Porsche Panamera GTS - Epic Nadirlik', '/cars/panamera/panamera-gts.jpg', 493, 150, 150, 49300, 1.81, 2.70, 99, 247),
('Porsche Panamera Turbo E-Hybrid', 'Legendary', 'Porsche Panamera Turbo E-Hybrid - Legendary Nadirlik', '/cars/panamera/panamera-turbo-e-hybrid.jpg', 670, 200, 200, 67000, 1.17, 1.75, 134, 335),
('Porsche Panamera Turbo S E-Hybrid', 'Legendary', 'Porsche Panamera Turbo S E-Hybrid - Legendary Nadirlik', '/cars/panamera/panamera-turbo-s-e-hybrid.jpg', 771, 200, 200, 77100, 1.17, 1.75, 154, 386),
-- Macan Serisi
('Porsche Macan Electric', 'Common', 'Porsche Macan Electric - Common Nadirlik', '/cars/macan/macan-electric.jpg', 355, 100, 100, 35500, 0.50, 0.75, 71, 178),
('Porsche Macan 4 Electric', 'Rare', 'Porsche Macan 4 Electric - Rare Nadirlik', '/cars/macan/macan-4-electric.jpg', 402, 120, 120, 40200, 0.67, 1.00, 80, 201),
('Porsche Macan 4S Electric', 'Epic', 'Porsche Macan 4S Electric - Epic Nadirlik', '/cars/macan/macan-4s-electric.jpg', 509, 150, 150, 50900, 1.81, 2.70, 102, 255),
('Porsche Macan Turbo Electric', 'Legendary', 'Porsche Macan Turbo Electric - Legendary Nadirlik', '/cars/macan/macan-turbo-electric.jpg', 630, 200, 200, 63000, 1.17, 1.75, 126, 315),
('Porsche Macan', 'Common', 'Porsche Macan - Common Nadirlik', '/cars/macan/macan.jpg', 261, 100, 100, 26100, 0.50, 0.75, 52, 131),
('Porsche Macan T', 'Common', 'Porsche Macan T - Common Nadirlik', '/cars/macan/macan-t.jpg', 261, 100, 100, 26100, 0.50, 0.75, 52, 131),
('Porsche Macan S', 'Rare', 'Porsche Macan S - Rare Nadirlik', '/cars/macan/macan-s.jpg', 375, 120, 120, 37500, 0.67, 1.00, 75, 188),
('Porsche Macan GTS', 'Epic', 'Porsche Macan GTS - Epic Nadirlik', '/cars/macan/macan-gts.jpg', 434, 150, 150, 43400, 1.81, 2.70, 87, 217);

DO $$ BEGIN
  RAISE NOTICE 'Araç modelleri başarıyla eklendi.';
END $$;

-- =====================================================================
-- GARAJ ŞABLONLARI (garages, user_id IS NULL)
-- =====================================================================
INSERT INTO public.garages (template_id, name, description, image_url, capacity, daily_bonus, value, purchase_type, user_id, level, location, created_at) VALUES
-- NMFP Garages
('nmfp-1', 'Başlangıç Garajı', '1 araç kapasiteli temel garaj', '/garage-sale/garage-1-car.png', 1, 100, 5000, 'NMFP', NULL, 1, 'default', get_utc_now()),
('nmfp-3', 'Standart Garaj', '3 araç kapasiteli standart garaj', '/garage-sale/garage-3-car.png', 3, 300, 15000, 'NMFP', NULL, 1, 'default', get_utc_now()),
('nmfp-5', 'Gelişmiş Garaj', '5 araç kapasiteli geniş garaj', '/garage-sale/garage-5-car.png', 5, 600, 30000, 'NMFP', NULL, 1, 'default', get_utc_now()),
('nmfp-10', 'Premium Garaj', '10 araç kapasiteli lüks garaj', '/garage-sale/garage-10-car.png', 10, 1500, 75000, 'NMFP', NULL, 1, 'default', get_utc_now()),
-- TON Pre-Garages
('ton-1', 'Diamond Pre-Garaj #1', '50 araç kapasiteli özel koleksiyon garajı', '/garage-sale/garage-pre-1.png', 50, 10000, 0.5, 'TON', NULL, 1, 'premium', get_utc_now()),
('ton-2', 'Diamond Pre-Garaj #2', '50 araç kapasiteli özel koleksiyon garajı', '/garage-sale/garage-pre-2.png', 50, 10000, 0.5, 'TON', NULL, 1, 'premium', get_utc_now()),
('ton-3', 'Diamond Pre-Garaj #3', '50 araç kapasiteli özel koleksiyon garajı', '/garage-sale/garage-pre-3.png', 50, 10000, 0.5, 'TON', NULL, 1, 'premium', get_utc_now())
ON CONFLICT (template_id) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE 'Garaj şablonları başarıyla eklendi.';
END $$;

-- =====================================================================
-- GÖREVLER (tasks)
-- =====================================================================
-- *** DÜZELTİLMİŞ INSERT KOMUTU (type ve frequency sütunları olmadan) ***
INSERT INTO public.tasks (title, description, total, reward, is_active) VALUES
('İlk Mining Turu', 'İlk mining seansını başarıyla tamamla.', 1, 500, TRUE),
('5 Mining Turu', 'Toplam 5 mining seansını başarıyla tamamla.', 5, 2000, TRUE),
('10 Mining Turu', 'Toplam 10 mining seansını başarıyla tamamla.', 10, 5000, TRUE),
('İlk Araç Tamiri', 'Herhangi bir aracını ilk kez tamir et.', 1, 300, TRUE),
('İlk Yakıt Dolumu', 'Herhangi bir aracının yakıtını ilk kez doldur.', 1, 200, TRUE),
('Garaj Bonusu Topla', 'Günlük garaj bonusunu topla.', 1, 150, TRUE),
('Yeni Araç Satın Al (NMFP)', 'Marketten NMFP ile yeni bir araç satın al.', 1, 1000, TRUE),
('Yeni Araç Satın Al (TON)', 'Marketten TON ile yeni bir araç satın al.', 1, 1500, TRUE),
('Yeni Araç Mintle (NFT)', 'Marketten bir aracı NFT olarak mintle.', 1, 2000, TRUE),
('Arkadaşını Davet Et', 'Bir arkadaşını oyuna davet et ve oynamaya başlasın.', 1, 2500, TRUE)
ON CONFLICT (title) DO UPDATE SET -- Eğer görev başlığı varsa güncelle
  description = EXCLUDED.description,
  -- type = EXCLUDED.type, -- Bu satır kaldırıldı
  total = EXCLUDED.total,
  reward = EXCLUDED.reward,
  is_active = EXCLUDED.is_active;
  -- frequency = EXCLUDED.frequency; -- Bu satır kaldırıldı

DO $$ BEGIN
  RAISE NOTICE 'Görevler başarıyla eklendi/güncellendi.';
END $$;

DO $$ BEGIN
  RAISE NOTICE '====== VERİ EKLEME TAMAMLANDI ======';
END $$;