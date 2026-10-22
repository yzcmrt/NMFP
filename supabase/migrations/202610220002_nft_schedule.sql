BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- The bearer is provisioned separately in Vault; never put it in cron.job.command.
CREATE OR REPLACE FUNCTION public.nmfp_nft_tick() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE bearer text; request_id bigint;
BEGIN
 SELECT decrypted_secret INTO bearer FROM vault.decrypted_secrets WHERE name='nmfp_nft_worker_secret';
 IF bearer IS NULL OR length(bearer)<32 THEN RETURN NULL; END IF;
 SELECT net.http_post(url:='https://nmfp.vercel.app/api/nft/worker',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||bearer),
   body:='{}'::jsonb,timeout_milliseconds:=60000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.nmfp_nft_tick() FROM PUBLIC,anon,authenticated;
-- Activation follows signer funding + on-chain setup + successful preflight.
SELECT cron.schedule('nmfp-nft-worker','* * * * *','SELECT public.nmfp_nft_tick();');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='nmfp-nft-worker'),active:=false);
COMMIT;
