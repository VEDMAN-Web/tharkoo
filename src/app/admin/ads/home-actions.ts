"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { setHomeSelection } from "@/server/listings/home-selection";

export async function saveHomeSelectionAction(input: { listingId: string; show: boolean; order: number }): Promise<
  { ok: true; show: boolean; order: number } | { ok: false; message: string }
> {
  try {
    const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
    if (!found) return { ok: false, message: "Sign in again to make this change." };
    const saved = await setHomeSelection({ ...input, actor: { id: found.user.id, roles: found.user.roles }, requestId: randomUUID() });
    return { ok: true, ...saved };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Something went wrong" };
  }
}
