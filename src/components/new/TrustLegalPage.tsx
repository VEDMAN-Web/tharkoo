import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";
import { contactPath } from "@/lib/urls";
import { LegalView } from "./LegalView";
import { publicParagraphs, readingMinutes, toSections } from "./legal-copy";

export type TrustLegalKey = "privacy" | "terms" | "cookies";

const TRUST_HEADINGS: Record<TrustLegalKey, Record<number, string>> = {
  privacy: { 0: "What we store", 1: "What a public ad shows", 2: "Cookies", 3: "Staff access", 4: "Your requests", 6: "About this note" },
  terms: { 0: "Using Tharkoo", 1: "Age and ID checks", 2: "Free ads and paid options", 3: "Your content", 4: "Removing ads", 6: "Status of these terms" },
  cookies: { 0: "Cookies we use", 1: "Choices saved in your browser", 2: "Other websites", 3: "Blocking cookies", 4: "The cookie note", 5: "More than one browser", 7: "Status of this note" },
};

export async function TrustLegalPage({ trustKey }: { trustKey: TrustLegalKey }) {
  const copy = TRUST[trustKey];
  const [newDesign, paths] = await Promise.all([newDesignOn(), getPaths()]);
  if (!newDesign) {
    return (
      <StaticPage title={copy.title}>
        {publicParagraphs(copy.paragraphs, trustKey).map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </StaticPage>
    );
  }
  return (
    <LegalView
      crumbs={[{ label: "Tharkoo India", href: "/" }, { label: copy.title }]}
      title={copy.title}
      updated="November 2026"
      minutes={readingMinutes(copy.paragraphs)}
      sections={toSections(copy.paragraphs, trustKey, TRUST_HEADINGS[trustKey])}
      askHref={contactPath(paths)}
      askLabel="Questions about this page?"
    />
  );
}
