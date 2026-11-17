import { connectDb } from "@/lib/db";
import { BlogPost, HelpArticle } from "@/server/models";
import type { StudioKind } from "./admin";

/** H8.58: the blog posts and help articles the site shows today (the older records), so the studio can list them next to its own items. */

export type BuiltInRow = { id: string; title: string; slug: string; status: "published" | "draft"; group: string };

const LIMIT = 100;

type Lean = { _id: { toString(): string }; title?: string; slug?: string; status?: string; category?: string; section?: string };

function rowOf(doc: Lean, group: string): BuiltInRow {
  return { id: String(doc._id), title: doc.title || "Untitled", slug: doc.slug ?? "", status: doc.status === "draft" ? "draft" : "published", group };
}

export const builtInScreen = (kind: StudioKind) => (kind === "blog" ? "/admin/blog-posts/" : "/admin/help-topics/");

/** The older records of one kind, in the order the site shows them. */
export async function listBuiltIns(kind: StudioKind): Promise<BuiltInRow[]> {
  await connectDb();
  if (kind === "blog") {
    const docs = await BlogPost.find({}).sort({ createdAt: -1, title: 1 }).limit(LIMIT).lean<Lean[]>();
    return docs.map((doc) => rowOf(doc, doc.category ?? ""));
  }
  const docs = await HelpArticle.find({}).sort({ section: 1, order: 1, title: 1 }).limit(LIMIT).lean<Lean[]>();
  return docs.map((doc) => rowOf(doc, doc.section ?? ""));
}
