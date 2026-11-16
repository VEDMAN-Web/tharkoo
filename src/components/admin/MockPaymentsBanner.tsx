import Link from "next/link";
import { readMoneySettings } from "@/server/billing/money-settings";

export async function MockPaymentsBanner() {
  const settings = await readMoneySettings().catch(() => null);
  if (!settings?.mockPaymentsOn) return null;
  return (
    <div className="adm-mockbar" role="status" data-tk="mock-payments-banner">
      <span>Test payments are ON: anyone can add credits without paying.</span>{" "}
      <Link href="/admin/settings/money/">Turn off in Prices & plans</Link>
    </div>
  );
}
