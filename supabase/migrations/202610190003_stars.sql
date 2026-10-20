BEGIN;
CREATE TABLE IF NOT EXISTS public.star_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id),
 kind text NOT NULL CHECK(kind IN ('car','garage','premium')), product_id text NOT NULL,
 amount integer NOT NULL CHECK(amount>0), title text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refund_pending','refunded','expired')),
 telegram_charge_id text UNIQUE, invoice_url text, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '20 minutes', paid_at timestamptz,
 delivered_id integer, terms_version text NOT NULL DEFAULT '2026-10-19'
);
ALTER TABLE public.star_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.star_orders FROM anon,authenticated;
GRANT ALL ON public.star_orders TO service_role;
CREATE OR REPLACE FUNCTION public.nmfp_fulfill_star_order(p_order_id uuid,p_telegram_id text,p_charge_id text,p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o star_orders%rowtype; u uuid; c car_models%rowtype; g garage_templates%rowtype; delivered integer;
BEGIN
 SELECT user_id INTO u FROM star_orders WHERE id=p_order_id;
 IF u IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 PERFORM 1 FROM users WHERE id=u AND telegram_id=p_telegram_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order owner mismatch'; END IF;
 SELECT * INTO o FROM star_orders WHERE id=p_order_id FOR UPDATE;
 IF o.amount<>p_amount OR length(p_charge_id)<1 THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF o.status='paid' AND o.telegram_charge_id=p_charge_id THEN RETURN jsonb_build_object('success',true,'duplicate',true,'delivered_id',o.delivered_id); END IF;
 IF o.status IN ('refund_pending','refunded') AND o.telegram_charge_id=p_charge_id THEN RETURN jsonb_build_object('refund_required',o.status='refund_pending'); END IF;
 IF o.status NOT IN ('pending','expired') THEN RAISE EXCEPTION 'Order cannot be fulfilled'; END IF;
 IF (o.kind='car' AND EXISTS(SELECT 1 FROM user_cars WHERE user_id=u AND car_model_id=o.product_id::uuid)) OR (o.kind='garage' AND EXISTS(SELECT 1 FROM garages WHERE user_id=u AND template_id=o.product_id)) THEN
  UPDATE star_orders SET status='refund_pending',telegram_charge_id=p_charge_id,paid_at=now() WHERE id=o.id;
  RETURN jsonb_build_object('refund_required',true);
 END IF;
 IF o.kind='car' THEN
  SELECT * INTO STRICT c FROM car_models WHERE id=o.product_id::uuid;
  INSERT INTO user_cars(user_id,car_model_id,name,purchase_type,mining_multiplier,fuel,condition,status,level)
   VALUES(u,c.id,c.name,'STARS',1.2,100,100,'active',1) RETURNING id INTO delivered;
 ELSIF o.kind='garage' THEN
  SELECT * INTO STRICT g FROM garage_templates WHERE id=o.product_id;
  INSERT INTO garages(user_id,template_id,name,image_url,capacity,daily_bonus,level,value,purchase_type,location)
   VALUES(u,g.id,g.name,g.image,g.capacity,round(g.daily_bonus*1.2),1,g.price,'STARS','İstanbul') RETURNING id INTO delivered;
 ELSIF o.kind='premium' THEN
  UPDATE users SET premium_active=true,premium_until=greatest(now(),coalesce(premium_until,now()))+interval '365 days',auto_mining=true WHERE id=u;
 END IF;
 INSERT INTO transactions(user_id,type,amount,currency,status,item,source,date) VALUES(u,'purchase',o.amount,'XTR','confirmed',o.title,'Telegram Stars',now());
 UPDATE star_orders SET status='paid',telegram_charge_id=p_charge_id,paid_at=now(),delivered_id=delivered WHERE id=o.id;
 RETURN jsonb_build_object('success',true,'delivered_id',delivered);
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_fulfill_star_order(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_fulfill_star_order(uuid,text,text,integer) TO service_role;
COMMIT;
