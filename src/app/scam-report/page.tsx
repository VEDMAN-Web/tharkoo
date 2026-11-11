import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "How to report a scam | Tharkoo",
  description: "How to report a suspicious listing on Tharkoo.",
  path: "/scam-report/",
});

export default function Page() {
  return (
    <StaticPage title="How to report a scam">
      <p>Use the report link on the ad, or write to the help centre and include the ad link.</p>
      <p>
        <Link href="/safety/">Safety</Link>
        {" · "}
        <Link href="/help/">Help Center</Link>
      </p>
    </StaticPage>
  );
}
