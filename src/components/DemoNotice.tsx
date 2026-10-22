"use client";
import Link from "next/link";
import Image from "next/image";
export default function DemoNotice({ onContinue }: { onContinue: () => void }) {
  return (
    <section
      className="demo-gate"
      lang="en"
      aria-labelledby="demo-title"
      aria-describedby="demo-description"
    >
      <div className="demo-card">
        <Image
          className="demo-emblem"
          src="/gamefi/favicon/android-icon-192x192.png"
          alt="NMFP neon triangle emblem"
          width={128}
          height={128}
          priority
        />
        <p className="eyebrow">NMFP / NEED MONEY FOR PORSCHE</p>
        <h1 id="demo-title">
          A dream garage.
          <br />
          <span>A demo game.</span>
        </h1>
        <p className="demo-label">DEMO ONLY · NO EARNINGS OR PAYOUTS</p>
        <div id="demo-description" className="demo-copy">
          <p>
            Need Money for Porsche is an experimental demo made for
            entertainment. It does not offer or guarantee income, payouts,
            investment returns, or a real Porsche.
          </p>
          <p>
            Mining is simulated. NMFP points have no cash value and cannot be
            withdrawn or exchanged for money.
          </p>
          <p>
            Optional Telegram Stars purchases cost real money. They buy game
            features or collectibles, not earnings or a promise of profit. You
            can play without buying anything.
          </p>
        </div>
        <button className="cyber-button demo-continue" onClick={onContinue}>
          I understand — enter demo <span aria-hidden="true">↗</span>
        </button>
        <p className="demo-fan-note">
          Independent fan project. Not affiliated with or endorsed by Porsche
          AG.
        </p>
        <nav className="demo-links" aria-label="Demo information">
          <Link href="/terms">Purchase terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
        </nav>
      </div>
    </section>
  );
}
