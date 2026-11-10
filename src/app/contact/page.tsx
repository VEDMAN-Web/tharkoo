import Link from "next/link";
import { getSite } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Contact | Tharkoo",
  description: "How to reach Tharkoo support about an account, a listing, or a payment question.",
  path: "/contact/",
});

export default async function Contact() {
  const site = await getSite();
  return (
    <Container className="py-8">
      <h1 className="t-h1">Contact</h1>
      <p className="t-body mt-3 max-w-[68ch] text-muted">
        Support hours: {site.supportHours || "We reply on business days."} For a listing problem, use the report link on the ad. For a legal request, open the grievance page.
      </p>
      <p className="mt-4">
        <Link href="/cms/grievance/" className="text-accent">Grievance</Link>
        {" · "}
        <Link href="/help/" className="text-accent">Help Center</Link>
      </p>
    </Container>
  );
}
