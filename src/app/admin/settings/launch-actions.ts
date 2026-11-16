"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { setLaunchSwitch, type LaunchSwitches } from "@/server/wallet/launch-switches";

export type LaunchResult = { ok: true; switches: LaunchSwitches } | { ok: false; error: string };

export async function saveLaunchSwitchAction(name: string, on: boolean): Promise<LaunchResult> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const switches = await setLaunchSwitch({ actorId: found.user.id, roles: found.user.roles, name, on, requestId: randomUUID() });
    return { ok: true, switches };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("launch switch save failed", error);
    return { ok: false, error: "The setting was not saved. Try again." };
  }
}
