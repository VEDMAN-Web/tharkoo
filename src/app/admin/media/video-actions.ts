"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { dismissVideoReports, listVideosForAdmin, removeVideoAsAdmin, type AdminVideoRow } from "@/server/media/video";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function staff() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new ForbiddenError("Sign in as staff to review videos");
  return identity;
}

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("video action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function listVideosAction() {
  return run(async () => ({ videos: (await listVideosForAdmin((await staff()).roles)) as AdminVideoRow[] }));
}

export async function removeVideoAction(mediaId: string) {
  return run(async () => removeVideoAsAdmin(await staff(), mediaId, "Removed by staff"));
}

export async function dismissVideoReportsAction(listingId: string) {
  return run(async () => dismissVideoReports(await staff(), listingId));
}
