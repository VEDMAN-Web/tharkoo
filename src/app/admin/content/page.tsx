import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { siteUrl } from "@/lib/utils";
import { builtInCounts, builtInScreen, listBuiltIns } from "@/server/content/studio/builtin";
import { listContent, options, parseKind, parseStatus, readEditorItem, tabCounts } from "@/server/content/studio/admin";
import { canPublishKind } from "@/server/content/studio/service";
import { getPaths } from "@/server/urls/service";
import { ContentView } from "./_studio/ContentView";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** H8.31 (A31): the content studio editor for blog posts and help articles, with the search panel and link suggestions. */
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await getStaffFromHeaders();
  if (!can(viewer.roles, "content.write")) {
    return (
      <AdminShell title="Content studio" hasHeader>
        <Notice kind="warn" title="Not for your role">Only editors and admins can use the content studio.</Notice>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const tab = parseKind(one(params.tab));
  const status = parseStatus(one(params.status));
  const q = one(params.q).trim().slice(0, 80);
  const itemId = one(params.item).slice(0, 40);
  const [rows, ownCounts, item, authors, categories, paths, builtIns, builtCounts] = await Promise.all([
    listContent(tab, { status, q }),
    tabCounts(),
    itemId ? readEditorItem(itemId) : Promise.resolve(null),
    options("author"),
    options("blogCategory"),
    getPaths(),
    listBuiltIns(tab),
    builtInCounts(),
  ]);
  const counts = { blog: ownCounts.blog + builtCounts.blog, help: ownCounts.help + builtCounts.help };
  const shown = item && item.kind === tab ? item : null;
  const problem = itemId && !shown ? "That item was not found. Pick one from the list." : "";
  return (
    <AdminShell title="Content studio" hasHeader>
      <ContentView
        tab={tab}
        status={status}
        q={q}
        rows={rows}
        builtIns={builtIns}
        builtInScreen={builtInScreen(tab)}
        counts={counts}
        item={shown}
        authors={authors}
        categories={categories}
        host={hostOf(siteUrl())}
        prefix={tab === "blog" ? paths.blog : paths.help}
        canPublish={canPublishKind(viewer.roles, tab)}
        canWrite={can(viewer.roles, "content.write")}
        problem={problem}
      />
    </AdminShell>
  );
}
