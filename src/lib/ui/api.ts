export type ApiError = {
  code?: string;
  message?: string;
  fields?: Record<string, string[]>;
  details?: Record<string, string[]>;
};

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: ApiError; status: number };

export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: ApiError } | null;
  if (body && body.ok) return { ok: true, data: body.data as T, status: res.status };
  return {
    ok: false,
    status: res.status,
    error: body?.error || { code: "ERROR", message: "Something went wrong. Please try again." },
  };
}

export function fieldErrors(error: ApiError) {
  return error.fields || error.details || {};
}

export function idempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function friendlyError(error: ApiError) {
  switch (error.code) {
    case "UNAUTHORIZED":
      return "Email or password is incorrect.";
    case "CONFLICT":
      return "That email is already registered.";
    case "RATE_LIMITED":
      return "Too many tries. Please wait a minute.";
    case "FREE_LIMIT":
      return "You have reached the free ad limit for this week.";
    case "VERIFICATION_REQUIRED":
      return "Verify your ID to publish.";
    case "POLICY_VIOLATION":
      return error.message || "This listing does not meet the content rules.";
    case "VALIDATION_ERROR":
      return "Please check the highlighted fields.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

export function safeNext(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

const STAFF = new Set(["admin", "superadmin", "moderator", "trust_safety", "support", "seo_editor", "finance"]);

export function isStaffRole(roles: string[] | undefined) {
  return Boolean(roles?.some((role) => STAFF.has(role)));
}
