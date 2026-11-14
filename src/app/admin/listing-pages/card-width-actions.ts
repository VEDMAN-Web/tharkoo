"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { setCardWidth, type CardWidth } from "@/server/listings/card-width";

/** H6.17: admin and superadmin only (checked in setCardWidth). Listing pages are rebuilt so the new width shows at once. */
export async function saveCardWidthAction(width: CardWidth) {
  try {
    const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
    if (!found) return { ok: false as const, message: "Sign in again to make this change." };
    await setCardWidth({ actor: { id: found.user.id, roles: found.user.roles }, width, requestId: randomUUID() });
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Something went wrong" };
  }
}
