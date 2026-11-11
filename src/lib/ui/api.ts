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
      return "Too many requests, try again later";
    case "VERIFICATION_REQUIRED":
      return "Your ID needs a quick check before this ad can go live.";
    case "FREE_LIMIT":
      return "You have reached the free ad limit for this week.";
    case "POLICY_VIOLATION":
      return error.message || "This listing does not meet the content rules.";
    case "VALIDATION_ERROR":
      return "Please check the highlighted fields.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/** Same-origin relative path only. Rejects scheme, protocol-relative, and encoded bypasses. */
export function safeNext(raw: string | null | undefined) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512) return null;
  let value = trimmed;
  try {
    value = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (value.includes("%")) {
    try {
      const twice = decodeURIComponent(value);
      if (twice.startsWith("//") || twice.includes("\\") || twice.includes("://")) return null;
    } catch {
      return null;
    }
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\") || value.includes("://") || /[\u0000-\u001F\u007F]/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  if (path.includes(":") || path.includes("//") || !/^\/(?:[A-Za-z0-9._~-]+\/?)*$/.test(path)) return null;
  return value;
}

const STAFF = new Set(["admin", "superadmin", "moderator", "trust_safety", "support", "seo_editor", "finance"]);

export function isStaffRole(roles: string[] | undefined) {
  return Boolean(roles?.some((role) => STAFF.has(role)));
}

/** Set on login. Public pages skip account requests when it is absent, so logged-out views stay quiet. */
export function hasSessionHint() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith("tk-in="));
}
