"use client";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { useTelegram } from "./TelegramInitProvider";
import DynamicMiningButton from "./DynamicMiningButton";
import {
  currentSession,
  miningPower,
  maintenanceCost,
  duration,
} from "@/lib/gameState";
import { gameAction } from "@/lib/gameActions";
import { formatCurrency } from "@/app/utils/formatters";
import type { UserCar } from "@/types";
export default function CarOperations({
  car,
  now,
}: {
  car: UserCar;
  now: number;
}) {
  const { game, user, busy, runOperation } = useTelegram();
  if (!game || !user) return null;
  const session = currentSession(game.sessions, car.id),
    capacity = game.garages.reduce((sum, g) => sum + g.capacity, 0),
    slots = Math.max(0, capacity - game.sessions.length);
  const power = miningPower(car),
    estimated = Math.round(power * 8 * (user.is_premium ? 1.2 : 1));
  const progress = session
    ? Math.max(
        0,
        Math.min(
          100,
          (100 * (now - Date.parse(session.start_time))) /
            Math.max(
              1,
              Date.parse(session.end_time) - Date.parse(session.start_time),
            ),
        ),
      )
    : 0;
  async function act(
    action: string,
    args: Record<string, unknown>,
    success: string,
  ) {
    try {
      await runOperation(async () => {
        const result = await gameAction<{ status?: string; reward?: number }>(
          action,
          args,
        );
        if (action === "complete_mining")
          toast.success(
            result.status === "already_settled"
              ? "Bu turun ödülü zaten hesabına işlendi."
              : `${formatCurrency(result.reward || 0)} NMFP mining ödülü eklendi.`,
          );
        else toast.success(success);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    }
  }
  return (
    <article className="cyber-panel overflow-hidden">
      <div className="relative h-44 bg-black/20">
        <Image
          src={car.car_model?.image_url || "/cars/718/718-cayman.jpg"}
          alt={car.name}
          fill
          sizes="(max-width:760px) 100vw, 450px"
          className="object-contain p-4"
        />
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-between gap-3">
          <h3 className="font-semibold">{car.name}</h3>
          <span className="text-xs text-cyan-300">
            {session ? "MINING" : "GARAJ"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>
            Yakıt <strong>{car.fuel}%</strong>
          </p>
          <p>
            Kondisyon <strong>{car.condition}%</strong>
          </p>
          <p>
            Güç <strong>{power}/saat</strong>
          </p>
          <p>
            8 saat <strong>{formatCurrency(estimated)} NMFP</strong>
          </p>
        </div>
        {session && (
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span>
                {now >= Date.parse(session.end_time)
                  ? "Tur tamamlandı"
                  : duration(Date.parse(session.end_time) - now)}
              </span>
              <span>{formatCurrency(session.expected_reward)} NMFP</span>
            </div>
            <div
              role="progressbar"
              aria-label="Mining ilerlemesi"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 bg-white/10 rounded"
            >
              <div
                className="h-full bg-cyan-300 rounded"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-lg border border-white/15 p-2 text-xs disabled:opacity-40"
            disabled={
              busy ||
              Boolean(session) ||
              car.status !== "active" ||
              car.condition >= 100 ||
              user.balance < maintenanceCost(car, "repair")
            }
            onClick={() =>
              void act(
                "repair_car_uuid",
                { p_car_id: car.id },
                "Bakım tamamlandı.",
              )
            }
          >
            Bakım · {formatCurrency(maintenanceCost(car, "repair"))} NMFP
          </button>
          <button
            className="rounded-lg border border-white/15 p-2 text-xs disabled:opacity-40"
            disabled={
              busy ||
              Boolean(session) ||
              car.status !== "active" ||
              car.fuel >= 100 ||
              user.balance < maintenanceCost(car, "refill")
            }
            onClick={() =>
              void act(
                "refill_car_uuid",
                { p_car_id: car.id },
                "Depo dolduruldu.",
              )
            }
          >
            Yakıt · {formatCurrency(maintenanceCost(car, "refill"))} NMFP
          </button>
        </div>
        <DynamicMiningButton
          car={car}
          miningSession={session}
          now={now}
          timeLeft={session ? duration(Date.parse(session.end_time) - now) : ""}
          isLoading={busy}
          canStartMining={slots > 0}
          onStartMining={(id) =>
            act(
              "start_mining",
              {
                p_car_id: id,
                p_garage_id: car.garage_id || game.garages[0]?.id || null,
              },
              "Mining başladı. Tur süresi 8 saat.",
            )
          }
          onClaimReward={(id) =>
            act("complete_mining", { p_mining_session_id: id }, "Ödül işlendi.")
          }
        />
      </div>
    </article>
  );
}
