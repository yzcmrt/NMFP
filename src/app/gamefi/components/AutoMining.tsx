"use client";
import { toast } from "react-hot-toast";
import { useTelegram } from "@/components/TelegramInitProvider";
import { starsCheckout } from "@/lib/starsCheckout";
import { gameAction } from "@/lib/gameActions";
export default function AutoMining() {
  const { user, busy, runOperation } = useTelegram();
  const active = Boolean(
    user?.premium_active &&
    user.premium_until &&
    Date.parse(user.premium_until) > Date.now(),
  );
  async function purchase() {
    try {
      await runOperation(async () => {
        await starsCheckout("premium", "annual");
        toast.success("Otomatik mining paketi aktif.");
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ödeme tamamlanamadı.");
    }
  }
  async function toggle() {
    try {
      await runOperation(async () => {
        await gameAction("set_auto_mining", { enabled: !user?.auto_mining });
        toast.success(
          user?.auto_mining
            ? "Yeni otomatik turlar durduruldu. Mevcut turlar devam ediyor."
            : "Otomatik mining açıldı. Uygun araçlar bir dakika içinde başlar.",
        );
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ayar kaydedilemedi.");
    }
  }
  return (
    <section className="cyber-panel p-5 space-y-3">
      <h2 className="font-semibold text-lg">Otomatik mining</h2>
      <p className="text-sm muted">
        Boş kapasite olduğunda uygun araçlar için turları otomatik başlatır. Her
        tur öncesinde yakıt ve bakım maliyeti NMFP bakiyenden düşer. Bakiye
        yetersizse araç bekler.
      </p>
      {active ? (
        <>
          <p className="text-green-300">
            Paket aktif ·{" "}
            {new Date(user!.premium_until!).toLocaleDateString("tr-TR")}{" "}
            tarihine kadar
          </p>
          <button
            disabled={busy}
            className="cyber-button disabled:opacity-40"
            onClick={() => void toggle()}
          >
            {user?.auto_mining
              ? "Otomatik turları duraklat"
              : "Otomatik turları başlat"}
          </button>
        </>
      ) : (
        <button
          disabled={busy}
          onClick={() => void purchase()}
          className="cyber-button disabled:opacity-40"
        >
          199 Stars · 365 gün
        </button>
      )}
      <p className="text-xs muted">
        Tek seferlik ödeme. Abonelik otomatik yenilenmez.{" "}
        <a href="/terms" className="underline">
          Satın alma koşulları
        </a>
      </p>
    </section>
  );
}
