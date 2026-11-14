"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { setCodeOnlyLogin } from "@/server/auth/code-only";
import { loginCodeWarning } from "@/server/auth/email-code";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";

export type CodeOnlyResult = { ok: true; enabled: boolean } | { ok: false; error: string };

/**
 * H7.2b: superadmin turns "Code-only login" on or off. The service checks the role and writes the audit entry.
 * Turning it on is refused while no code can be sent, so nobody is locked out by a switch with no mail behind it.
 */
export async function saveCodeOnlyLoginAction(enabled: boolean): Promise<CodeOnlyResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  if (enabled && loginCodeWarning()) {
    return { ok: false, error: "Login codes cannot be sent yet. Set up email (Brevo) before turning this on." };
  }
  try {
    const result = await setCodeOnlyLogin({ actorId: found.user.id, roles: found.user.roles, enabled, requestId: randomUUID() });
    return { ok: true, enabled: result.enabled };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("code-only login switch save failed", error);
    return { ok: false, error: "The setting was not saved. Try again." };
  }
}
