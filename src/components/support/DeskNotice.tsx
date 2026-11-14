import Link from "next/link";
import { Notice } from "@/components/admin/ui";
import { deskSummary } from "@/server/support/desk";
import { currentDeskActor } from "@/server/support/page-actor";

/** Staff dashboard notice: how many tickets have a new customer message. Shows nothing to roles without the desk. */
export async function DeskNotice() {
  const summary = await deskSummary(await currentDeskActor());
  if (summary.unread <= 0) return null;
  return (
    <Notice kind="info" title="Support desk">
      {summary.unread === 1 ? "One ticket has a new customer message." : `${summary.unread} tickets have new customer messages.`}{" "}
      <Link href="/admin/support/">Open the support desk</Link>
    </Notice>
  );
}
