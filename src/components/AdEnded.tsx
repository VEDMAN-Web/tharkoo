import Link from "next/link";
import type { EndedAdView } from "@/server/listings/ended-ad";
import { ListingCard, ListingGrid } from "@/components/new/ListingCards";
import { UiTextProvider } from "@/components/ui/AdCard";
import { categoryPath, placePath } from "@/lib/urls";
import { makeT, type UiTextMap } from "@/lib/ui/text";

/** H16.4: the page of an ad that has ended. 200 with noindex, no text of the ad, and similar ads. */
export function AdEnded({ view, texts }: { view: EndedAdView; texts?: UiTextMap }) {
  const t = makeT(texts);
  const more = view.categorySlug ? (view.citySlug ? placePath(view.categorySlug, view.citySlug) : categoryPath(view.categorySlug)) : "/";
  return (
    <UiTextProvider texts={texts}>
      <article className="tk-container" style={{ paddingTop: 16, paddingBottom: 24 }} data-tk="ad-ended">
        <h1>{t("ad.ended.title")}</h1>
        <p role="status">{t("ad.ended.text")}</p>
        {view.similar.length ? (
          <ListingGrid>
            {view.similar.map((ad, index) => (
              <li key={ad.slug ?? index}>
                <ListingCard ad={ad} order={index} texts={texts} />
              </li>
            ))}
          </ListingGrid>
        ) : null}
        {view.categorySlug ? <p><Link href={more}>{t("ad.ended.more", { category: view.categoryName, place: view.cityName || "India" })}</Link></p> : null}
      </article>
    </UiTextProvider>
  );
}
