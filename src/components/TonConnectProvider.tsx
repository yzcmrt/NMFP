'use client';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { useEffect, useState } from 'react';

export default function TonConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [manifestUrl, setManifestUrl] = useState("https://www.needmoneyforporsche.wtf/tonconnect-manifest.json");
  
  useEffect(() => {
    // İstemci tarafında çalıştığından window nesnesine erişebiliriz
    const host = window.location.host;
    const isGamefiDomain = host.includes('gamefi.needmoneyforporsche.wtf');
    
    if (isGamefiDomain) {
      setManifestUrl("https://gamefi.needmoneyforporsche.wtf/tonconnect-manifest.json");
    } else {
      setManifestUrl("https://www.needmoneyforporsche.wtf/tonconnect-manifest.json");
    }
  }, []);
  
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
} 