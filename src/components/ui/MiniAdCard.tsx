import Link from "next/link";
import { ImageIcon } from "lucide-react";
import "./mini-ad-card.css";

/**
 * H14.2: a small ad card (photo, title) where the WHOLE card opens the ad. One real link on the title is stretched over the
 * card; nothing else on it is a link or a button. Used where a "View ad" button used to be.
 */
export function MiniAdCard({ href, title, photo, dataTk = "ad-card" }: { href: string; title: string; photo?: string | null; dataTk?: string }) {
  return (
    <div className="tk-mini-ad" data-tk={dataTk}>
      <span className="tk-mini-ad-photo" aria-hidden="true">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={56} height={56} loading="lazy" />
        ) : (
          <ImageIcon size={20} focusable="false" />
        )}
      </span>
      <span className="tk-mini-ad-main">
        <Link href={href} prefetch={false} className="tk-mini-ad-link" data-tk="mini-ad-link" data-ad-link>{title}</Link>
      </span>
    </div>
  );
}
