BEGIN;
CREATE OR REPLACE FUNCTION public.get_activity_distribution(p_user_id uuid)
RETURNS TABLE(activity_type text,percentage numeric)
LANGUAGE sql SET search_path=public,pg_temp AS $$
 WITH activities AS (
  SELECT 'Mining'::text AS category FROM mining_sessions WHERE user_id=p_user_id AND status='completed'
  UNION ALL SELECT 'Görev' FROM user_tasks WHERE user_id=p_user_id AND is_completed
  UNION ALL SELECT 'Market' FROM transactions WHERE user_id=p_user_id AND type='purchase'
 ), counts AS (SELECT category,count(*) AS n FROM activities GROUP BY category)
 SELECT category,round(100*n/sum(n) OVER(),1) FROM counts ORDER BY n DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_activity_distribution(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_distribution(uuid) TO service_role;
COMMIT;
