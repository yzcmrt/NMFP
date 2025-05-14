import { Rarity } from "@/types";

/**
 * String 'rarity' değerini Rarity enum değerine dönüştürür
 * @param rarityStr Rarity değeri string olarak ('Common', 'Rare', 'Epic', 'Legendary')
 * @returns Rarity enum değeri
 */
export function stringToRarity(rarityStr: string): Rarity | undefined {
  // String değeri büyük/küçük harf duyarsız hale getir
  const normalizedStr = rarityStr.toLowerCase();
  
  if (normalizedStr === 'common') return Rarity.COMMON;
  if (normalizedStr === 'rare') return Rarity.RARE;
  if (normalizedStr === 'epic') return Rarity.EPIC;
  if (normalizedStr === 'legendary') return Rarity.LEGENDARY;
  
  // Eşleşme bulunamazsa varsayılan değer
  console.warn(`Bilinmeyen rarity değeri: "${rarityStr}", Common olarak varsayılıyor`);
  return undefined;
}

/**
 * Model ID'sini string'den number'a dönüştürür (eğer mümkünse)
 * @param modelId Model ID string değeri
 * @returns number olarak Model ID veya NaN (dönüşüm başarısız olursa)
 */
export function modelIdToNumber(modelId: string): number {
  const parsed = parseInt(modelId, 10);
  if (isNaN(parsed)) {
    console.warn(`modelId string değeri "${modelId}" sayıya dönüştürülemedi`);
  }
  return parsed;
}

/**
 * Tip güvenliği için model ID'sini her zaman string olarak döndürür
 * @param modelId Model ID (string veya number olabilir)
 * @returns String olarak Model ID
 */
export function ensureModelIdString(modelId: string | number): string {
  return modelId.toString();
} 