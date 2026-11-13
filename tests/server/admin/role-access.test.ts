import { describe, expect, it } from "vitest";
import { canUseModel } from "@/lib/admin-model-access";
import { canOpenAdminPath, routeMinRole } from "@/lib/admin-gate";

const ROLES = {
  superadmin: ["superadmin"],
  admin: ["admin"],
  moderator: ["moderator"],
  trust_safety: ["trust_safety"],
  seo_editor: ["seo_editor"],
  support: ["support"],
  finance: ["finance"],
  user: ["user"],
  anonymous: [],
} as const;

type RoleName = keyof typeof ROLES;

/** Every route the sidebar names, with the roles that may open it. Anything else needs admin. */
const ROUTE_TABLE: [string, RoleName[]][] = [
  ["/admin/", ["superadmin", "admin", "moderator", "trust_safety", "seo_editor", "support", "finance"]],
  ["/admin/homepage/", ["superadmin", "admin"]],
  ["/admin/moderation/", ["superadmin", "admin", "moderator"]],
  ["/admin/listings/", ["superadmin", "admin", "moderator"]],
  ["/admin/reports/", ["superadmin", "admin", "trust_safety"]],
  ["/admin/kyc/", ["superadmin", "admin", "trust_safety"]],
  ["/admin/tags/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/seo/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/seo/pages/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/seo/indexing/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/seo/settings/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/urls/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/templates/", ["superadmin", "admin", "seo_editor"]],
  ["/admin/coupons/", ["superadmin", "admin", "finance"]],
  ["/admin/finance/", ["superadmin", "admin", "finance"]],
  ["/admin/users/", ["superadmin", "admin"]],
  ["/admin/admins/", ["superadmin"]],
  ["/admin/settings/", ["superadmin"]],
  ["/admin/flags/", ["superadmin"]],
  ["/admin/audit/", ["superadmin", "admin"]],
  // Not in the sidebar: closed until it is listed.
  ["/admin/some-new-screen/", ["superadmin", "admin"]],
  ["/admin/seo/settings/", ["superadmin", "admin", "seo_editor"]],
];

describe("admin screens by role (server gate)", () => {
  it.each(ROUTE_TABLE)("%s opens only for the listed roles", (path, allowed) => {
    for (const [name, roles] of Object.entries(ROLES)) {
      expect(canOpenAdminPath(roles, path), `${name} on ${path}`).toBe(allowed.includes(name as RoleName));
    }
  });

  it("an unknown screen needs admin", () => {
    expect(routeMinRole("/admin/not-in-the-sidebar/")).toBe("admin");
  });

  it("a signed-in user without a staff role opens no admin screen", () => {
    for (const [path] of ROUTE_TABLE) expect(canOpenAdminPath(ROLES.user, path), path).toBe(false);
  });
});

const MODELS = [
  "Site",
  "Category",
  "Location",
  "Listing",
  "SeoTemplate",
  "Page",
  "HelpArticle",
  "BlogPost",
  "CreditPack",
  "Banner",
  "Coupon",
  "BannedWord",
  "FeatureFlag",
  "AttributeGroup",
  "Product",
  "PromotionOrder",
] as const;

/** Roles that may read or write each model through /api/admin. admin and superadmin may use every model. */
const MODEL_TABLE: Record<string, { read: RoleName[]; write: RoleName[] }> = {
  SeoTemplate: { read: ["seo_editor"], write: ["seo_editor"] },
  Listing: { read: ["moderator", "trust_safety"], write: [] },
};

describe("admin model access by role (generic API)", () => {
  for (const model of MODELS) {
    for (const access of ["read", "write"] as const) {
      it.each(Object.entries(ROLES))(`${model} ${access} (%s)`, (name, roles) => {
        const listed = MODEL_TABLE[model]?.[access] ?? [];
        const expected = name === "superadmin" || name === "admin" || listed.includes(name as RoleName);
        expect(canUseModel(roles, model, access)).toBe(expected);
      });
    }
  }
});
