import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { FOCUS_POSITION, HERO_CONTAIN_BACKGROUND, overlayRgba, resolveHero, type HeroFocus, type HeroSettings } from "@/lib/layout/hero";
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
  /** Whole-banner link, used only when the heading, sub-heading and search are all hidden. */
  bannerLink?: { label: string; href: string } | null;
  /** Editor preview: no priority loading. */
  preview?: boolean;
  /** The look (H6.9): layout, fit, focus, height, overlay and text settings. Missing fields take their defaults (see resolveHero). */
  [setting: string]: unknown;
}

type Photo = Img & { src: string };

/** An image with a safe address, or null. */
function usablePhoto(image: Img | null | undefined): Photo | null {
  if (!image) return null;
  const src = safeHref(image.src);
  return src ? { ...image, src } : null;
}

function HeroPhoto({
  photo,
  className,
  sizes,
  priority,
  fit,
  focus,
}: {
  photo: Photo;
  className: string;
  sizes: string;
  priority: boolean;
  fit: HeroSettings["fit"];
  focus: HeroFocus;
}) {
  const style = { objectFit: fit, objectPosition: FOCUS_POSITION[focus] } as CSSProperties;
  // The desktop photo is the largest paint, so it gets priority loading. The phone photo loads eagerly with a high fetch priority.
  if (photo.src.startsWith("/")) {
    return (
      <Image
        className={className}
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        priority={priority}
        loading="eager"
        fetchPriority="high"
        style={style}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="eager" fetchPriority="high" style={style} />;
}

/** CSS variables for the section: the dark layer colour, the image shapes (for a height taken from the image) and the letterbox colour. */
function heroVars(settings: HeroSettings, desktop: Photo | null, phone: Photo | null): CSSProperties {
  const vars: Record<string, string> = {
    "--hero-bg": settings.overlay === "color" ? settings.overlayColor : HERO_CONTAIN_BACKGROUND,
  };
  if (settings.overlay === "color") vars["--hero-overlay"] = overlayRgba(settings.overlayColor, settings.overlayOpacity);
  if (desktop) vars["--ar-d"] = `${desktop.width} / ${desktop.height}`;
  if (phone) vars["--ar-m"] = `${phone.width} / ${phone.height}`;
  return vars as unknown as CSSProperties;
}

/** Same markup as the built-in home page hero, so the page looks the same. The heading is the page h1. */
export function HeroBlock(props: Props) {
  const { heading, subheading, searchPlaceholder, primaryCta, secondaryCta, bannerLink } = props;
  const settings = resolveHero(props);
  const desktop = usablePhoto(props.imageDesktop);
  const phone = usablePhoto(props.imageMobile);
  const primary = primaryCta ? safeHref(primaryCta.href) : "";
  const secondary = secondaryCta ? safeHref(secondaryCta.href) : "";
  const banner = bannerLink ? safeHref(bannerLink.href) : "";
  const bannerOnly = !settings.showHeadline && !settings.showSubtext && !settings.showSearch;
  const full = settings.layout === "full";
  return (
    <>
      <section
        className="tk-hero"
        data-tk="hero"
        data-layout={settings.layout}
        data-height={settings.height}
        data-overlay={settings.overlay}
        data-fit={settings.fit}
        data-x={settings.textAlign}
        data-y={settings.textVertical}
        data-tone={settings.textTone}
        data-shadow={settings.textShadow ? "on" : undefined}
        data-ar-d={desktop ? "" : undefined}
        data-ar-m={phone ? "" : undefined}
        style={heroVars(settings, desktop, phone)}
      >
        {desktop ? (
          <HeroPhoto
            photo={desktop}
            className={phone ? "tk-hero-photo tk-only-desktop" : "tk-hero-photo"}
            sizes={full ? "100vw" : "42vw"}
            priority={!props.preview}
            fit={settings.fit}
            focus={settings.focus}
          />
        ) : null}
        {phone ? (
          <HeroPhoto
            photo={phone}
            className={desktop ? "tk-hero-photo tk-only-mobile" : "tk-hero-photo"}
            sizes="100vw"
            priority={false}
            fit={settings.fit}
            focus={settings.focus}
          />
        ) : null}
        {bannerOnly && banner && bannerLink ? <BannerLink href={banner} label={bannerLink.label} /> : null}
        <div className="tk-hero-copy">
          <h1 className={settings.showHeadline ? undefined : "sr-only"}>{heading}</h1>
          {settings.showSubtext && subheading ? <p className="tk-hero-sub">{subheading}</p> : null}
          {settings.showSearch ? <HeroSearch label={searchPlaceholder || undefined} /> : null}
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

/** Covers the whole banner. Only rendered when no text or search is shown, so it is the only control in the hero. */
function BannerLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return <Link href={href} className="tk-hero-link" aria-label={label} prefetch={false} />;
  }
  return <a href={href} className="tk-hero-link" aria-label={label} rel="noopener" />;
}
