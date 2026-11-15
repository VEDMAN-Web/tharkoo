import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, parseInput } from "@/server/http";
import { Site } from "@/server/models";
import { z } from "zod";

/**
 * H7.1: the "New design" switch. Stored on the site document as `newDesign`.
 *
 * Superadmin only and audited. The old design stays in the code so one switch flips back.
 * A missing value means: on only where SITE_NOINDEX is "true" (the staging host), off everywhere else.
 * H7.2 and H7.3 read the same switch through `newDesignOn()`.
 *
 * `newDesign` is not in the Site schema (models/cms.ts is outside this lane), so reads use lean and writes
 * pass `strict: false`. Add the field to the schema in a later lane and drop the option.
 */

const SITE_KEY = "default";
const audit = new AuditRepository();

export const newDesignBodySchema = z.object({ on: z.boolean() }).strict();

/** Pure: the switch value a site gets before anyone has saved it. */
export function defaultNewDesign(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_NOINDEX === "true";
}

/** The value in force now. Any server code may read it. */
export async function newDesignOn(): Promise<boolean> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY }).select("newDesign").lean<{ newDesign?: boolean } | null>();
  if (site && typeof site.newDesign === "boolean") return site.newDesign;
  return defaultNewDesign();
}

/** Superadmin only. Writes the switch and an audit entry with the value before and after. */
export async function setNewDesign(input: { actorId: string; roles: readonly string[]; on: unknown; requestId: string }) {
  await connectDb();
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this setting");
  const { on } = parseInput(newDesignBodySchema, { on: input.on });
  const before = await newDesignOn();
  await Site.updateOne({ key: SITE_KEY }, { $set: { newDesign: on } }, { upsert: true, strict: false });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.new_design.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before: { newDesign: before },
    after: { newDesign: on },
  });
  await refreshPublicCache();
  return { on };
}

/**
 * Idempotent migration: stores the default for a site that has no value yet. A stored value (on or off)
 * is never changed. Safe to run from the daily cron or the seed.
 */
export async function ensureNewDesignSetting(requestId: string) {
  await connectDb();
  const value = defaultNewDesign();
  const result = await Site.updateOne(
    { key: SITE_KEY, newDesign: { $exists: false } },
    { $set: { newDesign: value } },
    { strict: false },
  );
  if (result.modifiedCount > 0) {
    await audit.append({
      actorType: "system",
      action: "settings.new_design.default",
      targetType: "site",
      targetId: SITE_KEY,
      requestId,
      after: { newDesign: value },
    });
    await refreshPublicCache();
  }
  return { updated: result.modifiedCount, value };
}
