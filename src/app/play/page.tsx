import Link from "next/link";
export default function Play() {
  return (
    <section className="guide-page">
      <p className="eyebrow">PLAYER MANUAL // 01</p>
      <h1>Your first NMFP garage.</h1>
      <p className="guide-intro">
        Need Money for Porsche is a demo game. Open the Telegram bot, read the
        demo notice and start your first simulated mining cycle.
      </p>
      <div className="feature-grid">
        {[
          [
            "01",
            "Open the garage",
            "Open @NMFP_bot in Telegram and tap the game button. Your Telegram account saves your progress.",
          ],
          [
            "02",
            "Prepare your car",
            "New players start with a free car and garage. Check fuel, condition and available garage slots.",
          ],
          [
            "03",
            "Start a cycle",
            "Send a ready car on an eight-hour mining cycle. Completed cycles award in-game NMFP points.",
          ],
          [
            "04",
            "Build your collection",
            "Spend points on cars, fuel, repairs and garages. Optional upgrades use Telegram Stars.",
          ],
        ].map(([n, t, b]) => (
          <article className="feature-panel" key={n}>
            <p className="eyebrow">{n}</p>
            <h2>{t}</h2>
            <p>{b}</p>
          </article>
        ))}
      </div>
      <a className="cyber-button" href="https://t.me/NMFP_bot">
        OPEN IN TELEGRAM ↗
      </a>
      <p className="hero-note">
        Demo only. No income or payouts are offered or guaranteed. NMFP points
        cannot be withdrawn or exchanged for money.{" "}
        <Link href="/terms">Purchase terms</Link>
      </p>
    </section>
  );
}
