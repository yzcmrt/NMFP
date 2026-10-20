import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return <div className="landing">
    <section className="landing-hero">
      <Image src="/cars/garage/garaj-10.jpg" alt="Neon-lit garage with sports cars and mining rigs" fill priority sizes="100vw" className="hero-image" />
      <div className="hero-shade" />
      <div className="hero-copy">
        <p className="eyebrow"><span className="status-dot" /> TELEGRAM MINING SIMULATOR</p>
        <h1>YOUR GARAGE.<br />YOUR <em>NIGHT SHIFT.</em></h1>
        <p className="hero-description">Build a fleet. Power the rigs. Own the night.<br />A cyberpunk garage built around cars, strategy and in-game mining.</p>
        <div className="hero-actions"><a href="https://t.me/NMFP_bot" className="cyber-button">ENTER THE GARAGE <span>↗</span></a><Link href="/play" className="text-link">How it works <span>→</span></Link></div>
        <p className="hero-note">Free starter car + garage. No wallet required.</p>
      </div>
      <div className="hero-caption"><span>NMFP // NIGHT SHIFT</span><span>BUILD. MINE. REPEAT.</span></div>
    </section>
    <div className="landing-strip"><span>01 / COLLECT CARS</span><span>02 / RUN MINING CYCLES</span><span>03 / EXPAND YOUR GARAGE</span></div>
    <section className="landing-section">
      <div className="section-heading"><div><p className="eyebrow">THE GAME LOOP</p><h2>From one car<br />to a whole operation.</h2></div><p>Every cycle starts with a ready car.<br />Keep it fueled. Keep it running.</p></div>
      <div className="feature-grid">{[
        ['01', 'BUILD YOUR FLEET', 'Start with a free car. Use NMFP points to add new models to your collection.', '↗'],
        ['02', 'RUN THE SHIFT', 'Assign cars to garage slots for eight-hour mining cycles. Maintain fuel and condition between runs.', '⌁'],
        ['03', 'UPGRADE YOUR SETUP', 'Expand garage capacity and unlock optional upgrades with Telegram Stars.', '+'],
      ].map(([number,title,body,icon])=><article className="feature-panel" key={number}><div className="feature-index"><span>{number} / NMFP</span><b aria-hidden="true">{icon}</b></div><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>
    <section className="landing-disclosure"><span className="eyebrow">GAME ECONOMY</span><p>NMFP is an in-game point system, not real cryptocurrency mining. Points have no cash value and cannot be withdrawn. Optional purchases use Telegram Stars.</p><Link href="/tokenomics" className="text-link">Explore the economy →</Link></section>
  </div>;
}
