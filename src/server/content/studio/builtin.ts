import { connectDb } from "@/lib/db";
import { BlogPost, HelpArticle } from "@/server/models";
import type { ContentStatus } from "@/server/models/content";
import type { StudioKind } from "./admin";

/** H8.58: the blog posts and help articles the site shows today (the older records), so the studio can list them next to its own items. */

export type BuiltInRow = { id: string; title: string; slug: string; status: "published" | "draft"; group: string };

const LIMIT = 100;

type Lean = { _id: { toString(): string }; title?: string; slug?: string; status?: string; category?: string; section?: string };

function rowOf(doc: Lean, group: string): BuiltInRow {
  return { id: String(doc._id), title: doc.title || "Untitled", slug: doc.slug ?? "", status: doc.status === "draft" ? "draft" : "published", group };
}

/** How many of each kind exist, for the tab counts. */
export async function builtInCounts(): Promise<Record<StudioKind, number>> {
  await connectDb();
  const [blog, help] = await Promise.all([BlogPost.countDocuments({}), HelpArticle.countDocuments({})]);
  return { blog, help };
}

export const builtInScreen = (kind: StudioKind) => (kind === "blog" ? "/admin/blog-posts/" : "/admin/help-topics/");

/** The older records of one kind, in the order the site shows them, narrowed by the studio's status chip and search words. */
export async function listBuiltIns(kind: StudioKind, filter: { status?: ContentStatus | ""; q?: string } = {}): Promise<BuiltInRow[]> {
  // These records are only ever draft or published, so "In review" and "Scheduled" match none of them.
  if (filter.status && filter.status !== "draft" && filter.status !== "published") return [];
  await connectDb();
  const match: Record<string, unknown> = {};
  // Anything that is not "draft" shows as published (see rowOf).
  if (filter.status) match.status = filter.status === "draft" ? "draft" : { $ne: "draft" };
  const q = (filter.q ?? "").trim().slice(0, 80);
  if (q) match.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (kind === "blog") {
    const docs = await BlogPost.find(match).sort({ createdAt: -1, title: 1 }).limit(LIMIT).lean<Lean[]>();
    return docs.map((doc) => rowOf(doc, doc.category ?? ""));
  }
  const docs = await HelpArticle.find(match).sort({ section: 1, order: 1, title: 1 }).limit(LIMIT).lean<Lean[]>();
  return docs.map((doc) => rowOf(doc, doc.section ?? ""));
}
