"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { getDraft, getPublished, listRevisions, publish, restore, saveDraft } from "@/server/layout/service";
import { seedHomeLayout, seedPostLayout } from "@/server/seed/layouts";
import type { BlockBase, PageKey } from "@/server/models/layout";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function staff() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new ForbiddenError("Sign in as staff to edit layouts");
  return identity;
}

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("layout action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function loadLayout(key: PageKey, scope: string) {
  return run(async () => {
    const who = await staff();
    if (!who.roles.some((role) => role === "admin" || role === "superadmin")) throw new ForbiddenError("Only an admin can edit page layouts");
    // The first time an admin opens the home or post-ad editor, start from the page as it is today.
    if (key === "home" && scope === "default") await seedHomeLayout();
    if (key === "post" && scope === "default") await seedPostLayout();
    const [draft, published] = await Promise.all([getDraft(key, scope), getPublished(key, scope)]);
    return { draft: (draft ?? published ?? []) as BlockBase[], published: published as BlockBase[] | null };
  });
}

export async function saveDraftAction(key: PageKey, scope: string, blocks: unknown) {
  return run(async () => {
    const who = await staff();
    return saveDraft({ key, scope, blocks, email: who.email, roles: who.roles });
  });
}

export async function publishAction(key: PageKey, scope: string, note?: string) {
  return run(async () => {
    const who = await staff();
    return publish({ key, scope, note, email: who.email, roles: who.roles });
  });
}

export async function restoreAction(key: PageKey, scope: string, version: number) {
  return run(async () => {
    const who = await staff();
    return restore({ key, scope, version, email: who.email, roles: who.roles });
  });
}

export async function revisionsAction(key: PageKey, scope: string) {
  return run(async () => {
    const who = await staff();
    return { revisions: await listRevisions(key, scope, who.roles) };
  });
}
