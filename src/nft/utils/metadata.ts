import pinataSDK from "@pinata/sdk";
import { readdirSync } from "fs";
import { writeFile, readFile } from "fs/promises";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Bir klasördeki tüm dosyaları IPFS'e yükler
 * @param folderPath Yüklenecek klasör yolu
 * @returns IPFS hash değeri
 */
export async function uploadFolderToIPFS(folderPath: string): Promise<string> {
  try {
    const pinata = new pinataSDK({
      pinataApiKey: process.env.PINATA_API_KEY,
      pinataSecretApiKey: process.env.PINATA_API_SECRET,
    });

    const response = await pinata.pinFromFS(folderPath);
    return response.IpfsHash;
  } catch (error) {
    console.error("IPFS yükleme hatası:", error);
    throw error;
  }
}

/**
 * Metadata dosyalarını IPFS hash ile günceller
 * @param metadataFolderPath Metadata klasör yolu
 * @param imagesIpfsHash Görsellerin IPFS hash değeri
 */
export async function updateMetadataFiles(metadataFolderPath: string, imagesIpfsHash: string): Promise<void> {
  try {
    const files = readdirSync(metadataFolderPath).filter(file => file.endsWith('.json') && file !== 'collection.json');
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud';

    await Promise.all(files.map(async (filename, index) => {
      const filePath = path.join(metadataFolderPath, filename);
      const fileContent = await readFile(filePath, 'utf8');
      
      const metadata = JSON.parse(fileContent);
      
      // Dosya adından model kimliğini çıkar (örn: 718_cayman.json -> 718_cayman)
      const modelId = filename.replace('.json', '');
      
      // Modelın bulunduğu seriyi bul (örn: 718_cayman -> 718)
      const series = modelId.split('_')[0];
      
      // Görsel yolunu ayarla
      metadata.image = `ipfs://${imagesIpfsHash}/${series}/${modelId.replace(/_/g, '-')}.jpg`;
      
      await writeFile(filePath, JSON.stringify(metadata, null, 2));
    }));
  } catch (error) {
    console.error("Metadata güncelleme hatası:", error);
    throw error;
  }
}

/**
 * Koleksiyon metadata dosyasını IPFS hash ile günceller
 * @param collectionFilePath Koleksiyon metadata dosya yolu
 * @param imagesIpfsHash Görsellerin IPFS hash değeri
 */
export async function updateCollectionMetadata(collectionFilePath: string, imagesIpfsHash: string): Promise<void> {
  try {
    const fileContent = await readFile(collectionFilePath, 'utf8');
    const metadata = JSON.parse(fileContent);
    
    // Koleksiyon logosu için görsel ata
    metadata.image = `ipfs://${imagesIpfsHash}/logo.jpg`;
    
    await writeFile(collectionFilePath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error("Koleksiyon metadata güncelleme hatası:", error);
    throw error;
  }
}

/**
 * Tüm araç modellerinin NFT metadata dosyalarını oluşturur
 * @param metadataFolderPath Metadata klasör yolu
 * @param carModels Araç modelleri
 */
export async function generateNftMetadataFiles(metadataFolderPath: string, carModels: any[]): Promise<void> {
  try {
    for (const model of carModels) {
      const metadata = {
        name: model.name,
        description: `${model.brand} ${model.name}, ${model.rarity} nadir seviyesinde, ${model.nftLimit.toLocaleString()} adet limitli üretim`,
        attributes: [
          { "trait_type": "Marka", "value": model.brand },
          { "trait_type": "Seri", "value": model.series },
          { "trait_type": "Model", "value": model.name.replace(`${model.series} `, '') },
          { "trait_type": "Nadir Seviye", "value": model.rarity },
          { "trait_type": "Mining Gücü", "value": model.miningPower.toString() },
          { "trait_type": "NFT Limit", "value": model.nftLimit.toString() }
        ]
      };
      
      const filename = `${model.modelId}.json`;
      const filePath = path.join(metadataFolderPath, filename);
      
      await writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
  } catch (error) {
    console.error("Metadata dosyası oluşturma hatası:", error);
    throw error;
  }
}

/**
 * Koleksiyon metadata dosyasını oluşturur
 * @param metadataFolderPath Metadata klasör yolu
 * @param collectionName Koleksiyon adı
 * @param collectionDescription Koleksiyon açıklaması
 * @param socialLinks Sosyal medya linkleri 
 */
export async function generateCollectionMetadata(
  metadataFolderPath: string, 
  collectionName: string, 
  collectionDescription: string, 
  socialLinks: string[] = []
): Promise<void> {
  try {
    const metadata = {
      name: collectionName,
      description: collectionDescription,
      social_links: socialLinks
    };
    
    const filePath = path.join(metadataFolderPath, 'collection.json');
    await writeFile(filePath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error("Koleksiyon metadata oluşturma hatası:", error);
    throw error;
  }
} 