"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { deleteMedia } from "@/server/media/service";
import { listOwnAdVideos, type AdVideo } from "@/server/media/video";

async function signedInId() {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  return found?.user.id ?? null;
}

/** The advertiser's own videos for one ad, for the post and edit forms. */
export async function listMyVideosAction(listingId: string): Promise<AdVideo[]> {
  const userId = await signedInId();
  if (!userId) return [];
  return listOwnAdVideos(userId, listingId);
}

export async function removeMyVideoAction(mediaId: string): Promise<{ ok: boolean }> {
  const userId = await signedInId();
  if (!userId) return { ok: false };
  try {
    await deleteMedia(userId, mediaId, crypto.randomUUID());
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
