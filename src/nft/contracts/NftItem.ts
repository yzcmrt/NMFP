import {
  Address,
  Cell,
  internal,
  beginCell,
  contractAddress,
  StateInit,
  SendMode,
  Contract,
  ContractProvider,
  Sender
} from "@ton/core";
import { OpenedWallet } from "../utils/helpers";

/**
 * NFT Öğesi verilerinin yapısı
 */
export type NftItemData = {
  index: number;
  collectionAddress: Address;
  ownerAddress: Address;
  content: string;
};

/**
 * NFT Öğesi sözleşmesi için sınıf
 */
export class NftItem implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  /**
   * NFT Öğesi sözleşmesi için kod hücresi oluşturur
   * @returns Kod hücresi
   */
  static createCodeCell(): Cell {
    // Burada projeye özgü kod BOC'u kullanılmalı
    const itemCodeBoc = process.env.NFT_ITEM_CODE_BOC;
    if (!itemCodeBoc) {
      throw new Error("NFT_ITEM_CODE_BOC çevre değişkeni tanımlanmamış");
    }
    return Cell.fromBase64(itemCodeBoc);
  }

  /**
   * NFT Öğesi veri hücresi oluşturur
   * @param data NFT öğesi verileri
   * @returns Veri hücresi
   */
  static createDataCell(data: NftItemData): Cell {
    return beginCell()
      .storeUint(data.index, 64)
      .storeAddress(data.collectionAddress)
      .storeAddress(data.ownerAddress)
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(data.content))
          .endCell()
      )
      .endCell();
  }

  /**
   * NFT Öğesi için state init oluşturur
   * @param data NFT öğesi verileri
   * @returns State init objesi
   */
  static createStateInit(data: NftItemData): { code: Cell; data: Cell } {
    const code = NftItem.createCodeCell();
    const dataCell = NftItem.createDataCell(data);
    return { code, data: dataCell };
  }

  /**
   * Verilen verilerle NFT öğesi adresi oluşturur
   * @param data NFT öğesi verileri
   * @param workchain Workchain ID (varsayılan 0)
   * @returns NFT öğesi adresi
   */
  static createAddress(data: NftItemData, workchain = 0): Address {
    const stateInit = NftItem.createStateInit(data);
    return contractAddress(workchain, stateInit);
  }

  /**
   * Yeni bir NFT Öğesi örneği oluşturur
   * @param data NFT öğesi verileri
   * @param workchain Workchain ID (varsayılan 0)
   * @returns NftItem örneği
   */
  static create(data: NftItemData, workchain = 0): NftItem {
    const stateInit = NftItem.createStateInit(data);
    const address = contractAddress(workchain, stateInit);
    return new NftItem(address, stateInit);
  }

  /**
   * NFT öğesi verilerini alır
   * @param provider ContractProvider örneği
   * @returns NFT öğesi verileri
   */
  async getData(provider: ContractProvider): Promise<{
    index: number;
    collectionAddress: Address;
    ownerAddress: Address;
    content: string;
  }> {
    const { stack } = await provider.get("get_nft_data", []);
    
    const index = stack.readNumber();
    const collectionAddress = stack.readAddress();
    const ownerAddress = stack.readAddress();
    const contentCell = stack.readCell();
    const contentSlice = contentCell.beginParse();
    const content = contentSlice.loadBuffer(contentSlice.remainingBits / 8).toString();
    
    return {
      index,
      collectionAddress,
      ownerAddress,
      content
    };
  }

  /**
   * NFT sahipliğini başka bir adrese transfer eder
   * @param provider ContractProvider örneği
   * @param via Gönderici (mevcut owner olmalı)
   * @param params İşlem parametreleri
   * @returns İşlem sonucu
   */
  async transfer(
    provider: ContractProvider,
    via: Sender,
    params: {
      value: bigint;
      newOwnerAddress: Address;
      responseAddress?: Address;
      customPayload?: Cell;
      forwardAmount?: bigint;
      forwardPayload?: Cell;
    }
  ) {
    const messageBody = beginCell()
      .storeUint(0x5fcc3d14, 32) // op code for transfer
      .storeUint(0, 64) // query id
      .storeAddress(params.newOwnerAddress)
      .storeAddress(params.responseAddress || null)
      .storeBit(false) // null custom_payload
      .storeCoins(params.forwardAmount || BigInt(0))
      .storeBit(false) // forward_payload in the same cell
      .endCell();

    return await provider.internal(via, {
      value: params.value,
      bounce: true,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody
    });
  }

  /**
   * NFT koleksiyonuna mesaj gönderir
   * @param provider ContractProvider örneği
   * @param via Gönderici
   * @param params İşlem parametreleri
   * @returns İşlem sonucu
   */
  async sendToCollection(
    provider: ContractProvider,
    via: Sender,
    params: {
      value: bigint;
      gasAmount: bigint;
      body: Cell;
    }
  ) {
    const messageBody = beginCell()
      .storeUint(0x7da38631, 32) // op code for sending to collection
      .storeCoins(params.gasAmount)
      .storeRef(params.body)
      .endCell();

    return await provider.internal(via, {
      value: params.value,
      bounce: true,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody
    });
  }
} 