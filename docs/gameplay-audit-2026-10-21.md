# NMFP oyun akışı ve NFT incelemesi — 21 Ekim 2026

## Düzeltilen oyun akışı

| Alan | Bulgu | Düzeltme |
| --- | --- | --- |
| Mining | Ödenmiş eski seanslar aktif listesine dönüyor, ödül düğmesi tekrar çıkıyor ve yeniden başlatmayı engelliyordu. | Sunucu görüntüsü yalnızca aktif seansları içerir. Tamamlanan ödül için tekrar talep başarılı fakat sıfır kredili sonuç döner. |
| Veri yenileme | Ana sayfa, araçlar ve bakiyede bağımsız sorgulama/senkronizasyon katmanları vardı. | Tek oyun sağlayıcısı, görünür sayfada 15 saniyelik yenileme ve işlemden sonra sunucudan güncel veri. 22 kullanılmayan dosya kaldırıldı. |
| Araç bakımı | Ekrandaki sabit maliyetler SQL model fiyatıyla uyuşmuyordu. | Model fiyatı × eksik yüzde / 100, üst tam sayıya yuvarlama; sunucu ve ekran aynı hesap. Mining sırasında bakım kapalı. |
| Garaj bonusu | Düğmenin işlem bağlantısı yoktu; eski SQL hatayı yutup sıfır dönebiliyordu. | Kullanıcı kilidi altında tek toplama, tam 24 saat bekleme ve açık hata; tüm garajların bonusu birlikte. |
| Görevler | Test görevleri, eski TON/NFT görevleri ve bakım kayıtları arasında uyumsuzluk vardı. | Oyun kanıtı sunucuda doğrulanır, ödül bir kez verilir. Stars görevi güncellendi; test, desteklenmeyen NFT ve manuel davet görevleri gizlendi. |
| Otomatik mining | Ücretli paketin açma/duraklatma durumu yeterince açık değildi. | Aktif paket kontrolüyle açma/duraklatma. Duraklatma mevcut turu iptal etmez; yeni otomatik turları engeller. |
| İstatistik | Tahmini/sabit dağılım, eski ödül verisi ve hata durumları yanıltıcı olabiliyordu. | Tarih aralığında gerçekten kaydedilmiş mining ödülleri, UTC günleri ve açık hata/yenileme. Eski tutarı bilinmeyen seanslar ayrıca belirtilir. |
| Cüzdan | İade bekleyen sipariş ödeme bekliyor gibi görünebiliyordu. | İade işleniyor / iade edildi / süresi doldu ayrımı ve giderlerin negatif gösterimi. |

Geçmişte `actual_reward` değeri eksik 43 tamamlanmış mining kaydı tespit edildi. Eski bakiyelerin hangi ödemeleri içerdiği kesin olmadığı için geçmiş seanslara toplu yeniden ödeme yapılmadı.

## Kontrol kapsamı

- 30 otomatik kod testi: Telegram HMAC, oturum, kaynak doğrulama, kullanıcı sahipliği, görev kanıtı, mining durumları, bakım fiyatı, bonus süresi, Stars ve webhook teslimatı.
- SQL testleri BEGIN / ROLLBACK içinde geçici kullanıcılarla çalıştırıldı: ilk varlıklar, mining, erken talep reddi, tek ödül, yeniden başlatma, bakım/yakıt, bonus bekleme, görev ödülü, otomatik mining, istatistik ve RPC erişim sınırları.
- Aynı SQL testinde Stars yanlış kullanıcı/tutar, tekrar bildirim, araç/garaj/paket teslimatı ve mükerrer üründe iade kuyruğu kontrol edildi. Gerçek ödeme yapılmadı.
- Üretim derlemesi, TypeScript ve lint kontrolleri.
- Ayrı yerel test verileriyle gerçek React ekranlarında ödül toplama → bakım → yakıt → mining başlatma, otomatik tur açma/duraklatma, garaj bonusu, görev ilerlemesi/tamamlama, istatistik ve cüzdan gezildi. Tarayıcı hata kaydı yoktu. 390 px genişlikte mobil görünüm ve ödül düğmesi kontrol edildi.
- Katalogdaki araç ve garaj görsellerinin dosyaları mevcut.

