import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.privacy;

export const metadata = pageMetadata({
  title: `${copy.title} | Tharkoo`,
  description: copy.description,
  path: "/privacy/",
});

export default function Page() {
  return (
    <StaticPage title={copy.title}>
      {copy.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </StaticPage>
  );
}
