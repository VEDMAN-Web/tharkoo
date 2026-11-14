"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { setNewDesign } from "@/server/site-links/new-design";

export type NewDesignResult = { ok: true; on: boolean } | { ok: false; error: string };

/** H7.1: superadmin switches the New design on or off. The service checks the role and writes the audit entry. */
export async function saveNewDesignAction(on: boolean): Promise<NewDesignResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const result = await setNewDesign({ actorId: found.user.id, roles: found.user.roles, on, requestId: randomUUID() });
    return { ok: true, on: result.on };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("new design switch save failed", error);
    return { ok: false, error: "The setting was not saved. Try again." };
  }
}
