import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  StateInit,
  toNano,
  internal
} from '@ton/core';
import { NftItem, NftItemData } from './NftItem';
import { encodeOffChainContent, OpenedWallet, RoyaltyParams, createRoyaltyCell, openWallet, sleep, sendTon, waitSeqno } from "../utils/helpers";
import {
  TonClient,
  WalletContractV4,
} from "@ton/ton";

/**
 * NFT Koleksiyonu verilerinin yapısı
 */
export type NftCollectionData = {
  ownerAddress: Address;
  nextItemIndex: number;
  collectionContent: string;
  commonContent: string;
  nftItemCode: Cell;
  royaltyParams: {
    royaltyFactor: number;
    royaltyBase: number;
    royaltyAddress: Address;
  };
};

export type CollectionData = {
  ownerAddress: Address;
  royaltyPercent: number;
  royaltyAddress: Address;
  nextItemIndex: number;
  collectionContentUrl: string;
  commonContentUrl: string;
}

export type MintParams = {
  queryId: number | null,
  itemOwnerAddress: Address,
  itemIndex: number,
  amount: bigint,
  commonContentUrl: string
}

/**
 * NFT Koleksiyonu sözleşmesi için sınıf
 */
export class NftCollection implements Contract {
  static readonly CODE = Cell.fromBase64('te6cckECDQEAAdAAART/APSkE/S88sgLAQIBYgIDAgLMBAUCASAGBwIBSAgJAHWp+EJTMnB6qQZq+VMCUTLHBfLhkYDgJPkBIILwRZpWEZJwep0yl1YzlBB6qQTJRgOJwHCRf+AgghDI7QGjuo8CMdMfAYIQyO0Bo7ry4IHSAAGOGPQAYfpAIfpCVDRY+gAwVGVY+gAw+gAwECRulTBZ9FkwmMgBzwDJAczJ7VQCggiPHXTIIHL7AoEBACIBXLry9PhaVFRR+EG68vQi+gAx+gAwE6BUKscF8vSBP1hUNX+RcOKAECQQV4Eob+uCAA2u1E0NQB+GPSAAGOQPpAASDXSYEBAdcAgQEB1wBxJIEBAdcA8vQB1DAQNhDicQGBAdcA8vRVEvQB1DAQNhDiKAEBAdcA8vTe1QH6QAEg10mBAQHXAIEBAdcAcSSBAQHXAPL0AdQwEDYQ4hAFiAHXAHBVIG1tbds8cXBwcICABrjJfwHKAFWgVZBwgBzJcYAcwZQBoSBUKAHKAs4C+QFVsFYQbYEAkgM5J8JBEIEBAYAgEJCgsAYBGRwMCACAdJVA5EPdXBB9JbEZ5NfiUCCWJhcqATAFGOLfgjDAGLfgEgEScAqrpOEa6T');

  private collectionData?: CollectionData;

  constructor(
    readonly collectionAddress: Address,
    readonly init?: { code: Cell; data: Cell },
    collectionData?: CollectionData
  ) {
    if (collectionData) {
      this.collectionData = collectionData;
    }
  }

  /**
   * NFT Koleksiyonu sözleşmesi için kod hücresi oluşturur
   * @returns Kod hücresi
   */
  static createCodeCell(): Cell {
    return NftCollection.CODE;
  }

