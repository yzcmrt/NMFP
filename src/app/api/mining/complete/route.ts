import { checkOrigin, readSession, errorResponse } from "@/server/auth";
import { gameAction } from "@/server/game";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = readSession(request);
    const body = await request.json();
    const result = await gameAction(
      "complete_mining",
      { p_mining_session_id: body.sessionId },
      session,
    );
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
