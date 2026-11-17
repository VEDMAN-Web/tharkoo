import { describe, expect, it } from "vitest";
import { can, PERMS, STAFF_ROLES, type Perm, type StaffRole } from "@/lib/admin/perms";

const ALL = Object.keys(PERMS) as Perm[];
const SUPER_ONLY: Perm[] = ["ads.demo.restore", "team.edit", "raw.json"];

const EXPECTED: Record<Exclude<StaffRole, "superadmin" | "admin">, Perm[]> = {
  moderator: ["dashboard.view", "history.view", "ads.review", "ads.decide", "ads.edit", "ads.view", "reports.handle", "id.decide", "users.view"],
  trust_safety: ["dashboard.view", "history.view", "ads.review", "ads.decide", "ads.view", "reports.handle", "reports.legal", "id.decide", "users.view", "users.edit", "users.ban", "users.logout", "settings.emergency"],
  support: ["dashboard.view", "history.view", "ads.view", "desk.work", "users.view", "users.edit", "users.logout", "wallet.adjust.own"],
  finance: ["dashboard.view", "history.view", "wallet.view", "wallet.adjust", "orders.view", "orders.refund", "payouts.decide", "prices.view"],
  seo_editor: ["dashboard.view", "history.view", "content.write", "content.publish", "media.upload", "media.delete", "sitetext.edit", "catalogue.seo", "seo.edit"],
  blog_editor: ["dashboard.view", "history.view", "content.write", "content.publish", "media.upload"],
};

function allowed(role: StaffRole) {
  return ALL.filter((perm) => can([role], perm));
}

describe("admin permissions", () => {
  it("lists the 8 staff roles", () => {
    expect([...STAFF_ROLES].sort()).toEqual(["admin", "blog_editor", "finance", "moderator", "seo_editor", "superadmin", "support", "trust_safety"]);
  });

  it("gives superadmin everything and admin everything except the three superadmin-only permissions", () => {
    expect(allowed("superadmin")).toEqual(ALL);
    expect(allowed("admin")).toEqual(ALL.filter((perm) => !SUPER_ONLY.includes(perm)));
  });

  for (const [role, perms] of Object.entries(EXPECTED)) {
    it(`gives ${role} exactly its permissions`, () => {
      expect(allowed(role as StaffRole).sort()).toEqual([...perms].sort());
    });
  }

  it("refuses visitors, normal users, unknown roles and an empty list", () => {
    for (const perm of ALL) {
      expect(can(undefined, perm)).toBe(false);
      expect(can([], perm)).toBe(false);
      expect(can(["user"], perm)).toBe(false);
      expect(can(["owner"], perm)).toBe(false);
    }
  });

  it("allows a person with several roles whatever any one of them allows", () => {
    expect(can(["support", "finance"], "wallet.adjust")).toBe(true);
    expect(can(["support", "finance"], "team.edit")).toBe(false);
  });
});
