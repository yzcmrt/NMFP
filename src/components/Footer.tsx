"use client";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { usePathname } from "next/navigation";
export default function Footer() {
  const path = usePathname();
  if (path?.startsWith("/gamefi")) return null;
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link href="/" className="wordmark">
          <BrandMark />
        </Link>
        <p>Need Money for Porsche. Built for the dream. Played for fun.</p>
        <nav aria-label="Footer">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
          <a href="https://t.me/NMFP_bot">Telegram ↗</a>
        </nav>
      </div>
      <p className="footer-note">
        © {new Date().getFullYear()} NMFP — Need Money for Porsche. Demo only.
        No earnings, payouts or guaranteed returns. Not affiliated with or
        endorsed by Porsche AG.
      </p>
    </footer>
  );
}
