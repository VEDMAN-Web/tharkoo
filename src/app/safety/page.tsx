import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { publicParagraphs } from "@/components/new/legal-copy";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.safety;

export const metadata = pageMetadata({
  title: "Safety tips for meeting people on Tharkoo | Tharkoo",
  description: copy.description,
  path: "/safety/",
});

export default function Page() {
  return (
    <StaticPage title={copy.title}>
      {publicParagraphs(copy.paragraphs, "safety").map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
      <p>
        <Link href="/scam-report/">Report a listing</Link>
      </p>
    </StaticPage>
  );
}
