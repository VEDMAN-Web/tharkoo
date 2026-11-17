import { safeHref } from "@/lib/sanitize";
import { SUPPORT_PHONE, SUPPORT_TELEGRAM, telegramHref, whatsappHref } from "@/lib/support";
import { readContent } from "@/lib/ui/site-content";
import { getSite } from "@/lib/queries";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

/** The six social icons the footer draws, in its order, with the address each uses when no link is set for it. */
export const SOCIAL_NETWORKS: { name: string; fallback: string }[] = [
  { name: "WhatsApp", fallback: whatsappHref(SUPPORT_PHONE) },
  { name: "X", fallback: "" },
  { name: "LinkedIn", fallback: "" },
  { name: "Instagram", fallback: "" },
  { name: "Pinterest", fallback: "" },
  { name: "Telegram", fallback: telegramHref(SUPPORT_TELEGRAM) },
];

export type SocialSource = "link" | "default" | "none";
export type SocialStatus = { name: string; source: SocialSource; href: string };
type Row = { label: string; href: string; visible?: boolean };

/**
 * What each footer icon does on the site today. A visible link whose text is the network name wins; WhatsApp and Telegram
 * otherwise use the support address; the rest then show greyed and open nothing. When no social link is saved here, the site
 * falls back to the older social links of the site record (`legacy`), exactly as the footer does.
 */
export function socialStatus(config: ShellConfig, legacy: Row[]): SocialStatus[] {
  const rows: Row[] = config.footer.socials.length ? config.footer.socials : legacy;
  return SOCIAL_NETWORKS.map((network) => {
    const row = rows.find((item) => item.visible !== false && item.label.trim().toLowerCase() === network.name.toLowerCase());
    const href = row ? safeHref(row.href) : "";
    if (href) return { name: network.name, source: "link", href };
    if (network.fallback) return { name: network.name, source: "default", href: network.fallback };
    return { name: network.name, source: "none", href: "" };
  });
}

/** The older social links on the site record (Site text and the site fields), which the footer uses while none is saved in Menus. */
export async function readLegacySocials(): Promise<Row[]> {
  const site = (await getSite()) as { homepage?: unknown; socialLinks?: unknown };
  const fromContent = readContent(site.homepage).socials;
  const list = fromContent.length ? fromContent : Array.isArray(site.socialLinks) ? (site.socialLinks as Row[]) : [];
  return list.filter((item) => item && typeof item.label === "string" && typeof item.href === "string").map((item) => ({ label: item.label, href: item.href, visible: (item as { visible?: boolean }).visible !== false }));
}
