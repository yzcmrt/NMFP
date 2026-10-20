"use client";
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
export default function SiteFrame({children}: {children: React.ReactNode}) {
  const path = usePathname();
  const game = path === '/gamefi' || path?.startsWith('/gamefi/');
  return <><Navbar /><main className={game ? '' : 'site-content'}>{children}</main><Footer /></>;
}
