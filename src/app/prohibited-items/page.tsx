import { StaticPage } from "@/components/StaticPage";
import { publicParagraphs } from "@/components/new/legal-copy";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST["prohibited-items"];

export const metadata = pageMetadata({
  title: "Prohibited items and what Tharkoo does not allow | Tharkoo",
  description: copy.description,
  path: "/prohibited-items/",
});

export default function Page() {
  return (
    <StaticPage title={copy.title}>
      {publicParagraphs(copy.paragraphs, "prohibited-items").map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </StaticPage>
  );
}
