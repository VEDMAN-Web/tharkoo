import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { NotFoundError, ValidationError } from "@/server/http";
import { User } from "@/server/models";

/** H11.1: "Extra free ads" for one person, on top of the site setting. Admin only, audited, one Undo. */

export const MAX_EXTRA_FREE_ADS = 1000;

export async function setExtraFreeAds(ctx: AdminCtx, input: { userId: string; extra: unknown }) {
  await connectDb();
  const extra = typeof input.extra === "string" && input.extra.trim() !== "" ? Number(input.extra) : input.extra;
  if (typeof extra !== "number" || !Number.isInteger(extra) || extra < 0 || extra > MAX_EXTRA_FREE_ADS) {
    throw new ValidationError(`Extra free ads is a whole number from 0 to ${MAX_EXTRA_FREE_ADS}.`);
  }
  if (!mongoose.isValidObjectId(input.userId)) throw new NotFoundError("Not found");
  const user = await User.findById(input.userId).select("displayName extraFreeAds").lean<{ _id: mongoose.Types.ObjectId; displayName: string; extraFreeAds?: number } | null>();
  if (!user) throw new NotFoundError("Not found");
  const was = typeof user.extraFreeAds === "number" ? user.extraFreeAds : 0;
  const written = await adminWrite<{ extra: number }>(ctx, {
    perm: "prices.edit",
    action: "user.extra_free_ads",
    target: { type: "user", id: String(user._id), label: user.displayName },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ extraFreeAds: was }),
    apply: async () => {
      const hadKey = typeof user.extraFreeAds === "number";
      await User.updateOne({ _id: user._id }, extra === 0 ? { $unset: { extraFreeAds: "" } } : { $set: { extraFreeAds: extra } });
      const after = extra === 0 ? {} : { extraFreeAds: extra };
      return {
        after: { extraFreeAds: extra },
        result: { extra },
        summary: `Set extra free ads to ${extra} for ${user.displayName}`,
        undoData: {
          model: "User",
          id: String(user._id),
          restore: hadKey ? { extraFreeAds: was } : {},
          unset: hadKey ? [] : ["extraFreeAds"],
          expect: after,
        },
      };
    },
  });
  return { extra: written.result.extra, eventId: written.eventId, undoUntil: written.undoUntil };
}
