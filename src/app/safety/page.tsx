import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.safety;

export const metadata = pageMetadata({
  title: `${copy.title} | Tharkoo`,
  description: copy.description,
  path: "/safety/",
});

export default function Page() {
  return (
    <StaticPage title={copy.title}>
      {copy.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
      <p>
        <Link href="/scam-report/">Report a listing</Link>
      </p>
    </StaticPage>
  );
}
