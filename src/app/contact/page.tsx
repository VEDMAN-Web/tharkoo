import Link from "next/link";
import { JsonLd } from "@/lib/jsonld";
import { TRUST } from "@/content/trust";
import { getSite } from "@/lib/queries";
import { contactPageNode } from "@/lib/seo/schema";
import { contactPath, helpPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { StaticPage } from "@/components/StaticPage";

export const revalidate = 300;

const copy = TRUST.contact;

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(contactPath(paths), {
    title: `${copy.title} | Tharkoo`,
    description: copy.description,
    path: contactPath(paths),
  });
}

export default async function Contact() {
  const [site, paths] = await Promise.all([getSite(), getPaths()]);
  const heading = await urlHeading(contactPath(paths), copy.title);
  return (
    <>
      <JsonLd data={contactPageNode(site.name || "Tharkoo", contactPath(paths))} />
      <StaticPage title={heading}>
        <p>Support hours: {site.supportHours || "We reply on business days."}</p>
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
        <p>
          <Link href="/cms/grievance/">Grievance</Link>
          {" · "}
          <Link href={helpPath(paths)}>Help Center</Link>
        </p>
      </StaticPage>
    </>
  );
}
