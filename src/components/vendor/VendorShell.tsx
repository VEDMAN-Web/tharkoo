import Link from "next/link";

/** The phone bottom bar. The big + posts an ad. Shown only on narrow screens (see .tk-vbar in globals.css). */
function VendorBottomBar() {
  return (
    <nav className="tk-vbar" aria-label="Panel quick links">
      <Link href="/u/account/" className="tk-vbar-link">Home</Link>
      <Link href="/u/account/ads/" className="tk-vbar-link">Ads</Link>
      <Link href="/u/post-insert/" className="tk-vbar-plus" aria-label="Post an ad">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
      <Link href="/u/account/messages/" className="tk-vbar-link">Chats</Link>
      <Link href="/u/account/wallet/" className="tk-vbar-link">Wallet</Link>
    </nav>
  );
}

/**
 * H6.19: the vendor panel frame. The glass page background applies only to the panel screens (tk-glass-page).
 */
export function VendorShell({ children }: { title?: string; children: React.ReactNode; verified?: boolean }) {
  return (
    <div className="tk-container tk-glass-page" style={{ padding: "8px 0 40px" }}>
      {children}
      <VendorBottomBar />
    </div>
  );
}

export function Tile({ title, children, href }: { title: string; children: React.ReactNode; href: string }) {
  return (
    <a href={href} className="tk-tile-link">
      <h2>{title}</h2>
      <div>{children}</div>
    </a>
  );
}
