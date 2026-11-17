"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { ForbiddenError, HttpError } from "@/server/http";
import { refresh, resetUiTextAs, saveUiTextAs } from "./store";

type Result = { ok: true; saved: { key: string; value: string }[]; eventIds: string[] } | { ok: false; error: string; key?: string };

function fail(error: unknown, key?: string): Result {
  if (error instanceof HttpError) return { ok: false, error: error.message, key };
  console.error("ui text action failed", error);
  return { ok: false, error: "Something went wrong. Nothing was changed.", key };
}

/** Saves the changed texts one by one; stops at the first refused one and says which key it was. Each change is one audited write with its own Undo. */
export async function saveUiTextAction(changes: { key: string; value: string }[]): Promise<Result> {
  let key: string | undefined;
  try {
    const ctx = await adminContext();
    if (!Array.isArray(changes) || changes.length > 200) throw new ForbiddenError("Too many changes at once");
    const saved: { key: string; value: string }[] = [];
    const eventIds: string[] = [];
    for (const change of changes) {
      key = String(change?.key ?? "");
      const done = await saveUiTextAs(ctx, { key, value: change?.value });
      saved.push({ key: done.key, value: done.value });
      if (done.eventId) eventIds.push(done.eventId);
    }
    revalidatePath("/admin/ui-text/");
    return { ok: true, saved, eventIds };
  } catch (error) {
    return fail(error, key);
  }
}

export async function resetUiTextAction(key: string): Promise<Result> {
  try {
    const done = await resetUiTextAs(await adminContext(), String(key));
    revalidatePath("/admin/ui-text/");
    return { ok: true, saved: [{ key: done.key, value: done.value }], eventIds: [] };
  } catch (error) {
    return fail(error, key);
  }
}

/** Undo of a save of one or more texts: every change in the list, newest first. */
export async function undoUiTextAction(eventIds: string[]): Promise<{ ok: boolean; message: string }> {
  let restored = 0;
  let failed = "";
  for (const id of [...(Array.isArray(eventIds) ? eventIds : [])].reverse()) {
    const outcome = await undoAction(String(id));
    if (outcome.ok) restored += 1;
    else failed = outcome.message;
  }
  await refresh();
  revalidatePath("/admin/ui-text/");
  return failed && restored === 0 ? { ok: false, message: failed } : { ok: true, message: `Undone. ${restored} text${restored === 1 ? " is" : "s are"} back as before.${failed ? " One could not be undone." : ""}` };
}
