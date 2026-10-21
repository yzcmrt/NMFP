BEGIN;
CREATE OR REPLACE FUNCTION public.nmfp_game_stats(p_user_id uuid,p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 WITH period AS (SELECT (now() AT TIME ZONE 'UTC')::date-greatest(0,least(89,p_days-1)) first_day),
 settled AS (SELECT * FROM mining_sessions WHERE user_id=p_user_id AND status='completed' AND (coalesce(completed_at,end_time) AT TIME ZONE 'UTC')::date>=(SELECT first_day FROM period)),
 daily AS (SELECT d::date AS day,coalesce(sum(s.actual_reward),0) reward,count(s.id) tours FROM generate_series((SELECT first_day FROM period),(now() AT TIME ZONE 'UTC')::date,interval '1 day')d LEFT JOIN settled s ON (coalesce(s.completed_at,s.end_time) AT TIME ZONE 'UTC')::date=d::date GROUP BY d),
 cars AS (SELECT c.name,coalesce(sum(s.actual_reward),0) reward,count(*) tours FROM settled s JOIN user_cars c ON c.id=s.car_id GROUP BY c.id,c.name ORDER BY reward DESC LIMIT 10)
 SELECT jsonb_build_object('daily',coalesce((SELECT jsonb_agg(daily ORDER BY day) FROM daily),'[]'::jsonb),'cars',coalesce((SELECT jsonb_agg(cars ORDER BY reward DESC) FROM cars),'[]'::jsonb),'totalReward',(SELECT coalesce(sum(actual_reward),0) FROM settled),'tours',(SELECT count(*) FROM settled),'unknownRewards',(SELECT count(*) FROM settled WHERE actual_reward IS NULL),'days',greatest(1,least(90,p_days)));
$$;
REVOKE ALL ON FUNCTION public.nmfp_game_stats(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_game_stats(uuid,integer) TO service_role;
COMMIT;
