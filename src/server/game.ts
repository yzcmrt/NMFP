import "server-only";
import { gameErrorMessage } from "./gameErrors";
import { database, requireOwned } from "./db";
import { HttpError, type Session } from "./auth";
const userActions: Record<string, string[]> = {
  get_user_cars_with_models: [],
  get_user_garages_with_templates: [],
  get_user_mining_stats: [],
  get_daily_mining_stats: ["p_days"],
  get_car_performance_stats: [],
  get_activity_distribution: [],
  repair_car_uuid: ["p_car_id"],
  refill_car_uuid: ["p_car_id"],
  start_mining: ["p_car_id", "p_garage_id"],
  complete_mining: ["p_mining_session_id"],
  purchase_car_v3: ["p_model_id", "p_purchase_type", "p_wallet_address"],
  purchase_garage_v3: [
    "p_garage_template_id",
    "p_purchase_type",
    "p_wallet_address",
  ],
  collect_garage_bonuses: [],
  prepare_and_start_eligible_cars: ["p_auto_pay_maintenance"],
};
export async function gameAction(
  name: string,
  input: Record<string, unknown>,
  session: Session,
): Promise<any> {
  const db = database();
  if (name === "update_expired_mining_sessions") {
    const { data, error } = await db
      .from("mining_sessions")
      .select("id")
      .eq("user_id", session.userId)
      .eq("status", "active")
      .lte("end_time", new Date().toISOString());
    if (error) throw new HttpError(503, "Unable to refresh mining sessions.");
    const completed = [];
    for (const row of data || []) {
      await gameAction(
        "complete_mining",
        { p_mining_session_id: row.id },
        session,
      );
      completed.push(row);
    }
    return { updated_count: completed.length, sessions: completed };
  }
  if (name === "set_auto_mining") {
    if (typeof input.enabled !== "boolean")
      throw new HttpError(400, "Geçersiz otomatik mining ayarı.");
    const { data, error } = await db.rpc("nmfp_set_auto_mining", {
      p_user_id: session.userId,
      p_enabled: input.enabled,
    });
    if (error)
      throw new HttpError(
        400,
        error.message.startsWith("NMFP:")
          ? error.message.slice(5)
          : "Ayar kaydedilemedi.",
      );
    return data;
  }
  const allowed = userActions[name];
  if (!allowed) throw new HttpError(403, "This operation is not available.");
  const args: Record<string, unknown> = {};
  for (const key of allowed)
    if (input[key] !== undefined) args[key] = input[key];
  for (const key of ["p_car_id", "p_garage_id", "p_mining_session_id"]) {
    if (
      args[key] != null &&
      (!Number.isSafeInteger(args[key]) || Number(args[key]) <= 0)
    )
      throw new HttpError(400, "Geçersiz oyun öğesi.");
  }
  if (
    name === "get_daily_mining_stats" &&
    args.p_days !== undefined &&
    (!Number.isSafeInteger(args.p_days) ||
      Number(args.p_days) < 1 ||
      Number(args.p_days) > 90)
  )
    throw new HttpError(400, "Geçersiz tarih aralığı.");
  if (name !== "complete_mining") args.p_user_id = session.userId;
  if (args.p_car_id != null)
    await requireOwned("user_cars", args.p_car_id, session.userId);
  if (args.p_garage_id != null)
    await requireOwned("garages", args.p_garage_id, session.userId);
  if (name === "complete_mining") {
    const row = await requireOwned(
      "mining_sessions",
      args.p_mining_session_id,
      session.userId,
    );
    if (row.status === "completed")
      return { status: "already_settled", reward: 0 };
    if (new Date(row.end_time).getTime() > Date.now())
      throw new HttpError(409, "Mining is still in progress.");
  }
  if (name.startsWith("purchase_") && args.p_purchase_type !== "NMFP")
    throw new HttpError(
      409,
      "Stars satın alımı için Telegram ödeme ekranını kullanın.",
    );
  const mutating = !name.startsWith("get_");
  const { data, error } = mutating
    ? await db.rpc("nmfp_game_action", {
        p_user_id: session.userId,
        p_action: name,
        p_args: args,
      })
    : await db.rpc(name, args);
  if (error) throw new HttpError(400, gameErrorMessage(error.message));
  return name === "complete_mining"
    ? {
        status: Number(data) > 0 ? "credited" : "already_settled",
        reward: Number(data) || 0,
      }
    : data;
}
