import {
  readSession,
  checkOrigin,
  errorResponse,
  HttpError,
} from "@/server/auth";
import { database } from "@/server/db";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const s = readSession(request);
    const { taskId } = await request.json();
    if (!Number.isSafeInteger(taskId) || taskId <= 0)
      throw new HttpError(400, "Geçersiz görev.");
    const { data, error } = await database().rpc("nmfp_record_task_visit", {
      p_user_id: s.userId,
      p_task_id: taskId,
    });
    if (error)
      throw new HttpError(
        400,
        error.message.startsWith("NMFP:")
          ? error.message.slice(5)
          : "Bağlantı açılamadı.",
      );
    return Response.json({ url: data });
  } catch (e) {
    return errorResponse(e);
  }
}
