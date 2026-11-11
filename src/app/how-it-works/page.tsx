import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST["how-it-works"];

export const metadata = pageMetadata({
  title: "How Tharkoo works: posting, browsing and contacting | Tharkoo",
  description: copy.description,
  path: "/how-it-works/",
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
