"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { setWatermarkSettings, type WatermarkSettings } from "@/server/settings/watermark";

export type WatermarkResult = { ok: true; data: WatermarkSettings } | { ok: false; error: string };

/** H6.18: superadmin saves the watermark settings. The service checks the role and writes an audit entry. */
export async function saveWatermarkAction(input: unknown): Promise<WatermarkResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const data = await setWatermarkSettings({ actorId: found.user.id, roles: found.user.roles, settings: input, requestId: randomUUID() });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("watermark settings save failed", error);
    return { ok: false, error: "The watermark setting was not saved. Try again." };
  }
}
