"use client";
import { transactionAmount } from "@/lib/gameState";
import Link from "next/link";
import Image from "next/image";
import MiningArea from "./components/MiningArea";
import AutoMining from "./components/AutoMining";
import { useTelegram } from "@/components/TelegramInitProvider";
import { formatCurrency } from "@/app/utils/formatters";

export default function GameFiPage() {
  const { user, telegramUser, game: data } = useTelegram();
  const balance = user?.balance || 0;
  const active = data?.sessions.length;
  const capacity = data?.garages.reduce((sum, g) => sum + g.capacity, 0);
  return (
    <div className="command-deck">
      <div className="deck-heading">
        <div>
          <p className="eyebrow">OPERATOR / LVL {user?.level ?? 1}</p>
          <h1>
            {user?.username || telegramUser?.first_name || "Oyuncu"}
            <span className="cursor-mark">_</span>
          </h1>
        </div>
        <span className="operator-xp">
          {user?.xp?.toLocaleString() ?? 0} XP
        </span>
      </div>
      <section className="garage-banner">
        <Image
          src="/cars/garage/garaj-10.jpg"
          alt="Neon garaj"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 900px"
        />
        <div className="garage-banner-shade" />
        <div className="garage-banner-copy">
          <p className="eyebrow">NIGHT SHIFT // KONTROL MERKEZİ</p>
          <h2>
            Garaj senin.
            <br />
            Sıradaki hamle de.
          </h2>
          <Link href="/gamefi/car" className="text-link">
            Araç koleksiyonu ↗
          </Link>
        </div>
      </section>
      <section className="balance-panel">
        <div>
          <p className="eyebrow">OYUN BAKİYESİ</p>
          <strong>
            {formatCurrency(balance)} <small>NMFP</small>
          </strong>
        </div>
        <Link
          href="/gamefi/wallet"
          className="round-link"
          aria-label="Bakiye ve işlem geçmişi"
        >
          ↗
        </Link>
      </section>
      <div className="deck-stats">
        <Link href="/gamefi/car">
          <span>ARAÇ</span>
          <strong>{data?.cars.length ?? "—"}</strong>
        </Link>
        <Link href="/gamefi/garage">
          <span>GARAJ SLOTU</span>
          <strong>{capacity ?? "—"}</strong>
        </Link>
        <div>
          <span>AKTİF TUR</span>
          <strong>
            {active ?? "—"}
            <i className={active ? "status-dot" : ""} />
          </strong>
        </div>
      </div>
      <div className="deck-section-label">
        <h2>Üretim kontrolü</h2>
        <span>01 / OPERATIONS</span>
      </div>
      <MiningArea />
      <AutoMining />
      <section className="cyber-panel transaction-panel">
        <div className="deck-section-label">
          <h2>Son işlemler</h2>
          <Link href="/gamefi/wallet">TÜMÜ ↗</Link>
        </div>
        {!data ? (
          <p className="muted" role="status">
            İşlemler yükleniyor…
          </p>
        ) : data.transactions.length === 0 ? (
          <p className="muted">İlk turunla işlem geçmişin burada oluşacak.</p>
        ) : (
          <ul>
            {data.transactions.slice(0, 5).map((t) => (
              <li key={t.id}>
                <div>
                  <strong>
                    {t.item || t.source || t.type.replaceAll("_", " ")}
                  </strong>
                  <time dateTime={t.date}>
                    {new Date(t.date).toLocaleString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <span>
                  {formatCurrency(transactionAmount(t))}{" "}
                  <small>{t.currency === "XTR" ? "Stars" : t.currency}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
