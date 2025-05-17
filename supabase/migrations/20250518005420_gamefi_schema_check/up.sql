-- Gamefi şeması kontrol ve optimizasyon
-- Bu dosya sadece mevcut durumu kontrol etmek için gereken SQL sorgularını içerir
-- ve veritabanında herhangi bir değişiklik yapmaz.

-- Mevcut tablo yapılarının kontrol edilmesi
SELECT
    table_name,
    column_name,
    data_type
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND table_name IN ('users', 'user_cars', 'car_models', 'garages', 'mining_sessions', 'transactions')
ORDER BY
    table_name,
    ordinal_position;

-- Kullanılacak rapor fonksiyonu (gerçek bir migration değil, sadece veri görüntüleme)
CREATE OR REPLACE FUNCTION gamefi_schema_check()
RETURNS TABLE (
    table_name text, 
    record_count bigint, 
    last_updated timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.table_name::text,
        (SELECT count(*)::bigint FROM "public." || quote_ident(t.table_name)) as record_count,
        (
            SELECT max(updated_at)
            FROM "public." || quote_ident(t.table_name)
            WHERE EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = t.table_name
                AND column_name = 'updated_at'
            )
        ) as last_updated
    FROM
        information_schema.tables t
    WHERE
        t.table_schema = 'public'
        AND t.table_name IN ('users', 'user_cars', 'car_models', 'garages', 'mining_sessions', 'transactions')
    ORDER BY
        t.table_name;
END;
$$ LANGUAGE plpgsql; 