import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Report a listing | Tharkoo",
  description: "How to report a Tharkoo listing.",
  path: "/submit-report/",
});

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ ad?: string }> }) {
  const { ad } = await searchParams;
  return (
    <Container className="py-8">
      <h1 className="t-h1">Report a listing</h1>
      <p className="t-body mt-3 max-w-[68ch] text-muted">
        {ad ? `You asked about ad ${ad}. ` : ""}
        A public report form is coming soon. Until then, use the grievance page and include the ad link.
      </p>
      <p className="mt-4">
        <Link href="/cms/grievance/" className="tk-btn tk-btn-rose">Open grievance</Link>
      </p>
    </Container>
  );
}
