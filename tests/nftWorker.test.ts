import { test } from "node:test";
import assert from "node:assert/strict";
import { Address, beginCell, toNano, TupleReader } from "@ton/core";
import { processNftQueue } from "../src/server/nft/worker";
import { COLLECTION, METADATA_PREFIX } from "../src/lib/nft/contract";
const id = "00000000-0000-4000-8000-000000000001",
  owner = Address.parse("0:" + "1".repeat(64));
function scenario(
  options: {
    active?: boolean;
    funded?: boolean;
    seqno?: number;
    expired?: boolean;
    sendFails?: boolean;
  } = {},
) {
  process.env.NFT_AUTO_MINT_ENABLED = "true";
  const job: any = {
    id,
    state: "prepared",
    item_index: 0,
    item_address: "0:" + "2".repeat(64),
    recipient_address: owner.toRawString(),
    wallet_seqno: 4,
    valid_until:
      Math.floor(Date.now() / 1000) + (options.expired ? -1000 : 180),
    signed_boc: Buffer.from("durable-test-transfer").toString("base64"),
  };
  const events: string[] = [];
  const updates: any[] = [];
  const sent: Buffer[] = [];
  const db: any = {
    rpc: async (name: string, args: any) => {
      events.push(args.p_release ? "release" : name);
      return { data: true, error: null };
    },
    from: (table: string) => {
      let patch: any;
      const q: any = {
        select: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        eq: () => q,
        neq: () => q,
        update: (p: any) => {
          patch = p;
          return q;
        },
        maybeSingle: async () => ({ data: job, error: null }),
        then: (resolve: any) => {
          updates.push({ table, ...patch });
          resolve({ data: null, error: null });
        },
      };
      return q;
    },
  };
  const client: any = {
    getBalance: async () => (options.funded === false ? 0n : toNano("1")),
    getContractState: async () => ({
      state: options.active ? "active" : "uninit",
      lastTransaction: { hash: "verified-chain-hash" },
    }),
    runMethod: async () => ({
      stack: new TupleReader([
        { type: "int", value: -1n },
        { type: "int", value: 0n },
        {
          type: "slice",
          cell: beginCell().storeAddress(Address.parse(COLLECTION)).endCell(),
        },
        { type: "slice", cell: beginCell().storeAddress(owner).endCell() },
        { type: "cell", cell: beginCell().storeStringTail(id).endCell() },
      ]),
    }),
    open: () => ({ getSeqno: async () => options.seqno ?? 4 }),
    sendFile: async (b: Buffer) => {
      sent.push(b);
      if (options.sendFails) throw Error("Response lost");
    },
  };
  const deps: any = {
    database: () => db,
    tonClient: () => client,
    collectionState: async () => ({
      owner,
      common: METADATA_PREFIX,
      nextIndex: 0n,
    }),
    signer: async () => ({
      wallet: {
        address: owner,
        createTransfer: () => {
          throw Error("Must not sign a new transfer");
        },
      },
      key: {},
    }),
  };
  return { deps, job, events, updates, sent };
}
test("lost broadcast response retries the exact durable BOC, never signs another NFT", async () => {
  const s = scenario({ sendFails: true });
  for (let i = 0; i < 2; i++) await assert.rejects(processNftQueue(s.deps));
  assert.equal(s.sent.length, 2);
  assert.ok(s.sent[0].equals(s.sent[1]));
  assert.equal(s.events.filter((e) => e === "release").length, 2);
  assert.ok(!s.events.includes("nmfp_nft_prepare"));
});
test("confirmed NFT is reconciled even when signer funds run low", async () => {
  const s = scenario({ active: true, funded: false });
  assert.equal((await processNftQueue(s.deps)).state, "minted");
  assert.equal(s.sent.length, 0);
  assert.ok(
    s.updates.some((p) => p.state === "minted" && p.signed_boc === null),
  );
});
test("advanced wallet sequence without NFT pauses for review instead of issuing another mint", async () => {
  const s = scenario({ seqno: 5, expired: true });
  assert.equal((await processNftQueue(s.deps)).state, "review");
  assert.equal(s.sent.length, 0);
  assert.ok(s.updates.some((p) => p.state === "review"));
});
