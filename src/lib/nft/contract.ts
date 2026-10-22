import { Address, beginCell, Cell, contractAddress, toNano } from "@ton/core";
import { COLLECTION, METADATA_PREFIX } from "./config";
export {
  COLLECTION,
  COLLECTION_CODE_HASH,
  METADATA_PREFIX,
  UPGRADE_STARS,
} from "./config";
export function readCollection(data: Cell) {
  const s = data.beginParse();
  const owner = s.loadAddress();
  const nextIndex = s.loadUintBig(64);
  const content = s.loadRef();
  const itemCode = s.loadRef();
  const royalty = s.loadRef();
  const c = content.beginParse();
  const collectionMetadata = c.loadRef();
  const common = c.loadRef().beginParse().loadStringTail();
  return { owner, nextIndex, itemCode, royalty, collectionMetadata, common };
}
export function itemAddress(
  index: bigint,
  itemCode: Cell,
  collection = Address.parse(COLLECTION),
) {
  return contractAddress(collection.workChain, {
    code: itemCode,
    data: beginCell().storeUint(index, 64).storeAddress(collection).endCell(),
  });
}
export function mintBody(
  index: bigint,
  recipient: Address,
  metadataId: string,
  queryId: bigint,
) {
  if (!/^[0-9a-f-]{36}$/.test(metadataId))
    throw Error("Invalid metadata identifier");
  return beginCell()
    .storeUint(1, 32)
    .storeUint(queryId, 64)
    .storeUint(index, 64)
    .storeCoins(toNano("0.05"))
    .storeRef(
      beginCell()
        .storeAddress(recipient)
        .storeRef(beginCell().storeStringTail(metadataId).endCell())
        .endCell(),
    )
    .endCell();
}
export function metadataSetupBody(data: Cell) {
  const state = readCollection(data);
  if (state.nextIndex !== 0n)
    throw Error("Metadata prefix must not change after minting starts");
  return beginCell()
    .storeUint(4, 32)
    .storeUint(0, 64)
    .storeRef(
      beginCell()
        .storeRef(state.collectionMetadata)
        .storeRef(beginCell().storeStringTail(METADATA_PREFIX).endCell())
        .endCell(),
    )
    .storeRef(state.royalty)
    .endCell();
}
export function normalizeRecipient(value: unknown) {
  if (typeof value !== "string" || value.length > 100)
    throw Error("Geçerli bir TON adresi seçin.");
  if (Address.isFriendly(value) && Address.parseFriendly(value).isTestOnly)
    throw Error("Mainnet cüzdanı gerekiyor.");
  const a = Address.parse(value);
  if (a.workChain !== 0) throw Error("Desteklenmeyen cüzdan ağı.");
  return a.toRawString();
}
