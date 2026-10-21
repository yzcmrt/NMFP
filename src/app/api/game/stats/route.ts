import { readSession, errorResponse, HttpError } from "@/server/auth";
import { database } from "@/server/db";
export async function GET(request: Request) {
  try {
    const s = readSession(request);
    const days = Number(new URL(request.url).searchParams.get("days") || 7);
    if (![1, 7, 30, 90].includes(days))
      throw new HttpError(400, "Geçersiz tarih aralığı.");
    const { data, error } = await database().rpc("nmfp_game_stats", {
      p_user_id: s.userId,
      p_days: days,
    });
    if (error) throw new HttpError(503, "İstatistikler yüklenemedi.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
