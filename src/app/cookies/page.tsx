import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";

const copy = TRUST.cookies;

export const metadata = pageMetadata({
  title: "Cookie policy: what Tharkoo stores and why | Tharkoo",
  description: copy.description,
  path: "/cookies/",
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
