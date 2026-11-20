import Link from "next/link";
import { JsonLd } from "@/lib/jsonld";
import { TRUST } from "@/content/trust";
import { getSite } from "@/lib/queries";
import { contactPageNode } from "@/lib/seo/schema";
import { cmsPath, contactPath, helpPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { StaticPage } from "@/components/StaticPage";
import { ContactView, type ContactInfo } from "@/components/new/ContactView";
import { hasPlaceholder, publicParagraphs } from "@/components/new/legal-copy";
import { newDesignOn } from "@/server/site-links/new-design";
import { readShellConfig } from "@/server/site-links/shell-config";
import type { ContactKind, ShellContact } from "@/server/site-links/shell-config-rules";
import { readContent } from "@/lib/ui/site-content";

export const revalidate = 300;

const copy = TRUST.contact;
const NEW_TITLE = "Talk to a real person";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(contactPath(paths), {
    title: "Contact Tharkoo support | Tharkoo",
    description: copy.description,
    path: contactPath(paths),
  });
}

function contactValue(contacts: ShellContact[], kind: ContactKind): string {
  return contacts.find((item) => item.kind === kind && item.visible && item.value.trim() && !hasPlaceholder(item.value))?.value.trim() || "";
}

export default async function Contact() {
  const [site, paths, newDesign, shell] = await Promise.all([getSite(), getPaths(), newDesignOn(), readShellConfig()]);
  const jsonLd = <JsonLd data={contactPageNode(site.name || "Tharkoo", contactPath(paths))} />;
  if (newDesign) {
    const content = readContent((site as { homepage?: unknown }).homepage);
    const info: ContactInfo = {
      email: contactValue(shell.footer.contacts, "email"),
      phone: contactValue(shell.footer.contacts, "phone") || shell.chat.phone.trim(),
      whatsapp: contactValue(shell.footer.contacts, "whatsapp") || content.support.whatsapp || "",
      telegram: contactValue(shell.footer.contacts, "telegram") || content.support.telegram || "",
      hours: content.support.hours || site.supportHours || "",
      office: contactValue(shell.footer.contacts, "address"),
    };
    const title = await urlHeading(contactPath(paths), NEW_TITLE);
    return (
      <>
        {jsonLd}
        <ContactView title={title} info={info} grievanceHref={cmsPath(paths, "grievance")} helpHref={helpPath(paths)} homeHref="/" />
      </>
    );
  }
  const heading = await urlHeading(contactPath(paths), copy.title);
  return (
    <>
      {jsonLd}
      <StaticPage title={heading}>
        <p>Support hours: {site.supportHours || "We reply on business days."}</p>
        {publicParagraphs(copy.paragraphs, "contact").map((paragraph) => (
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
