import { test } from "node:test";
import assert from "node:assert/strict";
import {
  miningState,
  currentSession,
  maintenanceCost,
  miningPower,
  bonusAvailable,
  transactionAmount,
  orderStatus,
} from "../src/lib/gameState";
import { gameErrorMessage } from "../src/server/gameErrors";
import type { UserCar, MiningSession, Transaction } from "../src/types";
const car = {
  id: 1,
  status: "active",
  fuel: 75,
  condition: 90,
  mining_multiplier: 1.2,
  car_model: { mining_power: 300, repair_cost: 194, refill_cost: 78 },
} as UserCar;
const session = {
  id: 1,
  car_id: 1,
  status: "active",
  start_time: new Date(0).toISOString(),
  end_time: new Date(8000).toISOString(),
} as MiningSession;
test("paid history never blocks restart and active session takes precedence", () => {
  const paid = { ...session, status: "completed" };
  assert.equal(currentSession([paid], 1), undefined);
  assert.equal(currentSession([paid, session], 1), session);
  assert.equal(miningState(car, paid, 1, 9000), "ready");
});
test("deadline is claimable without pretending DB is settled", () => {
  assert.equal(miningState(car, session, 0, 7999), "mining");
  assert.equal(miningState(car, session, 0, 8000), "claimable");
  assert.equal(session.status, "active");
});
test("fuel, condition, state and capacity gates", () => {
  assert.equal(miningState({ ...car, fuel: 24 }, undefined, 1), "fuel");
  assert.equal(
    miningState({ ...car, condition: 9 }, undefined, 1),
    "condition",
  );
  assert.equal(miningState(car, undefined, 0), "capacity");
  assert.equal(
    miningState({ ...car, status: "mining" }, undefined, 1),
    "unavailable",
  );
});
test("model-specific maintenance prices match SQL ceiling and multiplier", () => {
  assert.equal(maintenanceCost(car, "repair"), 20);
  assert.equal(maintenanceCost(car, "refill"), 20);
  assert.equal(miningPower(car), 360);
  assert.equal(maintenanceCost({ ...car, fuel: 100 }, "refill"), 0);
});
test("daily bonus respects exact 24h including first collection", () => {
  assert.equal(bonusAvailable(null, 0), true);
  assert.equal(bonusAvailable(new Date(0).toISOString(), 86400000 - 1), false);
  assert.equal(bonusAvailable(new Date(0).toISOString(), 86400000), true);
});
test("expense display and refunds reflect their meaning", () => {
  assert.equal(
    transactionAmount({ type: "expense", amount: 20 } as Transaction),
    -20,
  );
  assert.equal(
    transactionAmount({ type: "purchase", amount: -50 } as Transaction),
    -50,
  );
  assert.equal(orderStatus("refund_pending"), "İade işleniyor");
  assert.equal(orderStatus("expired"), "Süresi doldu");
});
test("only approved business errors are exposed", () => {
  assert.match(gameErrorMessage("Garaj kapasitesi dolu"), /Garaj kapasitesi/);
  assert.match(gameErrorMessage("Araçta yeterli yakıt yok"), /%25/);
  assert.doesNotMatch(
    gameErrorMessage("sensitive database internal details"),
    /sensitive/,
  );
});
