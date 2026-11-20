import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { TRUST } from "@/content/trust";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";
import { contactPath } from "@/lib/urls";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { LegalDoc } from "./LegalDoc";
import { LegalView } from "./LegalView";
import "./new-design.css";
import { publicParagraphs, readingMinutes, toSections } from "./legal-copy";

export type TrustLegalKey = "privacy" | "terms" | "cookies" | "safety";

const TITLES: Record<TrustLegalKey, string> = { privacy: "Privacy Policy", terms: "Terms and Conditions", cookies: "Cookie policy", safety: "Stay safe" };

/** H17.14: privacy and terms show the approved text as written, with an effective date from the Site text screen. */
const APPROVED = { privacy: { effective: "legal.privacy.effective", table: "What personal data we collect and why" }, terms: { effective: "legal.terms.effective", table: "" } } as const;

const TRUST_HEADINGS: Record<"safety" | "cookies", Record<number, string>> = {
  safety: { 0: "1. Before you reply", 1: "2. If you meet", 2: "3. What an ID check means", 3: "4. Reporting an ad", 4: "5. Getting help", 5: "6. Replying with care", 6: "7. Before you go out" },
  cookies: { 0: "1. Cookies we use", 1: "2. Choices saved in your browser", 2: "3. Other websites", 3: "4. Blocking cookies", 4: "5. The cookie note", 5: "6. More than one browser", 7: "7. Status of this note" },
};

function ReportLink() {
  return (
    <p className="tkp-after-article">
      <Link href="/scam-report/">Report a listing</Link>
    </p>
  );
}

export async function TrustLegalPage({ trustKey }: { trustKey: TrustLegalKey }) {
  const copy = TRUST[trustKey];
  const [newDesign, paths] = await Promise.all([newDesignOn(), getPaths()]);
  if (trustKey === "privacy" || trustKey === "terms") {
    const approved = APPROVED[trustKey];
    const effective = makeT(await textOverrides())(approved.effective);
    const body = <LegalDoc blocks={copy.paragraphs} tableLabel={approved.table} />;
    if (!newDesign) return <StaticPage title={copy.title}><p>Effective date: {effective}</p>{body}</StaticPage>;
    return (
      <LegalView
        crumbs={[{ label: "Tharkoo India", href: "/" }, { label: TITLES[trustKey] }]}
        title={TITLES[trustKey]}
        updated={effective}
        updatedPrefix="Effective date"
        minutes={readingMinutes(copy.paragraphs)}
        sections={[]}
        body={body}
        askHref={contactPath(paths)}
        askLabel="Questions about this page?"
      />
    );
  }
  if (!newDesign) {
    return (
      <StaticPage title={copy.title}>
        {publicParagraphs(copy.paragraphs, trustKey).map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
        {trustKey === "safety" ? <ReportLink /> : null}
      </StaticPage>
    );
  }
  return (
    <>
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
      {trustKey === "safety" ? <ReportLink /> : null}
    </>
  );
}
