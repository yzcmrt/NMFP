# NMFP Supabase Yapılandırması

Bu dizin, NMFP projesinin Supabase veritabanı yönetimi için kullanılmaktadır.

## Dizin Yapısı

- `migrations/`: Veritabanı şema değişiklikleri
- `functions/`: Edge Functions ve PostgreSQL fonksiyonları
- `seed/`: Test verisi ve başlangıç verileri

## Supabase CLI Kullanımı

### Bağlantı Kurma

```bash
# Supabase hesabınıza giriş yapın
supabase login

# Uzak projeye bağlanın
supabase link --project-ref <proje-id>
```

### Yerel Geliştirme

```bash
# Yerel Supabase örneğini başlatın (Docker gerektirir)
supabase start

# Yerel örneği durdurun
supabase stop
```

### Veritabanı İşlemleri

```bash
# Mevcut veritabanı şemasını kontrol edin
supabase db dump

# Migrations oluşturun
supabase migration new <migration-ismi>

# Migrations'ları uygulayın
supabase db push
```

### Fonksiyonlar

```bash
# Yeni Edge Function oluşturun
supabase functions new <fonksiyon-ismi>

# Fonksiyonları deploy edin
supabase functions deploy <fonksiyon-ismi>
```

## Gamefi Modülü için Özel Notlar

Gamefi modülü, aşağıdaki tabloları kullanmaktadır:
- users
- user_cars
- car_models
- garages
- mining_sessions
- transactions

Herhangi bir şema değişikliği yapmadan önce bu tabloların ilişkilerini ve mevcut uygulamadaki kullanımlarını kontrol ediniz. 