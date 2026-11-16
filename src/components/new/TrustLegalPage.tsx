import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";
import { contactPath } from "@/lib/urls";
import { LegalView } from "./LegalView";
import { publicParagraphs, readingMinutes, toSections } from "./legal-copy";

export type TrustLegalKey = "privacy" | "terms" | "cookies";

const TITLES: Record<TrustLegalKey, string> = { privacy: "Privacy policy", terms: "Terms of use", cookies: "Cookie policy" };

const TRUST_HEADINGS: Record<TrustLegalKey, Record<number, string>> = {
  privacy: { 0: "1. What we store", 1: "2. What a public ad shows", 2: "3. Cookies", 3: "4. Staff access", 4: "5. Your requests", 6: "6. About this note" },
  terms: { 0: "1. Using Tharkoo", 1: "2. Age and ID checks", 2: "3. Posting fee and paid options", 3: "4. Your content", 4: "5. Removing ads", 6: "6. Status of these terms" },
  cookies: { 0: "1. Cookies we use", 1: "2. Choices saved in your browser", 2: "3. Other websites", 3: "4. Blocking cookies", 4: "5. The cookie note", 5: "6. More than one browser", 7: "7. Status of this note" },
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
      crumbs={[{ label: "Tharkoo India", href: "/" }, { label: TITLES[trustKey] }]}
      title={TITLES[trustKey]}
      updated="November 2026"
      minutes={readingMinutes(copy.paragraphs)}
      summary={copy.description}
      sections={toSections(copy.paragraphs, trustKey, TRUST_HEADINGS[trustKey])}
      askHref={contactPath(paths)}
      askLabel="Questions about this page?"
    />
  );
}
