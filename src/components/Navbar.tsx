"use client";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { usePathname } from "next/navigation";
import { useState } from "react";
export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path?.startsWith("/gamefi")) return null;
  const links = [
    ["/play", "How to play"],
    ["/tokenomics", "Economy"],
    ["/support", "Support"],
  ];
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="NMFP home">
        <BrandMark />
      </Link>
      <nav className="desktop-links" aria-label="Main">
        {links.map(([href, title]) => (
          <Link
            href={href}
            key={href}
            aria-current={path === href ? "page" : undefined}
          >
            {title}
          </Link>
        ))}
        <Link href="/gamefi" className="nav-launch">
          LAUNCH APP ↗
        </Link>
      </nav>
      <button
        className="mobile-menu-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          {[...links, ["/gamefi", "Launch app ↗"]].map(([href, title]) => (
            <Link href={href} key={href} onClick={() => setOpen(false)}>
              {title}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
