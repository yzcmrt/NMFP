CREATE OR REPLACE FUNCTION public.purchase_garage(
  p_user_id UUID,
  p_garage_template_id TEXT,
  p_purchase_type TEXT -- 'NMFP' or 'TON' matching the template
) RETURNS INTEGER AS $$
DECLARE
  v_user_record RECORD;
  v_garage_template RECORD;
  v_price_paid NUMERIC; -- Use NUMERIC for both NMFP (BIGINT) and TON (NUMERIC)
  v_new_garage_id INTEGER;
  v_currency TEXT;
  v_now TIMESTAMP WITH TIME ZONE := get_utc_now();
BEGIN
  RAISE NOTICE '[purchase_garage] Basladi: user_id=%, template_id=%, type=%', p_user_id, p_garage_template_id, p_purchase_type;

  -- Get user and lock row
  SELECT * INTO v_user_record FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_garage] Kullanici bulunamadi: %', p_user_id; END IF;

  -- Get garage template details (ensure price columns exist in your 'garages' table for templates)
  SELECT *,
         COALESCE(nmfp_price, 0) AS effective_nmfp_price, -- Handle NULL price, default to 0
         COALESCE(ton_price, 0) AS effective_ton_price     -- Handle NULL price, default to 0
  INTO v_garage_template
  FROM public.garages
  WHERE template_id = p_garage_template_id AND user_id IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION '[purchase_garage] Garaj modeli bulunamadi: template_id=%', p_garage_template_id; END IF;
  RAISE NOTICE '[purchase_garage] Garaj sablonu: %, NMFP Fiyat: %, TON Fiyat: %', v_garage_template.name, v_garage_template.effective_nmfp_price, v_garage_template.effective_ton_price;

  -- Check purchase type and price
  IF p_purchase_type = 'NMFP' THEN
     -- Check if template can be purchased with NMFP
     IF v_garage_template.effective_nmfp_price <= 0 THEN
         RAISE EXCEPTION '[purchase_garage] Garaj sablonu (%s) NMFP ile satilamaz veya fiyatı 0.', v_garage_template.template_id;
     END IF;
     v_price_paid := v_garage_template.effective_nmfp_price;
     v_currency := 'NMFP';
     RAISE NOTICE '[purchase_garage] NMFP ile alim: Fiyat=%', v_price_paid;
     -- Check user balance
     IF v_user_record.balance < v_price_paid THEN
         RAISE EXCEPTION '[purchase_garage] Yetersiz NMFP puani (Gerekli: %, Mevcut: %)', v_price_paid, v_user_record.balance;
     END IF;
     -- Deduct balance
     UPDATE public.users SET balance = balance - v_price_paid WHERE id = p_user_id;

  ELSIF p_purchase_type = 'TON' THEN
     -- Check if template can be purchased with TON
     IF v_garage_template.effective_ton_price <= 0 THEN
         RAISE EXCEPTION '[purchase_garage] Garaj sablonu (%s) TON ile satilamaz veya fiyatı 0.', v_garage_template.template_id;
     END IF;
     v_price_paid := v_garage_template.effective_ton_price;
     v_currency := 'TON';
     RAISE NOTICE '[purchase_garage] TON ile alim: Fiyat=%', v_price_paid;
     -- Check user balance
     IF v_user_record.ton_coins < v_price_paid THEN
         RAISE EXCEPTION '[purchase_garage] Yetersiz TON coin (Gerekli: %, Mevcut: %)', v_price_paid, v_user_record.ton_coins;
     END IF;
     -- Deduct balance
     UPDATE public.users SET ton_coins = ton_coins - v_price_paid WHERE id = p_user_id;
  ELSE
     RAISE EXCEPTION '[purchase_garage] Gecersiz satin alma tipi: %', p_purchase_type;
  END IF;
  RAISE NOTICE '[purchase_garage] Bakiye dusuldu.';

  -- Create a new garage for the user based on the template
  INSERT INTO public.garages (
      user_id, name, image_url, capacity, level, daily_bonus, value, location, created_at, template_id, purchase_type
  ) VALUES (
      p_user_id,
      v_garage_template.name,
      v_garage_template.image_url,
      v_garage_template.capacity,
      1, -- Start at level 1
      v_garage_template.daily_bonus,
      0, -- User owned garage value might differ or be 0 initially
      v_garage_template.location,
      v_now,
      NULL, -- User garage doesn't have template_id set
      p_purchase_type -- Record how it was purchased
  )
  RETURNING id INTO v_new_garage_id;
  RAISE NOTICE '[purchase_garage] Yeni garaj eklendi: id=%', v_new_garage_id;

  -- Record the transaction (Use negative amount for purchases)
  INSERT INTO public.transactions (user_id, type, amount, currency, status, item, date)
  VALUES (p_user_id, 'purchase_garage', -v_price_paid, v_currency, 'confirmed', v_garage_template.name, v_now);
  RAISE NOTICE '[purchase_garage] Islem kaydedildi.';

  RETURN v_new_garage_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[purchase_garage] HATA: %', SQLERRM;
        RAISE; -- Re-raise the exception
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;