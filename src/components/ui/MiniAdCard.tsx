import Link from "next/link";
import { ImageIcon } from "lucide-react";
import "./mini-ad-card.css";

/**
 * H14.2: a small ad card (photo, title, price) where the WHOLE card opens the ad. One real link on the title is stretched over the
 * card; nothing else on it is a link or a button. Used where a "View ad" button used to be.
 */
export function MiniAdCard({ href, title, photo, price, dataTk = "ad-card" }: { href: string; title: string; photo?: string | null; price?: number | null; dataTk?: string }) {
  return (
    <div className="tk-mini-ad" data-tk={dataTk}>
      <span className="tk-mini-ad-photo" aria-hidden="true">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" />
        ) : (
          <ImageIcon size={20} focusable="false" />
        )}
      </span>
      <span className="tk-mini-ad-main">
        <Link href={href} prefetch={false} className="tk-mini-ad-link" data-tk="mini-ad-link">{title}</Link>
        {typeof price === "number" && price > 0 ? <span className="tk-mini-ad-price">{`₹${price.toLocaleString("en-IN")}`}</span> : null}
      </span>
    </div>
  );
}
