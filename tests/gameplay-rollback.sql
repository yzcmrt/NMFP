-- Run inside a transaction together with the migration, then ROLLBACK.
DO $$
DECLARE u uuid; r jsonb; c integer; s integer; bal bigint; cost bigint; reward bigint; task_id integer; snapshot jsonb; stats jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM users WHERE telegram_id='990000000000022') THEN RAISE EXCEPTION 'TEST fixture already exists'; END IF;
 r:=get_or_create_user('990000000000022','gameplay_rollback_test',false,false); u:=(r->>'user_id')::uuid;
 SELECT id INTO c FROM user_cars WHERE user_id=u ORDER BY id LIMIT 1;
 s:=(nmfp_game_action(u,'start_mining',jsonb_build_object('p_car_id',c)))::integer;
 BEGIN
  PERFORM nmfp_game_action(u,'start_mining',jsonb_build_object('p_car_id',c));
  RAISE EXCEPTION 'TEST duplicate mining accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM nmfp_game_action(u,'repair_car_uuid',jsonb_build_object('p_car_id',c));
  RAISE EXCEPTION 'TEST repair during mining accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST%' THEN RAISE; END IF; END;
 UPDATE mining_sessions SET start_time=now()-interval '9 hours',end_time=now()-interval '1 hour' WHERE id=s;
 SELECT balance INTO bal FROM users WHERE id=u;
 SELECT expected_reward INTO reward FROM mining_sessions WHERE id=s;
 PERFORM nmfp_game_action(u,'complete_mining',jsonb_build_object('p_mining_session_id',s));
 IF (SELECT balance FROM users WHERE id=u)<>bal+reward+(SELECT t.reward FROM tasks t WHERE t.title='İlk Mining Turu') THEN RAISE EXCEPTION 'TEST mining + first task accounting mismatch'; END IF;
 stats:=nmfp_game_stats(u,7);
 IF (stats->>'totalReward')::bigint<>reward OR (stats->>'tours')::integer<>1 OR jsonb_array_length(stats->'daily')<>7 THEN RAISE EXCEPTION 'TEST settled statistics mismatch'; END IF;
 snapshot:=nmfp_game_snapshot(u);
 IF jsonb_array_length(snapshot->'sessions')<>0 THEN RAISE EXCEPTION 'TEST paid session leaked into active snapshot'; END IF;
 IF snapshot->'user'->>'id'<>u::text THEN RAISE EXCEPTION 'TEST snapshot ownership'; END IF;
 SELECT ceil(m.repair_cost*0.1) INTO cost FROM user_cars c JOIN car_models m ON m.id=c.car_model_id WHERE c.user_id=u;
 PERFORM nmfp_game_action(u,'repair_car_uuid',jsonb_build_object('p_car_id',c));
 IF (SELECT condition FROM user_cars WHERE id=c)<>100 OR NOT EXISTS(SELECT 1 FROM transactions WHERE user_id=u AND item='Araç Tamiri' AND amount=cost) THEN RAISE EXCEPTION 'TEST repair price/state mismatch'; END IF;
 SELECT id INTO task_id FROM tasks WHERE verification_type='car_repair' AND is_active LIMIT 1;
 r:=nmfp_verify_task(u,task_id,false);
 IF r->>'completed'<>'true' OR (r->>'reward')::integer<>0 THEN RAISE EXCEPTION 'TEST repair task not automatically credited exactly once'; END IF;
 PERFORM nmfp_game_action(u,'refill_car_uuid',jsonb_build_object('p_car_id',c));
 IF (SELECT fuel FROM user_cars WHERE id=c)<>100 THEN RAISE EXCEPTION 'TEST refill failed'; END IF;
 SELECT balance INTO bal FROM users WHERE id=u;
 PERFORM nmfp_game_action(u,'collect_garage_bonuses','{}');
 IF (SELECT balance FROM users WHERE id=u)<=bal THEN RAISE EXCEPTION 'TEST bonus missing'; END IF;
 SELECT balance INTO bal FROM users WHERE id=u;
 BEGIN
  PERFORM nmfp_game_action(u,'collect_garage_bonuses','{}');
  RAISE EXCEPTION 'TEST duplicate bonus accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'NMFP:Günlük bonus zaten%' THEN RAISE; END IF; END;
 IF (SELECT balance FROM users WHERE id=u)<>bal THEN RAISE EXCEPTION 'TEST duplicate bonus changed balance'; END IF;
 UPDATE users SET last_bonus_collected_at=now()-interval '24 hours' WHERE id=u;
 PERFORM nmfp_game_action(u,'collect_garage_bonuses','{}');
 SELECT id INTO task_id FROM tasks WHERE verification_type='link_click' AND is_active ORDER BY id LIMIT 1;
 r:=nmfp_verify_task(u,task_id,false);
 IF r->>'completed'<>'false' THEN RAISE EXCEPTION 'TEST unvisited link rewarded'; END IF;
 PERFORM nmfp_record_task_visit(u,task_id);
 r:=nmfp_verify_task(u,task_id,false);
 IF r->>'completed'<>'true' THEN RAISE EXCEPTION 'TEST visited link not rewarded'; END IF;
 SELECT balance INTO bal FROM users WHERE id=u;
 r:=nmfp_verify_task(u,task_id,false);
 IF (r->>'reward')::integer<>0 OR (SELECT balance FROM users WHERE id=u)<>bal THEN RAISE EXCEPTION 'TEST task double credit'; END IF;
 BEGIN
  PERFORM nmfp_set_auto_mining(u,true);
  RAISE EXCEPTION 'TEST unpaid auto mining enabled';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'NMFP:Otomatik mining%' THEN RAISE; END IF; END;
 UPDATE users SET premium_active=true,premium_until=now()+interval '1 day' WHERE id=u;
 PERFORM nmfp_set_auto_mining(u,true);PERFORM nmfp_set_auto_mining(u,false);
 IF (SELECT auto_mining FROM users WHERE id=u) THEN RAISE EXCEPTION 'TEST auto mining pause failed'; END IF;
 s:=(nmfp_game_action(u,'start_mining',jsonb_build_object('p_car_id',c)))::integer;
 IF jsonb_array_length(nmfp_game_snapshot(u)->'sessions')<>1 THEN RAISE EXCEPTION 'TEST restart after paid history failed'; END IF;
 IF has_function_privilege('anon','public.nmfp_game_snapshot(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.nmfp_verify_task(uuid,integer,boolean)','EXECUTE') THEN RAISE EXCEPTION 'TEST public game function access'; END IF;
END $$;
SELECT 'PASS: gameplay, snapshot, restart, maintenance, bonus cooldown, tasks, auto mining and access boundaries' result;
