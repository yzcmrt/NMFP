-- Premium mining sisteminin geri alınması

-- Cron işlerini kaldır
SELECT cron.unschedule('auto-renew-premium-mining');
SELECT cron.unschedule('check-premium-expiry');

-- Trigger'ı kaldır
DROP TRIGGER IF EXISTS after_premium_mining_completion ON mining_sessions;

-- Fonksiyonları kaldır
DROP FUNCTION IF EXISTS process_completed_premium_mining();
DROP FUNCTION IF EXISTS premium_expiry_check();
DROP FUNCTION IF EXISTS auto_renew_premium_mining();
DROP FUNCTION IF EXISTS start_auto_mining_for_user(UUID); 