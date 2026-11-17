import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { blogPath, helpPath, validateSlug } from "@/lib/urls";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateKey } from "@/server/http";
import { ContentItem, type ContentItemDoc } from "@/server/models/content";
import { getPaths, saveRedirect } from "@/server/urls/service";
import { canWriteKind, type ContentWrite } from "./service";

/**
 * H8.31: changes the web address of a blog post or a help article. When the old address was ever public, visitors and Google
 * who come to it are sent to the new one by a permanent redirect, so no link breaks. The address is never changed to one that is taken or reserved.
 */

const WAS_PUBLIC = ["published", "scheduled", "unpublished"] as const;

export async function changeSlug(ctx: AdminCtx, input: { itemId: string; slug: string }): Promise<ContentWrite & { redirected: boolean }> {
  await connectDb();
  if (!mongoose.isValidObjectId(input.itemId)) throw new NotFoundError("Not found");
  const item = await ContentItem.findById(input.itemId).lean<(ContentItemDoc & { _id: mongoose.Types.ObjectId }) | null>();
  if (!item) throw new NotFoundError("Not found");
  if (item.kind !== "blog" && item.kind !== "help") throw new ValidationError("Only a blog post or a help article has an address that can change here.");
  if (!canWriteKind(ctx.roles, item.kind) || !can(ctx.roles, "content.write")) throw new ForbiddenError("You do not have permission to do this");
  const paths = await getPaths();
  const checked = validateSlug(String(input.slug ?? ""), paths);
  if (!checked.ok) throw new ValidationError(checked.message);
  const next = checked.slug;
  if (next === item.slug) throw new ConflictError("This is already the address.");
  const wasPublic = (WAS_PUBLIC as readonly string[]).includes(item.status) || Boolean(item.publishedAt);
  const make = item.kind === "blog" ? blogPath : helpPath;
  const title = item.draft?.title ?? "";
  const written = await adminWrite(ctx, {
    perm: "content.write",
    action: "content.slug",
    target: { type: "content", id: String(item._id), label: title },
    before: async () => ({ slug: item.slug }),
    apply: async () => {
      try {
        const updated = await ContentItem.updateOne({ _id: item._id, slug: item.slug }, { $set: { slug: next, lastEditedBy: ctx.email } });
        if (updated.matchedCount !== 1) throw new ConflictError("Someone changed this a moment ago. Open it again.");
      } catch (error) {
        if (isDuplicateKey(error)) throw new ConflictError("Another page already uses this address.");
        throw error;
      }
      if (wasPublic) await saveRedirect(make(paths, item.slug), make(paths, next));
      return { after: { slug: next, redirect: wasPublic }, result: null, summary: `Changed the address of "${title}" to ${make(paths, next)}${wasPublic ? " (the old one redirects)" : ""}` };
    },
  });
  await refreshPublicCache("content studio");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `The address is now ${make(paths, next)}`, itemId: String(item._id), redirected: wasPublic };
}
