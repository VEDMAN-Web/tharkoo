"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { isAdminRole } from "@/lib/ui/site-content";
import { adCountsFor, setAdCounts, type AdCountsView } from "@/server/listings/ad-counts";

/** H6.17: the signed-in staff member, read from the session. The role check itself is in setAdCounts. */
async function actor() {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  return found ? { id: found.user.id, roles: found.user.roles } : null;
}

function failed(error: unknown) {
  return { ok: false as const, message: error instanceof Error ? error.message : "Something went wrong" };
}

/** Admin and superadmin only. Sets the shown views and clicks; real counts are never changed. */
export async function saveAdCountsAction(input: { listingId: string; views: number; clicks: number }): Promise<
  { ok: true; counts: AdCountsView } | { ok: false; message: string }
> {
  try {
    const who = await actor();
    if (!who) return { ok: false, message: "Sign in again to make this change." };
    const counts = await setAdCounts({ ...input, actor: who, requestId: randomUUID() });
    return { ok: true, counts };
  } catch (error) {
    return failed(error);
  }
}

export async function readAdCountsAction(listingId: string) {
  try {
    const who = await actor();
    if (!who) return { ok: false as const, message: "Sign in again to see this." };
    if (!isAdminRole(who.roles)) return { ok: false as const, message: "Only an admin can see these counts" };
    return { ok: true as const, counts: await adCountsFor(listingId) };
  } catch (error) {
    return failed(error);
  }
}
