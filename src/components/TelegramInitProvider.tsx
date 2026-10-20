'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@/types';
interface TelegramUser { id: number; first_name: string; username?: string; photo_url?: string; is_premium?: boolean; }
interface Context { user: User | null; telegramUser: TelegramUser | null; isLoading: boolean; error: string | null; rawInitData: string | null; parsedInitData: any; refreshUserData: () => Promise<void>; }
const TelegramContext = createContext<Context>({ user: null, telegramUser: null, isLoading: true, error: null, rawInitData: null, parsedInitData: null, refreshUserData: async () => {} });
export const useTelegram = () => useContext(TelegramContext);
export default function TelegramInitProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshUserData = useCallback(async () => {
    const response = await fetch('/api/auth/telegram', { cache: 'no-store' });
    if (response.ok) setUser((await response.json()).user);
    else if (response.status === 401) { setUser(null); setError('Session expired. Please reopen the game in Telegram.'); }
  }, []);
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg?.initData) throw new Error('Open NMFP in Telegram to load your cars, garage and progress.');
        tg.ready(); tg.expand();
        const response = await fetch('/api/auth/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to sign in. Please reopen the game.');
        if (active) { setUser(result.user); setTelegramUser(result.telegramUser); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to connect.'); }
      finally { if (active) setIsLoading(false); }
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-nmfp-telegram]');
    if ((window as any).Telegram?.WebApp) void initialize();
    else {
      if (!script) { script = document.createElement('script'); script.dataset.nmfpTelegram = 'true'; script.src = 'https://telegram.org/js/telegram-web-app.js'; script.async = true; document.head.appendChild(script); }
      script.addEventListener('load', initialize);
      script.onerror = () => { if (active) { setError('Telegram could not load. Please reopen the game.'); setIsLoading(false); } };
    }
    return () => { active = false; script?.removeEventListener('load', initialize); };
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => { if (document.visibilityState === 'visible') void refreshUserData().catch(() => {}); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user?.id, refreshUserData]);
  const context = { user, telegramUser, isLoading, error, rawInitData: null, parsedInitData: null, refreshUserData };
  return <TelegramContext.Provider value={context}>{isLoading ? <div role="status" className="min-h-dvh bg-black text-white grid place-items-center">Connecting to your garage…</div> : error ? <div className="min-h-dvh bg-black text-white flex flex-col justify-center items-center p-8 text-center gap-6"><h1 className="text-3xl font-bold">Your garage awaits.</h1><p className="text-zinc-400 max-w-sm">{error}</p><a className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl" href="https://t.me/NMFP_bot">Open in Telegram</a><button onClick={() => location.reload()} className="text-sm underline">Try again</button></div> : children}</TelegramContext.Provider>;
}
