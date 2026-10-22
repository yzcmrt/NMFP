"use client";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { usePathname } from "next/navigation";
import TelegramInitProvider from "@/components/TelegramInitProvider";
import { Toaster } from "react-hot-toast";
import {
  HomeIcon,
  CarIcon,
  GarageIcon,
  TaskIcon,
  ChartIcon,
  WalletIcon,
} from "./components/Icons";
const items = [
  { href: "/gamefi", label: "Üs", icon: <HomeIcon /> },
  { href: "/gamefi/car", label: "Araç", icon: <CarIcon /> },
  { href: "/gamefi/garage", label: "Garaj", icon: <GarageIcon /> },
  { href: "/gamefi/task", label: "Görev", icon: <TaskIcon /> },
  { href: "/gamefi/stats", label: "İstatistik", icon: <ChartIcon /> },
  { href: "/gamefi/wallet", label: "Cüzdan", icon: <WalletIcon /> },
];
export default function GamefiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <TelegramInitProvider>
      <div className="cyber-app">
        <header className="game-topbar">
          <Link href="/gamefi" className="wordmark">
            <BrandMark />
          </Link>
          <span className="eyebrow">DEMO / SIMULATED MINING</span>
        </header>
        <div className="page-container game-content">
          <p className="game-demo-banner" lang="en">
            DEMO ONLY · No earnings or payouts.{" "}
            <Link href="/terms">Learn more ↗</Link>
          </p>
          {children}
          <div className="game-legal">
            <span>NMFP · OYUN PUANI</span>
            <Link href="/terms">Koşullar</Link>
            <Link href="/support">Destek ↗</Link>
          </div>
        </div>
        <nav className="bottom-nav" aria-label="Oyun">
          <div className="nav-inner">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={path === item.href ? "page" : undefined}
                className={`bottom-nav-item ${path === item.href ? "active" : ""}`}
              >
                <span className="bottom-nav-icon">{item.icon}</span>
                <span className="bottom-nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#121c24",
              color: "#eef5ef",
              border: "1px solid #35505b",
            },
          }}
        />
      </div>
    </TelegramInitProvider>
  );
}
