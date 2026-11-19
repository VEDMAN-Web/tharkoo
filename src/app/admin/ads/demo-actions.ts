"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { endDemoAds, restoreDemoAds } from "@/server/listings/demo-ads";
import { refreshDemoText } from "@/server/listings/demo-text-refresh";

export type EndDemoResult = { ok: true; ended: number; eventId: string } | { ok: false; message: string };
export type PlainResult = { ok: boolean; message: string };

export async function endDemoAdsAction(confirm: string): Promise<EndDemoResult> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, message: "Sign in again to make this change." };
  try {
    const result = await endDemoAds({ actorId: found.user.id, roles: found.user.roles, confirm, requestId: randomUUID() });
    revalidatePath("/admin/ads/");
    return { ok: true, ended: result.ended, eventId: result.eventId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.fields?.confirm?.[0] ?? error.message };
    console.error("end demo ads failed", error);
    return { ok: false, message: "Nothing was changed. Try again." };
  }
}

export async function restoreDemoAdsAction(): Promise<PlainResult> {
  try {
    const done = await restoreDemoAds(await adminContext());
    revalidatePath("/admin/ads/");
    return { ok: true, message: `Brought back ${done.restored} demo ${done.restored === 1 ? "ad" : "ads"}.` };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    console.error("restore demo ads failed", error);
    return { ok: false, message: "Nothing was changed. Try again." };
  }
}

export async function undoEndDemoAdsAction(eventId: string): Promise<PlainResult> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/ads/");
  return outcome.ok ? { ok: true, message: "Undone. The demo ads are live again." } : { ok: false, message: outcome.message };
}

export type RefreshTextResult = { ok: true; rewritten: number; eventId: string } | { ok: false; message: string };

/** H17.10: rewrites the title and text of the sample ads from the category templates. A typed confirmation, one audit entry, and Undo. */
export async function refreshDemoTextAction(confirm: string): Promise<RefreshTextResult> {
  try {
    const result = await refreshDemoText(await adminContext(), { confirm });
    revalidatePath("/admin/ads/");
    return { ok: true, rewritten: result.rewritten, eventId: result.eventId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.fields?.confirm?.[0] ?? error.message };
    console.error("refresh sample ad text failed", error);
    return { ok: false, message: "Nothing was changed. Try again." };
  }
}

export async function undoRefreshDemoTextAction(eventId: string): Promise<PlainResult> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/ads/");
  return outcome.ok ? { ok: true, message: "Undone. The old sample ad text is back." } : { ok: false, message: outcome.message };
}
