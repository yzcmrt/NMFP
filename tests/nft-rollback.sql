-- Run after migration inside BEGIN/ROLLBACK. Never commit these fixtures.
DO $$
DECLARE u uuid; u2 uuid; c integer; o uuid; j uuid; m uuid; r jsonb; lock1 uuid:=gen_random_uuid(); lock2 uuid:=gen_random_uuid();
BEGIN
 IF EXISTS(SELECT 1 FROM users WHERE telegram_id IN ('990000000000031','990000000000032')) THEN RAISE EXCEPTION 'TEST fixture exists'; END IF;
 u:=(get_or_create_user('990000000000031','nft_test',false,false)->>'user_id')::uuid;
 u2:=(get_or_create_user('990000000000032','nft_test_other',false,false)->>'user_id')::uuid;
 SELECT id INTO c FROM user_cars WHERE user_id=u LIMIT 1;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title,recipient_address) VALUES(u,'nft_upgrade',c::text,50,'NFT test','0:'||repeat('1',64)) RETURNING id INTO o;
 PERFORM nmfp_fulfill_star_order(o,'990000000000031','nft-upgrade-test',50);
 PERFORM nmfp_fulfill_star_order(o,'990000000000031','nft-upgrade-test',50);
 IF (SELECT count(*) FROM nft_jobs WHERE car_id=c)<>1 THEN RAISE EXCEPTION 'TEST upgrade duplicate'; END IF;
 SELECT id INTO j FROM nft_jobs WHERE car_id=c;
 IF (SELECT metadata->>'image' FROM nft_jobs WHERE id=j) NOT LIKE 'https://nmfp.vercel.app/%' THEN RAISE EXCEPTION 'TEST invalid metadata'; END IF;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title,recipient_address) VALUES(u,'nft_upgrade',c::text,50,'duplicate','0:'||repeat('1',64)) RETURNING id INTO o;
 r:=nmfp_fulfill_star_order(o,'990000000000031','nft-duplicate-test',50);
 IF r->>'refund_required'<>'true' THEN RAISE EXCEPTION 'TEST duplicate upgrade not refunded'; END IF;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title,recipient_address) VALUES(u2,'nft_upgrade',c::text,50,'foreign car','0:'||repeat('2',64)) RETURNING id INTO o;
 r:=nmfp_fulfill_star_order(o,'990000000000032','nft-foreign-test',50);
 IF r->>'refund_required'<>'true' THEN RAISE EXCEPTION 'TEST foreign upgrade allowed'; END IF;
 SELECT id INTO m FROM car_models WHERE id NOT IN(SELECT car_model_id FROM user_cars WHERE user_id=u) LIMIT 1;
 INSERT INTO star_orders(user_id,kind,product_id,amount,title,recipient_address) VALUES(u,'nft_car',m::text,100,'NFT + car','0:'||repeat('1',64)) RETURNING id INTO o;
 PERFORM nmfp_fulfill_star_order(o,'990000000000031','nft-new-car-test',100);
 PERFORM nmfp_fulfill_star_order(o,'990000000000031','nft-new-car-test',100);
 IF (SELECT count(*) FROM nft_jobs WHERE user_id=u)<>2 OR (SELECT count(*) FROM user_cars WHERE user_id=u AND car_model_id=m)<>1 THEN RAISE EXCEPTION 'TEST NFT car fulfillment'; END IF;
 IF NOT nmfp_nft_lock(lock1) OR nmfp_nft_lock(lock2) THEN RAISE EXCEPTION 'TEST concurrent worker lease'; END IF;
 PERFORM nmfp_nft_prepare(lock1,j,0,'0:'||repeat('3',64),'test-only-boc',0,9999999999);
 IF (SELECT state FROM nft_jobs WHERE id=j)<>'prepared' THEN RAISE EXCEPTION 'TEST durable preparation'; END IF;
 BEGIN
  PERFORM nmfp_nft_prepare(lock2,j,1,'0:'||repeat('3',64),'test-only-boc',0,9999999999);
  RAISE EXCEPTION 'TEST foreign lease accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST%' THEN RAISE; END IF; END;
 IF has_table_privilege('anon','public.nft_jobs','SELECT') OR has_function_privilege('authenticated','nmfp_nft_prepare(uuid,uuid,bigint,text,text,bigint,bigint)','EXECUTE') THEN RAISE EXCEPTION 'TEST public NFT access'; END IF;
END $$;
SELECT 'PASS: NFT upgrade, new car, owner checks, idempotency, refunds, worker lock and durable preparation' result;
