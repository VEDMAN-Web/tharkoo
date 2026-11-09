import { StaticPage } from "@/components/StaticPage";
export const metadata = { title: "Help centre" };
export default function Help() {
  return (
    <StaticPage title="Help centre">
      <p>Browse ads without an account. Posting needs a verified vendor account (slice 2).</p>
      <h2 id="scams" className="pt-6 text-xl font-semibold text-[var(--text-primary)]">
        How to report a scam
      </h2>
      <p>
        Tharkoo staff never ask you to pay on UPI/personal wallets. Use Submit a report, keep the Ad ID, and do not
        share OTPs.
      </p>
    </StaticPage>
  );
}
