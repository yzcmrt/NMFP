"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@/types";
import type { GameSnapshot } from "@/lib/gameState";
interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
}
interface Context {
  user: User | null;
  telegramUser: TelegramUser | null;
  isLoading: boolean;
  error: string | null;
  rawInitData: null;
  parsedInitData: null;
  game: GameSnapshot | null;
  syncError: string | null;
  busy: boolean;
  refreshUserData: () => Promise<void>;
  runOperation: <T>(operation: () => Promise<T>) => Promise<T>;
}
const TelegramContext = createContext<Context>({
  user: null,
  telegramUser: null,
  isLoading: true,
  error: null,
  rawInitData: null,
  parsedInitData: null,
  game: null,
  syncError: null,
  busy: false,
  refreshUserData: async () => {},
  runOperation: async (op) => op(),
});
export const useTelegram = () => useContext(TelegramContext);
export default function TelegramInitProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null),
    [game, setGame] = useState<GameSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [syncError, setSyncError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const pending = useRef<Promise<void> | null>(null),
    operationLock = useRef(false),
    mounted = useRef(true);
  const readGame = useCallback(() => {
    if (pending.current) return pending.current;
    const promise = (async () => {
      const r = await fetch("/api/game", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const body = await r.json();
      if (!r.ok) {
        if (r.status === 401 && mounted.current)
          setError("Oturum süresi doldu. Oyunu Telegram’dan yeniden açın.");
        throw new Error(body.message || "Veriler yenilenemedi.");
      }
      if (mounted.current) {
        setGame(body);
        setUser(body.user);
        setSyncError(null);
      }
    })();
    pending.current = promise;
    void promise
      .catch((e) => {
        if (mounted.current)
          setSyncError(e instanceof Error ? e.message : "Bağlantı kesildi.");
      })
      .finally(() => {
        if (pending.current === promise) pending.current = null;
      });
    return promise;
  }, []);
  const refreshUserData = useCallback(async () => {
    const previous = pending.current;
    if (previous) {
      await previous.catch(() => {});
      if (pending.current === previous) pending.current = null;
    }
    await readGame();
  }, [readGame]);
  const runOperation = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      if (operationLock.current)
        throw new Error("Devam eden işlemin tamamlanmasını bekleyin.");
      operationLock.current = true;
      setBusy(true);
      try {
        return await operation();
      } finally {
        await refreshUserData().catch(() => {});
        operationLock.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refreshUserData],
  );
  useEffect(() => {
    mounted.current = true;
    let active = true;
    let started = false;
    const initialize = async () => {
      if (started) return;
      started = true;
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg?.initData)
          throw new Error(
            "Araçlarını ve ilerlemeni yüklemek için NMFP’yi Telegram içinde aç.",
          );
        tg.ready();
        tg.expand();
        const r = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
          signal: AbortSignal.timeout(15000),
        });
        const body = await r.json();
        if (!r.ok)
          throw new Error(
            body.message || "Giriş yapılamadı. Oyunu yeniden açın.",
          );
        if (active) {
          setUser(body.user);
          setTelegramUser(body.telegramUser);
          await readGame();
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Bağlanılamadı.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-nmfp-telegram]",
    );
    const failed = () => {
      if (active) {
        setError("Telegram yüklenemedi. Tekrar deneyin.");
        setIsLoading(false);
      }
    };
    if ((window as any).Telegram?.WebApp) void initialize();
    else {
      if (!script) {
        script = document.createElement("script");
        script.dataset.nmfpTelegram = "true";
        script.src = "https://telegram.org/js/telegram-web-app.js";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", initialize);
      script.addEventListener("error", failed);
    }
    const timeout = setTimeout(() => {
      if (!started) failed();
    }, 15000);
    return () => {
      active = false;
      mounted.current = false;
      clearTimeout(timeout);
      script?.removeEventListener("load", initialize);
      script?.removeEventListener("error", failed);
    };
  }, [readGame]);
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !operationLock.current)
        void readGame().catch(() => {});
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user?.id, readGame]);
  return (
    <TelegramContext.Provider
      value={{
        user,
        telegramUser,
        isLoading,
        error,
        game,
        syncError,
        busy,
        refreshUserData,
        runOperation,
        rawInitData: null,
        parsedInitData: null,
      }}
    >
      {isLoading || error ? (
        <div className="garage-gate">
          <Image
            src="/cars/garage/garaj-10.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="gate-background"
          />
          <div className="gate-panel">
            <Link href="/" className="wordmark">
              N<span> / </span>MFP
            </Link>
            <p className="eyebrow">CYBER GARAGE // ACCESS TERMINAL</p>
            <h1>
              Your night
              <br />
              shift awaits<span className="cursor-mark">_</span>
            </h1>
            {isLoading ? (
              <p role="status" className="gate-status">
                <span className="status-dot" />
                Garajına bağlanılıyor…
              </p>
            ) : (
              <>
                <p className="muted">{error}</p>
                <a className="cyber-button" href="https://t.me/NMFP_bot">
                  TELEGRAM’DA AÇ ↗
                </a>
                <button
                  onClick={() => location.reload()}
                  className="gate-retry"
                >
                  Tekrar dene ↻
                </button>
              </>
            )}
            <p className="gate-footnote">
              Telegram hesabın garajını ve ilerlemeni saklar.
            </p>
          </div>
        </div>
      ) : (
        <>
          {syncError && (
            <div role="alert" className="data-alert">
              Son kayıtlı veriler gösteriliyor. {syncError}{" "}
              <button
                disabled={busy}
                onClick={() => void refreshUserData().catch(() => {})}
              >
                Yenile
              </button>
            </div>
          )}
          {children}
        </>
      )}
    </TelegramContext.Provider>
  );
}
