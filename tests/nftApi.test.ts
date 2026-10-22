import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession } from "../src/server/auth";
import { POST as invoice } from "../src/app/api/stars/invoice/route";
import { POST as worker } from "../src/app/api/nft/worker/route";
import { GET as status } from "../src/app/api/nft/status/route";
import { GET as metadata } from "../src/app/api/nft/metadata/[id]/route";
process.env.SESSION_SECRET = "nft-test-session-secret-more-than-32-characters";
process.env.SUPABASE_URL = "https://db.test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.NFT_AUTO_MINT_ENABLED = "false";
const userId = "00000000-0000-4000-8000-000000000001";
const cookie =
  "nmfp_session=" +
  signSession({
    userId,
    telegramId: "123",
    exp: Math.floor(Date.now() / 1000) + 600,
  });
test("NFT checkout rejects invalid recipient and disabled delivery before creating invoice", async () => {
  const original = global.fetch;
  global.fetch = async () => {
    throw Error("Unexpected network call");
  };
  try {
    for (const [recipient, expected] of [
      ["invalid", 400],
      ["0:" + "1".repeat(64), 503],
    ] as const) {
      const r = await invoice(
        new Request("https://nmfp.test/api/stars/invoice", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://nmfp.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            kind: "nft_upgrade",
            productId: "1",
            termsAccepted: true,
            recipientAddress: recipient,
          }),
        }),
      );
      assert.equal(r.status, expected);
    }
  } finally {
    global.fetch = original;
  }
});
test("worker rejects unauthorized requests and stays inert while disabled", async () => {
  process.env.NFT_WORKER_SECRET = "test-worker-secret-more-than-32-characters";
  for (const token of ["", "wrong", "秘密"])
    assert.equal(
      (
        await worker(
          new Request("https://nmfp.test/api/nft/worker", {
            method: "POST",
            headers: { authorization: encodeURIComponent(token) },
          }),
        )
      ).status,
      401,
    );
  const r = await worker(
    new Request("https://nmfp.test/api/nft/worker", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.NFT_WORKER_SECRET },
    }),
  );
  assert.equal((await r.json()).state, "disabled");
});
test("NFT status is scoped to session owner and excludes signed transfer and private order fields", async () => {
  assert.equal(
    (await status(new Request("https://nmfp.test/api/nft/status"))).status,
    401,
  );
  const original = global.fetch;
  global.fetch = async (input: any) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    assert.equal(url.searchParams.get("user_id"), "eq." + userId);
    assert.equal(
      url.searchParams.get("select"),
      "id,car_id,state,item_address,created_at,minted_at",
    );
    return Response.json([]);
  };
  try {
    assert.equal(
      (
        await status(
          new Request("https://nmfp.test/api/nft/status?user_id=foreign", {
            headers: { cookie },
          }),
        )
      ).status,
      200,
    );
  } finally {
    global.fetch = original;
  }
});
test("public NFT metadata queries only immutable metadata, rejects malformed ids", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async (input: any) => {
    calls++;
    const url = new URL(typeof input === "string" ? input : input.url);
    assert.equal(url.searchParams.get("select"), "metadata");
    return Response.json({
      metadata: { name: "Car", image: "https://nmfp.vercel.app/car.png" },
    });
  };
  try {
    assert.equal(
      (
        await metadata(new Request("https://nmfp.test"), {
          params: Promise.resolve({ id: "bad" }),
        })
      ).status,
      404,
    );
    const r = await metadata(new Request("https://nmfp.test"), {
      params: Promise.resolve({ id: userId }),
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      name: "Car",
      image: "https://nmfp.vercel.app/car.png",
    });
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
