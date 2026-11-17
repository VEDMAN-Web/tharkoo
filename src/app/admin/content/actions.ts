"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/admin/perms";
import { adminContext, type AdminCtx } from "@/server/admin/context";
import { createItem, publishItem, saveDraft, unpublishItem, type ContentWrite } from "@/server/content/studio/service";
import { changeSlug } from "@/server/content/studio/slug";
import { suggestLinks, type LinkSuggestion } from "@/server/content/studio/suggest";
import { HttpError } from "@/server/http";

/** H8.31: server actions behind the content editor. Each one answers { ok } and never throws a stack to the browser. */

export type ContentResult = ({ ok: true; redirected?: boolean } & ContentWrite) | { ok: false; message: string; fields?: Record<string, string[]> };
export type SuggestResult = { ok: true; items: LinkSuggestion[] } | { ok: false; message: string };

async function run(work: (ctx: AdminCtx) => Promise<ContentWrite & { redirected?: boolean }>): Promise<ContentResult> {
  try {
    const ctx = await adminContext();
    const done = await work(ctx);
    revalidatePath("/admin/content/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message, fields: error.fields };
    throw error;
  }
}

export async function createItemAction(input: { kind: string; title: string; slug?: string }): Promise<ContentResult> {
  return run((ctx) => createItem(ctx, { kind: String(input.kind), title: String(input.title ?? ""), slug: input.slug ? String(input.slug) : undefined }));
}

export async function saveDraftAction(input: { itemId: string; fields: unknown; expectedVersion?: number }): Promise<ContentResult> {
  return run((ctx) => saveDraft(ctx, { itemId: String(input.itemId), fields: input.fields, expectedVersion: typeof input.expectedVersion === "number" ? input.expectedVersion : undefined }));
}

export async function publishAction(input: { itemId: string }): Promise<ContentResult> {
  return run((ctx) => publishItem(ctx, { itemId: String(input.itemId) }));
}

export async function unpublishAction(input: { itemId: string; mode: string; to?: string }): Promise<ContentResult> {
  return run((ctx) => unpublishItem(ctx, { itemId: String(input.itemId), mode: String(input.mode), to: input.to ? String(input.to) : undefined }));
}

export async function changeSlugAction(input: { itemId: string; slug: string }): Promise<ContentResult> {
  return run((ctx) => changeSlug(ctx, { itemId: String(input.itemId), slug: String(input.slug ?? "") }));
}

/** Pages Google can see that the text talks about. Needs a signed-in staff member who can write content. */
export async function suggestLinksAction(text: string): Promise<SuggestResult> {
  try {
    const ctx = await adminContext();
    if (!can(ctx.roles, "content.write")) return { ok: false, message: "You do not have permission to do this" };
    return { ok: true, items: await suggestLinks(String(text ?? "")) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
