import { readSession, errorResponse, HttpError } from "@/server/auth";
import { database } from "@/server/db";
export async function GET(request: Request) {
  try {
    const session = readSession(request);
    const { data, error } = await database().rpc("nmfp_game_snapshot", {
      p_user_id: session.userId,
    });
    if (error || !data?.user)
      throw new HttpError(503, "Garaj verileri yüklenemedi. Tekrar deneyin.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
