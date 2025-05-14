import {
  Address,
  beginCell,
  Cell,
  toNano,
  fromNano,
  internal,
  SendMode,
  ContractProvider
} from "@ton/core";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import type { KeyPair } from "@ton/crypto";

export type OpenedWallet = {
  contract: WalletContractV4;
  keyPair: KeyPair;
};

/**
 * Mnemonic ifadeden cüzdan açar
 * @param client TonClient örneği
 * @param mnemonic Mnemonic kelimeler (24 kelime)
 * @returns Açılmış cüzdan bilgileri
 */
export async function openWallet(
  client: TonClient,
  mnemonic: string[]
): Promise<OpenedWallet> {
  // Mnemonic'ten keyPair oluştur
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  
  // Cüzdan sözleşmesi oluştur
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });
  
  // Açılmış cüzdan bilgilerini döndür
  return {
    contract: wallet,
    keyPair,
  };
}

/**
 * Cüzdanın TON bakiyesini alır
 * @param client TonClient örneği
 * @param address Cüzdan adresi
 * @returns TON bakiyesi, nano biriminden
 */
export async function getWalletBalance(
  client: TonClient,
  address: Address
): Promise<bigint> {
  try {
    const balance = await client.getBalance(address);
    return BigInt(balance);
  } catch (error) {
    console.error('Bakiye çekme hatası:', error);
    return BigInt(0);
  }
}

/**
 * TON miktarını insan tarafından okunabilir formata dönüştürür
 * @param amount TON miktarı (nano biriminde)
 * @returns İnsan tarafından okunabilir TON miktarı
 */
export function formatTonAmount(amount: bigint): string {
  return fromNano(amount);
}

/**
 * NFT için JSON metadata formatı
 */
export type NftMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
};

/**
 * NFT mint işlemi için TEP-62 standardına uygun payload oluşturur
 * @param contentUri İçerik URI'si (IPFS URI)
 * @param queryId İşlem sorgu ID'si (isteğe bağlı, varsayılan: 0)
 * @param ownerAddress NFT sahibi olacak adres (isteğe bağlı)
 * @returns Cell - TON Cell nesnesi
 */
export function createNftMintPayload(
  contentUri: string,
  queryId: number = 0,
  ownerAddress?: Address
): Cell {
  // Content referans hücresi
  const contentCell = beginCell()
    .storeBuffer(Buffer.from(contentUri))
    .endCell();
  
  // Sahip adresi içeren hücre (eğer verilmişse)
  const ownerCell = ownerAddress 
    ? beginCell().storeAddress(ownerAddress).endCell() 
    : beginCell().endCell();
  
  // TEP-62 standardına göre mint işlemi payload'ı
  const payload = beginCell()
    .storeUint(1, 32)  // op = 1: NFT Mint işlemi
    .storeUint(queryId, 64) // query_id
    .storeRef(ownerCell)    // owner_address hücresi
    .storeRef(contentCell)  // content referansı
    .endCell();
  
  return payload;
}

/**
 * NFT metadata'sını oluşturur ve NFT işlemleri için gerekli verileri döndürür
 * @param model NFT metadata modeli
 * @returns Metadata URL
 */
