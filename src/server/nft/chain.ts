import "server-only";
import { Cell, Address } from "@ton/core";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToPrivateKey, mnemonicValidate } from "@ton/crypto";
import {
  COLLECTION,
  COLLECTION_CODE_HASH,
  readCollection,
} from "@/lib/nft/contract";
let nextRpcAt = 0;
export function tonClient() {
  return new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TON_RPC_API_KEY,
    timeout: 8000,
    httpAdapter: async (config) => {
      // Public Toncenter access is rate-limited. Space requests even across
      // clients in one process; precheckout uses the DB heartbeat, never RPC.
      const delay = Math.max(0, nextRpcAt - Date.now());
      nextRpcAt =
        Date.now() + delay + (process.env.TON_RPC_API_KEY ? 100 : 1200);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const response = await fetch(
        config.url || "https://toncenter.com/api/v2/jsonRPC",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.TON_RPC_API_KEY
              ? { "X-API-Key": process.env.TON_RPC_API_KEY }
              : {}),
          },
          body: config.data,
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw Error("TON RPC temporarily unavailable");
      return {
        data: await response.json(),
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        config,
      };
    },
  });
}
export async function signer() {
  const words = (process.env.NFT_SIGNER_MNEMONIC || "").trim().split(/\s+/);
  if (words.length !== 24 || !(await mnemonicValidate(words)))
    throw Error("NFT signer is not configured");
  const key = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: key.publicKey,
  });
  if (
    !process.env.NFT_SIGNER_ADDRESS ||
    !wallet.address.equals(Address.parse(process.env.NFT_SIGNER_ADDRESS))
  )
    throw Error("NFT signer address mismatch");
  return { wallet, key };
}
export async function collectionState(client = tonClient()) {
  const account = await client.getContractState(Address.parse(COLLECTION));
  if (account.state !== "active" || !account.code || !account.data)
    throw Error("Collection is unavailable");
  const code = Cell.fromBoc(account.code)[0];
  if (code.hash().toString("hex") !== COLLECTION_CODE_HASH)
    throw Error("Unsupported collection code");
  return {
    ...readCollection(Cell.fromBoc(account.data)[0]),
    data: Cell.fromBoc(account.data)[0],
  };
}
