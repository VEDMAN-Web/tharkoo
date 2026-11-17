import { AdminShell } from "@/components/admin/AdminShell";
import { adminContext } from "@/server/admin/context";
import { isKind, listNotifications, BELL_PAGE_SIZE } from "@/server/admin/notifications";
import { NotificationsView } from "./NotificationsView";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** H8.53: every notification for the signed-in person, paged, with Unread/All and a kind filter. The same list as the bell. */
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ctx = await adminContext();
  const kind = one(params.kind);
  const unreadOnly = one(params.filter) === "unread";
  const page = Math.max(1, Math.floor(Number(one(params.page))) || 1);
  const data = await listNotifications(ctx.actorId, ctx.roles, { unreadOnly, kind: isKind(kind) ? kind : "", page, pageSize: BELL_PAGE_SIZE });
  return (
    <AdminShell title="Notifications" hasHeader>
      <NotificationsView data={data} filter={unreadOnly ? "unread" : "all"} kind={isKind(kind) ? kind : ""} now={data.now} />
    </AdminShell>
  );
}
