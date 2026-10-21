"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/components/TelegramInitProvider";
export function useGameClock() {
  const { game } = useTelegram();
  const [clock, setClock] = useState({ server: Date.now(), local: Date.now() });
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (game?.serverTime)
      setClock({ server: Date.parse(game.serverTime), local: Date.now() });
  }, [game?.serverTime]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setTick(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return clock.server + Math.max(0, tick - clock.local);
}
