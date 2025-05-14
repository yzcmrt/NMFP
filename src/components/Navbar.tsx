'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const Navbar = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      console.log('Hostname:', hostname);
      console.log('Current URL:', currentUrl);
      console.log('Is GameFi Domain:', isGamefiDomain);
    }
  }, [pathname]);

  // Body overflow'u kontrol et - menü açıkken sayfanın kaymasını engelle
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Cleanup
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/play', label: 'Play' },
    { href: '/tokenomics', label: 'Tokenomics' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/contact', label: 'Contact' },
  ];

  // GameFi sayfalarında veya subdomain'de Navbar'ı gösterme
  if (!shouldRender) {
    return null;
  }

  return (
    <nav className="bg-black border-b border-zinc-800 relative z-50">
      {/* Gradient border effect */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#c792ea] via-[#ff6bcb] to-transparent animate-gradientBg bg-[length:200%_auto]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-white font-bold text-xl tracking-tight flex items-center">
              <Image 
                src="/favicon/favicon-32x32.png"
                width={24}
                height={24}
                alt="NMFP Logo"
                className="mr-2"
              />
              NMFP
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium ${
                  pathname === link.href
                    ? 'text-white border-b-2 border-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white focus:outline-none z-50 relative"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <svg
                className="h-6 w-6 transition-transform duration-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-95 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className={`h-full flex flex-col justify-center transition-transform duration-500 transform ${
          isMobileMenuOpen ? 'translate-y-0' : '-translate-y-10 opacity-0'
        }`}>
          <div className="px-4 py-6 space-y-6 flex flex-col items-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-2xl font-medium transition-colors duration-300 ease-in-out px-4 py-3 ${
                  pathname === link.href
                    ? 'text-white border-b-2 border-[#ff6bcb]'
                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-[#c792ea]'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 