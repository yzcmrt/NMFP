'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaTwitter, FaTelegram } from 'react-icons/fa';
import { useState, useEffect } from 'react';

const Footer = () => {
  const pathname = usePathname();
  const [isGamefiSubdomain, setIsGamefiSubdomain] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  // Client tarafında subdomain kontrolü - daha kapsamlı kontrol
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname || '';
      const currentUrl = window.location.href || '';
      
      // Hem hostname kontrolü hem de URL paterni kontrolü
      const isGamefiDomain: boolean = !!(
        hostname.startsWith('gamefi.') || 
        hostname.includes('gamefi.needmoneyforporsche.wtf') ||
        currentUrl.includes('gamefi.needmoneyforporsche.wtf') ||
        (pathname && pathname.includes('/gamefi'))
      );
      
      setIsGamefiSubdomain(isGamefiDomain);
      
      // GameFi sayfası veya subdomain ise bileşeni gizle
      const isGamefiRoute: boolean = !!(pathname === '/gamefi' || 
                       (pathname && pathname.startsWith('/gamefi/')));
                       
      setShouldRender(!(isGamefiRoute || isGamefiDomain));
      
      // Debug için konsola bilgileri yazdıralım
      console.log('Footer - Hostname:', hostname);
      console.log('Footer - Current URL:', currentUrl);
      console.log('Footer - Is GameFi Domain:', isGamefiDomain);
    }
  }, [pathname]);
  
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <h3 className="text-white text-lg font-bold mb-4">NMFP</h3>
            <p className="text-sm">
              Never Miss Free Points is a platform that rewards players for participating in Web3 activities.
            </p>
          </div>
          
          <div>
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
          
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Connect With Us</h3>
            <div className="flex space-x-4">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">
                <FaTwitter size={24} />
              </a>
              <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">
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