  /**
   * NFT Koleksiyonu için içerik hücresi oluşturur
   * @param collectionContent Koleksiyon meta verileri için URI
   * @param commonContent Tüm NFT'ler için ortak URI öneki
   * @returns İçerik hücresi
   */
  static createContentCell(collectionContent: string, commonContent: string): Cell {
    return beginCell()
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(collectionContent))
          .endCell()
      )
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(commonContent))
          .endCell()
      )
      .endCell();
  }

  /**
   * NFT Koleksiyonu için telif hakkı hücresi oluşturur
   * @param royaltyParams Telif hakkı parametreleri
   * @returns Telif hakkı hücresi
   */
  static createRoyaltyCell(royaltyParams: {
    royaltyFactor: number;
    royaltyBase: number;
    royaltyAddress: Address;
  }): Cell {
    return beginCell()
      .storeUint(royaltyParams.royaltyFactor, 16)
      .storeUint(royaltyParams.royaltyBase, 16)
      .storeAddress(royaltyParams.royaltyAddress)
      .endCell();
  }

  /**
   * NFT Koleksiyonu veri hücresi oluşturur
   * @param data Koleksiyon verileri
   * @returns Veri hücresi
   */
  static createDataCell(data: NftCollectionData): Cell {
    const contentCell = NftCollection.createContentCell(
      data.collectionContent,
      data.commonContent
    );
    
    const royaltyCell = NftCollection.createRoyaltyCell(data.royaltyParams);
    
    return beginCell()
      .storeAddress(data.ownerAddress)
      .storeUint(data.nextItemIndex, 64)
      .storeRef(contentCell)
      .storeRef(data.nftItemCode)
      .storeRef(royaltyCell)
      .endCell();
  }

  /**
   * NFT Koleksiyonu için state init oluşturur
   * @param data Koleksiyon verileri
   * @returns State init objesi
   */
  static createStateInit(data: NftCollectionData): { code: Cell; data: Cell } {
    const code = NftCollection.createCodeCell();
    const dataCell = NftCollection.createDataCell(data);
    return { code, data: dataCell };
  }

  /**
   * Verilen verilerle koleksiyon adresi oluşturur
   * @param data Koleksiyon verileri
   * @param workchain Workchain ID (varsayılan 0)
   * @returns Koleksiyon adresi
   */
  static createAddress(data: NftCollectionData, workchain = 0): Address {
    const stateInit = NftCollection.createStateInit(data);
    return contractAddress(workchain, stateInit);
  }

  /**
   * Yeni bir NFT Koleksiyonu örneği oluşturur
   * @param data Koleksiyon verileri
   * @param workchain Workchain ID (varsayılan 0)
   * @returns NftCollection örneği
   */
  static create(data: NftCollectionData, workchain = 0): NftCollection {
    const stateInit = NftCollection.createStateInit(data);
    const address = contractAddress(workchain, stateInit);
    return new NftCollection(address, stateInit);
  }

  /**
   * NFT koleksiyon verilerini alır
   * @param provider ContractProvider örneği
   * @returns Koleksiyon verileri
   */
  async getData(provider: ContractProvider): Promise<{
    ownerAddress: Address;
    nextItemIndex: number;
    collectionContent: string;
    commonContent: string;
  }> {
    const { stack } = await provider.get("get_collection_data", []);
    
    const nextItemIndex = stack.readNumber();
    const slice = stack.readCell().beginParse();
    const collectionContent = slice.loadBuffer(slice.remainingBits / 8).toString();
    const ownerAddress = stack.readAddress();
    
    const { stack: contentStack } = await provider.get("get_common_content", []);
    const contentSlice = contentStack.readCell().beginParse();
    const commonContent = contentSlice.loadBuffer(contentSlice.remainingBits / 8).toString();
    
    return {
      ownerAddress,
      nextItemIndex,
      collectionContent,
      commonContent
    };
  }

  /**
   * Belirli bir indeksteki NFT öğesinin adresini alır
   * @param provider ContractProvider örneği
   * @param index NFT indeksi
   * @returns NFT öğesi adresi
   */
  async getNftItemAddressByIndex(
    provider: ContractProvider,
    index: number
  ): Promise<Address> {
    const { stack } = await provider.get("get_nft_address_by_index", [{ type: "int", value: BigInt(index) }]);
    return stack.readAddress();
  }

  /**
   * Yeni bir NFT mint etmek için mesaj gövdesi oluşturur
   * @param params Mint parametreleri
   * @returns Mesaj gövdesi
   */
  static createMintBody(params: {
    queryId: bigint;
    itemIndex: number;
    amount: bigint;
    itemOwnerAddress: Address;
    itemContent: string;
  }): Cell {
    return beginCell()
      .storeUint(1, 32) // op code for deploy
      .storeUint(Number(params.queryId), 64) // query id
      .storeUint(params.itemIndex, 64)
      .storeCoins(params.amount)
      .storeRef(
        beginCell()
          .storeAddress(params.itemOwnerAddress)
          .storeRef(
            beginCell()
              .storeBuffer(Buffer.from(params.itemContent))
              .endCell()
          )
          .endCell()
      )
      .endCell();
  }

  /**
   * NFT mint işlemini gerçekleştirir
   * @param wallet Açılmış cüzdan
   * @param params Mint parametreleri
   */
  async mintNft(
    tonClient: TonClient,
    wallet: OpenedWallet,
    params: {
      owner: Address;
      content: string;
      nftItemIndex?: number;
      value?: bigint;
    },
  ) {
    const provider = tonClient as unknown as ContractProvider;
    const collectionData = await this.getData(provider);
    const nftItemIndex = params.nftItemIndex ?? collectionData.nextItemIndex;
    
    // Koleksiyon adresi
    const collectionAddress = this.collectionAddress;
    
    // Mint işlemi için gereken ücreti hesapla
    const mintPrice = toNano(0.05);
    
    // Mint işlemi için body'i oluştur
    const body = NftCollection.createMintBody({
      queryId: BigInt(0),
      itemIndex: nftItemIndex,
      amount: mintPrice,
      itemOwnerAddress: params.owner,
      itemContent: params.content,
    });
    
    // Mint işlemini başlat
    const seqno = await wallet.contract.getSeqno(provider);
    
    // Transferi gönder
    await wallet.contract.sendTransfer(provider, {
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          to: collectionAddress,
          value: params.value ?? mintPrice + toNano(0.05),
          body,
          bounce: false,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });
    
    // İşlemin tamamlanmasını bekle
    await waitSeqno(seqno, wallet);
    
    // İşlem başarıyla tamamlandı
    console.log(`NFT başarıyla mint edildi, index: ${nftItemIndex}`);
    
    // NFT öğesinin adresini döndür
    return this.getNftItemAddressByIndex(provider, nftItemIndex);
  }

  /**
   * Koleksiyonun telif hakkı parametrelerini alır
   * @param provider ContractProvider örneği
   * @returns Telif hakkı parametreleri
   */
  async getRoyaltyParams(
    provider: ContractProvider
  ): Promise<{
    royaltyFactor: number;
    royaltyBase: number;
    royaltyAddress: Address;
  }> {
    const { stack } = await provider.get("royalty_params", []);
    
    const royaltyFactor = stack.readNumber();
    const royaltyBase = stack.readNumber();
    const royaltyAddress = stack.readAddress();
    
    return {
      royaltyFactor,
      royaltyBase,
      royaltyAddress
    };
  }

  /**
   * Koleksiyon sözleşme adresini hesaplar
   */
  public get address(): Address {
    return this.collectionAddress;
  }

  public get stateInit(): { code: Cell; data: Cell } {
    return this.init!;
  }

  /**
   * Koleksiyon kontratını deploy eder
   * @param wallet Açılmış cüzdan
   * @param value Gönderilecek miktar (nano TON)
   */
  async deploy(
    tonClient: TonClient,
    wallet: OpenedWallet,
    value: bigint = toNano('0.05'),
  ) {
    const provider = tonClient as unknown as ContractProvider;
    const seqno = await wallet.contract.getSeqno(provider);

    // Transferi gönder
    await wallet.contract.sendTransfer(provider, {
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          to: this.collectionAddress,
          init: this.init,
          value,
          bounce: false,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    // İşlemin tamamlanmasını bekle
    await waitSeqno(seqno, wallet);

    console.log(`Koleksiyon kontratı başarıyla deploy edildi: ${this.collectionAddress.toString()}`);
    return this.collectionAddress;
  }

  /**
   * Belirli bir adrese TON gönderir (top-up)
   * @param wallet Açılmış cüzdan
   * @param value Gönderilecek miktar (nano TON)
   */
  async topUp(tonClient: TonClient, wallet: OpenedWallet, value: bigint) {
    const provider = tonClient as unknown as ContractProvider;
    const seqno = await wallet.contract.getSeqno(provider);
    
    // TON gönderme işlemi
    await wallet.contract.sendTransfer(provider, {
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          to: this.collectionAddress,
          value,
          bounce: false,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });
    
    // İşlemin tamamlanmasını bekle
    await waitSeqno(seqno, wallet);
    
    // İşlem başarıyla tamamlandı
    console.log(`Koleksiyon kontratı başarıyla toplandı: ${this.collectionAddress.toString()}`);
  }
}