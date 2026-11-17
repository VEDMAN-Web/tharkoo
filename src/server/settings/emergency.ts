import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError } from "@/server/http";
import { Site } from "@/server/models";

/**
 * H8.25 (A25): the emergency switches. They live on the site record (`emergency`), every switch is off unless someone turns it on,
 * and each one is enforced on the server in the path it protects, so a pause cannot be skipped by calling the API directly.
 * A change goes through adminWrite (permission, audit) and can be undone for the "settings" window.
 */

export { EMERGENCY_KEYS, EMERGENCY_LABELS, PAUSE_MESSAGES, type EmergencyKey, type EmergencyState } from "@/server/settings/emergency-labels";
import { EMERGENCY_KEYS, EMERGENCY_LABELS, PAUSE_MESSAGES, type EmergencyKey, type EmergencyState } from "@/server/settings/emergency-labels";

const OFF: EmergencyState = { holdNewAds: false, pauseNewAccounts24h: false, pausePaidPosting: false, pausePurchases: false, pauseVideoCalls: false };

/** The switches as saved. A missing record or switch is off. Not cached: a switch must act at once. */
export async function readEmergency(): Promise<EmergencyState> {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("emergency").lean<{ emergency?: Partial<EmergencyState> } | null>();
  return { ...OFF, ...Object.fromEntries(EMERGENCY_KEYS.map((key) => [key, site?.emergency?.[key] === true])) } as EmergencyState;
}

export async function isEmergencyOn(key: EmergencyKey): Promise<boolean> {
  await connectDb();
  return (await readEmergency())[key];
}

/** Stops the caller with a clear message when this pause is on. */
export async function assertNotPaused(key: Exclude<EmergencyKey, "holdNewAds">): Promise<void> {
  await connectDb();
  if (await isEmergencyOn(key)) throw new ConflictError(PAUSE_MESSAGES[key]);
}

/** A new account is one created less than 24 hours ago. */
export function isNewAccount(createdAt: Date | undefined | null, now: Date = new Date()): boolean {
  return Boolean(createdAt) && now.getTime() - (createdAt as Date).getTime() < 24 * 60 * 60 * 1000;
}

export type EmergencyWrite = { eventId: string; undoUntil: string | null; summary: string; state: EmergencyState };

/** Turns one switch on or off. Needs the `settings.emergency` permission. Undo restores the whole saved set of switches. */
export async function setEmergencySwitch(ctx: AdminCtx, input: { key: string; on: unknown }): Promise<EmergencyWrite> {
  await connectDb();
  const key = EMERGENCY_KEYS.find((candidate) => candidate === input.key);
  if (!key || typeof input.on !== "boolean") throw new ConflictError("Choose one of the switches on the page.");
  const on = input.on;
  const written = await adminWrite(ctx, {
    perm: "settings.emergency",
    action: "settings.emergency",
    target: { type: "site", id: "default", label: EMERGENCY_LABELS[key].title },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ ...(await readEmergency()) }),
    apply: async () => {
      const was = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: "default" }, { $set: { [`emergency.${key}`]: on } }, { upsert: true });
      const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      const state = await readEmergency();
      const hadSet = Boolean(was && was.emergency && typeof was.emergency === "object");
      return {
        after: { ...state },
        result: state,
        summary: `${on ? "Turned on" : "Turned off"}: ${EMERGENCY_LABELS[key].title}`,
        undoData: { model: "Site", id: String(site?._id), restore: hadSet ? { emergency: JSON.parse(JSON.stringify(was?.emergency)) } : {}, unset: hadSet ? [] : ["emergency"], expect: { emergency: JSON.parse(JSON.stringify(site?.emergency ?? {})) } },
      };
    },
  });
  await refreshPublicCache("emergency switches");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `${EMERGENCY_LABELS[key].title}: ${on ? "on" : "off"}`, state: written.result };
}
