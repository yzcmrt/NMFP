"use client";
import React from "react";
import type { UserCar, MiningSession } from "@/types";
import { miningState } from "@/lib/gameState";
export default function DynamicMiningButton({
  car,
  miningSession,
  isLoading = false,
  isClaimLoading = false,
  canStartMining = true,
  timeLeft = "",
  onStartMining,
  onClaimReward,
  now = Date.now(),
}: {
  car: UserCar;
  miningSession?: MiningSession | null;
  isLoading?: boolean;
  isClaimLoading?: boolean;
  canStartMining?: boolean;
  timeLeft?: string;
  onStartMining: (id: number) => Promise<void>;
  onClaimReward: (id: number) => Promise<void>;
  now?: number;
}) {
  const state = miningState(
    car,
    miningSession || undefined,
    canStartMining ? 1 : 0,
    now,
  );
  const labels = {
    ready: "Mining Başlat",
    claimable: "Ödülü Topla",
    mining: `Mining · ${timeLeft}`,
    fuel: "Yakıt gerekli",
    condition: "Bakım gerekli",
    capacity: "Garaj dolu",
    unavailable: "Araç hazır değil",
  };
  return (
    <button
      className="cyber-button w-full disabled:opacity-50"
      disabled={
        isLoading || isClaimLoading || !["ready", "claimable"].includes(state)
      }
      onClick={() =>
        void (state === "claimable" && miningSession
          ? onClaimReward(miningSession.id)
          : onStartMining(car.id))
      }
    >
      {isLoading || isClaimLoading ? "İşleniyor…" : labels[state]}
    </button>
  );
}
