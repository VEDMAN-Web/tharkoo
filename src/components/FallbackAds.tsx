import Link from "next/link";
import { AdCard } from "@/components/ui/AdCard";
import type { FallbackSection } from "@/lib/fallback-ads";
import type { ListingDoc } from "@/lib/models";
import "./fallback-ads.css";

/**
 * H7.32: the fallback block under a page's own results (see lib/fallback-ads.ts). Each section is a heading and its
 * ad cards, in the same card as the page's own feed. With no own results, `lead` is the one friendly line and its
 * "post the first ad" button, drawn above the sections.
 */
export function FallbackAds({
  sections,
  layout,
  lead,
}: {
  sections: FallbackSection<ListingDoc>[];
  layout?: "row";
  lead?: { text: string; button: string; href: string };
}) {
  if (sections.length === 0 && !lead) return null;
  return (
    <div className="tkn-fb" data-tk="fallback-ads">
      {lead ? (
        <div className="tkn-fb-lead" data-tk="fallback-lead">
          <p>{lead.text}</p>
          <Link className="tk-btn" href={lead.href} prefetch={false}>
            {lead.button}
          </Link>
        </div>
      ) : null}
      {sections.map((section) => (
        <section key={section.key} className="tkn-fb-sec" data-tk={`fallback-${section.key}`}>
          <h2 className="tkn-fb-title">{section.title}</h2>
          <div className="tk-feed">
            {section.items.map((ad, index) => (
              <AdCard key={ad.publicId || ad.slug || index} ad={ad} layout={layout} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
