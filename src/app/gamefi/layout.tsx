'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Geist } from 'next/font/google';
import '../globals.css';
import TelegramInitProvider from '@/components/TelegramInitProvider';
import { Toaster } from 'react-hot-toast';

// İkon importları
import { 
  HomeIcon, 
  CarIcon, 
  GarageIcon,
  TaskIcon, 
  ChartIcon, 
  WalletIcon 
} from './components/Icons';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

export default function GamefiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Navigasyon itemları
  const navItems = [
    { href: '/gamefi', label: 'Home', icon: <HomeIcon /> },
    { href: '/gamefi/car', label: 'Car', icon: <CarIcon /> },
    { href: '/gamefi/garage', label: 'Garage', icon: <GarageIcon /> },
    { href: '/gamefi/task', label: 'Task', icon: <TaskIcon /> },
    { href: '/gamefi/stats', label: 'Stats', icon: <ChartIcon /> },
    { href: '/gamefi/wallet', label: 'Wallet', icon: <WalletIcon /> },
  ];

  return (
    <TelegramInitProvider>
      <div className={`${geistSans.variable} min-h-screen bg-black text-white`}>
        {/* Arka plan efekti */}
        <div className="app-background"></div>
        
        {/* Ana içerik */}
        <div className="page-container px-4 max-w-md mx-auto">
          {children}
          <p className="py-4 text-center text-xs text-gray-400"><Link href="/terms">Purchase terms</Link> · <Link href="/support">Payment support</Link></p>
        </div>

        {/* Alt navigasyon */}
        <nav className="bottom-nav">
          <div className={`grid ${navItems.length === 7 ? 'grid-cols-7' : 'grid-cols-6'} h-full max-w-md mx-auto`}>
            {navItems.map((item) => {
              // Daha güvenli isActive kontrolü
              let isActive = false;
              
              if (pathname) {
                if (item.href === '/gamefi') {
                  isActive = pathname === '/gamefi';
                } else {
                  isActive = pathname.startsWith(item.href);
                }
              }
                
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="bottom-nav-icon">{item.icon}</span>
                  <span className="bottom-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        
        {/* Toast bildirimleri */}
        <Toaster 
          position="top-center" 
          containerStyle={{
            pointerEvents: "none"
          }}
          toastOptions={{
            style: {
              pointerEvents: "auto"
            }
          }}
        />
      </div>
    </TelegramInitProvider>
  );
} 