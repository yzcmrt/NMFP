import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <Image
          src="/cars/garage/garaj-10.jpg"
          alt="Neon-lit garage with sports cars and mining rigs"
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> NMFP / TELEGRAM DEMO GAME
          </p>
          <h1>
            NEED MONEY
            <br />
            FOR <em>PORSCHE.</em>
          </h1>
          <p className="hero-description">
            The dream is a Porsche. The game is a neon-lit garage.
            <br />
            Collect virtual cars, run simulated mining cycles and build your
            dream collection — just for fun.
          </p>
          <div className="hero-actions">
            <a href="https://t.me/NMFP_bot" className="cyber-button">
              PLAY THE DEMO <span>↗</span>
            </a>
            <Link href="/play" className="text-link">
              How it works <span>→</span>
            </Link>
          </div>
          <p className="hero-note">
            Free starter car + garage. No wallet required. Demo only — no
            earnings or payouts.
          </p>
        </div>
        <div className="hero-caption">
          <span>NEED MONEY FOR PORSCHE</span>
          <span>DREAM. BUILD. PLAY.</span>
        </div>
      </section>
      <div className="landing-strip">
        <span>01 / COLLECT CARS</span>
        <span>02 / RUN MINING CYCLES</span>
        <span>03 / EXPAND YOUR GARAGE</span>
      </div>
      <section className="landing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE GAME LOOP</p>
            <h2>
              From one car
              <br />
              to a whole operation.
            </h2>
          </div>
          <p>
            Every cycle starts with a ready car.
            <br />
            Keep it fueled. Keep it running.
          </p>
        </div>
        <div className="feature-grid">
          {[
            [
              "01",
              "BUILD YOUR FLEET",
              "Start with a free car. Use NMFP points to add new models to your collection.",
              "↗",
            ],
            [
              "02",
              "RUN THE SHIFT",
              "Assign cars to garage slots for eight-hour mining cycles. Maintain fuel and condition between runs.",
              "⌁",
            ],
            [
              "03",
              "UPGRADE YOUR SETUP",
              "Expand garage capacity and unlock optional upgrades with Telegram Stars.",
              "+",
            ],
          ].map(([number, title, body, icon]) => (
            <article className="feature-panel" key={number}>
              <div className="feature-index">
                <span>{number} / NMFP</span>
                <b aria-hidden="true">{icon}</b>
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-disclosure">
        <span className="eyebrow">DEMO / NOT AN INCOME PRODUCT</span>
        <p>
          Need Money for Porsche is an experimental demo, not an income or
          investment product. No earnings, payouts, returns or real cars are
          promised or guaranteed. Mining is simulated; NMFP points have no cash
          value and cannot be withdrawn. Optional Telegram Stars purchases cost
          real money and do not generate earnings.
        </p>
        <Link href="/tokenomics" className="text-link">
          Explore the economy →
        </Link>
      </section>
    </div>
  );
}
