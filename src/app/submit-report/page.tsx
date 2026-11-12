import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";
import { ReportForm } from "./ReportForm";

export const metadata = pageMetadata({
  title: "Report a listing | Tharkoo",
  description: "Report a Tharkoo listing to our moderation team.",
  path: "/submit-report/",
});

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ ad?: string }> }) {
  const { ad = "" } = await searchParams;
  const safeAd = ad.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return (
    <Container className="py-8">
      <h1 className="t-h1">Report a listing</h1>
      <p className="t-body mt-3 max-w-[68ch] text-muted">
        {safeAd ? `You are reporting ad ${safeAd}. ` : "Open this page from an ad to report it. "}
        Reports are read by our moderation team. You do not need an account. For urgent safety concerns, see the{" "}
        <Link href="/cms/grievance/" className="underline">grievance page</Link>.
      </p>
      <ReportForm ad={safeAd} />
    </Container>
  );
}
