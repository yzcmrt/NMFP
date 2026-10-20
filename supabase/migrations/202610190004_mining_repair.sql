BEGIN;
-- These legacy triggers double-charge maintenance, double-credit rewards, or reference removed columns.
-- Keep the definitions for rollback, but let one completion function own the state transition.
ALTER TABLE public.mining_sessions DISABLE TRIGGER trigger_auto_renew_mining;
ALTER TABLE public.mining_sessions DISABLE TRIGGER trigger_update_car_condition;
ALTER TABLE public.mining_sessions DISABLE TRIGGER trigger_update_car_on_mining_completion;
ALTER TABLE public.mining_sessions DISABLE TRIGGER apply_premium_bonus;
ALTER TABLE public.mining_sessions DISABLE TRIGGER after_premium_mining_completion;
CREATE OR REPLACE FUNCTION public.complete_mining(p_mining_session_id integer)
RETURNS bigint LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s mining_sessions%rowtype; reward bigint;
BEGIN
 SELECT * INTO s FROM mining_sessions WHERE id=p_mining_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Mining session not found.'; END IF;
 IF s.status='completed' THEN RETURN 0; END IF;
 IF s.status<>'active' OR s.end_time>now() THEN RAISE EXCEPTION 'NMFP:Mining is still in progress.'; END IF;
 reward:=s.expected_reward;
 UPDATE users SET balance=balance+reward,xp=xp+greatest(1,reward/10) WHERE id=s.user_id;
 UPDATE user_cars SET fuel=greatest(0,fuel-25),condition=greatest(0,condition-10),status='active',mining_tour_count=mining_tour_count+1,updated_at=now() WHERE id=s.car_id;
 UPDATE mining_sessions SET status='completed',actual_reward=reward,completed_at=now() WHERE id=s.id;
 INSERT INTO transactions(user_id,type,amount,currency,status,source,item,date) VALUES(s.user_id,'mining_reward',reward,'NMFP','confirmed','Mining Completion','Mining #'||s.id,now());
 RETURN reward;
END;
$$;
CREATE OR REPLACE FUNCTION public.prepare_and_start_eligible_cars(p_user_id uuid,p_auto_pay_maintenance boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE c record; started integer:=0; capacity integer; used integer; cost bigint:=0; before_balance bigint; warnings text[]:='{}';
BEGIN
 SELECT balance INTO before_balance FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Account not found.'; END IF;
 SELECT coalesce(sum(g.capacity),0) INTO capacity FROM garages g WHERE user_id=p_user_id;
 SELECT count(*) INTO used FROM mining_sessions WHERE user_id=p_user_id AND status='active';
 FOR c IN SELECT uc.* FROM user_cars uc JOIN car_models cm ON cm.id=uc.car_model_id WHERE uc.user_id=p_user_id AND uc.status='active' ORDER BY cm.mining_power*uc.mining_multiplier DESC LIMIT greatest(0,capacity-used)
 LOOP
  BEGIN
   IF p_auto_pay_maintenance THEN
    IF c.condition<100 THEN PERFORM repair_car_uuid(p_user_id,c.id); END IF;
    IF c.fuel<100 THEN PERFORM refill_car_uuid(p_user_id,c.id); END IF;
   END IF;
   PERFORM start_mining(p_user_id,c.id,c.garage_id);
   started:=started+1;
  EXCEPTION WHEN OTHERS THEN warnings:=array_append(warnings,'Car #'||c.id||': '||SQLERRM);
  END;
 END LOOP;
 SELECT before_balance-balance INTO cost FROM users WHERE id=p_user_id;
 RETURN jsonb_build_object('started_cars',started,'available_slots',greatest(0,capacity-used-started),'total_capacity',capacity,'used_slots',used+started,'total_cost',cost,'warnings',warnings);
END;
$$;
CREATE OR REPLACE FUNCTION public.nmfp_process_mining()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u record; s record; completed integer:=0;
BEGIN
 FOR u IN SELECT * FROM users WHERE premium_active OR EXISTS(SELECT 1 FROM mining_sessions ms WHERE ms.user_id=users.id AND ms.status='active' AND ms.end_time<=now()) FOR UPDATE SKIP LOCKED
 LOOP
  BEGIN
   FOR s IN SELECT id FROM mining_sessions WHERE user_id=u.id AND status='active' AND end_time<=now() ORDER BY id LOOP
    PERFORM complete_mining(s.id); completed:=completed+1;
   END LOOP;
   IF u.premium_active AND u.premium_until>now() AND u.auto_mining THEN
    PERFORM prepare_and_start_eligible_cars(u.id,true);
   ELSIF u.premium_active AND (u.premium_until IS NULL OR u.premium_until<=now()) THEN
    UPDATE users SET premium_active=false,auto_mining=false WHERE id=u.id;
   END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'NMFP mining processing failed for account: %',SQLERRM;
  END;
 END LOOP;
 RETURN completed;
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_process_mining() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_process_mining() TO service_role;
COMMIT;
