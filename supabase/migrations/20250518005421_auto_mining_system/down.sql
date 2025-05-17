-- Otomatik mining sisteminin geri alınması

-- Cron işlerini kaldır
SELECT cron.unschedule('auto-complete-mining');
SELECT cron.unschedule('auto-renew-premium-mining');

-- Fonksiyonları kaldır
DROP FUNCTION IF EXISTS cron_auto_complete_mining();
DROP FUNCTION IF EXISTS auto_renew_premium_mining();

-- Trigger'ı kaldır
DROP TRIGGER IF EXISTS after_mining_completion ON mining_sessions;
DROP FUNCTION IF EXISTS update_car_stats_after_mining(); 