BEGIN;
ALTER TABLE public.star_orders DROP CONSTRAINT IF EXISTS star_orders_kind_check;
ALTER TABLE public.star_orders ADD CONSTRAINT star_orders_kind_check CHECK(kind IN ('car','garage','premium','nft_car','nft_upgrade'));
ALTER TABLE public.star_orders ADD COLUMN IF NOT EXISTS recipient_address text;
ALTER TABLE public.star_orders ADD CONSTRAINT star_orders_nft_recipient CHECK(kind NOT IN ('nft_car','nft_upgrade') OR (recipient_address IS NOT NULL AND recipient_address ~ '^0:[0-9a-f]{64}$'));
CREATE TABLE public.nft_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id),
 car_id integer NOT NULL UNIQUE REFERENCES public.user_cars(id), order_id uuid NOT NULL UNIQUE REFERENCES public.star_orders(id),
 recipient_address text NOT NULL CHECK(recipient_address ~ '^0:[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','prepared','minted','review')),
 item_index bigint UNIQUE CHECK(item_index>=0), item_address text UNIQUE, metadata jsonb NOT NULL,
 signed_boc text, wallet_seqno bigint, valid_until bigint, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), prepared_at timestamptz, minted_at timestamptz,
 chain_tx_hash text, last_error text
);
CREATE UNIQUE INDEX nft_one_prepared ON public.nft_jobs((true)) WHERE state IN ('prepared','review');
ALTER TABLE public.nft_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nft_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.nft_jobs TO service_role;
CREATE TABLE public.nft_worker_lock(id integer PRIMARY KEY CHECK(id=1),owner uuid,until_at timestamptz,health_checked_at timestamptz,ready boolean NOT NULL DEFAULT false);
INSERT INTO public.nft_worker_lock(id) VALUES(1);
ALTER TABLE public.nft_worker_lock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nft_worker_lock FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.nft_worker_lock TO service_role;
CREATE FUNCTION public.nmfp_nft_lock(p_owner uuid,p_release boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_release THEN UPDATE nft_worker_lock SET owner=NULL,until_at=NULL WHERE id=1 AND owner=p_owner;
 ELSE UPDATE nft_worker_lock SET owner=p_owner,until_at=now()+interval '2 minutes' WHERE id=1 AND (until_at IS NULL OR until_at<now() OR owner=p_owner); END IF;
 RETURN FOUND;
END $$;
CREATE FUNCTION public.nmfp_nft_enqueue(p_user_id uuid,p_car_id integer,p_order_id uuid,p_recipient text) RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE c user_cars%rowtype; m car_models%rowtype; j uuid;
BEGIN
 SELECT * INTO STRICT c FROM user_cars WHERE id=p_car_id AND user_id=p_user_id;
 SELECT * INTO STRICT m FROM car_models WHERE id=c.car_model_id;
 INSERT INTO nft_jobs(user_id,car_id,order_id,recipient_address,metadata) VALUES(p_user_id,c.id,p_order_id,p_recipient,
 jsonb_build_object('name',m.name,'description','NMFP Cyber Garage collectible. NFT transfers do not transfer the in-game car or its mining progress.','image','https://nmfp.vercel.app'||m.image_url,'attributes',jsonb_build_array(jsonb_build_object('trait_type','Rarity','value',m.rarity),jsonb_build_object('trait_type','Mining Power','value',m.mining_power)))) RETURNING id INTO j;
 RETURN j;
END $$;
CREATE FUNCTION public.nmfp_nft_prepare(p_lock uuid,p_job uuid,p_index bigint,p_address text,p_boc text,p_seqno bigint,p_valid_until bigint) RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM nft_worker_lock WHERE id=1 AND owner=p_lock AND until_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NFT worker lease expired'; END IF;
 UPDATE nft_jobs SET state='prepared',item_index=p_index,item_address=p_address,signed_boc=p_boc,wallet_seqno=p_seqno,valid_until=p_valid_until,prepared_at=now(),attempts=attempts+1,last_error=NULL WHERE id=p_job AND state IN ('queued','prepared');
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.nmfp_nft_lock(uuid,boolean), public.nmfp_nft_enqueue(uuid,integer,uuid,text),public.nmfp_nft_prepare(uuid,uuid,bigint,text,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_nft_lock(uuid,boolean), public.nmfp_nft_enqueue(uuid,integer,uuid,text),public.nmfp_nft_prepare(uuid,uuid,bigint,text,text,bigint,bigint) TO service_role;
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
 IF (o.kind='nft_upgrade' AND (NOT EXISTS(SELECT 1 FROM user_cars WHERE id=o.product_id::integer AND user_id=u AND status<>'sold') OR EXISTS(SELECT 1 FROM nft_jobs WHERE car_id=o.product_id::integer))) OR (o.kind IN ('car','nft_car') AND EXISTS(SELECT 1 FROM user_cars WHERE user_id=u AND car_model_id=o.product_id::uuid)) OR (o.kind='garage' AND EXISTS(SELECT 1 FROM garages WHERE user_id=u AND template_id=o.product_id)) THEN
  UPDATE star_orders SET status='refund_pending',telegram_charge_id=p_charge_id,paid_at=now() WHERE id=o.id;
  RETURN jsonb_build_object('refund_required',true);
 END IF;
 IF o.kind IN ('car','nft_car') THEN
  SELECT * INTO STRICT c FROM car_models WHERE id=o.product_id::uuid;
  INSERT INTO user_cars(user_id,car_model_id,name,purchase_type,mining_multiplier,fuel,condition,status,level)
   VALUES(u,c.id,c.name,'STARS',1.2,100,100,'active',1) RETURNING id INTO delivered;
 ELSIF o.kind='garage' THEN
  SELECT * INTO STRICT g FROM garage_templates WHERE id=o.product_id;
  INSERT INTO garages(user_id,template_id,name,image_url,capacity,daily_bonus,level,value,purchase_type,location)
   VALUES(u,g.id,g.name,g.image,g.capacity,round(g.daily_bonus*1.2),1,g.price,'STARS','İstanbul') RETURNING id INTO delivered;
 ELSIF o.kind='nft_upgrade' THEN
  delivered:=o.product_id::integer;
 ELSIF o.kind='premium' THEN
  UPDATE users SET premium_active=true,premium_until=greatest(now(),coalesce(premium_until,now()))+interval '365 days',auto_mining=true WHERE id=u;
 END IF;
 IF o.kind IN ('nft_car','nft_upgrade') THEN PERFORM nmfp_nft_enqueue(u,delivered,o.id,o.recipient_address); END IF;
 INSERT INTO transactions(user_id,type,amount,currency,status,item,source,date) VALUES(u,'purchase',o.amount,'XTR','confirmed',o.title,'Telegram Stars',now());
 UPDATE star_orders SET status='paid',telegram_charge_id=p_charge_id,paid_at=now(),delivered_id=delivered WHERE id=o.id;
 RETURN jsonb_build_object('success',true,'delivered_id',delivered);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
