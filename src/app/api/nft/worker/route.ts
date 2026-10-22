import { createHash, timingSafeEqual } from "node:crypto";
import { processNftQueue } from "@/server/nft/worker";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.NFT_WORKER_SECRET || "",
    received = request.headers.get("authorization") || "";
  if (
    !secret ||
    !timingSafeEqual(
      createHash("sha256").update(received).digest(),
      createHash("sha256")
        .update("Bearer " + secret)
        .digest(),
    )
  )
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await processNftQueue(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "NFT processing will retry" },
      { status: 503 },
    );
  }
}
