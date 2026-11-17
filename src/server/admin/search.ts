import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { visibleScreens } from "@/lib/admin/screens";
import { listUsers, parseUserQuery } from "@/server/admin/users";
import { BlogPost, HelpArticle, Listing, Page, Payment } from "@/server/models";
import { SupportTicket } from "@/server/models/support";

/** H8.49 (A49): the global search of the admin top bar. Groups of results, each shown only to roles that may open that screen. */

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 80;
const PER_GROUP = 5;

export type SearchGroupKey = "screens" | "ads" | "users" | "tickets" | "orders" | "pages";
export interface SearchItem {
  id: string;
  title: string;
  sub: string;
  href: string;
}
export interface SearchGroup {
  key: SearchGroupKey;
  label: string;
  items: SearchItem[];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The query as typed, trimmed and cut to a safe length, or "" when it is too short to search. */
export function cleanQuery(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX) : "";
  return text.length >= SEARCH_MIN ? text : "";
}

function screenItems(roles: readonly string[], q: string): SearchItem[] {
  const needle = q.toLowerCase();
  return visibleScreens(roles)
    .filter((screen) => screen.label.toLowerCase().includes(needle))
    .slice(0, PER_GROUP)
    .map((screen) => ({ id: screen.id, title: screen.label, sub: "Open this screen", href: screen.href }));
}

async function adItems(q: string): Promise<SearchItem[]> {
  const pattern = new RegExp(escapeRegex(q), "i");
  const byId = /^[a-f0-9]{24}$/i.test(q) ? [{ _id: q }] : [];
  const rows = await Listing.find({ $or: [{ title: pattern }, { slug: pattern }, ...byId] })
    .sort({ updatedAt: -1 })
    .limit(PER_GROUP)
    .select("title slug status")
    .lean<{ _id: unknown; title?: string; slug?: string; status?: string }[]>();
  return rows.map((row) => ({ id: String(row._id), title: row.title || "Untitled", sub: [row.slug, row.status, /^demo-\d{1,6}$/.test(row.slug ?? "") ? "Demo ad" : ""].filter(Boolean).join(" · "), href: `/admin/ads/${String(row._id)}/` }));
}

async function ticketItems(q: string): Promise<SearchItem[]> {
  const number = /^#?(\d{1,9})$/.exec(q);
  const filter = number ? { $or: [{ number: Number(number[1]) }, { subject: new RegExp(escapeRegex(q), "i") }] } : { subject: new RegExp(escapeRegex(q), "i") };
  const rows = await SupportTicket.find(filter).sort({ lastMessageAt: -1 }).limit(PER_GROUP).select("number subject status").lean<{ _id: unknown; number: number; subject: string; status: string }[]>();
  return rows.map((row) => ({ id: String(row._id), title: row.subject || `Ticket ${row.number}`, sub: `#${row.number} · ${row.status}`, href: `/admin/support/${String(row._id)}/` }));
}

async function orderItems(q: string): Promise<SearchItem[]> {
  const rows = await Payment.find({ providerRef: new RegExp(`^${escapeRegex(q)}`, "i") })
    .sort({ updatedAt: -1 })
    .limit(PER_GROUP)
    .select("providerRef amount status provider")
    .lean<{ _id: unknown; providerRef?: string; amount?: number; status?: string; provider?: string }[]>();
  return rows.map((row) => ({
    id: String(row._id),
    title: row.providerRef || String(row._id),
    sub: [row.amount !== undefined ? `Rs ${row.amount}` : "", row.status, row.provider].filter(Boolean).join(" · "),
    href: `/admin/finance/?q=${encodeURIComponent(row.providerRef || String(row._id))}`,
  }));
}

async function pageItems(q: string): Promise<SearchItem[]> {
  const pattern = new RegExp(escapeRegex(q), "i");
  const [pages, posts, help] = await Promise.all([
    Page.find({ title: pattern }).limit(PER_GROUP).select("title").lean<{ _id: unknown; title?: string }[]>(),
    BlogPost.find({ title: pattern }).limit(PER_GROUP).select("title").lean<{ _id: unknown; title?: string }[]>(),
    HelpArticle.find({ title: pattern }).limit(PER_GROUP).select("title").lean<{ _id: unknown; title?: string }[]>(),
  ]);
  return [
    ...pages.map((row) => ({ id: String(row._id), title: row.title || "Untitled", sub: "Page", href: "/admin/pages/" })),
    ...posts.map((row) => ({ id: String(row._id), title: row.title || "Untitled", sub: "Blog post", href: "/admin/blog/" })),
    ...help.map((row) => ({ id: String(row._id), title: row.title || "Untitled", sub: "Help article", href: "/admin/help/" })),
  ].slice(0, PER_GROUP);
}

/** Searches what this role may open. An empty or short query gives no groups. Groups with no result are left out. */
export async function searchAdmin(roles: readonly string[], raw: unknown): Promise<SearchGroup[]> {
  await connectDb();
  const q = cleanQuery(raw);
  if (!q) return [];
  const jobs: Promise<SearchGroup>[] = [];
  const add = (key: SearchGroupKey, label: string, run: () => Promise<SearchItem[]>) => jobs.push(run().then((items) => ({ key, label, items })));
  add("screens", "Go to", async () => screenItems(roles, q));
  if (can(roles, "ads.view") || can(roles, "ads.review")) add("ads", "Ads", () => adItems(q));
  if (can(roles, "users.view")) {
    add("users", "Users", async () => {
      const list = await listUsers({ ...parseUserQuery({ q }), pageSize: PER_GROUP }, roles);
      return list.rows.slice(0, PER_GROUP).map((row) => ({ id: row.id, title: row.name, sub: row.email, href: `/admin/users/?open=${row.id}` }));
    });
  }
  if (can(roles, "desk.work")) add("tickets", "Support tickets", () => ticketItems(q));
  if (can(roles, "orders.view")) add("orders", "Orders & credits", () => orderItems(q));
  if (can(roles, "content.write") || can(roles, "pages.edit")) add("pages", "Pages and content", () => pageItems(q));
  return (await Promise.all(jobs)).filter((group) => group.items.length > 0);
}
