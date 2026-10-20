"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function Footer(){
 const path=usePathname();if(path?.startsWith('/gamefi'))return null;
 return <footer className="site-footer"><div className="footer-top"><Link href="/" className="wordmark">N<span> / </span>MFP</Link><p>Keep the garage running.</p><nav aria-label="Footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/support">Support</Link><a href="https://t.me/NMFP_bot">Telegram ↗</a></nav></div><p className="footer-note">© {new Date().getFullYear()} NMFP. A fictional game. Not affiliated with or endorsed by Porsche AG.</p></footer>;
}
