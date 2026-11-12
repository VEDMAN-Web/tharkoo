import { AuditRepository } from "@/server/audit";
import { ForbiddenError } from "@/server/http";
import { User } from "@/server/models";

export interface SeoActor {
  roles: string[];
  email: string;
}

const audit = new AuditRepository();

/** seo_editor and above may use the SEO center; settings that change robots need superadmin. */
export function assertSeoEditor(actor: SeoActor) {
  if (!actor.roles.some((role) => role === "seo_editor" || role === "admin" || role === "superadmin")) {
    throw new ForbiddenError("Only an SEO editor or admin can use the SEO center");
  }
}

export function assertSuperadmin(actor: SeoActor) {
  if (!actor.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this");
}

export async function recordSeo(actor: SeoActor, action: string, targetType: string, targetId: string, before: unknown, after: unknown) {
  const user = actor.email ? await User.findOne({ email: actor.email }).select("_id") : null;
  await audit.append({
    actorId: user?._id?.toString() ?? null,
    actorType: "admin",
    action,
    targetType,
    targetId,
    before: (before ?? {}) as Record<string, unknown>,
    after: (after ?? {}) as Record<string, unknown>,
    requestId: crypto.randomUUID(),
  });
}
