import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { HttpError } from "@/server/http";
import { canWorkDesk } from "@/server/support/access";
import { deskQueue, deskThread } from "@/server/support/desk";
import { currentDeskActor } from "@/server/support/page-actor";
import { queueQuerySchema } from "@/server/support/schemas";
import { DeskView, type OpenThread } from "./_desk/DeskView";
import { inOpenTab, latestOrder, matchesSearch, ownerIdOf, openUnseen, parseTab, tabCounts, tabStatus, userCard } from "./_desk/data";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** H8.43 (A43): the support desk in three panes. Tab, search and the open ticket live in the address. The ticket page /admin/support/[id]/ still works. */
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await currentDeskActor();
  if (!actor || !canWorkDesk(actor.roles)) {
    return (
      <AdminShell title="Support desk" hasHeader>
        <Notice kind="warn" title="Not for your role">Only support, moderator, admin and superadmin staff can work the support desk.</Notice>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const tab = parseTab(one(params.tab));
  const q = one(params.q).trim().slice(0, 120);
  const ticketId = one(params.ticket).slice(0, 40);
  let thread: OpenThread | null = null;
  let problem = "";
  if (ticketId) {
    try {
      const opened = await deskThread(actor, ticketId, crypto.randomUUID());
      const owner = await ownerIdOf(ticketId);
      thread = {
        ticket: opened.ticket,
        customer: opened.owner.name,
        messages: opened.messages,
        staff: opened.staff,
        card: await userCard(owner?.ownerId ?? null, actor.roles),
        guest: owner?.kind === "guest" ? { email: opened.owner.email, phone: opened.owner.phone } : null,
        order: opened.ticket.topic === "coins_payments" ? await latestOrder(owner?.ownerId ?? null, actor.roles) : null,
      };
    } catch (error) {
      problem = error instanceof HttpError ? error.message : "This ticket could not be opened.";
    }
  }
  // Counted after the ticket is opened, so opening it clears its own red number on this very page.
  const [queue, counts, unseen] = await Promise.all([deskQueue(actor, queueQuerySchema.parse({ status: tabStatus(tab) })), tabCounts(), openUnseen()]);
  const items = queue.items.filter((item) => (tab === "open" ? inOpenTab(item) : true)).filter((item) => matchesSearch(item, q));

  return (
    <AdminShell title="Support desk" hasHeader>
      {problem ? <Notice kind="error" title="Ticket not available">{problem}</Notice> : null}
      <DeskView tab={tab} counts={counts} unseen={unseen} items={items} now={queue.now} q={q} ticketId={thread ? ticketId : ""} thread={thread} viewerId={actor.id} />
    </AdminShell>
  );
}
