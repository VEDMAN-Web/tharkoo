/**
 * Reads a support request body. JSON is taken as is. Multipart carries text fields and optional
 * `screenshots` files, and the text fields are returned as strings. Boolean fields accept true or "true".
 */
export async function readSupportBody(request: Request): Promise<{ data: Record<string, unknown>; form: FormData | null }> {
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await request.formData();
    const data: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") data[key] = value;
    }
    return { data: { ...data, internal: data.internal === "true" }, form };
  }
  const json: unknown = await request.json().catch(() => ({}));
  const data = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return { data: { ...data, internal: data.internal === true || data.internal === "true" }, form: null };
}

/** Query string as a plain object. Empty values (an "All" filter) are dropped before validation. */
export function queryObject(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (value !== "") out[key] = value;
  }
  return out;
}

/** Path segments after the API prefix, for example ["tickets", "<id>", "messages"]. */
export function segmentsAfter(request: Request, prefix: string): string[] {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return path.replace(new RegExp(`^${prefix}/?`), "").split("/").filter(Boolean);
}
