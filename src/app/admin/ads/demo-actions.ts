"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { endDemoAds } from "@/server/listings/demo-ads";

export type EndDemoResult = { ok: true; ended: number } | { ok: false; message: string };

export async function endDemoAdsAction(confirm: string): Promise<EndDemoResult> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, message: "Sign in again to make this change." };
  try {
    const result = await endDemoAds({ actorId: found.user.id, roles: found.user.roles, confirm, requestId: randomUUID() });
    return { ok: true, ended: result.ended };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.fields?.confirm?.[0] ?? error.message };
    console.error("end demo ads failed", error);
    return { ok: false, message: "Nothing was changed. Try again." };
  }
}
