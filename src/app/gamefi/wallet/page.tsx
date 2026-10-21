"use client";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { useTelegram } from "@/components/TelegramInitProvider";
import { orderStatus, transactionAmount } from "@/lib/gameState";
import { formatCurrency } from "@/app/utils/formatters";
export default function WalletPage() {
  const { game, user } = useTelegram();
  const address = useTonAddress();
  if (!game) return <p role="status">Cüzdan yükleniyor…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cüzdan & siparişler</h1>
      <section className="cyber-panel p-5">
        <p className="text-sm muted">Oyun içi bakiye</p>
        <p className="text-3xl font-bold mt-2">
          {formatCurrency(user?.balance || 0)} NMFP
        </p>
        <p className="text-xs muted mt-2">
          NMFP bir oyun puanıdır; nakit veya kripto para karşılığı yoktur.
        </p>
      </section>
      <section className="cyber-panel p-5 space-y-3">
        <h2 className="font-semibold">TON cüzdanı</h2>
        <TonConnectButton />
        {address && <p className="text-xs break-all muted">{address}</p>}
        <p className="text-sm muted">
          Cüzdan bağlantısı isteğe bağlıdır. Oyun içi ödemeler Telegram Stars
          ile yapılır.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stars siparişleri</h2>
        {game.orders.length ? (
          game.orders.map((o) => (
            <article key={o.id} className="cyber-panel p-4">
              <p>
                {o.title} · {o.amount} Stars
              </p>
              <p className="text-sm muted">{orderStatus(o.status)}</p>
              <p className="text-xs muted break-all mt-2">Sipariş: {o.id}</p>
            </article>
          ))
        ) : (
          <p className="text-sm muted">Henüz sipariş yok.</p>
        )}
        <a href="/support" className="text-sm underline">
          Ödeme desteği / iade talebi
        </a>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Son 50 oyun işlemi</h2>
        {game.transactions.length ? (
          game.transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex justify-between gap-4 text-sm border-b border-white/10 py-3"
            >
              <div>
                <p>{tx.item || tx.source || tx.type}</p>
                <time dateTime={tx.date} className="text-xs muted">
                  {new Date(tx.date).toLocaleString("tr-TR")}
                </time>
              </div>
              <span className="whitespace-nowrap">
                {formatCurrency(transactionAmount(tx))}{" "}
                {tx.currency === "XTR" ? "Stars" : tx.currency}
              </span>
            </div>
          ))
        ) : (
          <p className="muted">Henüz işlem yok.</p>
        )}
      </section>
    </div>
  );
}
