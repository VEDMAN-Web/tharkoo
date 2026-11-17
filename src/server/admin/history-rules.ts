/** Words and limits of the History & undo screen (H8.26). Pure, so the screen's browser code can use them too. */

export type HistoryTab = "recent" | "audit";
export type TypeKey = "ads" | "users" | "money" | "pages" | "settings" | "other";
export const HISTORY_PAGE_SIZES = [25, 50, 100] as const;
export const HISTORY_DAYS = [7, 30, 90, 0] as const;
export const TYPE_LABELS: Record<TypeKey, string> = { ads: "Ads", users: "Users", money: "Money", pages: "Pages and text", settings: "Settings", other: "Other" };

export const TYPE_PATTERNS: Record<Exclude<TypeKey, "other">, RegExp> = {
  ads: /^(listing|ad|video|report|verification|moderation|demo)\b/,
  users: /^(user|session|account)\b/,
  money: /^(wallet|payment|coupon|recharge|promotion|coins|refund|credit|payout|billing|plan|prices?)\b/,
  pages: /^(layout|content|ui_text|page|menu|blog|help|cms|seo|url|media)\b/,
  settings: /^(settings|site|launch|team|flag|undo)\b/,
};

export function typeOfAction(action: string): TypeKey {
  for (const key of Object.keys(TYPE_PATTERNS) as (keyof typeof TYPE_PATTERNS)[]) if (TYPE_PATTERNS[key].test(action)) return key;
  return "other";
}
