"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { deleteSiteMedia, listSiteMedia, updateSiteMedia, type MediaFilter, type MediaItem } from "@/server/layout/media";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function staff() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new ForbiddenError("Sign in as staff to manage images");
  return identity;
}

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("media action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function listMediaAction(filter: MediaFilter) {
  return run(async () => {
    const who = await staff();
    const result = await listSiteMedia(filter, who.roles);
    return { total: result.total, items: result.items as (MediaItem & { used: boolean })[] };
  });
}

export async function updateMediaAction(id: string, patch: { alt?: string; tags?: string }) {
  return run(async () => {
    const who = await staff();
    return { item: await updateSiteMedia(id, patch, who.email, who.roles) };
  });
}

export async function deleteMediaAction(id: string) {
  return run(async () => {
    const who = await staff();
    return deleteSiteMedia(id, who.email, who.roles);
  });
}
