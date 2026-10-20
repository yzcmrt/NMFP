-- NMFP recovery: preserve existing accounts and assets.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE public.car_models ADD COLUMN IF NOT EXISTS stars_price integer;
ALTER TABLE public.garage_templates ADD COLUMN IF NOT EXISTS stars_price integer;
UPDATE public.car_models SET stars_price = CASE lower(rarity) WHEN 'legendary' THEN 500 WHEN 'epic' THEN 250 WHEN 'rare' THEN 100 ELSE 50 END WHERE stars_price IS NULL;
UPDATE public.garage_templates SET stars_price = greatest(49,capacity * 20 - 1) WHERE stars_price IS NULL;

CREATE OR REPLACE FUNCTION public.nmfp_game_action(p_user_id uuid, p_action text, p_args jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_car integer; v_garage integer; v_session mining_sessions%rowtype;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Account not found.'; END IF;
 v_car := (p_args->>'p_car_id')::integer;
 v_garage := (p_args->>'p_garage_id')::integer;
 IF v_car IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_cars WHERE id=v_car AND user_id=p_user_id) THEN RAISE EXCEPTION 'NMFP:Car not found.'; END IF;
 IF v_garage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM garages WHERE id=v_garage AND user_id=p_user_id) THEN RAISE EXCEPTION 'NMFP:Garage not found.'; END IF;
 CASE p_action
 WHEN 'purchase_car_v3' THEN
  IF p_args->>'p_purchase_type' IS DISTINCT FROM 'NMFP' THEN RAISE EXCEPTION 'NMFP:Verified checkout is required.'; END IF;
  v_result:=to_jsonb(purchase_car_v3(p_user_id,(p_args->>'p_model_id')::uuid,'NMFP',null));
 WHEN 'purchase_garage_v3' THEN
  IF p_args->>'p_purchase_type' IS DISTINCT FROM 'NMFP' THEN RAISE EXCEPTION 'NMFP:Verified checkout is required.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM garage_templates WHERE id=p_args->>'p_garage_template_id' AND purchase_type='nmfp') THEN RAISE EXCEPTION 'NMFP:This garage requires Stars checkout.'; END IF;
  v_result:=to_jsonb(purchase_garage_v3(p_user_id,p_args->>'p_garage_template_id','NMFP',null));
 WHEN 'start_mining' THEN v_result:=to_jsonb(start_mining(p_user_id,v_car,v_garage));
 WHEN 'repair_car_uuid' THEN v_result:=to_jsonb(repair_car_uuid(p_user_id,v_car));
 WHEN 'refill_car_uuid' THEN v_result:=to_jsonb(refill_car_uuid(p_user_id,v_car));
 WHEN 'collect_garage_bonuses' THEN v_result:=to_jsonb(collect_garage_bonuses(p_user_id));
 WHEN 'prepare_and_start_eligible_cars' THEN v_result:=to_jsonb(prepare_and_start_eligible_cars(p_user_id,coalesce((p_args->>'p_auto_pay_maintenance')::boolean,false)));
 WHEN 'complete_mining' THEN
  SELECT * INTO v_session FROM mining_sessions WHERE id=(p_args->>'p_mining_session_id')::integer AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NMFP:Mining session not found.'; END IF;
  IF v_session.status='completed' THEN RETURN '0'::jsonb; END IF;
  IF v_session.end_time>now() THEN RAISE EXCEPTION 'NMFP:Mining is still in progress.'; END IF;
  v_result:=to_jsonb(complete_mining(v_session.id));
 ELSE RAISE EXCEPTION 'NMFP:Unsupported action.';
 END CASE;
 RETURN coalesce(v_result,'null'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.nmfp_game_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nmfp_game_action(uuid,text,jsonb) TO service_role;
COMMIT;
