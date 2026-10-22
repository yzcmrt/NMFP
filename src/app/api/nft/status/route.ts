import { readSession, errorResponse, HttpError } from "@/server/auth";
import { database } from "@/server/db";
import { nftAvailability } from "@/server/nft/availability";
import { COLLECTION, UPGRADE_STARS } from "@/lib/nft/contract";
export async function GET(request: Request) {
  try {
    const s = readSession(request),
      db = database();
    const { data, error } = await db
      .from("nft_jobs")
      .select("id,car_id,state,item_address,created_at,minted_at")
      .eq("user_id", s.userId)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(503, "NFT kayıtları yüklenemedi.");
    const health = await nftAvailability();
    return Response.json(
      {
        jobs: data,
        collection: COLLECTION,
        upgradeStars: UPGRADE_STARS,
        ...health,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
