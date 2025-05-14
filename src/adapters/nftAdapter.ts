import { CarModel, Rarity } from '@/types/car';
import { stringToRarity, ensureModelIdString } from '@/utils/typeConverters';

/**
 * Backend'den gelen NFT ile ilgili verileri frontend için dönüştüren adaptör modülü
 */

/**
 * Backend'den gelen araba modeli nesnesini frontend için dönüştürür
 * @param backendModel Backend'den gelen model verisi
 * @returns Frontend için dönüştürülmüş CarModel
 */
export function adaptCarModelFromBackend(backendModel: any): CarModel {
  // Rarity kontrolü
  let rarity: Rarity;
  if (typeof backendModel.rarity === 'string') {
    rarity = stringToRarity(backendModel.rarity);
  } else if (backendModel.rarity === undefined) {
    console.warn('Backend model verisinde rarity yok, Common kullanılıyor');
    rarity = Rarity.COMMON;
  } else {
    rarity = backendModel.rarity;
  }
  
  return {
    modelId: ensureModelIdString(backendModel.modelId),
    name: backendModel.name || 'Bilinmeyen Model',
    brand: backendModel.brand || 'NMFP',
    series: backendModel.series || 'NMFP Series',
    rarity: rarity,
    description: backendModel.description,
    image: backendModel.image || backendModel.imageUrl || '',
    imageUrl: backendModel.imageUrl || backendModel.image || '',
    miningPower: Number(backendModel.miningPower) || 0,
    nftLimit: Number(backendModel.nftLimit) || 0
  };
}

/**
 * Frontend CarModel nesnesini backend için API formatına dönüştürür
 * @param model Frontend CarModel nesnesi
 * @returns Backend API formatında model
 */
export function adaptCarModelForBackend(model: CarModel): any {
  return {
    modelId: ensureModelIdString(model.modelId),
    name: model.name,
    brand: model.brand,
    series: model.series,
    rarity: model.rarity.toString(),  // Backend için string olarak gönder
    description: model.description || '',
    image: model.image,
    miningPower: model.miningPower,
    nftLimit: model.nftLimit
  };
}

/**
 * NFT Mint parametrelerini backend için dönüştürür
 * @param mintParams Mint parametreleri
 * @returns Backend için dönüştürülmüş mint parametreleri
 */
export function adaptMintParamsForBackend(mintParams: any): any {
  return {
    modelId: ensureModelIdString(mintParams.modelId),
    walletAddress: mintParams.walletAddress,
    mintCost: Number(mintParams.mintCost) || 0,
    metadataUri: mintParams.metadataUri || '',
    mintPayload: mintParams.mintPayload || ''
  };
}

/**
 * TON değerlerini nano TON'a dönüştürür
 * @param tonAmount TON miktarı (örn: 1.5)
 * @returns Nano TON miktarı (string olarak)
 */
export function convertToNanoTon(tonAmount: number): string {
  return (tonAmount * 1e9).toString();
}

/**
 * Nano TON değerlerini normal TON'a dönüştürür
 * @param nanoTonAmount Nano TON miktarı (string veya number olabilir)
 * @returns TON miktarı (number)
 */
export function convertFromNanoTon(nanoTonAmount: string | number): number {
  const amount = typeof nanoTonAmount === 'string' ? 
    parseFloat(nanoTonAmount) : nanoTonAmount;
  return amount / 1e9;
} 