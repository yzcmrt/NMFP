"use client";
export async function gameAction<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const r = await fetch(`/api/data/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.message || "İşlem tamamlanamadı.");
  return body;
}