export const createMetadataJson = async (model: any): Promise<{ url: string }> => {
  try {
    console.log('createMetadataJson için gelen model:', model);
    
    // Temel NFT metadata yapısını oluştur
    const metadata = {
      name: model.name,
      description: model.description,
      image: model.image,
      attributes: model.attributes || []
    };
    
    // JSON formatına dönüştür
    const jsonString = JSON.stringify(metadata);
    console.log('Oluşturulan JSON metadata:', jsonString);
    
    // Base64 encoding
    const base64Data = btoa(jsonString);
    
    // Data URI formatında döndür
    const dataUri = `data:application/json;base64,${base64Data}`;
    console.log('Final metadata URI:', dataUri);
    
    return { url: dataUri };
  } catch (error) {
    console.error('Metadata oluşturma hatası:', error);
    throw new Error(`Metadata oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
};

/**
 * NFT Royalty bilgileri
 */
export type RoyaltyParams = {
  royaltyFactor: number; // 0-1000 arasında, 1000 = %100
  royaltyBase: number; // Genellikle 1000
  royaltyAddress: Address; // Royalty ödemelerinin alıcısı
};

/**
 * Royalty bilgilerini içeren Cell oluşturur
 * @param params Royalty parametreleri
 * @returns Royalty Cell'i
 */
export function createRoyaltyCell(params: RoyaltyParams): Cell {
  return beginCell()
    .storeUint(params.royaltyFactor, 16)
    .storeUint(params.royaltyBase, 16)
    .storeAddress(params.royaltyAddress)
    .endCell();
}

/**
 * İşlem sonucunu kontrol eder ve başarı durumunu doğrular
 * @param client TonClient örneği
 * @param txHash İşlem hash'i
 * @param address İşlemin kaynağı olan adres
 * @param maxAttempts Maksimum kontrol sayısı
 * @param retryDelay Kontroller arası bekleme süresi (ms)
 * @returns İşlem başarılı mı?
 */
export async function verifyTransaction(
  client: TonClient,
  txHash: string,
  address: string,
  maxAttempts: number = 10,
  retryDelay: number = 2000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // İşlem sonucunu kontrol et
      const transactions = await client.getTransactions(Address.parse(address), {
        limit: 10
      });
      
      // İşlemleri hash'e göre filtrele
      const matchingTx = transactions.find(tx => tx.hash.toString() === txHash);
      
      if (matchingTx) {
        console.log('İşlem doğrulandı:', txHash);
        return true;
      }
      
      console.log(`İşlem kontrolü (${attempt + 1}/${maxAttempts}): Henüz işlem bulunamadı`);
      
      // Bekle ve tekrar dene
      await sleep(retryDelay);
    } catch (error) {
      console.warn(`İşlem kontrol hatası (${attempt + 1}/${maxAttempts}):`, error);
      // Bekle ve tekrar dene
      await sleep(retryDelay);
    }
  }
  
  // Maksimum deneme sayısına ulaşıldı, işlem doğrulanamadı
  console.error('İşlem doğrulanamadı:', txHash);
  return false;
}

/**
 * Gas hesaplamaları için yardımcı fonksiyon
 * @param operationType İşlem tipi (mint, transfer, vb.)
 * @returns Tahmini gas limiti (TON)
 */
export function estimateGasLimit(operationType: 'mint' | 'transfer' | 'other'): string {
  switch (operationType) {
    case 'mint':
      return '0.06'; // NFT mint için yaklaşık değer
    case 'transfer':
      return '0.03'; // Transfer için yaklaşık değer
    default:
      return '0.02'; // Varsayılan değer
  }
}

/**
 * TON gönderimi için yardımcı fonksiyon (Güncellenmiş)
 * @param wallet Açılmış cüzdan
 * @param to Alıcı adresi
 * @param amount Gönderilecek miktar (TON)
 * @param payload Payload hücresi veya base64 string
 * @param gasLimit Gas limiti (TON)
 * @returns Seqno değeri ve işlem hash'i
 */
export async function sendTon(
  wallet: OpenedWallet,
  to: Address,
  amount: string,
  payload?: Cell | string,
  gasLimit?: string
): Promise<{seqno: number, hash: string}> {
  try {
    // TonClient oluştur
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });
    
    // Seqno al - doğrudan WalletContractV4 getSeqno metodunu kullan
    const seqno = await wallet.contract.getSeqno(client as unknown as ContractProvider);
    
    // Payload'ı hazırla
    let messageBody: Cell | null = null;
    if (payload) {
      if (typeof payload === 'string') {
        // Base64 formatında payload string ise
        messageBody = Cell.fromBoc(Buffer.from(payload, 'base64'))[0];
      } else {
        // Cell nesnesi ise
        messageBody = payload;
      }
    }
    
    // İşlemi gönder
    await wallet.contract.sendTransfer(client as unknown as ContractProvider, {
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: toNano(amount),
          to,
          bounce: true, // Başarısız işlem durumunda TON'ları geri al
          body: messageBody,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });
    
    // İşlem hash'i için geçici bir değer oluştur
    const hash = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Seqno ve hash değerlerini döndür
    return { seqno, hash };
  } catch (error) {
    console.error("SendTon hatası:", error);
    throw error;
  }
}

/**
 * Bir seqno değişimini bekler (işlem tamamlanma kontrolü için)
 * @param seqno Başlangıç seqno değeri
 * @param wallet Açılmış cüzdan
 */
export async function waitSeqno(seqno: number, wallet: OpenedWallet) {
  try {
    // TonClient oluştur
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });
        
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(2000);
      const seqnoAfter = await wallet.contract.getSeqno(client as unknown as ContractProvider);
      if (seqnoAfter > seqno) break;
    }
  } catch (error) {
    console.error("WaitSeqno hatası:", error);
  }
}

/**
 * Belirtilen süre kadar bekler
 * @param ms Milisaniye cinsinden bekleme süresi
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bufferi parçalara ayırır
 * @param buff Buffer verisi
 * @param chunkSize Parça boyutu
 * @returns Parçalanmış buffer dizisi
 */
export function bufferToChunks(buff: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  let currentBuffer = Buffer.from(buff);
  
  while (currentBuffer.byteLength > 0) {
    chunks.push(currentBuffer.subarray(0, chunkSize));
    currentBuffer = currentBuffer.subarray(chunkSize);
  }
  return chunks;
}

/**
 * Yılan formatında Cell oluşturur (büyük veriler için)
 * @param data Buffer verisi
 * @returns Cell
 */
export function makeSnakeCell(data: Buffer): Cell {
  const chunks = bufferToChunks(data, 127);

  if (chunks.length === 0) {
    return beginCell().endCell();
  }

  if (chunks.length === 1) {
    return beginCell().storeBuffer(chunks[0]).endCell();
  }

  let curCell = beginCell();

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];

    curCell.storeBuffer(chunk);

    if (i - 1 >= 0) {
      const nextCell = beginCell();
      nextCell.storeRef(curCell);
      curCell = nextCell;
    }
  }

  return curCell.endCell();
}

/**
 * Off-chain içeriği kodlar
 * @param content İçerik metni
 * @returns Cell
 */
export function encodeOffChainContent(content: string): Cell {
  let data = Buffer.from(content);
  const offChainPrefix = Buffer.from([0x01]);
  data = Buffer.concat([offChainPrefix, data]);
  return makeSnakeCell(data);
} 