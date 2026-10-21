BEGIN;
-- Keep historical balances and sessions intact; only repair the active game contract.
CREATE UNIQUE INDEX IF NOT EXISTS nmfp_one_active_session_per_car ON public.mining_sessions(car_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS nmfp_sessions_user_status ON public.mining_sessions(user_id,status);

CREATE OR REPLACE FUNCTION public.nmfp_game_snapshot(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
  'user',(SELECT to_jsonb(u) FROM users u WHERE id=p_user_id),
  'cars',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('car_model',to_jsonb(m)) ORDER BY c.id) FROM user_cars c JOIN car_models m ON m.id=c.car_model_id WHERE c.user_id=p_user_id AND c.status<>'sold'),'[]'::jsonb),
  'garages',coalesce((SELECT jsonb_agg(g ORDER BY g.id) FROM garages g WHERE user_id=p_user_id),'[]'::jsonb),
  'sessions',coalesce((SELECT jsonb_agg(s ORDER BY s.id DESC) FROM mining_sessions s WHERE user_id=p_user_id AND status='active'),'[]'::jsonb),
  'transactions',coalesce((SELECT jsonb_agg(t ORDER BY t.date DESC,t.id DESC) FROM (SELECT * FROM transactions WHERE user_id=p_user_id ORDER BY date DESC,id DESC LIMIT 50)t),'[]'::jsonb),
  'tasks',coalesce((SELECT jsonb_agg(t ORDER BY t.id) FROM tasks t WHERE is_active),'[]'::jsonb),
  'userTasks',coalesce((SELECT jsonb_agg(t ORDER BY t.id) FROM user_tasks t WHERE user_id=p_user_id),'[]'::jsonb),
  'models',coalesce((SELECT jsonb_agg(m ORDER BY m.nmfp_price,m.id) FROM car_models m),'[]'::jsonb),
  'templates',coalesce((SELECT jsonb_agg(g ORDER BY g.capacity,g.id) FROM garage_templates g),'[]'::jsonb),
  'orders',coalesce((SELECT jsonb_agg(o ORDER BY o.created_at DESC) FROM (SELECT id,title,amount,CASE WHEN status='pending' AND expires_at<now() THEN 'expired' ELSE status END status,created_at FROM star_orders WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 30)o),'[]'::jsonb),
  'serverTime',now()
 );
