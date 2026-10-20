import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="text-center py-20 animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 gradient-text">
          Need Money For Porsche
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10">
          Build your virtual garage in Telegram. Manage cars, collect in-game NMFP points and expand your collection.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/play" 
            className="web3-button inline-block bg-white text-black px-8 py-3 rounded-md font-medium hover:text-white transition-colors"
          >
            Start Playing
          </Link>
          <Link 
            href="/tokenomics" 
            className="inline-block bg-transparent text-white border border-white px-8 py-3 rounded-md font-medium hover:bg-white/10 transition-colors animate-glow"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-2 gap-16">
        <div className="space-y-6 blur-bg p-6">
          <h2 className="text-3xl font-bold gradient-text">Simple, Strategic Gameplay</h2>
          <p className="text-gray-400">
            Our game combines simplicity with deep strategy. Make the right moves, time your actions perfectly, and grow your garage over time.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Intuitive gameplay mechanics</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Real-time updates and stats</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Personal mining statistics</span>
            </li>
          </ul>
        </div>
        <div className="space-y-6 blur-bg p-6">
          <h2 className="text-3xl font-bold gradient-text">Build Your Collection</h2>
          <p className="text-gray-400">
            Send your cars on eight-hour mining sessions, maintain their fuel and condition, and spend the points you collect inside the game.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Rewarding gameplay mechanics</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Daily bonuses and rewards</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-purple-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Optional upgrades with Telegram Stars</span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-16">
        <h2 className="text-4xl font-bold mb-6 gradient-text">Ready to Start Your Journey?</h2>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
          Start with a free virtual car and garage. NMFP points have no cash value and cannot be withdrawn.
        </p>
        <Link 
          href="/play" 
          className="web3-button inline-block bg-white text-black px-10 py-4 rounded-md font-medium text-lg hover:text-white transition-colors"
        >
          Start Playing Now
        </Link>
      </section>
    </div>
  );
}
