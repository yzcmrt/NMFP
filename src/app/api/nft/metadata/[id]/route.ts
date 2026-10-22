import { database } from "@/server/db";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  )
    return Response.json({ message: "Not found" }, { status: 404 });
  const { data, error } = await database()
    .from("nft_jobs")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  if (error) return Response.json({ message: "Unavailable" }, { status: 503 });
  if (!data) return Response.json({ message: "Not found" }, { status: 404 });
  return Response.json(data.metadata, {
    headers: { "Cache-Control": "public, max-age=3600, immutable" },
  });
}
