import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { safeHref } from "@/lib/sanitize";

interface Img {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface Props {
  heading: string;
  subheading?: string;
  imageDesktop?: Img | null;
  imageMobile?: Img | null;
  searchPlaceholder?: string;
  primaryCta?: { label: string; href: string } | null;
  secondaryCta?: { label: string; href: string } | null;
  overlay?: string;
}

/** Same markup as the built-in home page hero, so the page looks the same. The heading is the page h1. */
export function HeroBlock({ heading, subheading, imageDesktop, imageMobile, searchPlaceholder, primaryCta, secondaryCta, overlay = "light" }: Props) {
  const photo = imageDesktop ? safeHref(imageDesktop.src) : "";
  const phone = imageMobile ? safeHref(imageMobile.src) : "";
  const primary = primaryCta ? safeHref(primaryCta.href) : "";
  const secondary = secondaryCta ? safeHref(secondaryCta.href) : "";
  return (
    <>
      <section className="tk-hero" data-tk="hero" data-overlay={overlay}>
        {photo && imageDesktop ? (
          photo.startsWith("/") ? (
            <Image className="tk-hero-photo" src={photo} alt={imageDesktop.alt} width={imageDesktop.width} height={imageDesktop.height} priority sizes="42vw" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tk-hero-photo" src={photo} alt={imageDesktop.alt} width={imageDesktop.width} height={imageDesktop.height} />
          )
        ) : null}
        {phone && imageMobile ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tk-hero-photo tk-only-mobile" src={phone} alt={imageMobile.alt} width={imageMobile.width} height={imageMobile.height} />
        ) : null}
        <div className="tk-hero-copy">
          <h1>{heading}</h1>
          {subheading ? <p className="tk-hero-sub">{subheading}</p> : null}
          <HeroSearch label={searchPlaceholder || undefined} />
        </div>
      </section>
      {primaryCta && primary ? (
        <Link href={primary} data-tk="post-ad" className="tk-btn tk-btn-primary tk-home-post" prefetch={false}>
          {primaryCta.label}
        </Link>
      ) : null}
      {secondaryCta && secondary ? (
        <Link href={secondary} className="tk-btn tk-btn-outline-gold tk-home-post" prefetch={false}>
          {secondaryCta.label}
        </Link>
      ) : null}
    </>
  );
}
