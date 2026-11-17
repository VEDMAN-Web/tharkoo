"use server";

import { canEditSite } from "@/lib/ui/site-content";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import { getDraft, getPublished, listRevisions, publish, restore, saveDraft, validateBlocks } from "@/server/layout/service";
import { seedPostLayout } from "@/server/seed/layouts";
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
    if (!canEditSite(who.roles)) throw new ForbiddenError("Only an admin can edit page layouts");
    // The first time an admin opens the post-ad editor, start from the page as it is today. The Home layout is made by the Page builder.
    if (key === "post" && scope === "default") await seedPostLayout();
    const [draft, published] = await Promise.all([getDraft(key, scope), getPublished(key, scope)]);
    const own = (draft && draft.length > 0 ? draft : published) as BlockBase[] | null;
    // A listing scope with no layout yet starts from what the pages show today: the default layout, else the built-in blocks.
    if (key === "listing" && (!own || own.length === 0)) {
      const fallback = scope === "default" ? null : await getPublished(key, "default");
      const start = fallback && fallback.length > 0 ? fallback : validateBlocks("listing", listingDefaultBlocks(), new Set());
      return { draft: start as BlockBase[], published: null, starter: true };
    }
    return { draft: (own ?? []) as BlockBase[], published: published as BlockBase[] | null, starter: false };
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
