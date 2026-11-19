import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS, findItem, visibleGroups } from "@/components/admin/nav";
import { STAFF_ROLES } from "@/lib/admin/perms";
import { GROUPS, LEGACY_ROUTES, SCREENS, canOpenPath, screenForPath } from "@/lib/admin/screens";
import { canOpenAdminPath } from "@/lib/admin-gate";
import { isStaffRole } from "@/server/auth/service";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";

const FOUR = ["superadmin", "admin", "moderator", "trust_safety"];
const ADMINS = ["superadmin", "admin"];

const WHO_OPENS: Record<string, string[]> = {
  dashboard: [...STAFF_ROLES],
  history: [...STAFF_ROLES],
  review: FOUR,
  reports: FOUR,
  "id-checks": FOUR,
  support: [...ADMINS, "support"],
  "all-ads": [...FOUR, "support"],
  users: [...FOUR, "support"],
  orders: [...ADMINS, "finance"],
  prices: [...ADMINS, "finance"],
  "page-builder": [...ADMINS, "content_editor"],
  content: [...ADMINS, "seo_editor", "blog_editor", "content_editor"],
  media: [...ADMINS, "content_editor"],
  menus: [...ADMINS, "content_editor"],
  categories: [...ADMINS, "content_editor"],
  cities: [...ADMINS, "content_editor"],
  seo: [...ADMINS, "seo_editor"],
  settings: ["superadmin"],
  team: ["superadmin"],
};

function labels(roles: string[]) {
  return visibleGroups(roles).flatMap((group) => group.items.map((entry) => entry.label));
}

