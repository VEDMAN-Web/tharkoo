import { safeHref } from "@/lib/sanitize";

interface Props {
  image?: { src: string; alt: string; width: number; height: number } | null;
  title?: string;
  text?: string;
  link?: { label: string; href: string } | null;
  theme?: string;
}

export function BannerBlock({ image, title, text, link, theme = "brand" }: Props) {
  const href = link ? safeHref(link.href) : "";
  const src = image ? safeHref(image.src) : "";
  return (
    <aside className="tk-block tk-block-banner" data-theme={theme}>
      {image && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
      ) : null}
      <div>
        {title ? <h2>{title}</h2> : null}
        {text ? <p>{text}</p> : null}
      </div>
      {link && href ? <a href={href}>{link.label}</a> : null}
    </aside>
  );
}
