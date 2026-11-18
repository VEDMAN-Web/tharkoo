import Link from "next/link";
import type { MediaFilter, MyMediaRow } from "@/server/media/mine";
import { RemoveMediaButton } from "./RemoveMediaButton";

export type LibraryRow = MyMediaRow & { adHref: string };

const FILTERS: { key: MediaFilter; label: string; href: string }[] = [
  { key: "all", label: "All", href: "/u/account/media/" },
  { key: "photos", label: "Photos", href: "/u/account/media/?type=photos" },
  { key: "videos", label: "Videos", href: "/u/account/media/?type=videos" },
];

const STATE_LABEL: Record<MyMediaRow["state"], string> = { live: "Live", checking: "Being checked", refused: "Refused" };
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string) {
  return iso ? DATE_FORMAT.format(new Date(iso)) : "";
}

const FRAME = { width: "100%", height: "100%", objectFit: "cover" as const, display: "block" };

function Preview({ row }: { row: LibraryRow }) {
  if (!row.url) {
    return <div style={{ ...FRAME, display: "grid", placeItems: "center", color: "var(--muted)" }}>No preview</div>;
  }
  if (row.kind === "video") {
    return <video src={row.url} poster={row.posterUrl || undefined} controls muted playsInline preload="metadata" aria-label={`Video for ${row.adTitle}`} style={FRAME} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={row.url} alt={`Photo for ${row.adTitle}`} loading="lazy" style={FRAME} />;
}

function Item({ row }: { row: LibraryRow }) {
  const chip = row.state === "live"
    ? { bg: "var(--ok-bg)", color: "var(--ok)" }
    : row.state === "checking"
      ? { bg: "var(--chip)", color: "var(--muted)" }
      : { bg: "var(--warn-bg)", color: "var(--warn)" };
  return (
    <li data-tk="media-item" data-kind={row.kind} data-state={row.state} style={{ listStyle: "none", minWidth: 0, display: "grid", gap: 6, alignContent: "start" }}>
      <div style={{ aspectRatio: "4 / 5", borderRadius: 8, overflow: "hidden", background: "var(--chip)" }}>
        <Preview row={row} />
      </div>
      <p className="t-small" style={{ fontWeight: 600, overflowWrap: "anywhere", margin: 0 }}>
        <Link href={row.adHref} style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", minHeight: 24 }}>{row.adTitle}</Link>
      </p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0 }}>
        <span className="tk-chip" data-tk="media-state" style={{ background: chip.bg, color: chip.color }}>{STATE_LABEL[row.state]}</span>
        {row.isCover ? <span className="tk-chip" data-tk="media-cover">Cover</span> : null}
      </p>
      {row.reason ? <p className="t-caption" style={{ color: "var(--warn)", margin: 0 }}>{row.reason}</p> : null}
      <p className="t-caption" style={{ color: "var(--muted)", margin: 0 }}>
        {[formatDate(row.createdAt), formatSize(row.bytes)].filter(Boolean).join(" · ")}
      </p>
      <RemoveMediaButton id={row.id} kind={row.kind} />
    </li>
  );
}

export function MediaLibrary({ rows, filter, truncated }: { rows: LibraryRow[]; filter: MediaFilter; truncated: boolean }) {
  return (
    <>
      <nav aria-label="Filter" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 16px" }}>
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={filter === item.key ? "page" : undefined}
            className="up-chip-link"
            data-tk="media-filter"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p data-tk="media-empty">
          No {filter === "all" ? "photos or videos" : filter} yet. <Link href="/u/post-insert/" style={{ color: "var(--accent)" }}>Post an ad</Link> to add some.
        </p>
      ) : (
        <ul data-tk="media-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16, padding: 0, margin: 0 }}>
          {rows.map((row) => (
            <Item key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </ul>
      )}
      {truncated ? <p className="t-small" style={{ marginTop: 12 }}>Showing the newest {rows.length} items.</p> : null}
    </>
  );
}
