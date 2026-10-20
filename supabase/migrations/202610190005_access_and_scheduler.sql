BEGIN;
-- Browsers now use the authenticated application API. The existing server role retains its access.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Replace competing reward/auto-mining/expiry jobs, keeping their definitions recoverable.
SELECT cron.alter_job(jobid,active:=false) FROM cron.job
WHERE jobname IN ('process-completed-mining-sessions','check-mining-completion','auto-renew-premium-mining','check-premium-expiry')
 OR command='SELECT check_premium_expiry()';
SELECT cron.schedule('nmfp-mining-v2','* * * * *','SELECT public.nmfp_process_mining();');
NOTIFY pgrst,'reload schema';
COMMIT;
