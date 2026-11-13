/** Roles that may use every model through the generic /api/admin endpoints. */
const ALL_MODELS_ROLES = ["admin", "superadmin"] as const;

/** Roles that may read a model through /api/admin/list (besides the all-model roles). */
const READ_ROLES = new Map<string, readonly string[]>([
  ["SeoTemplate", ["seo_editor"]],
  ["Listing", ["moderator", "trust_safety"]],
]);

/** Roles that may create, update or delete a model through /api/admin/mutate (besides the all-model roles). */
const WRITE_ROLES = new Map<string, readonly string[]>([["SeoTemplate", ["seo_editor"]]]);

export type ModelAccess = "read" | "write";

/**
 * Deny by default: a model not listed for a role is refused. Coupons, finance, settings, users and roles
 * are not listed for anyone but admin and superadmin, and support or finance staff get no generic model access.
 */
export function canUseModel(roles: readonly string[], model: string, access: ModelAccess): boolean {
  if (roles.some((role) => (ALL_MODELS_ROLES as readonly string[]).includes(role))) return true;
  const allowed = (access === "write" ? WRITE_ROLES : READ_ROLES).get(model) ?? [];
  return allowed.some((role) => roles.includes(role));
}
