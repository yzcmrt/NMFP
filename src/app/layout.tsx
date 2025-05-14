import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TonConnectProvider from "@/components/TonConnectProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Need Money For Porsche | Telegram Game",
  description: "Official website for the Need Money For Porsche Telegram game",
  icons: {
    icon: [
      { url: '/gamefi/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/gamefi/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/gamefi/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' }
    ],
    apple: [
      { url: '/gamefi/favicon/apple-icon-57x57.png', sizes: '57x57', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-60x60.png', sizes: '60x60', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/gamefi/favicon/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: '/gamefi/favicon/favicon.ico'
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    // URL yolunu doğrudan header'lardan al - server-side routing için daha güvenilir
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";
    const isGamefiSubdomain = headersList.get("x-is-gamefi-subdomain") === "true";
    
    // GameFi içeriği olup olmadığını kontrol et
    // Not: Artık middleware, subdomain taklidini yönetiyor, burada sadece içerik kontrolü yapıyoruz
    const isGamefiRoute = pathname?.startsWith('/gamefi') || false;
    
    // Ya subdomain'deyiz ya da gamefi içeriği gösteriyoruz
    const isGamefi = isGamefiSubdomain || isGamefiRoute;

    // Debug bilgileri
    if (process.env.NODE_ENV === 'development') {
      console.log('Layout - Pathname:', pathname);
      console.log('Layout - Is GameFi Subdomain:', isGamefiSubdomain);
      console.log('Layout - Is GameFi Route:', isGamefiRoute);
      console.log('Layout - Final Is GameFi:', isGamefi);
    }

    return (
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <TonConnectProvider>
            {!isGamefi && <Navbar />}
            <main className={!isGamefi ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" : ""}>
              {children}
            </main>
            {!isGamefi && <Footer />}
          </TonConnectProvider>
        </body>
      </html>
    );
  } catch (error) {
    // Herhangi bir hata durumunda temel HTML yapısını döndür
    console.error('Layout error:', error);
    
    return (
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <TonConnectProvider>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </main>
          </TonConnectProvider>
        </body>
      </html>
    );
  }
}
