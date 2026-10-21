"use client";
import { useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { useTelegram } from "@/components/TelegramInitProvider";
import { useGameClock } from "@/hooks/useGameClock";
import { bonusAvailable, duration } from "@/lib/gameState";
import { gameAction } from "@/lib/gameActions";
import { starsCheckout } from "@/lib/starsCheckout";
import { formatCurrency } from "@/app/utils/formatters";
import type { GarageTemplate } from "@/types";
export default function GaragePage() {
  const { game, user, busy, runOperation } = useTelegram();
  const [tab, setTab] = useState("owned");
  const now = useGameClock();
  if (!game || !user) return <p role="status">Garajlar yükleniyor…</p>;
  const totalBonus = game.garages.reduce(
      (s, g) => s + Number(g.daily_bonus),
      0,
    ),
    capacity = game.garages.reduce((s, g) => s + g.capacity, 0),
    ready = bonusAvailable(user.last_bonus_collected_at, now);
  async function collect() {
    try {
      await runOperation(async () => {
        const amount = await gameAction<number>("collect_garage_bonuses");
        toast.success(`${formatCurrency(amount)} NMFP garaj bonusu eklendi.`);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bonus alınamadı.");
    }
  }
  async function buy(template: GarageTemplate) {
    try {
      await runOperation(async () => {
        if (template.purchase_type === "ton")
          await starsCheckout("garage", template.id);
        else
          await gameAction("purchase_garage_v3", {
            p_garage_template_id: template.id,
            p_purchase_type: "NMFP",
          });
        toast.success("Garaj hesabına eklendi.");
        setTab("owned");
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Satın alma tamamlanamadı.");
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Garaj yönetimi</h1>
      <section className="cyber-panel p-5 space-y-3">
        <p>
          Mining kapasitesi:{" "}
          <strong>
            {game.sessions.length}/{capacity}
          </strong>
        </p>
        <p className="text-sm muted">
          Tüm garajlarının bonusu birlikte, 24 saatte bir toplanır.
        </p>
        <button
          className="cyber-button disabled:opacity-40"
          disabled={busy || !ready || totalBonus <= 0}
          onClick={() => void collect()}
        >
          {busy
            ? "İşleniyor…"
            : ready
              ? `Bonusu Topla · ${formatCurrency(totalBonus)} NMFP`
              : `Sonraki bonus · ${duration(Date.parse(user.last_bonus_collected_at!) + 86400000 - now)}`}
        </button>
      </section>
      <div role="tablist" aria-label="Garajlar" className="flex gap-3">
        <button
          role="tab"
          aria-selected={tab === "owned"}
          className="cyber-button"
          onClick={() => setTab("owned")}
        >
          Garajlarım · {game.garages.length}
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
      <div className="grid md:grid-cols-2 gap-4">
        {tab === "owned"
          ? game.garages.map((g) => (
              <article key={g.id} className="cyber-panel overflow-hidden">
                <div className="relative h-40">
                  <Image
                    src={g.image_url || "/cars/garage/garaj-10.jpg"}
                    alt={g.name}
                    fill
                    sizes="(max-width:760px) 100vw, 450px"
                    className="object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="font-semibold">{g.name}</h2>
                  <p className="text-sm muted">
                    {g.capacity} mining slotu · {formatCurrency(g.daily_bonus)}{" "}
                    NMFP günlük bonus
                  </p>
                </div>
              </article>
            ))
          : game.templates.map((t) => {
              const owned = game.garages.some((g) => g.template_id === t.id),
                stars = t.purchase_type === "ton",
                price = stars ? t.stars_price : t.price;
              return (
                <article key={t.id} className="cyber-panel overflow-hidden">
                  <div className="relative h-40">
                    <Image
                      src={t.image || "/cars/garage/garaj-10.jpg"}
                      alt={t.name}
                      fill
                      sizes="(max-width:760px) 100vw, 450px"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <h2 className="font-semibold">{t.name}</h2>
                    <p className="text-sm muted">
                      {t.capacity} mining slotu ·{" "}
                      {formatCurrency(
                        t.purchase_type === "ton"
                          ? Math.round(t.daily_bonus * 1.2)
                          : t.daily_bonus,
                      )}{" "}
                      NMFP günlük bonus
                    </p>
                    <button
                      className="cyber-button w-full disabled:opacity-40"
                      disabled={
                        busy ||
                        owned ||
                        !price ||
                        (!stars && user.balance < Number(price))
                      }
                      onClick={() => void buy(t)}
                    >
                      {owned
                        ? "Garajında mevcut"
                        : `${formatCurrency(Number(price || 0))} ${stars ? "Stars" : "NMFP"}`}
                    </button>
                  </div>
                </article>
              );
            })}
      </div>
      {tab === "owned" && !game.garages.length && (
        <p className="muted">
          Henüz garajın yok. Mining başlatmak için mağazadan bir garaj edin.
        </p>
      )}
    </div>
  );
}