describe("screens map (A5)", () => {
  it("has 7 groups and 19 screens, with the sidebar v5 labels in order", () => {
    expect(GROUPS).toHaveLength(7);
    expect(SCREENS).toHaveLength(19);
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["Today", "Queues", "Ads & people", "Money", "Website", "Catalogue", "System"]);
    expect(NAV_GROUPS.flatMap((group) => group.items.map((entry) => entry.label))).toEqual([
      "Dashboard",
      "History & undo",
      "Ads to review",
      "Reports",
      "ID checks",
      "Support desk",
      "All ads",
      "Users",
      "Orders & credits",
      "Prices & plans",
      "Page builder",
      "Content studio",
      "Media library",
      "Menus & site text",
      "Categories & fields",
      "Cities & areas",
      "SEO",
      "Settings",
      "Team & roles",
    ]);
  });

  it("every screen and every old route points at a page or route that exists, with no duplicate address", () => {
    const hrefs = [...SCREENS, ...LEGACY_ROUTES].map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      const dir = path.join(process.cwd(), "src", "app", href.replace(/^\//, ""));
      expect(existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts")), href).toBe(true);
    }
  });

  it("covers every one of the 9 roles and the permissions of each screen", () => {
    expect(STAFF_ROLES).toHaveLength(9);
    for (const screen of SCREENS) {
      for (const role of STAFF_ROLES) {
        const expected = (WHO_OPENS[screen.id] ?? []).includes(role);
        expect(canOpenPath([role], screen.href), `${role} on ${screen.id}`).toBe(expected);
        expect(canOpenAdminPath([role], screen.href), `${role} gate on ${screen.id}`).toBe(expected);
      }
    }
  });

  it("shows each role only the screens it can open", () => {
    expect(labels(["blog_editor"])).toEqual(["Dashboard", "History & undo", "Content studio"]);
    expect(labels(["support"])).toEqual(["Dashboard", "History & undo", "Support desk", "All ads", "Users"]);
    expect(labels(["finance"])).toEqual(["Dashboard", "History & undo", "Orders & credits", "Prices & plans"]);
    expect(labels(["moderator"])).toEqual(["Dashboard", "History & undo", "Ads to review", "Reports", "ID checks", "All ads", "Users"]);
    expect(labels(["seo_editor"])).toEqual(["Dashboard", "History & undo", "Content studio", "SEO"]);
    expect(labels(["content_editor"])).toEqual(["Dashboard", "History & undo", "Page builder", "Content studio", "Media library", "Menus & site text", "Categories & fields", "Cities & areas"]);
    expect(labels(["admin"])).not.toContain("Settings");
    expect(labels(["admin"])).not.toContain("Team & roles");
    expect(labels(["superadmin"])).toHaveLength(19);
    expect(labels([])).toEqual([]);
    expect(labels(["user"])).toEqual([]);
  });

  it("an unknown /admin path is for admin and superadmin only", () => {
    for (const role of STAFF_ROLES) {
      expect(canOpenAdminPath([role], "/admin/not-a-screen/"), role).toBe(role === "admin" || role === "superadmin");
    }
    expect(screenForPath("/admin/not-a-screen/")).toEqual({ view: "settings.edit" });
  });

  it("the longest address wins, with or without the closing slash", () => {
    expect(screenForPath("/admin")).toEqual({ view: "dashboard.view" });
    expect(screenForPath("/admin/seo/templates/")).toEqual({ view: "seo.edit" });
    expect(screenForPath("/admin/seo/pages/abc")).toEqual({ view: "seo.edit" });
    expect(screenForPath("/admin/ads/")).toEqual({ view: "ads.view" });
    expect(screenForPath("/admin/ads/create/")).toEqual({ view: "settings.edit" });
    expect(screenForPath("/admin/settings/")).toEqual({ view: "settings.edit", only: "superadmin" });
    expect(screenForPath("/admin/settings/money/")).toEqual({ view: "prices.edit" });
    expect(screenForPath("/admin/support/abc123/")).toEqual({ view: "desk.work" });
    expect(screenForPath("/admin/blog/")).toEqual({ view: "content.write" });
  });

  it("old routes stay reachable for the roles that had them", () => {
    expect(canOpenAdminPath(["moderator"], "/admin/listings/")).toBe(true);
    expect(canOpenAdminPath(["seo_editor"], "/admin/tags/")).toBe(true);
    expect(canOpenAdminPath(["seo_editor"], "/admin/urls/")).toBe(true);
    expect(canOpenAdminPath(["seo_editor"], "/admin/ui-text/")).toBe(true);
    expect(canOpenAdminPath(["finance"], "/admin/coupons/")).toBe(true);
    expect(canOpenAdminPath(["finance"], "/admin/promotions/")).toBe(true);
    expect(canOpenAdminPath(["blog_editor"], "/admin/blog/")).toBe(true);
    expect(canOpenAdminPath(["blog_editor"], "/admin/help/")).toBe(true);
    expect(canOpenAdminPath(["blog_editor"], "/admin/seo/")).toBe(false);
    expect(canOpenAdminPath(["moderator"], "/admin/ads/create/")).toBe(false);
    expect(canOpenAdminPath(["admin"], "/admin/homepage/")).toBe(true);
    expect(canOpenAdminPath(["admin"], "/admin/settings/money/")).toBe(true);
    expect(canOpenAdminPath(["admin"], "/admin/settings/")).toBe(false);
    expect(canOpenAdminPath(["admin"], "/admin/flags/")).toBe(false);
    expect(canOpenAdminPath(["seo_editor"], "/admin/homepage/")).toBe(false);
  });

  it("a person with no staff role opens nothing", () => {
    for (const screen of SCREENS) {
      expect(canOpenAdminPath(["user"], screen.href), screen.id).toBe(false);
      expect(canOpenAdminPath([], screen.href), screen.id).toBe(false);
    }
  });

  it("counts and the phone bar are set on the screens the mockups mark", () => {
    expect(findItem("review")?.counts).toEqual(["reviewLive", "reviewHeld", "reviewEdited"]);
    expect(findItem("support")?.counts).toEqual(["tickets"]);
    expect(findItem("content")?.counts).toEqual(["contentReview"]);
    expect(SCREENS.filter((screen) => screen.phoneBar).map((screen) => screen.id)).toEqual(["dashboard", "review", "support"]);
  });
});

describe("blog_editor is a staff role (A5)", () => {
  it("is known to the model, the login check and the decision rule", () => {
    expect(STAFF_ROLE_NAMES.has("blog_editor")).toBe(true);
    expect(isStaffRole(["blog_editor"])).toBe(true);
    expect(isStaffRole(["user"])).toBe(false);
  });
});
