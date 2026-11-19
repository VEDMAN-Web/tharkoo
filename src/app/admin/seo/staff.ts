import { recordAdminChange } from "@/server/admin/write";
import { ForbiddenError } from "@/server/http";

export interface SeoActor {
  roles: string[];
  email: string;
}

/** seo_editor and above may use the SEO center; settings that change robots need superadmin. */
export function assertSeoEditor(actor: SeoActor) {
  if (!actor.roles.some((role) => role === "seo_editor" || role === "admin" || role === "superadmin")) {
    throw new ForbiddenError("Only an SEO editor or admin can use the SEO center");
  }
}

export function assertSuperadmin(actor: SeoActor) {
  if (!actor.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this");
}

const SEO_WORDS: Record<string, string> = {
  "seo.template.save": "Saved the SEO template",
  "seo.template.delete": "Removed the SEO template",
  "seo.audit.run": "Ran the SEO check",
  "seo.settings.save": "Saved the SEO settings",
  "seo.redirect.create": "Added a redirect from",
  "seo.override.save": "Saved the SEO override for",
  "seo.override.delete": "Removed the SEO override for",
};

export async function recordSeo(actor: SeoActor, action: string, targetType: string, targetId: string, before: unknown, after: unknown) {
  const words = SEO_WORDS[action] ?? `Changed SEO (${action})`;
  await recordAdminChange(actor, {
    action,
    target: { type: targetType, id: targetId, label: targetId },
    before: (before ?? {}) as Record<string, unknown>,
    after: (after ?? {}) as Record<string, unknown>,
    summary: action === "seo.audit.run" || action === "seo.settings.save" ? words : `${words}: ${targetId}`,
  });
}
