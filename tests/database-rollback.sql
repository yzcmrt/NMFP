-- Appended to the recovery migrations inside a transaction, always rolled back.
DO $$
DECLARE u uuid; result jsonb; car integer; session_id integer; reward bigint; bal bigint; ord uuid; model uuid; n integer;
BEGIN
 IF EXISTS(SELECT 1 FROM users WHERE telegram_id='990000000000001') THEN RAISE EXCEPTION 'TEST fixture already exists'; END IF;
 result:=get_or_create_user('990000000000001','recovery_rollback_test',false,false);
 u:=(result->>'user_id')::uuid;
 IF u IS NULL THEN RAISE EXCEPTION 'TEST signup failed: %',result; END IF;
 IF (SELECT count(*) FROM user_cars WHERE user_id=u)=0 THEN RAISE EXCEPTION 'TEST missing starter car'; END IF;
 IF (SELECT count(*) FROM garages WHERE user_id=u)=0 THEN RAISE EXCEPTION 'TEST missing starter garage'; END IF;
 IF (SELECT balance FROM users WHERE id=u)<50000 THEN RAISE EXCEPTION 'TEST missing starter balance'; END IF;
 SELECT id INTO car FROM user_cars WHERE user_id=u LIMIT 1;
 PERFORM nmfp_game_action(u,'start_mining',jsonb_build_object('p_car_id',car));
 SELECT id,expected_reward INTO session_id,reward FROM mining_sessions WHERE user_id=u AND status='active' LIMIT 1;
 IF session_id IS NULL THEN RAISE EXCEPTION 'TEST mining did not start'; END IF;
 BEGIN
  PERFORM nmfp_game_action(u,'complete_mining',jsonb_build_object('p_mining_session_id',session_id));
  RAISE EXCEPTION 'TEST early completion allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'NMFP:Mining is still%' THEN RAISE; END IF; END;
 UPDATE mining_sessions SET start_time=now()-interval '9 hours',end_time=now()-interval '1 hour' WHERE id=session_id;
 SELECT balance INTO bal FROM users WHERE id=u;
 PERFORM nmfp_game_action(u,'complete_mining',jsonb_build_object('p_mining_session_id',session_id));
 IF (SELECT fuel<>75 OR condition<>90 FROM user_cars WHERE id=car) THEN RAISE EXCEPTION 'TEST maintenance charged incorrectly'; END IF;
 IF (SELECT balance FROM users WHERE id=u)<bal+reward THEN RAISE EXCEPTION 'TEST reward missing'; END IF;
 SELECT balance INTO bal FROM users WHERE id=u;
 result:=nmfp_game_action(u,'complete_mining',jsonb_build_object('p_mining_session_id',session_id));
 IF result<>'0'::jsonb OR (SELECT balance FROM users WHERE id=u)<>bal THEN RAISE EXCEPTION 'TEST duplicate completion credited'; END IF;
 SELECT id INTO model FROM car_models WHERE id NOT IN (SELECT car_model_id FROM user_cars WHERE user_id=u) LIMIT 1;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title) VALUES(u,'car',model::text,50,'Rollback test') RETURNING id INTO ord;
 BEGIN
  PERFORM nmfp_fulfill_star_order(ord,'990000000000002','rollback-charge',50);
  RAISE EXCEPTION 'TEST owner mismatch accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Order owner mismatch' THEN RAISE; END IF; END;
 BEGIN
  PERFORM nmfp_fulfill_star_order(ord,'990000000000001','rollback-charge',1);
  RAISE EXCEPTION 'TEST wrong amount accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Payment mismatch' THEN RAISE; END IF; END;
 PERFORM nmfp_fulfill_star_order(ord,'990000000000001','rollback-charge',50);
 PERFORM nmfp_fulfill_star_order(ord,'990000000000001','rollback-charge',50);
 SELECT count(*) INTO n FROM user_cars WHERE user_id=u AND car_model_id=model;
 IF n<>1 OR (SELECT status FROM star_orders WHERE id=ord)<>'paid' THEN RAISE EXCEPTION 'TEST Stars delivery/idempotency failed'; END IF;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title) VALUES(u,'car',model::text,50,'Duplicate item test') RETURNING id INTO ord;
 result:=nmfp_fulfill_star_order(ord,'990000000000001','rollback-duplicate-charge',50);
 IF result->>'refund_required'<>'true' OR (SELECT status FROM star_orders WHERE id=ord)<>'refund_pending' THEN RAISE EXCEPTION 'TEST duplicate purchase not queued for refund'; END IF;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title) VALUES(u,'garage','ton-5',99,'Garage test') RETURNING id INTO ord;
 -- Use a real catalog ID rather than assuming the naming scheme.
 UPDATE star_orders SET product_id=(SELECT id FROM garage_templates WHERE id NOT IN(SELECT template_id FROM garages WHERE user_id=u) ORDER BY capacity LIMIT 1) WHERE id=ord;
 PERFORM nmfp_fulfill_star_order(ord,'990000000000001','rollback-garage-charge',99);
 INSERT INTO star_orders(user_id,kind,product_id,amount,title) VALUES(u,'premium','annual',199,'Rollback premium') RETURNING id INTO ord;
 PERFORM nmfp_fulfill_star_order(ord,'990000000000001','rollback-premium-charge',199);
 IF NOT (SELECT premium_active AND auto_mining AND premium_until>now()+interval '364 days' FROM users WHERE id=u) THEN RAISE EXCEPTION 'TEST premium delivery failed'; END IF;
 RAISE NOTICE 'NMFP rollback tests PASS: signup, assets, mining, early claim rejection, single maintenance, idempotency, Stars owner/amount/delivery, premium';
END;
$$;
SELECT 'PASS: all database checks; transaction rolled back' AS result;