$$;
REVOKE ALL ON FUNCTION public.nmfp_game_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_game_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.collect_garage_bonuses(p_user_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE last_collected timestamptz; bonus bigint;
BEGIN
 SELECT last_bonus_collected_at INTO last_collected FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Hesap bulunamadı.'; END IF;
 IF last_collected IS NOT NULL AND last_collected+interval '24 hours'>now() THEN RAISE EXCEPTION 'NMFP:Günlük bonus zaten toplandı. 24 saat dolunca tekrar deneyin.'; END IF;
 SELECT coalesce(sum(daily_bonus),0) INTO bonus FROM garages WHERE user_id=p_user_id;
 IF bonus<=0 THEN RAISE EXCEPTION 'NMFP:Toplanabilecek garaj bonusu yok.'; END IF;
 UPDATE users SET balance=balance+bonus,last_bonus_collected_at=now() WHERE id=p_user_id;
 INSERT INTO transactions(user_id,type,amount,currency,status,source,date) VALUES(p_user_id,'reward',bonus,'NMFP','confirmed','Garaj Günlük Bonus',now());
 RETURN bonus;
END;
$$;

CREATE OR REPLACE FUNCTION public.nmfp_maintain_car(p_user_id uuid,p_car_id integer,p_kind text)
RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE c user_cars%rowtype; m car_models%rowtype; bal bigint; cost bigint;
BEGIN
 SELECT balance INTO bal FROM users WHERE id=p_user_id FOR UPDATE;
 SELECT * INTO c FROM user_cars WHERE id=p_car_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Araç bulunamadı.'; END IF;
 IF c.status<>'active' OR EXISTS(SELECT 1 FROM mining_sessions WHERE car_id=c.id AND status='active') THEN RAISE EXCEPTION 'NMFP:Bakım ve yakıt için mining turunun bitmesini bekleyin.'; END IF;
 SELECT * INTO STRICT m FROM car_models WHERE id=c.car_model_id;
 IF p_kind='repair' THEN
  IF c.condition>=100 THEN RAISE EXCEPTION 'NMFP:Aracın kondisyonu zaten tam.'; END IF;
  cost:=ceil((100-c.condition)::numeric*m.repair_cost/100);
 ELSIF p_kind='refill' THEN
  IF c.fuel>=100 THEN RAISE EXCEPTION 'NMFP:Yakıt deposu zaten dolu.'; END IF;
  cost:=ceil((100-c.fuel)::numeric*m.refill_cost/100);
 ELSE RAISE EXCEPTION 'NMFP:Geçersiz bakım işlemi.'; END IF;
 IF cost<0 OR cost IS NULL THEN RAISE EXCEPTION 'NMFP:Bakım fiyatı kullanılamıyor.'; END IF;
 IF bal<cost THEN RAISE EXCEPTION 'NMFP:Yeterli NMFP bakiyesi yok.'; END IF;
 UPDATE users SET balance=balance-cost WHERE id=p_user_id;
 IF p_kind='repair' THEN
  UPDATE user_cars SET condition=100,updated_at=now() WHERE id=c.id;
  PERFORM update_task_progress(p_user_id,'İlk Araç Tamiri',1);
 ELSE UPDATE user_cars SET fuel=100,updated_at=now() WHERE id=c.id; END IF;
 INSERT INTO transactions(user_id,type,amount,currency,status,item,source,date) VALUES(p_user_id,'expense',cost,'NMFP','confirmed',CASE WHEN p_kind='repair' THEN 'Araç Tamiri' ELSE 'Yakıt Dolumu' END,'Car #'||c.id,now());
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_maintain_car(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_maintain_car(uuid,integer,text) TO service_role;
CREATE OR REPLACE FUNCTION public.repair_car_uuid(p_user_id uuid,p_car_id integer) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT nmfp_maintain_car(p_user_id,p_car_id,'repair');$$;
CREATE OR REPLACE FUNCTION public.refill_car_uuid(p_user_id uuid,p_car_id integer) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT nmfp_maintain_car(p_user_id,p_car_id,'refill');$$;

CREATE OR REPLACE FUNCTION public.nmfp_set_auto_mining(p_user_id uuid,p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE u users%rowtype;
BEGIN
 SELECT * INTO u FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Hesap bulunamadı.'; END IF;
 IF p_enabled AND (NOT coalesce(u.premium_active,false) OR coalesce(u.premium_until,now())<=now()) THEN RAISE EXCEPTION 'NMFP:Otomatik mining için aktif paket gerekiyor.'; END IF;
 UPDATE users SET auto_mining=p_enabled WHERE id=p_user_id;
 RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_set_auto_mining(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_set_auto_mining(uuid,boolean) TO service_role;

-- Retire test / unsupported offers without deleting task history or changing rewards already paid.
UPDATE tasks SET is_active=false WHERE title ILIKE 'Test:%' OR verification_type IS NULL OR verification_type IN ('manual','bot_command','car_mint_nft');
-- Telegram currently returns 'member list is inaccessible' for this channel.
-- Re-enable after the bot has administrator access and membership verification succeeds.
UPDATE tasks SET is_active=false WHERE verification_type='channel_join' AND verification_data->>'channel_username'='needmoneyforporschewtf';
UPDATE tasks SET title='Yeni Araç Satın Al (Stars)',description='Marketten Telegram Stars ile yeni bir araç satın al.',verification_type='car_purchase_stars' WHERE verification_type='car_purchase_ton';
CREATE OR REPLACE FUNCTION public.trigger_purchase_tasks() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.purchase_type='NMFP' THEN PERFORM update_task_progress(NEW.user_id,'Yeni Araç Satın Al (NMFP)',1);
 ELSIF NEW.purchase_type='STARS' THEN PERFORM update_task_progress(NEW.user_id,'Yeni Araç Satın Al (Stars)',1);
 END IF; RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nmfp_verify_task(p_user_id uuid,p_task_id integer,p_external_verified boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE t tasks%rowtype; ut user_tasks%rowtype; progress_count integer:=0;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Hesap bulunamadı.'; END IF;
 SELECT * INTO t FROM tasks WHERE id=p_task_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Görev bulunamadı.'; END IF;
 SELECT * INTO ut FROM user_tasks WHERE user_id=p_user_id AND task_id=t.id FOR UPDATE;
 IF ut.is_completed THEN RETURN jsonb_build_object('success',true,'completed',true,'reward',0,'message','Bu görevin ödülü zaten işlendi.'); END IF;
 CASE t.verification_type
 WHEN 'mining_complete' THEN SELECT count(*) INTO progress_count FROM mining_sessions WHERE user_id=p_user_id AND status='completed';
 WHEN 'car_repair' THEN SELECT count(*) INTO progress_count FROM transactions WHERE user_id=p_user_id AND (type IN ('repair','repair_car') OR (type='expense' AND item LIKE 'Araç Tamiri%'));
 WHEN 'car_refill' THEN SELECT count(*) INTO progress_count FROM transactions WHERE user_id=p_user_id AND (type IN ('refill','refill_car') OR (type='expense' AND item LIKE 'Yakıt Dolumu%'));
 WHEN 'car_purchase_nmfp' THEN SELECT count(*) INTO progress_count FROM user_cars WHERE user_id=p_user_id AND purchase_type='NMFP';
 WHEN 'car_purchase_stars' THEN SELECT count(*) INTO progress_count FROM user_cars WHERE user_id=p_user_id AND purchase_type IN ('STARS','TON');
 WHEN 'collect_bonus' THEN SELECT count(*) INTO progress_count FROM transactions WHERE user_id=p_user_id AND source='Garaj Günlük Bonus';
 WHEN 'channel_join' THEN IF NOT p_external_verified THEN RAISE EXCEPTION 'NMFP:Önce kanala katılın.'; END IF; progress_count:=t.total;
 WHEN 'link_click' THEN progress_count:=coalesce(ut.progress,0);
 ELSE RAISE EXCEPTION 'NMFP:Bu görev şu anda kullanılamıyor.';
 END CASE;
 progress_count:=least(t.total,greatest(progress_count,coalesce(ut.progress,0)));
 IF ut.id IS NULL THEN INSERT INTO user_tasks(user_id,task_id,progress,is_completed) VALUES(p_user_id,t.id,progress_count,false) RETURNING * INTO ut;
 ELSE UPDATE user_tasks SET progress=progress_count WHERE id=ut.id; END IF;
 IF progress_count<t.total THEN RETURN jsonb_build_object('success',true,'completed',false,'reward',0,'progress',progress_count,'message',format('İlerleme: %s/%s',progress_count,t.total)); END IF;
 UPDATE user_tasks SET progress=t.total,is_completed=true,completed_at=now() WHERE id=ut.id;
 UPDATE users SET balance=balance+t.reward,xp=xp+greatest(10,t.reward/5) WHERE id=p_user_id;
 INSERT INTO transactions(user_id,type,amount,currency,status,source,date) VALUES(p_user_id,'reward',t.reward,'NMFP','confirmed','Görev Ödülü: '||t.title,now());
 RETURN jsonb_build_object('success',true,'completed',true,'reward',t.reward,'message','Görev tamamlandı.');
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_verify_task(uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_verify_task(uuid,integer,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.nmfp_record_task_visit(p_user_id uuid,p_task_id integer)
RETURNS text LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE t tasks%rowtype; ut user_tasks%rowtype;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Hesap bulunamadı.'; END IF;
 SELECT * INTO t FROM tasks WHERE id=p_task_id AND is_active AND verification_type='link_click';
 IF NOT FOUND OR coalesce(t.verification_data->>'url','')!~'^https://' THEN RAISE EXCEPTION 'NMFP:Görev bağlantısı kullanılamıyor.'; END IF;
 SELECT * INTO ut FROM user_tasks WHERE user_id=p_user_id AND task_id=t.id;
 IF ut.id IS NULL THEN INSERT INTO user_tasks(user_id,task_id,progress,is_completed) VALUES(p_user_id,t.id,t.total,false);
 ELSIF NOT ut.is_completed THEN UPDATE user_tasks SET progress=t.total WHERE id=ut.id; END IF;
 RETURN t.verification_data->>'url';
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_record_task_visit(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_record_task_visit(uuid,integer) TO service_role;
COMMIT;
