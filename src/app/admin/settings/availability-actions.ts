"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { setAwayHours } from "@/server/availability/service";
import { HttpError } from "@/server/http";

export type AwayHoursResult = { ok: true; awayAfterHours: number } | { ok: false; error: string };

/** H7.5: admins set how many hours without activity before a seller shows Away. The service checks the role and audits. */
export async function saveAwayHoursAction(awayAfterHours: number): Promise<AwayHoursResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const result = await setAwayHours({ actorId: found.user.id, roles: found.user.roles, awayAfterHours, requestId: randomUUID() });
    return { ok: true, awayAfterHours: result.awayAfterHours };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("availability hours save failed", error);
    return { ok: false, error: "The setting was not saved. Try again." };
  }
}
