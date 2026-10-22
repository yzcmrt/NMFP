import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain, createShardAccount, internal } from "@ton/sandbox";
import { Address, Cell, toNano } from "@ton/core";
import fixture from "./fixtures/nmfp-collection.json";
import {
  COLLECTION,
  COLLECTION_CODE_HASH,
  METADATA_PREFIX,
  readCollection,
  mintBody,
  metadataSetupBody,
  itemAddress,
  normalizeRecipient,
} from "../src/lib/nft/contract";
const code = Cell.fromBoc(Buffer.from(fixture.code, "hex"))[0],
  data = Cell.fromBoc(Buffer.from(fixture.data, "hex"))[0],
  address = Address.parse(COLLECTION);
const id = "00000000-0000-4000-8000-000000000001";
test("actual collection code supports metadata setup and owner mint; verifies deployed NFT", async () => {
  assert.equal(code.hash().toString("hex"), COLLECTION_CODE_HASH);
  const chain = await Blockchain.create();
  chain.verbosity = {
    print: false,
    blockchainLogs: false,
    vmLogs: "none",
    debugLogs: false,
  };
  await chain.setShardAccount(
    address,
    createShardAccount({ address, code, data, balance: toNano("1") }),
  );
  const original = readCollection(data);
  const recipient = Address.parse("0:" + "1".repeat(64));
  const setup = await chain.sendMessage(
    internal({
      from: original.owner,
      to: address,
      value: toNano("0.1"),
      body: metadataSetupBody(data),
    }),
  );
  assert.ok(
    setup.transactions.some(
      (t) => t.description.type === "generic" && !t.description.aborted,
    ),
  );
  const result = await chain.sendMessage(
    internal({
      from: original.owner,
      to: address,
      value: toNano("0.1"),
      body: mintBody(0n, recipient, id, 1n),
    }),
  );
  const item = itemAddress(0n, original.itemCode);
  const nft = (await chain.runGetMethod(item, "get_nft_data")).stackReader;
  assert.equal(nft.readBigNumber(), -1n);
  assert.equal(nft.readBigNumber(), 0n);
  assert.ok(nft.readAddress().equals(address));
  assert.ok(nft.readAddress().equals(recipient));
  const content = nft.readCell();
  assert.equal(content.beginParse().loadStringTail(), id);
  const full = (
    await chain.runGetMethod(address, "get_nft_content", [
      { type: "int", value: 0n },
      { type: "cell", cell: content },
    ])
  ).stackReader
    .readCell()
    .beginParse();
  assert.equal(full.loadUint(8), 1);
  assert.equal(full.loadStringTail(), METADATA_PREFIX + id);
  assert.equal(
    (
      await chain.runGetMethod(address, "get_collection_data")
    ).stackReader.readBigNumber(),
    1n,
  );
  assert.ok(result.transactions.length >= 2);
});
test("foreign wallet cannot mint into the actual collection", async () => {
  const chain = await Blockchain.create();
  chain.verbosity = {
    print: false,
    blockchainLogs: false,
    vmLogs: "none",
    debugLogs: false,
  };
  await chain.setShardAccount(
    address,
    createShardAccount({ address, code, data, balance: toNano("1") }),
  );
  const stranger = Address.parse("0:" + "2".repeat(64));
  const r = await chain.sendMessage(
    internal({
      from: stranger,
      to: address,
      value: toNano("0.1"),
      body: mintBody(0n, stranger, id, 1n),
    }),
  );
  assert.ok(
    r.transactions.some(
      (t) =>
        t.description.type === "generic" &&
        t.description.computePhase.type === "vm" &&
        t.description.computePhase.exitCode === 401,
    ),
  );
  assert.equal(
    (
      await chain.runGetMethod(address, "get_collection_data")
    ).stackReader.readBigNumber(),
    0n,
  );
});
test("recipient normalization rejects testnet and malformed addresses", () => {
  const a = Address.parse("0:" + "3".repeat(64));
  assert.equal(normalizeRecipient(a.toString()), a.toRawString());
  assert.throws(() => normalizeRecipient(a.toString({ testOnly: true })));
  assert.throws(() => normalizeRecipient("nope"));
});
test("one-time ownership transfer enables new signer and rejects previous owner", async () => {
  const chain = await Blockchain.create();
  chain.verbosity = {
    print: false,
    blockchainLogs: false,
    vmLogs: "none",
    debugLogs: false,
  };
  await chain.setShardAccount(
    address,
    createShardAccount({ address, code, data, balance: toNano("1") }),
  );
  const old = readCollection(data).owner,
    newOwner = Address.parse("0:" + "4".repeat(64));
  const { beginCell } = await import("@ton/core");
  await chain.sendMessage(
    internal({
      from: old,
      to: address,
      value: toNano("0.1"),
      body: beginCell()
        .storeUint(3, 32)
        .storeUint(0, 64)
        .storeAddress(newOwner)
        .endCell(),
    }),
  );
  const collection = (await chain.runGetMethod(address, "get_collection_data"))
    .stackReader;
  collection.readBigNumber();
  collection.readCell();
  assert.ok(collection.readAddress().equals(newOwner));
  const denied = await chain.sendMessage(
    internal({
      from: old,
      to: address,
      value: toNano("0.1"),
      body: mintBody(0n, newOwner, id, 1n),
    }),
  );
  assert.ok(
    denied.transactions.some(
      (t) =>
        t.description.type === "generic" &&
        t.description.computePhase.type === "vm" &&
        t.description.computePhase.exitCode === 401,
    ),
  );
  await chain.sendMessage(
    internal({
      from: newOwner,
      to: address,
      value: toNano("0.1"),
      body: mintBody(0n, newOwner, id, 2n),
    }),
  );
  assert.equal(
    (
      await chain.runGetMethod(address, "get_collection_data")
    ).stackReader.readBigNumber(),
    1n,
  );
});
