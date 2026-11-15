import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError } from "@/server/http";
import { FeatureFlag } from "@/server/models";

/**
 * Relay #64: "Code-only login". Stored as the feature flag `code-only-login`. Off by default: no flag row means off.
 * When on, users and sellers cannot use a password (log in, sign up, reset). Staff and admin password login is never changed.
 * Only a superadmin can change it, and every change is audited with the value before and after.
 */

export const CODE_ONLY_FLAG = "code-only-login";
const audit = new AuditRepository();

export const codeOnlyBodySchema = z.object({ enabled: z.boolean() }).strict();

/** True only when the stored flag is on. A missing row is off. */
export async function codeOnlyLoginEnabled(): Promise<boolean> {
  await connectDb();
  const flag = await FeatureFlag.findOne({ key: CODE_ONLY_FLAG }).select("enabled").lean<{ enabled?: boolean } | null>();
  return flag?.enabled === true;
}

/** Superadmin only. Writes the flag and an audit entry with the value before and after. */
export async function setCodeOnlyLogin(input: { actorId: string; roles: readonly string[]; enabled: boolean; requestId: string }) {
  await connectDb();
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this setting");
  const before = await codeOnlyLoginEnabled();
  await FeatureFlag.updateOne(
    { key: CODE_ONLY_FLAG },
    { $set: { enabled: input.enabled, label: "Code-only login (no passwords for users and sellers)" } },
    { upsert: true },
  );
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.code_only_login.update",
    targetType: "feature_flag",
    targetId: CODE_ONLY_FLAG,
    requestId: input.requestId,
    before: { enabled: before },
    after: { enabled: input.enabled },
  });
  return { enabled: input.enabled };
}
