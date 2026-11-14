"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { PolicyViolationError } from "@/server/http";
import { listDraftMedia, removeMyMedia, type DraftMedia } from "@/server/media/mine";

async function signedInId() {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  return found?.user.id ?? null;
}

/** The owner's photos and videos on one draft, for the post-ad photo step. Null when not signed in or not the owner. */
export async function listDraftMediaAction(listingId: string): Promise<DraftMedia | null> {
  const userId = await signedInId();
  if (!userId) return null;
  try {
    return await listDraftMedia(userId, listingId);
  } catch {
    return null;
  }
}

/** Removes one of the owner's photos or videos. The message is safe to show. */
export async function removeMyMediaAction(mediaId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await signedInId();
  if (!userId) return { ok: false, error: "Sign in to remove this." };
  try {
    await removeMyMedia(userId, mediaId, crypto.randomUUID());
    return { ok: true };
  } catch (error) {
    if (error instanceof PolicyViolationError) return { ok: false, error: error.message };
    return { ok: false, error: "That could not be removed. Try again." };
  }
}
