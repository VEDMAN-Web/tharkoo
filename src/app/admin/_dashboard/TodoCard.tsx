import Link from "next/link";
import { Banknote, CreditCard, FileText, Flag, IdCard, MessageSquare, ShieldCheck, type LucideIcon } from "lucide-react";
import type { AdminCounts } from "@/lib/admin/count-sum";
import { sumCounts } from "@/lib/admin/count-sum";
import type { CountId } from "@/lib/admin/screens";

type Row = { id: string; title: string; note: string; href: string; ids: readonly CountId[]; icon: LucideIcon };

const ROWS: readonly Row[] = [
  { id: "review", title: "Ads to review", note: "Live, not checked, held or edited", href: "/admin/moderation/", ids: ["reviewLive", "reviewHeld", "reviewEdited"], icon: ShieldCheck },
  { id: "tickets", title: "Support tickets", note: "Waiting for an answer", href: "/admin/support/", ids: ["tickets"], icon: MessageSquare },
  { id: "id", title: "ID checks", note: "Selfie and ID", href: "/admin/kyc/", ids: ["idChecks"], icon: IdCard },
  { id: "reports", title: "Reports on ads", note: "Open or picked up", href: "/admin/reports/", ids: ["reports"], icon: Flag },
  { id: "recharges", title: "Recharges to check", note: "Not confirmed after 30 min", href: "/admin/finance/", ids: ["recharges"], icon: CreditCard },
  { id: "payouts", title: "Payouts to approve", note: "Requests waiting", href: "/admin/finance/", ids: ["payouts"], icon: Banknote },
  { id: "legal", title: "Legal takedowns", note: "Answer within 24 h", href: "/admin/reports/", ids: ["legal"], icon: FileText },
  { id: "content", title: "Content in review", note: "Waiting for approval", href: "/admin/content/", ids: ["contentReview"], icon: FileText },
];

export function todoRows(counts: AdminCounts) {
  return ROWS.map((row) => ({ ...row, count: sumCounts(counts, row.ids) })).filter((row): row is Row & { count: number } => row.count !== null);
}

export function TodoCard({ counts }: { counts: AdminCounts }) {
  const rows = todoRows(counts);
  const waiting = rows.reduce((total, row) => total + row.count, 0);
  return (
    <section className="adm-card adm-d-card" aria-labelledby="dash-todo" data-tk="todo">
      <header className="adm-d-head">
        <h2 id="dash-todo">To do</h2>
        <span className={`adm-d-pill${waiting ? " is-hot" : ""}`}>{waiting} waiting</span>
      </header>
      {rows.length === 0 ? (
        <p className="adm-d-empty">Nothing is waiting for your role.</p>
      ) : (
        <ul className="adm-d-list">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.id}>
                <Link href={row.href} className="adm-d-row" data-tk={`todo-${row.id}`}>
                  <span className="adm-d-ico" aria-hidden="true"><Icon size={18} strokeWidth={1.8} focusable="false" /></span>
                  <span className="adm-d-text">
                    <strong>{row.title}</strong>
                    <small>{row.note}</small>
                  </span>
                  <span className="adm-d-num">{row.count.toLocaleString("en-IN")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
