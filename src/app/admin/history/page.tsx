import { AdminShell } from "@/components/admin/AdminShell";
import { adminContext } from "@/server/admin/context";
import { historyDetail, listHistory, parseHistoryQuery } from "@/server/admin/history";
import { undoWindowDays } from "@/server/admin/undo/registry";
import { ForbiddenError } from "@/server/http";
import { HistoryView, type Windows } from "./_view/HistoryView";

export const dynamic = "force-dynamic";

const RULES: { key: "edits" | "settings" | "decisions" | "demo" | "credits"; text: string }[] = [
  { key: "edits", text: "Ad edits and page publishes" },
  { key: "settings", text: "Settings, menus and texts" },
  { key: "decisions", text: "Moderation decisions, bans and ID decisions" },
  { key: "demo", text: "Ended demo ads" },
  { key: "credits", text: "Credits added or removed by staff, while unspent" },
];

/** H8.26 (A26): History & undo. Everything you pick (tab, filters, page, the open change) lives in the address. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminContext();
  const params = await searchParams;
  const query = parseHistoryQuery(params);
  let list;
  try {
    list = await listHistory(ctx, query);
  } catch (error) {
    if (!(error instanceof ForbiddenError) || query.tab !== "audit") throw error;
    list = await listHistory(ctx, { ...query, tab: "recent" });
  }
  const open = typeof params.open === "string" ? params.open : "";
  const detail = open ? await historyDetail(ctx, open) : null;
  const windows: Windows = await Promise.all(RULES.map(async (rule) => ({ key: rule.key, days: await undoWindowDays(rule.key), text: rule.text })));
  return (
    <AdminShell title="History & undo" hasHeader>
      <HistoryView list={list} detail={detail} windows={windows} />
    </AdminShell>
  );
}
