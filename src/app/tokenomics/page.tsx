import Link from "next/link";
export default function Economy() {
  return (
    <article className="max-w-3xl mx-auto py-12 space-y-8">
      <h1 className="text-4xl font-bold gradient-text">NMFP demo economy</h1>
      <section className="blur-bg p-6 space-y-4">
        <h2 className="text-2xl font-bold">NMFP points</h2>
        <p>
          Need Money for Porsche is a demo with no income or payout guarantee.
          NMFP is an in-game score, not a traded cryptocurrency. Collect points
          through eight-hour car mining sessions, garage bonuses and verified
          tasks. Spend them on cars, garages, fuel and repairs.
        </p>
        <p>
          Points, virtual cars and garages have no cash value. There is no cash
          withdrawal, staking service, guaranteed return or promised token
          launch.
        </p>
      </section>
      <section className="blur-bg p-6 space-y-4">
        <h2 className="text-2xl font-bold">
          Optional Telegram Stars purchases
        </h2>
        <p>
          Cars cost 50, 100, 250 or 500 Stars depending on rarity. Garage prices
          appear in the store. Automatic mining costs 199 Stars for 365 days,
          paid once with no automatic renewal.
        </p>
        <p>
          Telegram confirms each payment before the server delivers the item. A
          TON wallet is not needed for ordinary gameplay or virtual-item
          purchases. When NFT sales are enabled, the collectible requires a TON
          recipient address.
        </p>
        <p>
          Virtual cars purchased with Stars have a 20% mining multiplier; Stars
          garages have a 20% daily bonus. Ordinary car and garage purchases are
          game items. The separate NFT option, when enabled, creates a
          collectible; it carries no guaranteed resale value or return.
        </p>
      </section>
      <p>
        NMFP is an independent fan project and is not affiliated with Porsche.
      </p>
      <Link className="underline" href="/terms">
        Purchase terms
      </Link>
    </article>
  );
}
