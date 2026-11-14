import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError } from "@/server/http";
import { Site } from "@/server/models";

/**
 * H6.14: "Require ID check before posting". Stored on the site document as `requireIdCheckToPost`.
 * Off by default: a missing value means off, and the migration below writes `false` into the stored value.
 * When off, nobody is asked for ID in post-ad and no user record is marked approved.
 */

const SITE_KEY = "default";
const audit = new AuditRepository();

export const idCheckBodySchema = z.object({ required: z.boolean() }).strict();

/** The post-ad screen for one person: the form, the "verify first" screen, or the "we are checking" screen. */
export type IdCheckScreen = "form" | "verify" | "checking";

/** Pure: which post-ad screen to show. With the switch off the form always opens. */
export function idCheckScreen(required: boolean, status: string | null | undefined): IdCheckScreen {
  if (!required || status === "approved") return "form";
  if (status === "pending_review") return "checking";
  return "verify";
}

/** True only when the stored switch is on. A missing value is off. */
export async function idCheckRequired(): Promise<boolean> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY }).select("requireIdCheckToPost").lean<{ requireIdCheckToPost?: boolean } | null>();
  return site?.requireIdCheckToPost === true;
}

/** Superadmin only. Writes the switch and an audit entry with the value before and after. */
export async function setIdCheckRequired(input: { actorId: string; roles: readonly string[]; required: boolean; requestId: string }) {
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this setting");
  const before = await idCheckRequired();
  await Site.updateOne({ key: SITE_KEY }, { $set: { requireIdCheckToPost: input.required } }, { upsert: true });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.id_check.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before: { requireIdCheckToPost: before },
    after: { requireIdCheckToPost: input.required },
  });
  return { required: input.required };
}

/**
 * Stores `false` when the setting is missing. Idempotent: a stored value (on or off) is never changed.
 * Called from the daily cron route and from the seed, like the hero migration (H6.13).
 */
export async function ensureIdCheckSetting(requestId: string) {
  await connectDb();
  const result = await Site.updateOne(
    { key: SITE_KEY, requireIdCheckToPost: { $exists: false } },
    { $set: { requireIdCheckToPost: false } },
  );
  const updated = result.modifiedCount;
  if (updated > 0) {
    await audit.append({
      actorType: "system",
      action: "settings.id_check.default",
      targetType: "site",
      targetId: SITE_KEY,
      requestId,
      after: { requireIdCheckToPost: false },
    });
  }
  return { updated };
}
