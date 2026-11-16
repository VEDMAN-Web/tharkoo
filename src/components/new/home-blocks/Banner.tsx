import type { CSSProperties } from "react";
import Image from "next/image";
import { splitHeadline } from "../home-copy";
import type { Hero } from "./types";

const TEXT_IMAGE_W = 2400;
const TEXT_IMAGE_H = 1029;

function bannerFocus(hero: Hero): CSSProperties {
  const desktop = `${hero.focusX ?? 50}% ${hero.focusY ?? 25}%`;
  const phone = hero.photoPhone ? `${hero.phoneFocusX ?? 50}% ${hero.phoneFocusY ?? 25}%` : desktop;
  const w = hero.photoWidth && hero.photoHeight ? hero.photoWidth : TEXT_IMAGE_W;
  const h = hero.photoWidth && hero.photoHeight ? hero.photoHeight : TEXT_IMAGE_H;
  return { "--tkh-focus": desktop, "--tkh-focus-phone": phone, ...(hero.textInImage ? { "--tkh-ratio": `${w} / ${h}` } : {}) } as CSSProperties;
}

export function HomeBanner({ hero, sub }: { hero: Hero; sub: string }) {
  const { lead, accent } = splitHeadline(hero.desktop);
  const localPhoto = hero.photo.startsWith("/");
  const inImage = hero.textInImage === true && Boolean(hero.photo);
  const bannerW = inImage && hero.photoWidth && hero.photoHeight ? hero.photoWidth : inImage ? TEXT_IMAGE_W : 1280;
  const bannerH = inImage && hero.photoWidth && hero.photoHeight ? hero.photoHeight : inImage ? TEXT_IMAGE_H : 420;
  return (
    <div className="tkh-banner" style={bannerFocus(hero)} data-text-in-image={inImage ? "true" : undefined} data-phone-photo={inImage && hero.photoPhone ? "true" : undefined}>
      {hero.photo && hero.photoPhone ? (
        <picture>
          <source media="(max-width: 599px)" srcSet={hero.photoPhone} />
          <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} fetchPriority="high" />
        </picture>
      ) : hero.photo ? (
        localPhoto ? (
          <Image className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} priority sizes="(max-width: 1280px) 100vw, 1280px" />
        ) : (
          <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} />
        )
      ) : (
        <span className="tkh-banner-img tkh-banner-empty" aria-hidden="true" />
      )}
      {inImage ? (
        <h1 className="tkh-sr">{hero.desktop}</h1>
      ) : (
        <div className="tkh-banner-copy m-enter">
          <h1>
            {lead ? `${lead} ` : ""}
            <span className="tkh-grad">{accent}</span>
          </h1>
          <p>{sub}</p>
        </div>
      )}
    </div>
  );
}
