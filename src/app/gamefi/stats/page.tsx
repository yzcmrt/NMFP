"use client";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTelegram } from "@/components/TelegramInitProvider";
import { formatCurrency } from "@/app/utils/formatters";
interface Stats {
  daily: { day: string; reward: number; tours: number }[];
  cars: { name: string; reward: number; tours: number }[];
  totalReward: number;
  tours: number;
  unknownRewards: number;
  days: number;
}
export default function StatsPage() {
  const { user } = useTelegram();
  const [days, setDays] = useState(7),
    [retry, setRetry] = useState(0),
    [data, setData] = useState<Stats | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    setData(null);
    setError("");
    void fetch(`/api/game/stats?days=${days}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw new Error(body.message || "İstatistikler yüklenemedi.");
        setData(body);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [user?.id, days, retry]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mining istatistikleri</h1>
        <label className="text-sm">
          Dönem{" "}
          <select
            className="bg-[#101b23] rounded p-2 border border-white/20"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Bugün</option>
            <option value={7}>7 gün</option>
            <option value={30}>30 gün</option>
            <option value={90}>90 gün</option>
          </select>
        </label>
        <button
          className="text-sm underline"
          onClick={() => setRetry((n) => n + 1)}
        >
          Yenile
        </button>
      </div>
      <p className="text-xs muted">
        Günler UTC saatine göre hesaplanır. Yalnızca kayıtlı mining ödülleri
        gösterilir; görev ve garaj bonusları dahil değildir.
      </p>
      {error ? (
        <p role="alert" className="data-alert">
          {error}
        </p>
      ) : !data ? (
        <p role="status">İstatistikler yükleniyor…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <section className="cyber-panel p-5">
              <p className="text-sm muted">Mining ödülü</p>
              <p className="text-xl font-bold">
                {formatCurrency(data.totalReward)} NMFP
              </p>
            </section>
            <section className="cyber-panel p-5">
              <p className="text-sm muted">Tamamlanan tur</p>
              <p className="text-xl font-bold">{data.tours}</p>
            </section>
          </div>
          {data.unknownRewards > 0 && (
            <p className="text-sm muted">
              {data.unknownRewards} eski turun ödül tutarı kayıtlı değil; toplam
              kazanca eklenmedi.
            </p>
          )}
          <section className="cyber-panel p-4">
            <h2 className="font-semibold mb-4">Günlük kazanç</h2>
            <div style={{ height: 260, width: "100%", minWidth: 0 }}>
              <ResponsiveContainer>
                <AreaChart data={data.daily}>
                  <CartesianGrid stroke="#253a44" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => String(v).slice(5)}
                    stroke="#91a5ac"
                  />
                  <YAxis stroke="#91a5ac" />
                  <Tooltip
                    contentStyle={{
                      background: "#101b23",
                      border: "1px solid #35505b",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="reward"
                    name="NMFP"
                    stroke="#43c9d6"
                    fill="#43c9d6"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {data.tours === 0 && (
              <p className="text-sm muted">
                Bu dönemde tamamlanmış mining turu yok.
              </p>
            )}
          </section>
          <section className="cyber-panel p-5 space-y-3">
            <h2 className="font-semibold">Araç performansı</h2>
            {data.cars.map((c) => (
              <div key={c.name} className="flex justify-between gap-3 text-sm">
                <span>
                  {c.name} · {c.tours} tur
                </span>
                <span>{formatCurrency(c.reward)} NMFP</span>
              </div>
            ))}
            {!data.cars.length && (
              <p className="text-sm muted">
                Tamamlanan turlar burada görünecek.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
