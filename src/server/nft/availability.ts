import "server-only";
import { database } from "@/server/db";
import { HttpError } from "@/server/auth";
export async function nftAvailability() {
  if (process.env.NFT_AUTO_MINT_ENABLED !== "true")
    return {
      ready: false,
      reason:
        "Otomatik NFT teslimatı kuruluyor. Şu anda NFT ödemesi alınmıyor.",
    };
  const db = database();
  const [health, review] = await Promise.all([
    db
      .from("nft_worker_lock")
      .select("ready,health_checked_at")
      .eq("id", 1)
      .maybeSingle(),
    db
      .from("nft_jobs")
      .select("id", { count: "exact", head: true })
      .eq("state", "review"),
  ]);
  const fresh =
    Date.parse(health.data?.health_checked_at || "") > Date.now() - 180000;
  return !health.error &&
    !review.error &&
    health.data?.ready &&
    fresh &&
    !review.count
    ? { ready: true, reason: null }
    : {
        ready: false,
        reason:
          "NFT teslimat servisi geçici olarak hazır değil. Ödeme alınmıyor.",
      };
}
export async function requireNftAvailable() {
  const health = await nftAvailability();
  if (!health.ready)
    throw new HttpError(503, health.reason || "NFT unavailable");
}
