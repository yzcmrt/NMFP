import { Address, beginCell, toNano } from '@ton/core';
import { ipfsService, NftMetadata } from './ipfsService';
import { CarModel, Rarity } from '@/types/car';
import { stringToRarity, modelIdToNumber } from '@/utils/typeConverters';

export class NFTService {
  private collectionAddress: string;

  constructor() {
    this.collectionAddress = process.env.NFT_COLLECTION_ADDRESS || 'EQCa7zKkBDpXH4pihhZg3_cj2R2RJC2eqvWsU-RtpxzcY-EP';
  }

  /**
   * NFT mint maliyetini rarity'ye göre hesaplar
   * @param rarity Nadir seviye
   * @returns Mint maliyeti (TON)
   */
  calculateMintCost(rarity: Rarity): number {
    switch (rarity) {
      case Rarity.COMMON:
        return 1; // 1 TON
      case Rarity.RARE:
        return 3; // 3 TON
      case Rarity.EPIC:
        return 7; // 7 TON
      case Rarity.LEGENDARY:
        return 15; // 15 TON
      default:
        return 2; // Varsayılan
    }
  }

  /**
   * String rarity değerini Rarity enum'a dönüştürür ve mint maliyetini hesaplar
   * @param rarityStr Nadir seviye (string)
   * @returns Mint maliyeti (TON)
   */
  calculateMintCostFromString(rarityStr: string): number {
    const rarity = stringToRarity(rarityStr);
    return this.calculateMintCost(rarity);
  }

  /**
   * Araba modeli için NFT metadata'sını oluşturur
   * @param model Araba modeli
   * @returns NFT Metadata
   */
  createMetadata(model: CarModel): NftMetadata {
    return {
      name: `${model.brand || 'Bilinmeyen Marka'} ${model.name}`,
      description: `${model.brand || 'Bilinmeyen Marka'} ${model.name} - ${model.rarity} nadir seviyesi araç, Mining Gücü: ${model.miningPower} NMFP/saat`,
      image: model.image || 'https://example.com/default-car-image.jpg',
      attributes: [
        { trait_type: "Marka", value: model.brand || 'Bilinmeyen Marka' },
        { trait_type: "Seri", value: model.series },
        { trait_type: "Model", value: model.name },
        { trait_type: "Nadir Seviye", value: model.rarity },
        { trait_type: "Mining Gücü", value: model.miningPower.toString() },
        { trait_type: "NFT Limit", value: model.nftLimit.toString() }
      ]
    };
  }

  /**
   * IPFS'e metadata yükler ve NFT mint için gerekli parametreleri hazırlar
   * @param model Araba modeli
   * @param ownerAddress Sahip adresi
   * @returns {Promise<{mintCost: number, payload: string, metadataUri: string}>}
   */
  async prepareMintParams(model: CarModel, ownerAddress: string): Promise<{
    mintCost: number;
    payload: string;
    metadataUri: string;
  }> {
    // 1. Mint maliyetini hesapla - model.rarity artık Rarity enum tipinde
    const mintCost = this.calculateMintCost(model.rarity);
    
    // 2. Metadata oluştur
    const metadata = this.createMetadata(model);
    
    // 3. Metadata'yı IPFS'e yükle
    const metadataCid = await ipfsService.uploadMetadata(metadata);
    const metadataUri = ipfsService.getIpfsUri(metadataCid);
    
    // 4. Mint için payload oluştur - modelId'yi number'a çevir
    const modelIdNumber = modelIdToNumber(model.modelId);
    const mintPayload = this.createMintPayload(
      modelIdNumber,
      ownerAddress,
      metadataUri,
      mintCost
    );
    
    return {
      mintCost,
      payload: mintPayload,
      metadataUri
    };
  }

  /**
   * NFT Mint için payload oluşturur (TEP-62 uyumlu)
   * @param itemIndex Öğe indeksi
   * @param ownerAddress Sahip adresi
   * @param contentUri İçerik URI'si (IPFS)
   * @param mintCost Mint maliyeti
   * @returns Base64 kodlanmış payload
   */
  createMintPayload(
    itemIndex: number,
    ownerAddress: string,
    contentUri: string,
    mintCost: number
  ): string {
    try {
      // Sahip adresini Address türüne dönüştür
      let ownerAddr: Address;
      try {
        ownerAddr = Address.parse(ownerAddress);
      } catch (e) {
        console.error('Adres ayrıştırma hatası:', e);
        throw new Error('Geçersiz sahip adresi');
      }
      
      // NFT Mint için payload oluştur (TEP-62 standardına uygun)
      const mintBody = beginCell()
        .storeUint(1, 32) // op code for mint = 1
        .storeUint(0, 64) // query_id
        .storeUint(itemIndex, 64) // item_index
        .storeCoins(toNano(mintCost.toString())) // amount
        .storeRef(
          beginCell()
            .storeAddress(ownerAddr)
            .storeRef(
              beginCell()
                .storeBuffer(Buffer.from(contentUri))
                .endCell()
            )
            .endCell()
        )
        .endCell();
      
      // Base64 formatına dönüştür
      return mintBody.toBoc().toString('base64');
    } catch (error) {
      console.error('Mint payload oluşturma hatası:', error);
      throw error;
    }
  }

  /**
   * TonConnect için işlem parametrelerini hazırlar
   * @param payload Mint payload'ı
   * @param mintCost Mint maliyeti
   * @returns TonConnect transaction parametreleri
   */
  createTonConnectTransaction(payload: string, mintCost: number) {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 60 * 20, // 20 dakika geçerli
      messages: [
        {
          address: this.collectionAddress,
          amount: (mintCost * 1e9).toString(), // TON miktarını nano cinsinden string'e dönüştür
          payload: payload
        }
      ]
    };
  }
}

// Singleton instance
export const nftService = new NFTService(); 