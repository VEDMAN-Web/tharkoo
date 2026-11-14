import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { DeskThread } from "@/components/support/DeskThread";
import { StatusChip, formatWhen } from "@/components/support/labels";
import { HttpError } from "@/server/http";
import { canWorkDesk } from "@/server/support/access";
import { deskThread } from "@/server/support/desk";
import { currentDeskActor } from "@/server/support/page-actor";
import type { MessageView } from "@/server/support/records";

export const dynamic = "force-dynamic";

function MessageItem({ message }: { message: MessageView }) {
  const staff = message.authorType === "staff";
  const label = message.internal ? "Internal note (staff only)" : staff ? "Support" : "Customer";
  return (
    <li
      data-tk="desk-message"
      data-internal={message.internal ? "true" : "false"}
      className="adm-card"
      style={{
        display: "grid",
        gap: 6,
        borderStyle: message.internal ? "dashed" : "solid",
        background: message.internal ? "var(--warn-bg, transparent)" : undefined,
      }}
    >
      <span className="t-small text-muted">
        <strong>{label}</strong> · {formatWhen(message.createdAt)}
      </span>
      {message.body ? <p className="t-body" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</p> : null}
      {message.attachments.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {message.attachments.map((id, index) => (
            <a key={id} href={`/api/support/attachments/${id}`} target="_blank" rel="noopener noreferrer">
              <img src={`/api/support/attachments/${id}`} alt={`Screenshot ${index + 1}`} loading="lazy" style={{ width: 140, maxWidth: "100%", height: "auto", borderRadius: 8 }} />
            </a>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentDeskActor();
  if (!actor || !canWorkDesk(actor.roles)) {
    return (
      <AdminShell title="Support ticket">
        <Notice kind="warn" title="Not for your role">Only support, moderator, admin and superadmin staff can work the support desk.</Notice>
      </AdminShell>
    );
  }
  let thread: Awaited<ReturnType<typeof deskThread>>;
  try {
    thread = await deskThread(actor, id, crypto.randomUUID());
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "This ticket could not be opened.";
    return (
      <AdminShell title="Support ticket">
        <Notice kind="error" title="Ticket not available">{message}</Notice>
        <p className="t-small mt-3"><Link href="/admin/support/">Back to the support desk</Link></p>
      </AdminShell>
    );
  }
  const { ticket, owner, messages, staff } = thread;
  return (
    <AdminShell title={`Ticket #${ticket.number}`}>
      <div className="adm-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0 }}>
        <section className="adm-card" aria-label="Ticket details" style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="t-h3" style={{ margin: 0, overflowWrap: "anywhere" }}>{ticket.subject}</h2>
            <StatusChip status={ticket.status} label={ticket.statusLabel} />
          </div>
          <p className="t-small text-muted" style={{ margin: 0 }}>
            {ticket.topicLabel} · {owner.name} {owner.email ? `(${owner.email})` : ""} · {ticket.ownerKind === "vendor" ? "Vendor" : "User"}
          </p>
          <p className="t-small text-muted" style={{ margin: 0 }}>
            {ticket.assigned ? "Assigned" : "Not assigned"} · Last customer message {formatWhen(ticket.lastCustomerMessageAt)}
            {ticket.closedAt ? ` · Closed ${formatWhen(ticket.closedAt)}` : ""}
          </p>
          <p className="t-small" style={{ margin: 0 }}><Link href="/admin/support/">Back to the queue</Link></p>
        </section>
        <ol aria-label="Messages" className="adm-stack" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0 }}>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </ol>
        <DeskThread
          ticketId={ticket.id}
          status={ticket.status}
          closed={ticket.status === "closed"}
          staff={staff}
          viewerId={actor.id}
        />
      </div>
    </AdminShell>
  );
}
