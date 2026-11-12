"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { ForbiddenError, HttpError } from "@/server/http";
import { resetUiText, saveUiText } from "./store";

type Result = { ok: true; saved: { key: string; value: string }[] } | { ok: false; error: string; key?: string };

async function admin() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity) || !isAdminRole(identity.roles)) throw new ForbiddenError("Only an admin can edit UI text");
  return identity;
}

function fail(error: unknown, key?: string): Result {
  if (error instanceof HttpError) return { ok: false, error: error.message, key };
  console.error("ui text action failed", error);
  return { ok: false, error: "Something went wrong. Nothing was changed.", key };
}

/** Saves the changed texts one by one; stops at the first refused one and says which key it was. */
export async function saveUiTextAction(changes: { key: string; value: string }[]): Promise<Result> {
  let key: string | undefined;
  try {
    const who = await admin();
    if (!Array.isArray(changes) || changes.length > 200) throw new ForbiddenError("Too many changes at once");
    const saved: { key: string; value: string }[] = [];
    for (const change of changes) {
      key = String(change?.key ?? "");
      saved.push(await saveUiText({ roles: who.roles, email: who.email, key, value: change?.value }));
    }
    return { ok: true, saved };
  } catch (error) {
    return fail(error, key);
  }
}

export async function resetUiTextAction(key: string): Promise<Result> {
  try {
    const who = await admin();
    return { ok: true, saved: [await resetUiText({ roles: who.roles, email: who.email, key })] };
  } catch (error) {
    return fail(error, key);
  }
}
