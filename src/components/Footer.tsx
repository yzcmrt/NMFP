'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaTwitter, FaTelegram } from 'react-icons/fa';


const Footer = () => {
  const pathname = usePathname();
  const shouldRender = !pathname?.startsWith('/gamefi');

  const year = new Date().getFullYear();
  
  // GameFi sayfalarında veya subdomain'de Footer'ı gösterme
  if (!shouldRender) {
    return null;
  }

  return (
    <footer className="bg-black text-gray-300 border-t border-zinc-800 relative mt-auto">
      {/* Gradient border effect */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#ff6bcb] to-[#c792ea] animate-gradientBg bg-[length:200%_auto]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 items-stretch">
          <div className="h-full flex flex-col text-center">
            <h3 className="text-white text-lg font-bold mb-4">NMFP</h3>
            <p className="text-sm">
              Need Money For Porsche is a game that rewards players for participating in Web3 activities.
            </p>
          </div>

          <div className="h-full flex flex-col text-center">
            <h3 className="text-white text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/play" className="text-sm hover:text-white transition-colors">
                  Play
                </Link>
              </li>
              <li>
                <Link href="/tokenomics" className="text-sm hover:text-white transition-colors">
                  Tokenomics
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="h-full flex flex-col text-center">
            <h3 className="text-white text-lg font-bold mb-4">Connect With Us</h3>
            <div className="flex space-x-4 justify-center">
              <a
                href="https://x.com/NMFPorsche_Ton"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <FaTwitter size={24} />
              </a>
              <a
                href="https://t.me/needmoneyforporschewtf"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <FaTelegram size={24} />
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t border-zinc-800 text-center">
          <p className="text-xs">
            &copy; {year} NMFP. All rights reserved.
          </p>
          <p className="text-xs mt-2 text-gray-500">
            This game is a parody and is not affiliated with or endorsed by Porsche AG.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 