Bu kontroller gerçek Telegram mobil istemcisinde gerçek Stars tahsilatı veya gerçek TON/NFT işlemi yapıldığı anlamına gelmez. Tarayıcı arayüz testi izole örnek veriler, sunucu testleri ise ayrı SQL/API senaryoları kullandı.

## Telegram kanal görevi

`@needmoneyforporschewtf` için botun `getChatMember` isteği `member list is inaccessible` hatası verdi. Ödül doğrulaması yapamayan görev görünümden kaldırıldı. Yeniden açılması için botun kanalda üyelik okuyabilecek yönetici erişimine sahip olması ve kontrolün tekrar başarılı olması gerekiyor. Kullanıcıların eski görev/ödül kayıtları silinmedi.

## NFT: gerçek mint neden çalışmıyordu?

Eski kaynak kodun `src/app/gamefi/car/page.tsx` NFT satın alma dalı (yerel eski HEAD: `7b2c2ce`, satır 488–614) koleksiyona mint mesajı göndermiyor. Oyun cüzdanına yalnızca adres + TON tutarı gönderiyor; mint payload alanı yok. Cüzdanın `boc` cevabı başarı kabul ediliyor, metadata IPFS'e yükleniyor, beş saniye bekleniyor ve oyun içi araç satın alma kaydı oluşturuluyor. Metadata CID bu transferle bir NFT'ye bağlanmıyor.

Ayrı `src/services/nftService.ts` yardımcısında mint payload taslağı olsa da gerçek satın alma dalı bunu kullanmıyor. Taslakta model kimliğinden NFT indeksi türetiliyor; benzersiz NFT indeksi ve koleksiyonun `next_item_index` değeriyle güvenilir bir eşleme yok. Zincirde NFT'nin üretildiği, koleksiyonu, sahibi ve içeriği doğrulanmadan başarı gösterilebiliyor.

Dolayısıyla bu sorun yalnızca SQL tablosu eksikliği değil. Cüzdandan para gönderilmesi NFT üretimi değildir. Canlı sürümde sahte başarı veren mint/TON satın alma yolu kapalı kalır; desteklenmeyen NFT görevi de kaldırılır.

### Gerçek NFT için gereken ayrı uygulama

1. Kullanılacak TON koleksiyonunun adresi, ağı, yayımlanmış kodu ve mint yetkisini doğrula. Eski sabit adresin canlı koleksiyon olarak doğru olduğu bu incelemede doğrulanmadı.
2. Oyun satın alımını Stars ile sürdür; NFT'nin ayrı bir dışa aktarma/teslimat özelliği olarak ürün kurallarını belirle.
3. Cüzdan sahipliğini doğrulayan açık bir akış kur. Salt TonConnect adresi, sunucu açısından sahiplik kanıtı değildir.
4. Sunucuda benzersiz sipariş, NFT indeksi, metadata CID, işlem hash'i ve teslimat durumları tut. Tekrar denemelerin ikinci NFT üretmesini engelle.
5. Denetlenmiş koleksiyon mantığıyla mint mesajını gönder; gas ve yetki modelini testnet üzerinde doğrula. Referans koleksiyonun `op=1` mint işlemi koleksiyon sahibine özeldir; her kullanıcı cüzdanının doğrudan çağırabileceği varsayılamaz.
6. Zincirden `get_nft_address_by_index` ve `get_nft_data` sonuçlarıyla NFT, koleksiyon, sahip ve içeriği doğrula. Oyun kaydını ancak doğrulamadan sonra güncelle; bounce/gecikme/başarısızlık için tekrar deneme ve iade akışını test et.

Kaynaklar: [TON NFT referans uygulaması](https://docs.ton.org/contracts/standard/tokens/nft/nft-reference), [Telegram Stars dijital ürün ödemeleri](https://core.telegram.org/bots/payments-stars).
