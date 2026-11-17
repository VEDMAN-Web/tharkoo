"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { approveListing } from "@/server/moderation/decide";

type Result = { ok: true; status: "active" } | { ok: false; error: string };

async function staff() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new ForbiddenError("Sign in as staff");
  return identity;
}

async function run(job: () => Promise<{ status: "active" }>): Promise<Result> {
  try {
    return { ok: true, ...(await job()) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("moderation action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function approveAction(id: string): Promise<Result> {
  return run(async () => {
    const who = await staff();
    return approveListing({ id, roles: who.roles, email: who.email });
  });
}
