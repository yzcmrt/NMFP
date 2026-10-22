"use client";
import { useCallback, useEffect, useState } from "react";
import { TonConnectButton, useTonWallet } from "@tonconnect/ui-react";
import { toast } from "react-hot-toast";
import { useTelegram } from "./TelegramInitProvider";
import { starsCheckout } from "@/lib/starsCheckout";
import { COLLECTION } from "@/lib/nft/config";
type Status = {
  ready: boolean;
  reason: string | null;
  upgradeStars: number;
  jobs: Array<{
    id: string;
    car_id: number;
    state: string;
    item_address: string | null;
  }>;
};
export default function NftGarage() {
  const { game, busy, runOperation } = useTelegram(),
    wallet = useTonWallet();
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [kind, setKind] = useState<"nft_upgrade" | "nft_car">("nft_upgrade"),
    [selected, setSelected] = useState(""),
    [accepted, setAccepted] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nft/status", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || "NFT kayıtları yüklenemedi.");
      setStatus(d);
      setError("");
    } catch {
      setError("NFT durumu yüklenemedi. Tekrar deneyin.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const t = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);
  if (!game) return null;
  const choices =
    kind === "nft_upgrade"
      ? game.cars
          .filter(
            (c) =>
              c.status !== "sold" &&
              !status?.jobs.some((j) => j.car_id === c.id),
          )
          .map((c) => ({
            id: String(c.id),
            name: c.name,
            price: status?.upgradeStars || 0,
          }))
      : game.models
          .filter((m) => !game.cars.some((c) => c.car_model_id === m.id))
          .map((m) => ({
            id: m.id,
            name: m.name,
            price: Number(m.stars_price) + (status?.upgradeStars || 0),
          }));
  const choice = choices.find((c) => c.id === selected),
    recipient =
      wallet?.account.chain === "-239" ? wallet.account.address : null;
  async function buy() {
    if (!choice || !recipient) return;
    try {
      await runOperation(() => starsCheckout(kind, choice.id, recipient));
      toast.success(
        "Ödeme doğrulandı. NFT otomatik teslimat kuyruğuna eklendi.",
      );
      setSelected("");
      setAccepted(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      await refresh();
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">TON NFT koleksiyonu</h2>
      <p className="muted text-sm">
        Garajındaki araçtan bir koleksiyon NFT’si oluştur veya yeni araç ve
        NFT’yi birlikte al. Mint otomatik yapılır; NFT belirtilen TON cüzdanına
        gönderilir. NFT’yi devretmek oyun içi aracı veya mining ilerlemesini
        devretmez.
      </p>
      <a
        className="underline text-sm"
        href={`https://getgems.io/collection/${COLLECTION}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Koleksiyonu Getgems’te gör ↗
      </a>
      {error ? (
        <div role="alert">
          {error} <button onClick={() => void refresh()}>Yenile</button>
        </div>
      ) : !status ? (
        <p role="status">NFT servisi kontrol ediliyor…</p>
      ) : !status.ready ? (
        <p role="status" className="cyber-panel p-4">
          {status.reason}
        </p>
      ) : null}
      <div className="cyber-panel p-5 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <button
            className="cyber-button"
            aria-pressed={kind === "nft_upgrade"}
            onClick={() => {
              setKind("nft_upgrade");
              setSelected("");
              setAccepted(false);
            }}
          >
            Garajımdaki araç → NFT
          </button>
          <button
            className="cyber-button"
            aria-pressed={kind === "nft_car"}
            onClick={() => {
              setKind("nft_car");
              setSelected("");
              setAccepted(false);
            }}
          >
            Yeni araç + NFT
          </button>
        </div>
        <label className="block text-sm">
          Araç
          <select
            className="block w-full bg-[#101b23] border border-white/20 rounded p-3 mt-2"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setAccepted(false);
            }}
          >
            <option value="">Araç seç</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.price} Stars
              </option>
            ))}
          </select>
        </label>
        {choices.length === 0 && (
          <p className="muted text-sm">Bu seçenek için uygun araç yok.</p>
        )}
        <TonConnectButton />
        {wallet && !recipient && (
          <p role="alert">TON mainnet cüzdanı bağlayın.</p>
        )}
        {recipient && (
          <p className="text-xs break-all">NFT alıcı adresi: {recipient}</p>
        )}
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Alıcı adresini kontrol ettim. NFT teslimat adresi ödeme sonrası
          değiştirilemez.
        </label>
        <button
          className="cyber-button disabled:opacity-40"
          disabled={
            busy ||
            !status?.ready ||
            Boolean(error) ||
            !choice ||
            !recipient ||
            !accepted
          }
          onClick={() => void buy()}
        >
          {choice
            ? `${choice.price} Stars ile ${kind === "nft_car" ? "araç + NFT al" : "NFT oluştur"}`
            : "Önce araç ve cüzdan seç"}
        </button>
        <p className="text-xs muted">
          Tek seferlik Stars ödemesi. NFT için ayrıca TON göndermen veya mesaj
          imzalaman istenmez. Zincir onayı beklenirken tekrar ödeme yapma.
        </p>
      </div>
      <h3 className="font-semibold">NFT teslimatların</h3>
      {status?.jobs.map((j) => (
        <article key={j.id} className="cyber-panel p-4 space-y-2">
          <p>{game.cars.find((c) => c.id === j.car_id)?.name || "Araç NFT"}</p>
          <p className="text-sm muted">
            {
              (
                {
                  queued: "Otomatik mint sırasında",
                  prepared: "Zincir onayı bekleniyor",
                  minted: "NFT teslimatı doğrulandı",
                  review: "Teslimat incelemede; tekrar ödeme yapma",
                } as Record<string, string>
              )[j.state]
            }
          </p>
          {j.state === "minted" && j.item_address && (
            <a
              className="underline text-sm break-all"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://getgems.io/nft/${j.item_address}`}
            >
              NFT’yi görüntüle ↗
            </a>
          )}
          <p className="text-xs muted break-all">Talep: {j.id}</p>
        </article>
      ))}
      {status && !status.jobs.length && (
        <p className="muted text-sm">Henüz NFT talebin yok.</p>
      )}
      <a href="/support" className="underline text-sm">
        NFT / ödeme desteği
      </a>
    </section>
  );
}
