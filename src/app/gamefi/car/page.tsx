"use client";
import { useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { useTelegram } from "@/components/TelegramInitProvider";
import CarOperations from "@/components/CarOperations";
import { useGameClock } from "@/hooks/useGameClock";
import { starsCheckout } from "@/lib/starsCheckout";
import { gameAction } from "@/lib/gameActions";
import { formatCurrency } from "@/app/utils/formatters";
import type { CarModel } from "@/types";
export default function CarPage() {
  const { game, user, busy, runOperation } = useTelegram();
  const [tab, setTab] = useState("owned"),
    [rarity, setRarity] = useState("all");
  const now = useGameClock();
  if (!game || !user) return <p role="status">Araçlar yükleniyor…</p>;
  async function buy(model: CarModel, stars: boolean) {
    try {
      await runOperation(async () => {
        if (stars) await starsCheckout("car", model.id);
        else
          await gameAction("purchase_car_v3", {
            p_model_id: model.id,
            p_purchase_type: "NMFP",
          });
        toast.success("Araç garajına eklendi.");
        setTab("owned");
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Satın alma tamamlanamadı.");
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Araç koleksiyonu</h1>
      <div className="flex gap-3" role="tablist" aria-label="Araçlar">
        <button
          role="tab"
          aria-selected={tab === "owned"}
          className="cyber-button"
          onClick={() => setTab("owned")}
        >
          Araçlarım · {game.cars.length}
        </button>
        <button
          role="tab"
          aria-selected={tab === "store"}
          className="cyber-button"
          onClick={() => setTab("store")}
        >
          Mağaza
        </button>
      </div>
      {tab === "owned" ? (
        <div className="grid md:grid-cols-2 gap-4">
          {game.cars
            .filter((c) => c.status !== "sold")
            .map((car) => (
              <CarOperations key={car.id} car={car} now={now} />
            ))}
          {!game.cars.length && (
            <p className="muted">
              Henüz aracın yok. Mağazadan bir araç seçebilirsin.
            </p>
          )}
        </div>
      ) : (
        <>
          <label className="flex gap-3 items-center text-sm">
            Nadirlik
            <select
              className="bg-[#101b23] rounded p-2 border border-white/20"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
            >
              <option value="all">Tümü</option>
              {[...new Set(game.models.map((m) => m.rarity))].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm muted">
            Her modelden bir araç edinebilirsin. Stars ile alınan aracın mining
            gücü %20 daha yüksektir. Ödeme Telegram ekranında onaylanır.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {game.models
              .filter((m) => rarity === "all" || m.rarity === rarity)
              .map((model) => {
                const owned = game.cars.some(
                  (c) => c.car_model_id === model.id,
                );
                return (
                  <article
                    key={model.id}
                    className="cyber-panel overflow-hidden"
                  >
                    <div className="relative h-44">
                      <Image
                        src={model.image_url || "/cars/718/718-cayman.jpg"}
                        alt={model.name}
                        fill
                        sizes="(max-width:760px) 100vw, 450px"
                        className="object-contain p-4"
                      />
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between gap-2">
                        <h2 className="font-semibold">{model.name}</h2>
                        <span className="text-xs text-cyan-300">
                          {model.rarity}
                        </span>
                      </div>
                      <p className="text-sm muted">{model.description}</p>
                      <p className="text-sm">
                        {model.mining_power} NMFP/saat · 8 saatlik turlar
                      </p>
                      {owned ? (
                        <p className="text-green-300">Garajında mevcut</p>
                      ) : (
                        <div className="grid gap-2">
                          <button
                            disabled={
                              busy ||
                              user.balance < model.nmfp_price ||
                              model.nmfp_price <= 0
                            }
                            className="cyber-button disabled:opacity-40"
                            onClick={() => void buy(model, false)}
                          >
                            {formatCurrency(model.nmfp_price)} NMFP
                          </button>
                          {Number(model.stars_price) > 0 && (
                            <button
                              disabled={busy}
                              className="cyber-button disabled:opacity-40"
                              onClick={() => void buy(model, true)}
                            >
                              {model.stars_price} Stars
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
