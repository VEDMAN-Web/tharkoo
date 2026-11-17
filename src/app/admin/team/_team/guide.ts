import { SCREENS, canOpen } from "@/lib/admin/screens";
import type { StaffRole } from "@/lib/admin/perms";
import { ROLE_WORDS } from "@/lib/admin/role-words";

/** What each role can open, worked out from the real menu rules (never typed by hand), plus one plain note. */
export const GUIDE_ORDER: readonly StaffRole[] = ["moderator", "trust_safety", "support", "finance", "seo_editor", "blog_editor", "content_editor", "admin", "superadmin"];

/** The order of the role list when inviting or changing someone: Superadmin is always last. */
export const CHOICE_ORDER: readonly StaffRole[] = GUIDE_ORDER;

export const SUPERADMIN_WARNING = "Full access, including money, users, the team and raw data. Give it to as few people as you can.";

const NOTES: Record<StaffRole, string> = {
  moderator: "",
  trust_safety: "Can also ban people and use the emergency switches.",
  support: "Reads Users and can add credits with a reason.",
  finance: "Sees credits and orders.",
  seo_editor: "Can publish content.",
  blog_editor: "Writes blog and help, then sends for review. Cannot publish.",
  content_editor: "Edits pictures, words and page layouts. Cannot see money, users, settings or the team, or publish content.",
  admin: "",
  superadmin: "Also raw data.",
};

/** Dashboard and History & undo are open to every staff role; the guide says that once instead of in every row. */
const FOR_EVERYONE = new Set(["dashboard", "history"]);

export type RoleGuide = { role: StaffRole; label: string; opens: string; note: string };

export function guideFor(role: StaffRole): RoleGuide {
  const open = SCREENS.filter((screen) => canOpen([role], screen));
  const closed = SCREENS.filter((screen) => !canOpen([role], screen));
  const names = open.filter((screen) => !FOR_EVERYONE.has(screen.id)).map((screen) => screen.label);
  const opens = closed.length === 0 ? "Everything" : closed.length <= 3 ? `Everything except ${closed.map((screen) => screen.label).join(", ")}` : names.join(", ");
  return { role, label: ROLE_WORDS[role] ?? role, opens, note: NOTES[role] };
}

export const ROLE_GUIDE: readonly RoleGuide[] = GUIDE_ORDER.map(guideFor);
