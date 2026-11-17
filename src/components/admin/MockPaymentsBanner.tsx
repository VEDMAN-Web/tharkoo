import Link from "next/link";
import { readMoneySettings } from "@/server/billing/money-settings";

export async function MockPaymentsBanner() {
  const settings = await readMoneySettings().catch(() => null);
  if (!settings?.mockPaymentsOn) return null;
  return (
    <div className="adm-mockbar" role="status" data-tk="mock-payments-banner">
      <span>Test payments are ON<span className="adm-mockbar-more">: anyone can add credits without paying.</span></span>{" "}
      <Link href="/admin/prices/">Turn off<span className="adm-mockbar-more"> in Prices & plans</span></Link>
    </div>
  );
}
