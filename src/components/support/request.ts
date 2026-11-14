import type { ApiError, ApiResult } from "@/lib/ui/api";

/**
 * Sends a multipart form (text fields and screenshots). The shared `api()` helper always sets a JSON
 * content type, which would break the file upload, so support uses this small variant.
 */
export async function postForm<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: "POST",
    body: form,
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: ApiError } | null;
  if (body && body.ok) return { ok: true, data: body.data as T, status: res.status };
  return {
    ok: false,
    status: res.status,
    error: body?.error || { code: "ERROR", message: "Something went wrong. Please try again." },
  };
}
