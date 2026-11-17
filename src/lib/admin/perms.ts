export type StaffRole =
  | "superadmin"
  | "admin"
  | "moderator"
  | "trust_safety"
  | "support"
  | "finance"
  | "seo_editor"
  | "blog_editor"
  | "content_editor";

export const STAFF_ROLES: readonly StaffRole[] = [
  "superadmin",
  "admin",
  "moderator",
  "trust_safety",
  "support",
  "finance",
  "seo_editor",
  "blog_editor",
  "content_editor",
];

export type Perm =
  | "dashboard.view"
  | "history.view"
  | "ads.review"
  | "ads.decide"
  | "ads.edit"
  | "ads.view"
  | "ads.demo.end"
  | "ads.demo.restore"
  | "reports.handle"
  | "reports.legal"
  | "id.decide"
  | "desk.work"
  | "users.view"
  | "users.edit"
  | "users.ban"
  | "users.logout"
  | "wallet.view"
  | "wallet.adjust"
  | "wallet.adjust.own"
  | "orders.view"
  | "orders.refund"
  | "payouts.decide"
  | "prices.view"
  | "prices.edit"
  | "pages.edit"
  | "content.write"
  | "content.publish"
  | "content.legal"
  | "media.upload"
  | "media.delete"
  | "media.library"
  | "sitetext.edit"
  | "sitetext.write"
  | "menus.edit"
  | "catalogue.edit"
  | "catalogue.seo"
  | "seo.edit"
  | "seo.robots"
  | "settings.edit"
  | "settings.emergency"
  | "team.edit"
  | "raw.json";

const ADMINS: readonly StaffRole[] = ["admin", "superadmin"];
const SUPER: readonly StaffRole[] = ["superadmin"];
const EVERYONE: readonly StaffRole[] = STAFF_ROLES;

function with_(...roles: StaffRole[]): readonly StaffRole[] {
  return [...ADMINS, ...roles];
}

export const PERMS: Record<Perm, readonly StaffRole[]> = {
  "dashboard.view": EVERYONE,
  "history.view": EVERYONE,
  "ads.review": with_("moderator", "trust_safety"),
  "ads.decide": with_("moderator", "trust_safety"),
  "ads.edit": with_("moderator"),
  "ads.view": with_("moderator", "trust_safety", "support"),
  "ads.demo.end": ADMINS,
  "ads.demo.restore": SUPER,
  "reports.handle": with_("moderator", "trust_safety"),
  "reports.legal": with_("trust_safety"),
  "id.decide": with_("moderator", "trust_safety"),
  "desk.work": with_("support"),
  "users.view": with_("moderator", "trust_safety", "support"),
  "users.edit": with_("support", "trust_safety"),
  "users.ban": with_("trust_safety"),
  "users.logout": with_("trust_safety", "support"),
  "wallet.view": with_("finance"),
  "wallet.adjust": with_("finance"),
  "wallet.adjust.own": with_("support"),
  "orders.view": with_("finance"),
  "orders.refund": with_("finance"),
  "payouts.decide": with_("finance"),
  "prices.view": with_("finance"),
  "prices.edit": ADMINS,
  "pages.edit": with_("content_editor"),
  "content.write": with_("seo_editor", "blog_editor", "content_editor"),
  "content.publish": with_("seo_editor", "blog_editor"),
  "content.legal": ADMINS,
  "media.upload": with_("seo_editor", "blog_editor", "content_editor"),
  "media.delete": with_("seo_editor"),
  "media.library": with_("content_editor"),
  "sitetext.edit": with_("seo_editor", "content_editor"),
  "sitetext.write": with_("content_editor"),
  "menus.edit": with_("content_editor"),
  "catalogue.edit": with_("content_editor"),
  "catalogue.seo": with_("seo_editor"),
  "seo.edit": with_("seo_editor"),
  "seo.robots": ADMINS,
  "settings.edit": ADMINS,
  "settings.emergency": with_("trust_safety"),
  "team.edit": SUPER,
  "raw.json": SUPER,
};

export function can(roles: readonly string[] | undefined, perm: Perm): boolean {
  if (!roles || roles.length === 0) return false;
  const allowed = PERMS[perm];
  return roles.some((role) => (allowed as readonly string[]).includes(role));
}
