import type {
  User,
  UserCar,
  Garage,
  MiningSession,
  Transaction,
  Task,
  UserTask,
  CarModel,
  GarageTemplate,
} from "@/types";
export interface GameSnapshot {
  user: User;
  cars: UserCar[];
  garages: Garage[];
  sessions: MiningSession[];
  transactions: Transaction[];
  tasks: Task[];
  userTasks: UserTask[];
  models: CarModel[];
  templates: GarageTemplate[];
  orders: {
    id: string;
    title: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
  serverTime: string;
}
export function currentSession(sessions: MiningSession[], carId: number) {
  return sessions.find((s) => s.car_id === carId && s.status === "active");
}
export function miningState(
  car: UserCar,
  session: MiningSession | undefined,
  slots: number,
  now = Date.now(),
) {
  if (session?.status === "active")
    return Date.parse(session.end_time) <= now ? "claimable" : "mining";
  if (car.status !== "active") return "unavailable";
  if (car.fuel < 25) return "fuel";
  if (car.condition < 10) return "condition";
  return slots > 0 ? "ready" : "capacity";
}
export function miningPower(car: UserCar) {
  return Math.round(
    Number(car.car_model?.mining_power || 0) *
      Number(car.mining_multiplier ?? 1),
  );
}
export function maintenanceCost(car: UserCar, kind: "repair" | "refill") {
  return Math.ceil(
    ((100 - Number(kind === "repair" ? car.condition : car.fuel)) *
      Number(
        kind === "repair"
          ? car.car_model?.repair_cost || 0
          : car.car_model?.refill_cost || 0,
      )) /
      100,
  );
}
export function bonusAvailable(
  last: string | null | undefined,
  now = Date.now(),
) {
  return !last || now >= Date.parse(last) + 86400000;
}
export function duration(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function orderStatus(status: string) {
  return (
    (
      {
        paid: "Teslim edildi",
        pending: "Ödeme bekleniyor",
        refund_pending: "İade işleniyor",
        refunded: "İade edildi",
        failed: "Ödeme başarısız",
        expired: "Süresi doldu",
      } as Record<string, string>
    )[status] || "İşleniyor"
  );
}
export function transactionAmount(tx: Transaction) {
  const expense = [
    "expense",
    "purchase",
    "purchase_car",
    "purchase_garage",
    "repair",
    "refill",
    "repair_car",
    "refill_car",
  ].includes(tx.type);
  return expense ? -Math.abs(Number(tx.amount)) : Number(tx.amount);
}
