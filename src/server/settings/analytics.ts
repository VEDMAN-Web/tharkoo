import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { cleanGaId } from "@/lib/analytics/ga";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ValidationError } from "@/server/http";
import { Site } from "@/server/models";

/**
 * H17.11: the Google Analytics measurement ID, an admin site setting. Empty means no tag on the site.
 * The ID is public (it is in the page source of every site that uses it), so it is stored and shown as plain text,
 * but only the strict GA4 shape is accepted: nothing else can reach the page.
 */

export async function readGoogleAnalyticsId(): Promise<string> {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("googleAnalyticsId").lean<{ googleAnalyticsId?: string } | null>();
  return cleanGaId(site?.googleAnalyticsId);
}

export type AnalyticsWrite = { eventId: string; undoUntil: string | null; summary: string; id: string };

/** An admin sets (or clears) the ID. Admin permission, audit entry with before and after, undo for the "settings" window. */
export async function saveGoogleAnalyticsId(ctx: AdminCtx, input: { id: unknown }): Promise<AnalyticsWrite> {
  await connectDb();
  const raw = typeof input.id === "string" ? input.id.trim() : "";
  const id = raw === "" ? "" : cleanGaId(raw);
  if (raw !== "" && id === "") throw new ValidationError("Enter the measurement ID as it appears in Google Analytics, for example G-ABC123XYZ4, or leave it empty for no tag.");
  const written = await adminWrite(ctx, {
    perm: "settings.edit",
    action: "settings.google_analytics",
    target: { type: "site", id: "default", label: "Google Analytics ID" },
    texts: [id],
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ googleAnalyticsId: await readGoogleAnalyticsId() }),
    apply: async () => {
      const was = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: "default" }, { $set: { googleAnalyticsId: id } }, { upsert: true });
      const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      const had = Boolean(was && "googleAnalyticsId" in was);
      return {
        after: { googleAnalyticsId: id },
        result: id,
        summary: id ? `Set the Google Analytics ID to ${id}` : "Turned Google Analytics off (no ID)",
        undoData: { model: "Site", id: String(site?._id), restore: had ? { googleAnalyticsId: was?.googleAnalyticsId ?? "" } : {}, unset: had ? [] : ["googleAnalyticsId"], expect: { googleAnalyticsId: id } },
      };
    },
  });
  await refreshPublicCache("google analytics id");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: id ? "Google Analytics ID saved" : "Google Analytics is off", id: written.result };
}
