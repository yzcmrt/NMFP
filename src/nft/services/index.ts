import { 
  createMetadataJson, 
  createNftMintPayload, 
  estimateGasLimit, 
  verifyTransaction, 
  sendTon, 
  openWallet 
} from '../utils/helpers';
import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
// import { Rarity } from '../../types/car'; // Eski hatalı import
import { stringToRarity, modelIdToNumber, ensureModelIdString } from '@/utils/typeConverters';
import { NFTCollection } from "../contracts/NFTCollection";
// UserCar, CarModel ve Rarity artık @/types altında
import { UserCar, CarModel, Rarity } from "@/types";
import { supabase } from "@/services/supabaseService";

// Node.js proxy için axios kütüphanesi
import axios from 'axios';

/**
 * NFT Servis Sınıfı - IPFS ve NFT mint işlemleri için gerekli metodları içerir
 */
export class NFTService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataJWT: string;
  private gateway: string;
  private nftCollectionAddress: string;
  private tonClient: TonClient;
  private serverProxyUrl: string;
  
  constructor() {
    // Pinata API anahtarları ortam değişkenlerinden alınır
    this.pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '';
    this.pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';
    this.gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ivory-calm-vicuna-368.mypinata.cloud';
    this.nftCollectionAddress = process.env.NEXT_PUBLIC_NFT_COLLECTION_ADDRESS || '';
    this.serverProxyUrl = process.env.NEXT_PUBLIC_API_PROXY_URL || '/api/ipfs'; // Sunucu proxy URL
    
    // TON Client'ı başlat
    const endpoint = process.env.NEXT_PUBLIC_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
    const apiKey = process.env.NEXT_PUBLIC_TON_API_KEY || '';
    
    this.tonClient = new TonClient({
      endpoint,
      apiKey
    });
    
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('Pinata API anahtarları tanımlanmamış. IPFS yüklemeleri çalışmayabilir.');
    }
  }
  
  /**
   * Resim dosyasını IPFS'e yükler (Server proxy üzerinden)
   * @param file Yüklenecek dosya
   * @returns CID - IPFS içerik tanımlayıcısı
   */
  async uploadImageToIPFS(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Görsel IPFS\'e yükleniyor...');
      
      // İstemci tarafında çalışırken, sunucu proxy'sini kullan
      if (typeof window !== 'undefined') {
        const response = await fetch(`${this.serverProxyUrl}/upload-image`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Sunucu hatası:', response.status, errorData);
          throw new Error(`Sunucu hatası: ${response.status} - ${errorData.message || ''}`);
        }
        
        const data = await response.json();
        console.log('IPFS yükleme başarılı:', data);
        return data.ipfsHash;
      } 
      // Node.js ortamında doğrudan Pinata API'yi kullan
      else {
        const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
          maxBodyLength: Infinity,
          headers: {
            'Authorization': `Bearer ${this.pinataJWT}`,
          },
          timeout: 60000 // 60 saniye timeout
        });
        
        console.log('IPFS yükleme başarılı:', res.data);
        return res.data.IpfsHash;
      }
    } catch (error) {
      console.error('IPFS yükleme hatası:', error);
      throw new Error('Resim IPFS\'e yüklenirken bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }
  
  /**
   * NFT için metadata'yı IPFS'e yükler (Server proxy üzerinden)
   * @param name NFT adı
   * @param description NFT açıklaması
   * @param series Araç serisi
   * @param rarity Nadirlik seviyesi
   * @param imageCid Resmin IPFS CID'si
   * @returns CID - Metadata'nın IPFS içerik tanımlayıcısı
   */
  async uploadMetadataToIPFS(
    name: string, 
    description: string, 
    series: string,
    rarity: string,
    imageCid: string
  ): Promise<string> {
    try {
      const cyberpunkDescription = this.generateCyberpunkDescription(name, series, rarity);
      
      const metadata = {
        name,
        description: cyberpunkDescription,
        image: `ipfs://${imageCid}`,
        attributes: [
          { trait_type: "Series", value: series },
          { trait_type: "Rarity", value: rarity },
          { trait_type: "Collection", value: "NMFP Racing" }
        ]
      };
      
      console.log('Metadata IPFS\'e yükleniyor...', { name, rarity });
      
      // İstemci tarafında çalışırken, sunucu proxy'sini kullan
      if (typeof window !== 'undefined') {
        const response = await fetch(`${this.serverProxyUrl}/upload-metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ metadata })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Metadata yükleme sunucu hatası:', response.status, errorData);
          throw new Error(`Sunucu hatası: ${response.status} - ${errorData.message || ''}`);
        }
        
        const data = await response.json();
        console.log('Metadata IPFS yükleme başarılı:', data);
        return data.ipfsHash;
      } 
      // Node.js ortamında doğrudan Pinata API'yi kullan
      else {
        const data = {
          pinataOptions: {
            cidVersion: 0
          },
          pinataMetadata: {
            name: `${name}-metadata-${Date.now()}`,
          },
          pinataContent: metadata
        };
        
        const res = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.pinataJWT}`,
          },
          timeout: 30000 // 30 saniye timeout
        });
        
        console.log('Metadata IPFS yükleme başarılı:', res.data);
        return res.data.IpfsHash;
      }
    } catch (error) {
      console.error('Metadata IPFS yükleme hatası:', error);
      throw new Error('NFT metadata\'sı IPFS\'e yüklenirken bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }
  
  /**
   * Cyberpunk temalı açıklama üretir
   * @param name Araç adı
   * @param series Araç serisi
   * @param rarity Nadirlik seviyesi
   * @returns Cyberpunk temalı açıklama
   */
  private generateCyberpunkDescription(name: string, series: string, rarity: string): string {
    const descriptions = [
      `In the neon-drenched streets of 2077, the ${name} stands as a symbol of unmatched engineering excellence. This ${rarity.toLowerCase()} ${series} model cuts through the urban sprawl with precision and power, leaving nothing but awe in its wake.`,
      
      `Forged in the crucible of corporate warfare, this ${rarity.toLowerCase()} ${name} represents the pinnacle of cybernetic automotive design. Its quantum-enhanced engine roars through the megacity highways, defying both gravity and expectations.`,
      
      `The ${name}, a ${rarity.toLowerCase()} specimen of the legendary ${series} lineage, gleams under the artificial rain of Night City. Its chrome finish reflects the broken dreams of those who can only admire it from afar.`,
      
      `This ${rarity.toLowerCase()} ${name} is more than just transportation—it's a statement of power in a world where metal and flesh merge. Its neural interface system connects driver and machine in perfect harmony, creating an unbreakable bond.`,
      
      `Whispered about in underground racing circuits, the ${name} (${rarity}) has become mythical among speed enthusiasts. This ${series} masterpiece combines vintage aesthetics with bleeding-edge technology, creating an unforgettable driving experience.`
    ];
    
    // Rastgele bir açıklama seç
    const randomIndex = Math.floor(Math.random() * descriptions.length);
    return descriptions[randomIndex];
  }
  
  /**
   * NFT mint için ücretlendirmeyi hesaplar
   * @param rarity Nadirlik seviyesi
   * @returns Mint maliyeti (TON)
   */
  calculateMintCost(rarity: Rarity): number {
    // Çevre değişkenlerinden fiyatları al
    const costCommon = parseFloat(process.env.NEXT_PUBLIC_MINT_COST_COMMON || '0.15');
    const costRare = parseFloat(process.env.NEXT_PUBLIC_MINT_COST_RARE || '0.35');
    const costEpic = parseFloat(process.env.NEXT_PUBLIC_MINT_COST_EPIC || '0.85');
    const costLegendary = parseFloat(process.env.NEXT_PUBLIC_MINT_COST_LEGENDARY || '1.25');
    
    switch (rarity) {
      case Rarity.COMMON:
        return costCommon;
      case Rarity.RARE:
        return costRare;
      case Rarity.EPIC:
        return costEpic;
      case Rarity.LEGENDARY:
        return costLegendary;
      default:
        return costCommon; // Varsayılan olarak Common fiyatını kullan
    }
  }
  
  /**
   * String rarity değerini Rarity enum'a dönüştürür ve mint maliyetini hesaplar
   * @param rarityStr Nadirlik seviyesi (string)
   * @returns Mint maliyeti (TON)
   */
  calculateMintCostFromString(rarityStr: string): number {
    const rarity = stringToRarity(rarityStr);
    return this.calculateMintCost(rarity);
  }
  
  /**
   * TonConnect için işlem objesi oluşturur
   * @param address Hedef adres
   * @param amount TON miktarı
   * @param payload Payload (base64)
   * @returns TonConnect işlem nesnesi
   */
  createTonConnectTransaction(address: string, amount: number, payload?: string) {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 dakika geçerli
      messages: [
        {
          address: address || this.nftCollectionAddress,
          amount: (amount * 1e9).toString(), // TON miktarını nanotona çevirip string'e dönüştür
          payload: payload || ''
        }
      ]
    };
  }
  
  /**
   * Herhangi bir cüzdanın mint yetkisi olup olmadığını kontrol eder
   * @param walletAddress Kontrol edilecek cüzdan adresi
   * @returns Mint yetkisi olup olmadığı
   */
  async canMintNFT(walletAddress: string): Promise<boolean> {
    try {
      // Tüm cüzdanlara mint yetkisi veriyoruz
      return true;
      
      // İleride yetki kontrolü eklenebilir, örneğin:
      // const whitelist = ['adres1', 'adres2', ...];
      // return whitelist.includes(walletAddress);
    } catch (error) {
      console.error('Mint yetkisi kontrolünde hata:', error);
      return false;
    }
  }

  /**
   * Belirli bir rarity için kalan mint sayısını kontrol eder
   * @param rarity Nadir seviyesi
   * @returns Kalan mint sayısı
   */
  async getRemainingMints(rarity: Rarity): Promise<number> {
    try {
      // Rarity'ye göre maksimum mint sayıları
      const maxMints: {[key in Rarity]: number} = {
        [Rarity.COMMON]: 10000,
        [Rarity.RARE]: 5000,
        [Rarity.EPIC]: 2500,
        [Rarity.LEGENDARY]: 1000
      };
      
      // Rarity için varsayılan maksimum
      const defaultMax = 1000;
      
      // Koleksiyon adresinden mevcut mint sayısını al
      // (Gerçek uygulamada burada TON API çağrısı yapılarak mevcut mint sayısı alınabilir)
      const mintedCount = 0; // Şimdilik 0 olarak varsayalım
      
      // Kalan mint sayısını hesapla
      const maximum = maxMints[rarity] || defaultMax;
      const remaining = Math.max(0, maximum - mintedCount);
      
      return remaining;
    } catch (error) {
      console.error('Kalan mint sayısı kontrolünde hata:', error);
      return 0; // Hata durumunda 0 dön
    }
  }

  /**
   * NFT mint için gerekli parametreleri hazırlar
   */
  async prepareMintParams(carModel: any, walletAddress?: string): Promise<{
    mintCost: number;
    mintPayload: string;
    metadataUri: string;
    remainingMints: number;
  }> {
    try {
      // CarModel nesnesinde rarity kontrolü - string ise Enum'a dönüştür
      let modelRarity: Rarity;
      if (typeof carModel.rarity === 'string') {
        modelRarity = stringToRarity(carModel.rarity);
      } else if (carModel.rarity) {
        modelRarity = carModel.rarity;
      } else {
        modelRarity = Rarity.COMMON; // varsayılan değer
        console.warn('Rarity belirtilmedi, varsayılan Common kullanılıyor');
      }
      
      // modelId kontrolü - her zaman string olarak kullan
      const modelId = ensureModelIdString(carModel.modelId);
      
      // Mint maliyetini hesapla
      const mintCost = this.calculateMintCost(modelRarity);
      console.log(`Mint maliyeti hesaplandı: ${mintCost} TON (${carModel.name} - ${modelRarity})`);
      
      // Kalan mint sayısını kontrol et
      const remainingMints = await this.getRemainingMints(modelRarity);
      
      // Yeterli mint hakkı kalmadıysa hata fırlat
      if (remainingMints <= 0) {
        throw new Error(`Bu nadir seviyede (${modelRarity}) NFT oluşturma limitine ulaşıldı!`);
      }
      
      // Metadata hazırla ve yükle
      // Burada doğrudan URL oluşturuyoruz çünkü mintNFT fonksiyonu zaten görsel yüklemeyi yönetiyor
      // Eğer imageCid değeri zaten varsa, mintNFT fonksiyonu onu kullanacaktır
      let metadataUri = `ipfs://placeholder-${Date.now()}`;
      let mintPayload = '';
      
      // Eğer cüzdan adresi verilmişse, mint payload'ını da oluştur
      if (walletAddress) {
        // Metadata oluştur (metadata URI'si merkle ağacında saklanacak)
        // Metadata'yı inline base64 olarak değil, IPFS'te saklayacağız
        console.log('Mint payload hazırlanıyor...');
        
        // Metadata URI standart IPFS URI olarak ayarla (mintNFT sırasında güncellenecek)
        metadataUri = `ipfs://placeholder-metadata-${Date.now()}`;
        
        // Mint payload oluştur (Base64 formatında)
        let ownerAddress: Address | undefined = undefined;
        if (walletAddress) {
          try {
            ownerAddress = Address.parse(walletAddress);
          } catch (e) {
            console.warn('Geçersiz cüzdan adresi, NFT mint payload oluşturulamadı:', e);
          }
        }
        
        const payloadCell = createNftMintPayload(
          metadataUri,  // İçerik URI'si birinci parametre olmalı
          0, // queryId
          ownerAddress // Adres nesnesi veya undefined 
        );
        
        // Cell'i base64 formatına dönüştür
        mintPayload = payloadCell.toBoc().toString('base64');
        
        console.log('Mint payload oluşturuldu, mint parametreleri hazır');
      }
      
      return {
        mintCost,
        mintPayload,
        metadataUri,
        remainingMints
      };
    } catch (error) {
      console.error('Mint parametreleri hazırlanırken hata:', error);
      throw error;
    }
  }
  
  /**
   * NFT oluşturur (mint)
   * @param carModel Araba modeli
   * @param walletAddress Cüzdan adresi
   * @param imageCid Görsel IPFS CID (eğer daha önce yüklenmişse)
   * @returns İşlem bilgileri (txHash, başarı durumu)
   */
  async mintNFT(
    carModel: { name: string; modelId: string; series: string; rarity?: string; brand?: string },
    walletAddress: string,
    imageCid?: string
  ): Promise<{txHash: string, success: boolean, metadataUri: string}> {
    try {
      // Görsel yüklenmemişse, istemcide giriş resmi gerekli olacaktır
      if (!imageCid) {
        console.error('Görsel IPFS CID\'si sağlanmadı, mintNFT çağrısı yapılamaz!');
        throw new Error('NFT mint işlemi için görsel gereklidir');
      }
    
      // CarModel nesnesinde rarity kontrolü - string ise Enum'a dönüştür
      let modelRarity: Rarity;
      if (typeof carModel.rarity === 'string') {
        modelRarity = stringToRarity(carModel.rarity);
      } else if (carModel.rarity) {
        modelRarity = carModel.rarity;
      } else {
        modelRarity = Rarity.COMMON; // varsayılan değer
        console.warn('Rarity belirtilmedi, varsayılan Common kullanılıyor');
      }
      
      // modelId kontrolü - her zaman string olarak kullan
      const modelId = ensureModelIdString(carModel.modelId);

      // NFT mintleme maliyetini hesapla
      const mintCost = this.calculateMintCost(modelRarity);
      console.log(`NFT mint maliyeti: ${mintCost} TON (${carModel.name} - ${modelRarity})`);
      
      // Kalan mint sayısını kontrol et
      const remainingMints = await this.getRemainingMints(modelRarity);
      if (remainingMints <= 0) {
        throw new Error(`Bu nadir seviyede (${modelRarity}) NFT oluşturma limitine ulaşıldı!`);
      }

      // İsim ve açıklama oluştur
      const name = carModel.brand ? `${carModel.brand} ${carModel.name}` : `NMFP Racing ${carModel.name}`;
      const series = carModel.series || "Unknown Series";
      
      // Metadata IPFS'e yükle
      const metadataCid = await this.uploadMetadataToIPFS(
        name,
        `${name} - ${series} Series NFT`,
        series,
        modelRarity.toString(), // Rarity enum değerini string'e çevir
        imageCid
      );
      
      // Metadata URI oluştur
      const metadataUri = `ipfs://${metadataCid}`;
      
      // NFT Koleksiyon adresi
      const collectionAddress = Address.parse(this.nftCollectionAddress);
      
      // Kullanıcı cüzdan adresi
      const ownerAddress = Address.parse(walletAddress);
      
      // Mint operasyonunu NFT koleksiyonuna gönder
      // TEP-62 standardına uygun payload oluştur
      const payloadCell = createNftMintPayload(metadataUri, 0, ownerAddress);
      const payload = payloadCell.toBoc().toString('base64');
      
      // Gas limitini hesapla
      const gasLimit = estimateGasLimit('mint');
      
      // Örnek cüzdan açma (Gerçek uygulamada farklı yapılır)
      // Bu kısım normalde cüzdan sağlayıcı tarafından yönetilir - örnek amaçlıdır
      const wallet = await openWallet(
        this.tonClient,
        process.env.NFT_WALLET_MNEMONIC?.split(' ') || []
      );
      
      // NFT mint işlemi için TON gönder
      const { seqno, hash } = await sendTon(
        wallet,
        collectionAddress,
        mintCost.toString(),
        payload,
        gasLimit
      );
      
      // İşlem sonucunu kontrol et
      const success = await verifyTransaction(
        this.tonClient,
        hash,
        collectionAddress.toString(),
        10,
        2000
      );
      
      // İşlem bilgilerini döndür
      return {
        txHash: hash,
        success,
        metadataUri
      };
    } catch (error) {
      console.error('NFT mint hatası:', error);
      throw error; // Hatayı yukarı ilet
    }
  }
}

// Servisin tek bir örneğini oluştur ve dışa aktar
export const nftService = new NFTService(); 