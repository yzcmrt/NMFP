import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession } from "../src/server/auth";
import { GET as snapshot } from "../src/app/api/game/route";
import { GET as stats } from "../src/app/api/game/stats/route";
import { POST as visit } from "../src/app/api/tasks/visit/route";
import { POST as verify } from "../src/app/api/telegram/verify-task/route";
import { gameAction } from "../src/server/game";
process.env.SESSION_SECRET =
  "test-only-session-secret-longer-than-32-characters";
process.env.SUPABASE_URL = "https://db.test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
const session = {
  userId: "00000000-0000-4000-8000-000000000001",
  telegramId: "12345",
  exp: Math.floor(Date.now() / 1000) + 600,
};
function req(path: string, body?: unknown, origin = "https://nmfp.test") {
  return new Request("https://nmfp.test" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie: "nmfp_session=" + signSession(session),
      origin,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function network(
  fn: (url: URL, init: any) => Response,
  run: () => Promise<void>,
) {
  const original = global.fetch;
  global.fetch = async (input: any, init: any) =>
    fn(new URL(typeof input === "string" ? input : input.url), init);
  try {
    await run();
  } finally {
    global.fetch = original;
  }
}
test("snapshot requires session and forces session owner regardless of query", async () => {
  let calls = 0;
  await network(
    (url, init) => {
      calls++;
      assert.match(url.pathname, /rpc\/nmfp_game_snapshot$/);
      assert.deepEqual(JSON.parse(init.body), { p_user_id: session.userId });
      return Response.json({ user: { id: session.userId }, sessions: [] });
    },
    async () => {
      assert.equal(
        (await snapshot(new Request("https://nmfp.test/api/game"))).status,
        401,
      );
      const r = await snapshot(req("/api/game?userId=someone-else"));
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
    },
  );
  assert.equal(calls, 1);
});
test("stats rejects unsupported periods and forces authenticated user", async () => {
  let calls = 0;
  await network(
    (_url, init) => {
      calls++;
      assert.deepEqual(JSON.parse(init.body), {
        p_user_id: session.userId,
        p_days: 30,
      });
      return Response.json({ totalReward: 12 });
    },
    async () => {
      assert.equal((await stats(req("/api/game/stats?days=999"))).status, 400);
      assert.equal((await stats(req("/api/game/stats?days=30"))).status, 200);
    },
  );
  assert.equal(calls, 1);
});
test("task visits reject cross-origin, absent session, and invalid ids before SQL", async () => {
  await network(
    () => {
      throw new Error("Unexpected DB access");
    },
    async () => {
      assert.equal(
        (
          await visit(
            req("/api/tasks/visit", { taskId: 1 }, "https://evil.test"),
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await visit(
            new Request("https://nmfp.test/api/tasks/visit", {
              method: "POST",
              headers: { origin: "https://nmfp.test" },
              body: "{}",
            }),
          )
        ).status,
        401,
      );
      for (const taskId of [-1, 0, "1", 1.5])
        assert.equal(
          (await visit(req("/api/tasks/visit", { taskId }))).status,
          400,
        );
    },
  );
});
test("task verification cannot trust client claimed progress or verification", async () => {
  await network(
    (url, init) => {
      if (url.pathname.endsWith("/tasks"))
        return Response.json({
          id: 1,
          is_active: true,
          verification_type: "link_click",
        });
      assert.deepEqual(JSON.parse(init.body), {
        p_user_id: session.userId,
        p_task_id: 1,
        p_external_verified: false,
      });
      return Response.json({
        success: true,
        completed: false,
        reward: 0,
        message: "Incomplete",
      });
    },
    async () => {
      const r = await verify(
        req("/api/telegram/verify-task", {
          taskId: 1,
          p_user_id: "other",
          progress: 100,
          p_external_verified: true,
        }),
      );
      assert.equal(r.status, 200);
      assert.equal((await r.json()).result.completed, false);
    },
  );
});
test("already settled mining returns explicit idempotent result without mutation", async () => {
  let calls = 0;
  await network(
    (url) => {
      calls++;
      assert.equal(url.searchParams.get("user_id"), "eq." + session.userId);
      return Response.json({ id: 1, status: "completed" });
    },
    async () =>
      assert.deepEqual(
        await gameAction(
          "complete_mining",
          { p_mining_session_id: 1 },
          session,
        ),
        { status: "already_settled", reward: 0 },
      ),
  );
  assert.equal(calls, 1);
});
test("foreign car and malformed identifiers cannot trigger mining", async () => {
  await network(
    () => Response.json(null),
    async () => {
      await assert.rejects(
        () => gameAction("start_mining", { p_car_id: 1 }, session),
        /Item not found/,
      );
      for (const p_car_id of [-1, "1", 1.5])
        await assert.rejects(
          () => gameAction("start_mining", { p_car_id }, session),
          /Geçersiz/,
        );
    },
  );
});
