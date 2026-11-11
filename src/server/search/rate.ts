import { allowRequest, clientKey } from "@/lib/rate-limit";
import { failure } from "@/server/http";

const MAX = 60;
const WINDOW_MS = 60_000;

export function rateLimited(request: Request, bucket: string, requestId: string) {
  if (allowRequest(`${bucket}:${clientKey(request.headers)}`, MAX, WINDOW_MS)) return null;
  return Response.json(failure({ code: "RATE_LIMITED", message: "Too many requests" }, requestId), {
    status: 429,
    headers: { "retry-after": "60", "x-request-id": requestId },
  });
}
