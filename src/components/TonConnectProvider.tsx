'use client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
export default function TonConnectProvider({children}:{children:React.ReactNode}) {
 return <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL || 'https://nmfp.vercel.app/tonconnect-manifest.json'}>{children}</TonConnectUIProvider>;
}
