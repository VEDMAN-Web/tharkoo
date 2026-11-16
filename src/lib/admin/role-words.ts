export const ROLE_WORDS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  moderator: "Moderator",
  trust_safety: "Trust and safety",
  support: "Support",
  finance: "Finance",
  seo_editor: "SEO editor",
  blog_editor: "Blog editor",
};

export function roleWords(roles: readonly string[]): string {
  const known = roles.map((role) => ROLE_WORDS[role]).filter(Boolean);
  return known.length ? known.join(", ") : "Staff";
}
