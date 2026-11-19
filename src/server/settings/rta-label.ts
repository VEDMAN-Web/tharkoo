import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ValidationError } from "@/server/http";
import { Site } from "@/server/models";

/** H17.13: the registered RTA ("Restricted To Adults") label of this site. */
export const RTA_LABEL_VALUE = "RTA-5042-1996-1400-1577-RTA";

/** The label is ON unless an admin turned it off (a missing value counts as on). */
export async function readRtaLabel(): Promise<boolean> {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("rtaLabel").lean<{ rtaLabel?: boolean } | null>();
  return site?.rtaLabel !== false;
}

export type RtaWrite = { eventId: string; undoUntil: string | null; summary: string; on: boolean };

/** An admin turns the RTA label on or off. Admin permission, audit entry with before and after, Undo for the settings window. */
export async function saveRtaLabel(ctx: AdminCtx, input: { on: unknown }): Promise<RtaWrite> {
  await connectDb();
  if (typeof input.on !== "boolean") throw new ValidationError("Choose On or Off.");
  const on = input.on;
  const written = await adminWrite(ctx, {
    perm: "settings.edit",
    action: "settings.rta_label",
    target: { type: "site", id: "default", label: "RTA label" },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ rtaLabel: await readRtaLabel() }),
    apply: async () => {
      const was = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: "default" }, { $set: { rtaLabel: on } }, { upsert: true });
      const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      const had = Boolean(was && "rtaLabel" in was);
      return {
        after: { rtaLabel: on },
        result: on,
        summary: on ? "Turned on the RTA label" : "Turned off the RTA label",
        undoData: { model: "Site", id: String(site?._id), restore: had ? { rtaLabel: was?.rtaLabel ?? true } : {}, unset: had ? [] : ["rtaLabel"], expect: { rtaLabel: on } },
      };
    },
  });
  await refreshPublicCache("rta label");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: on ? "The RTA label is on" : "The RTA label is off", on: written.result };
}
