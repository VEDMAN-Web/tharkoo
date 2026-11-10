import { success } from "@/server/http";

export function json(data: unknown, requestId: string, status = 200, meta: Record<string, unknown> = {}) {
  return Response.json(success(data, requestId, meta), {
    status,
    headers: { "x-request-id": requestId, "cache-control": "no-store" },
  });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function segmentsOf(request: Request, prefix: string) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (path === prefix) return [];
  if (!path.startsWith(`${prefix}/`)) return [];
  return path.slice(prefix.length + 1).split("/").filter(Boolean);
}
