    CREATE OR REPLACE FUNCTION public.get_user_details(p_user_id uuid)
    RETURNS users -- Tek bir kullanıcı kaydı döndürür
    LANGUAGE sql
    STABLE -- Fonksiyon veritabanını değiştirmez
    SECURITY DEFINER -- Fonksiyonu oluşturanın (genellikle admin) yetkileriyle çalışır
    AS $$
      SELECT *
      FROM public.users
      WHERE id = p_user_id
      LIMIT 1; -- Sadece bir satır döndüğünden emin ol
    $$;