import type { CSSProperties, ReactNode } from "react";
import type { ShellImage } from "@/server/site-links/shell-config-rules";
import { NewSearchBar } from "./NewSearchBar";
import "./new-design.css";

/**
 * H7.4: the title band at the top of a category and city listing page (New design). The band image is set as CSS
 * variables, so the phone image can differ from the desktop one. The URLs were checked when they were saved.
 */
export function ListingBand({
  categoryName,
  cityName,
  image,
  chips,
}: {
  categoryName: string;
  cityName: string;
  image: ShellImage | null;
  /** The sub-category chips for this city, drawn inside the band. */
  chips?: ReactNode;
}) {
  const vars: Record<string, string> = {};
  if (image?.band) vars["--tkn-band-desk"] = `url("${image.band}")`;
  if (image?.bandPhone || image?.band) vars["--tkn-band-phone"] = `url("${image?.bandPhone || image?.band}")`;
  return (
    <section className="tkn-page tkn-band-wrap" aria-label={`${categoryName} in ${cityName}`}>
      <div className="tkn-band" style={vars as CSSProperties} data-tk="listing-band">
        <div className="tkn-band-inner">
          <p className="tkn-band-title">{`${categoryName} in ${cityName}`}</p>
          <NewSearchBar label={`Search ${categoryName.toLowerCase()} in ${cityName}`} />
          {chips ? <div className="tkn-band-chips">{chips}</div> : null}
        </div>
      </div>
    </section>
  );
}
