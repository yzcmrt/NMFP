// Browser tarafında fs modülü sorununu çözmek için Pinata SDK'yı koşullu import ediyoruz
// Client tarafında çalışırken HTTP API kullanacağız, sunucu tarafında ise SDK kullanacağız
let pinataSDK: any = null;

// Sadece sunucu tarafında import et
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PinataSDK = require('@pinata/sdk');
  pinataSDK = PinataSDK;
}

export type NftMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
};

class IPFSService {
  private pinata: any;
  private gateway: string;
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataJWT: string;

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.PINATA_API_SECRET || '';
    this.pinataJWT = process.env.PINATA_JWT || '';
    this.gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ivory-calm-vicuna-368.mypinata.cloud';
    
    // Sunucu tarafında çalışırken SDK'yı başlat
    if (typeof window === 'undefined' && pinataSDK) {
      this.pinata = new pinataSDK({
        pinataApiKey: this.pinataApiKey,
        pinataSecretApiKey: this.pinataSecretKey,
      });
    }
  }

  /**
   * Metadatayı IPFS'e yükler
   * @param metadata NFT metadata bilgileri
   * @returns IPFS CID (Content Identifier)
   */
  async uploadMetadata(metadata: NftMetadata): Promise<string> {
    try {
      console.log("IPFS'e metadata yükleniyor:", metadata);
      
      // Unique bir isim oluştur (timestamp kullanma)
      const cleanName = metadata.name
        .replace(/^(Porsche|NMFP)\s+/g, '') // Ön ekleri kaldır
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase();
      
      const metadataName = `metadata_${cleanName}`;
      
      // Metadata JSON dosyasını oluştur
      const metadataJSON = JSON.stringify(metadata);
      
      // İstemci tarafında çalışırken, HTTP API kullan
      if (typeof window !== 'undefined') {
        const response = await fetch('/api/ipfs/upload-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            metadata,
            fileName: metadataName // Standart dosya adını geçir
          })
        });
        
        if (!response.ok) {
          throw new Error(`Metadata yükleme hatası: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Metadata IPFS'e yüklendi, CID:", data.ipfsHash);
        return data.ipfsHash;
      }
      // Sunucu tarafında çalışırken, SDK kullan
      else if (this.pinata) {
        // Pinata'ya yükle
        const response = await this.pinata.pinJSONToIPFS(metadata, {
          pinataMetadata: {
            name: metadataName, // Timestamp kullanmak yerine standart isim
          },
        });
        
        console.log("Metadata IPFS'e yüklendi, CID:", response.IpfsHash);
        return response.IpfsHash;
      } else {
        throw new Error('Pinata SDK başlatılamadı');
      }
    } catch (error) {
      console.error("IPFS metadata yükleme hatası:", error);
      throw error;
    }
  }

  /**
   * Görsel dosyasını IPFS'e yükler
   * @param imageFile Görsel dosyası (File nesnesi)
   * @param modelIdentifier Benzersiz model tanımlayıcısı
   * @returns IPFS CID (Content Identifier)
   */
  async uploadImage(imageFile: File, modelIdentifier?: string): Promise<string> {
    try {
      console.log("IPFS'e görsel yükleniyor:", imageFile.name);
      
      // Standart bir isim oluştur
      let cleanFileName = imageFile.name;
      
      if (modelIdentifier) {
        // Model tanımlayıcısından standart bir görsel adı oluştur
        cleanFileName = `car_${modelIdentifier.toLowerCase().replace(/\s+/g, '_')}.jpg`;
      }
      
      // İstemci tarafında çalışırken, /api/ipfs/upload-image endpoint'ini kullan
      if (typeof window !== 'undefined') {
        // FormData oluştur
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('fileName', cleanFileName); // Standart dosya adını geçir
        
        const response = await fetch('/api/ipfs/upload-image', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Görsel yükleme hatası: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Görsel IPFS'e yüklendi, CID:", data.ipfsHash);
        return data.ipfsHash;
      }
      // Sunucu tarafında File nesnesi için implementasyon gerekiyor
      // Bu gerçekte kullanılmayacak, çünkü bu fonksiyon client-side'dan çağrılacak
      else {
        throw new Error('Server-side uploadImage desteklenmiyor, lütfen /api/ipfs/upload-image endpoint kullanın');
      }
    } catch (error) {
      console.error("IPFS görsel yükleme hatası:", error);
      throw error;
    }
  }

  /**
   * IPFS CID'sinden gateway URL'i oluşturur
   * @param cid IPFS CID
   * @returns Gateway URL'i
   */
  getGatewayUrl(cid: string): string {
    return `https://${this.gateway}/ipfs/${cid}`;
  }

  /**
   * IPFS URL'inden tam URI oluşturur
   * @param cid IPFS CID
   * @returns IPFS URI
   */
  getIpfsUri(cid: string): string {
    return `ipfs://${cid}`;
  }
}

// Singleton instance
export const ipfsService = new IPFSService(); 