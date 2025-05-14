export default function Tokenomics() {
  return (
    <div className="space-y-16">
      <section className="text-center animate-fade-in pt-10">
        <h1 className="text-5xl font-bold mb-6 gradient-text">Tokenomics</h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Understanding the economic system behind Need Money For Porsche.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-16 max-w-6xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold mb-8 gradient-text">Token Distribution</h2>
          <div className="bg-zinc-900 p-8 rounded-lg blur-bg">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Player Rewards</span>
                  <span className="font-bold">40%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden animate-glow">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-800" style={{ width: '40%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span>Liquidity Pool</span>
                  <span className="font-bold">25%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden animate-glow">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-800" style={{ width: '25%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span>Development</span>
                  <span className="font-bold">20%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden animate-glow">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-800" style={{ width: '20%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span>Marketing</span>
                  <span className="font-bold">10%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden animate-glow">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-800" style={{ width: '10%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span>Team</span>
                  <span className="font-bold">5%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden animate-glow">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-800" style={{ width: '5%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-8 gradient-text">Token Utility</h2>
          <div className="space-y-6">
            <div className="bg-zinc-900 p-6 rounded-lg blur-bg">
              <h3 className="text-xl font-bold mb-3">In-Game Currency</h3>
              <p className="text-gray-400">
                NMFP tokens serve as the primary currency within the game ecosystem, allowing players to make strategic moves and investments.
              </p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-lg blur-bg">
              <h3 className="text-xl font-bold mb-3">Rewards & Earnings</h3>
              <p className="text-gray-400">
                Players earn NMFP tokens through successful gameplay, daily activities, and special events. The better your strategy, the more you earn.
              </p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-lg blur-bg">
              <h3 className="text-xl font-bold mb-3">Governance</h3>
              <p className="text-gray-400">
                Token holders can participate in critical game decisions, feature proposals, and community initiatives.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 gradient-text">Token Economics</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 p-8 rounded-lg blur-bg">
            <h3 className="text-2xl font-bold mb-4">Supply Model</h3>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Total Supply:</strong> 1,000,000,000 NMFP tokens</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Initial Circulating Supply:</strong> 250,000,000 NMFP tokens</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Token Release Schedule:</strong> Linear vesting over 48 months for team and development allocations</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-zinc-900 p-8 rounded-lg blur-bg">
            <h3 className="text-2xl font-bold mb-4">Sustainability</h3>
            <ul className="space-y-4 text-gray-400">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Burn Mechanism:</strong> 2% of all in-game transactions are burned, creating deflationary pressure</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Treasury:</strong> 5% of transactions go to the community treasury for future development</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-purple-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Staking Rewards:</strong> Players can stake tokens for additional passive income</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 p-10 rounded-lg max-w-4xl mx-auto text-center blur-bg">
        <h2 className="text-3xl font-bold mb-6 gradient-text">Ready to Earn?</h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          Start playing today and become part of our thriving economic ecosystem.
        </p>
        <a 
          href="https://t.me/needmoneyforporschewtf" 
          target="_blank" 
          rel="noopener noreferrer"
          className="web3-button inline-block bg-white text-black px-10 py-4 rounded-md font-medium text-lg hover:text-white transition-colors"
        >
          Join Our Community
        </a>
      </section>
    </div>
  );
} 