This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# NMFP (Need Money For Porsche) Projesi

## NFT Mintleme ve TON İle Alışveriş Özellikleri (Güncellendi)

### NFT Mintleme Özelliği

NMFP projesi, Porsche araç modellerinin NFT'lerini mint etme özelliği sunmaktadır. Bu özellik, TON blockchain ağını kullanarak gerçekleştirilir.

#### NFT Mintleme Maliyetleri

NFT mintleme maliyetleri, araçların nadirlik seviyelerine göre değişiklik gösterir:

- **Common (Yaygın)**: 1 TON
- **Rare (Nadir)**: 2 TON
- **Epic (Destansı)**: 3.5 TON
- **Legendary (Efsanevi)**: 5 TON

#### NFT Metadata Yapısı

Her NFT için Cyberpunk temalı metadata yapısı kullanılır:

- Araç Adı ve Markası
- Cyberpunk temalı açıklama (her araç için dinamik olarak oluşturulur)
- Araç Serisi ve Nadir Seviyesi (Attributes olarak)
- Koleksiyon Bilgisi (NMFP Racing)

### TON ile Araç Satın Alma

Kullanıcılar, araç modelleri için NFT mintlemenin yanı sıra, doğrudan TON token kullanarak da araç satın alabilirler. Maliyet, aracın mining gücü değerinin 0.1 ile çarpılması sonucu hesaplanır.

### Yeni Geliştirmeler ve İyileştirmeler

#### 1. Gerçek Blockchain Entegrasyonu
- TEP-62 NFT standardına uygun mint işlemi
- İşlem doğrulama ve durum kontrolü
- Gas limitleri ve optimizasyonlar
- İşlem hash'i takibi

#### 2. Güvenli IPFS Entegrasyonu
- Sunucu tarafı proxy ile güvenli IPFS yükleme
- Metadata ve görsel yükleme için API endpointleri
- Metadatalar için Cyberpunk temalı içerik üretimi
- CORS hatalarını önleyen mimarı yapı

#### 3. Kullanıcı Deneyimi İyileştirmeleri
- Detaylı ve kullanıcı dostu hata mesajları
- İşlem durumu bildirimleri
- Başarılı işlem takibi
- Yetersiz bakiye kontrolü

### Kurulum ve Geliştirme

#### Gerekli Bağımlılıklar
```bash
npm install
```

#### Ortam Değişkenleri
.env.example dosyasındaki değişkenleri .env dosyasına kopyalayın ve kendi değerlerinizi girin:
```bash
cp .env.example .env
```

#### Geliştirme Sunucusu
```bash
npm run dev
```

#### Uygulamayı Build Etme
```bash
npm run build
```

### Teknik Notlar

#### IPFS Proxy Kullanımı
Bu proje, tarayıcı tarafından CORS kısıtlamalarını aşmak için bir Next.js API proxy kullanır:
- /api/ipfs/upload-image: Görsel dosyaları IPFS'e yükler
- /api/ipfs/upload-metadata: NFT metadata'sını IPFS'e yükler

#### TON Blockchain Etkileşimi
- TON Connect UI kütüphanesi ile cüzdan bağlantısı
- @ton/core ve @ton/crypto kütüphaneleri ile blockchain işlemleri
- TEP-62 uyumlu payload oluşturma
- Gerçek transaction doğrulama

#### Gas Optimizasyonu
NFT mint işlemleri için gas limitleri varsayılan olarak şöyle belirlenir:
- Mint işlemi: 0.06 TON
- Transfer işlemi: 0.03 TON
- Diğer işlemler: 0.02 TON

Bu değerler çalışma ortamınıza göre .env dosyasından ayarlanabilir.
