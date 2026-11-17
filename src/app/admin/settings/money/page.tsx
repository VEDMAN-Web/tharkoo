import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/** H8.17: the money settings moved to Prices & plans. This page stays so old links and bookmarks still land somewhere useful. */
export default function MoneyPage() {
  return (
    <AdminShell title="Money" hasHeader>
      <div className="adm-card" style={{ padding: 24, display: "grid", gap: 10, justifyItems: "start" }} data-tk="money-moved">
        <h1 style={{ margin: 0, fontSize: 20 }}>Money settings moved</h1>
        <p style={{ margin: 0 }}>The posting fee, credit price, paid posting and test payments are now on Prices &amp; plans.</p>
        <Link href="/admin/prices/" className="adm-btn">Open Prices &amp; plans</Link>
      </div>
    </AdminShell>
  );
}
