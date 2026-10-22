import "server-only";
import { randomUUID } from "node:crypto";
import {
  Address,
  beginCell,
  external,
  internal,
  SendMode,
  storeMessage,
  toNano,
} from "@ton/core";
import { database } from "@/server/db";
import {
  COLLECTION,
  METADATA_PREFIX,
  itemAddress,
  mintBody,
} from "@/lib/nft/contract";
import { collectionState, signer, tonClient } from "./chain";
// Only one durable signed transfer may be in flight. Retries rebroadcast the same
// BOC/seqno; a lost HTTP response must never allocate a second NFT index.
export async function processNftQueue(
  deps = { database, tonClient, collectionState, signer },
) {
  if (process.env.NFT_AUTO_MINT_ENABLED !== "true")
    return { state: "disabled" };
  const db = deps.database(),
    lock = randomUUID();
  const acquired = await db.rpc("nmfp_nft_lock", { p_owner: lock });
  if (acquired.error) throw Error("NFT lease unavailable");
  if (!acquired.data) return { state: "busy" };
  let job: any = null;
  try {
    const client = deps.tonClient(),
      state = await deps.collectionState(client),
      { wallet, key } = await deps.signer();
    if (!state.owner.equals(wallet.address) || state.common !== METADATA_PREFIX)
      throw Error("NFT collection setup is incomplete");
    const funded = (await client.getBalance(wallet.address)) >= toNano("0.15");
    const heartbeat = await db
      .from("nft_worker_lock")
      .update({ ready: funded, health_checked_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("owner", lock);
    if (heartbeat.error) throw Error("NFT heartbeat unavailable");
    const active = await db
      .from("nft_jobs")
      .select("*")
      .in("state", ["prepared", "review"])
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (active.error) throw Error("NFT queue unavailable");
    job = active.data;
    if (job?.state === "review") {
      await db.from("nft_worker_lock").update({ ready: false }).eq("id", 1);
      return { state: "review" };
    }
    if (!job) {
      const queued = await db
        .from("nft_jobs")
        .select("*")
        .eq("state", "queued")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (queued.error) throw Error("NFT queue unavailable");
      job = queued.data;
    }
    if (!job) return { state: "idle" };
    if (job.item_address) {
      const address = Address.parse(job.item_address),
        account = await client.getContractState(address);
      if (account.state === "active") {
        const { stack } = await client.runMethod(address, "get_nft_data");
        const initialized = stack.readBigNumber(),
          index = stack.readBigNumber(),
          collection = stack.readAddress(),
          owner = stack.readAddress(),
          content = stack.readCell().beginParse().loadStringTail();
        if (
          initialized !== -1n ||
          index !== BigInt(job.item_index) ||
          !collection.equals(Address.parse(COLLECTION)) ||
          !owner.equals(Address.parse(job.recipient_address)) ||
          content !== job.id
        ) {
          await db
            .from("nft_jobs")
            .update({
              state: "review",
              last_error:
                "NFT ownership/content mismatch; no new transfer will be sent",
            })
            .eq("id", job.id);
          return { state: "review" };
        }
        const saved = await db
          .from("nft_jobs")
          .update({
            state: "minted",
            minted_at: new Date().toISOString(),
            chain_tx_hash: account.lastTransaction?.hash || null,
            signed_boc: null,
            last_error: null,
          })
          .eq("id", job.id)
          .eq("state", "prepared");
        if (saved.error) throw Error("NFT confirmation could not be saved");
        return { state: "minted", id: job.id };
      }
    }
    const opened = client.open(wallet),
      seqno = await opened.getSeqno(),
      now = Math.floor(Date.now() / 1000);
    if (job.signed_boc) {
      if (seqno > Number(job.wallet_seqno)) {
        if (now > Number(job.valid_until) + 600) {
          await db
            .from("nft_jobs")
            .update({
              state: "review",
              last_error: "Wallet sequence advanced but NFT is not confirmed",
            })
            .eq("id", job.id);
          return { state: "review" };
        }
        return { state: "confirming" };
      }
      if (seqno !== Number(job.wallet_seqno))
        throw Error("Wallet sequence not synchronized");
      if (now < Number(job.valid_until) - 15) {
        await client.sendFile(Buffer.from(job.signed_boc, "base64"));
        return { state: "broadcast" };
      }
      if (now < Number(job.valid_until) + 60) return { state: "confirming" };
      if (state.nextIndex !== BigInt(job.item_index)) {
        await db
          .from("nft_jobs")
          .update({
            state: "review",
            last_error: "Collection index changed outside this worker",
          })
          .eq("id", job.id);
        return { state: "review" };
      }
    }
    if ((await client.getBalance(wallet.address)) < toNano("0.15"))
      throw Error("NFT network budget is low");
    const index =
      job.item_index == null ? state.nextIndex : BigInt(job.item_index);
    if (index > BigInt(Number.MAX_SAFE_INTEGER))
      throw Error("Collection index out of range");
    const validUntil = now + 180,
      query = BigInt("0x" + job.id.replaceAll("-", "").slice(0, 16));
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: key.secretKey,
      timeout: validUntil,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      messages: [
        internal({
          to: Address.parse(COLLECTION),
          value: toNano("0.1"),
          bounce: true,
          body: mintBody(
            index,
            Address.parse(job.recipient_address),
            job.id,
            query,
          ),
        }),
      ],
    });
    const boc = beginCell()
      .store(
        storeMessage(
          external({
            to: wallet.address,
            init: seqno === 0 ? wallet.init : undefined,
            body: transfer,
          }),
        ),
      )
      .endCell()
      .toBoc()
      .toString("base64");
    const saved = await db.rpc("nmfp_nft_prepare", {
      p_lock: lock,
      p_job: job.id,
      p_index: Number(index),
      p_address: itemAddress(index, state.itemCode).toRawString(),
      p_boc: boc,
      p_seqno: seqno,
      p_valid_until: validUntil,
    });
    if (saved.error || !saved.data)
      throw Error("NFT transfer could not be reserved");
    await client.sendFile(Buffer.from(boc, "base64"));
    return { state: "broadcast", id: job.id };
  } catch {
    await db
      .from("nft_worker_lock")
      .update({ ready: false, health_checked_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("owner", lock);
    if (job)
      await db
        .from("nft_jobs")
        .update({
          last_error:
            "Mint service temporarily unavailable; request retained for retry",
        })
        .eq("id", job.id)
        .neq("state", "minted");
    throw Error("NFT worker could not finish; request retained");
  } finally {
    await db.rpc("nmfp_nft_lock", { p_owner: lock, p_release: true });
  }
}
