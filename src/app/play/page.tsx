export default function Play() {
  return (
    <div className="space-y-16">
      <section className="text-center animate-fade-in pt-10">
        <h1 className="text-5xl font-bold mb-6 gradient-text">Play Now</h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Join the Need Money For Porsche Telegram game and start your journey to winning big.
        </p>
      </section>

      <section className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 gradient-text">How to Play</h2>
        
        <div className="space-y-12">
          <div className="grid md:grid-cols-[1fr_3fr] gap-8 items-start blur-bg p-6">
            <div className="bg-zinc-900 p-6 rounded-lg text-center animate-pulse-slow">
              <span className="text-4xl font-bold">01</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Join Our Telegram Channel</h3>
              <p className="text-gray-400 mb-4">
                The game is hosted entirely on Telegram. Join our official channel to get started.
              </p>
              <a 
                href="https://t.me/needmoneyforporschewtf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="web3-button inline-block bg-white text-black px-6 py-2 rounded-md font-medium hover:text-white transition-colors"
              >
                Join Telegram Channel
              </a>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_3fr] gap-8 items-start blur-bg p-6">
            <div className="bg-zinc-900 p-6 rounded-lg text-center animate-pulse-slow">
              <span className="text-4xl font-bold">02</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Start with Free Credits</h3>
              <p className="text-gray-400 mb-4">
                New players receive a welcome bonus of credits to get started. Use the /start command in our bot.
              </p>
              <div className="bg-zinc-900 p-3 rounded font-mono text-sm mb-4 animate-glow">
                /start
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_3fr] gap-8 items-start blur-bg p-6">
            <div className="bg-zinc-900 p-6 rounded-lg text-center animate-pulse-slow">
              <span className="text-4xl font-bold">03</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Make Strategic Decisions</h3>
              <p className="text-gray-400 mb-4">
                Choose when to invest, when to hold, and when to take risks. Every decision matters in your path to earning your Porsche.
              </p>
              <div className="bg-zinc-900 p-3 rounded font-mono text-sm mb-4 animate-glow">
                /invest [amount]
              </div>
              <div className="bg-zinc-900 p-3 rounded font-mono text-sm animate-glow">
                /strategy
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_3fr] gap-8 items-start blur-bg p-6">
            <div className="bg-zinc-900 p-6 rounded-lg text-center animate-pulse-slow">
              <span className="text-4xl font-bold">04</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Track Your Progress</h3>
              <p className="text-gray-400 mb-4">
                Monitor your earnings, achievements, and position on the leaderboard.
              </p>
              <div className="bg-zinc-900 p-3 rounded font-mono text-sm mb-4 animate-glow">
                /status
              </div>
              <div className="bg-zinc-900 p-3 rounded font-mono text-sm animate-glow">
                /leaderboard
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 p-10 rounded-lg max-w-4xl mx-auto blur-bg">
        <h2 className="text-3xl font-bold mb-6 text-center gradient-text">Ready to Start?</h2>
        <p className="text-center text-xl mb-8">
          Join thousands of players already on their way to earning their dream Porsche.
        </p>
        <div className="flex justify-center">
          <a 
            href="https://t.me/NMFP_bot" 
            target="_blank" 
            rel="noopener noreferrer"
            className="web3-button inline-block bg-white text-black px-10 py-4 rounded-md font-medium text-lg hover:text-white transition-colors"
          >
            Start Playing on Telegram
          </a>
        </div>
      </section>
    </div>
  );
} 