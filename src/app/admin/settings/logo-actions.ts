"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { setLogo, type LogoVariant } from "@/server/settings/logo";

export type LogoResult = { ok: true; light: string; dark: string } | { ok: false; error: string };

/** Saves one logo address for light or dark backgrounds. The service checks the role and writes the audit entry. */
export async function saveLogoAction(variant: LogoVariant, url: string): Promise<LogoResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const result = await setLogo({ actorId: found.user.id, roles: found.user.roles, variant, url, requestId: randomUUID() });
    return { ok: true, light: result.light, dark: result.dark };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("logo save failed", error);
    return { ok: false, error: "The logo was not saved. Try again." };
  }
}
