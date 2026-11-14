"use client";

export type TileState = "uploading" | "live" | "checking" | "refused";

export interface MediaTileProps {
  kind: "image" | "video";
  label: string;
  state: TileState;
  url?: string | null;
  posterUrl?: string | null;
  progress?: number;
  reason?: string | null;
  isCover?: boolean;
  busy?: boolean;
  onMakeCover?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
}

const STATE_TEXT: Record<TileState, string> = { uploading: "Uploading", live: "Live", checking: "Being checked", refused: "Refused" };

const BUTTON = { minHeight: 32, padding: "4px 10px", fontSize: 13 };

function Frame({ kind, url, posterUrl, label }: Pick<MediaTileProps, "kind" | "url" | "posterUrl" | "label">) {
  const frame = { width: "100%", height: "100%", objectFit: "cover" as const, display: "block" };
  if (!url) return <div style={{ ...frame, display: "grid", placeItems: "center", color: "var(--muted)" }}>{kind === "video" ? "Video" : "Photo"}</div>;
  if (kind === "video") {
    return <video src={url} poster={posterUrl || undefined} controls muted playsInline preload="metadata" aria-label={label} style={frame} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} loading="lazy" style={frame} />;
}

/** One photo or video in the post-ad photo step: preview, status, upload share and the owner's actions. */
export function MediaTile(props: MediaTileProps) {
  const { kind, label, state, progress = 0, reason, isCover, busy, url, posterUrl } = props;
  const uploading = state === "uploading";
  return (
    <li data-tk="photo-tile" data-state={state} data-kind={kind} style={{ listStyle: "none", minWidth: 0, display: "grid", gap: 6, alignContent: "start" }}>
      <div style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: 8, overflow: "hidden", background: "var(--chip)" }}>
        {uploading && kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
        ) : (
          <Frame kind={kind} url={url} posterUrl={posterUrl} label={label} />
        )}
        {uploading ? (
          <div data-tk="upload-progress" role="status" style={{ position: "absolute", left: 8, right: 8, bottom: 8, background: "var(--surface, #fff)", borderRadius: 6, padding: 6, fontSize: 12 }}>
            Uploading {Math.round(progress * 100)}%
            <div aria-hidden style={{ height: 4, background: "var(--chip)", borderRadius: 2, marginTop: 4 }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
            </div>
          </div>
        ) : null}
      </div>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, fontSize: 12 }}>
        <span className="tk-chip" data-tk="photo-state">{STATE_TEXT[state]}</span>
        {isCover ? <span className="tk-chip" data-tk="photo-cover">Cover</span> : null}
      </p>
      {reason ? <p className="t-caption" style={{ color: "var(--warn)", margin: 0 }}>{reason}</p> : null}
      {!uploading ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {props.onMakeCover && !isCover ? <button type="button" className="tk-btn tk-btn-outline-gold" style={BUTTON} disabled={busy} onClick={props.onMakeCover}>Make cover</button> : null}
          {props.onMoveLeft ? <button type="button" className="tk-btn tk-btn-outline-gold" style={BUTTON} disabled={busy} aria-label={`Move ${label} left`} onClick={props.onMoveLeft}>Move left</button> : null}
          {props.onMoveRight ? <button type="button" className="tk-btn tk-btn-outline-gold" style={BUTTON} disabled={busy} aria-label={`Move ${label} right`} onClick={props.onMoveRight}>Move right</button> : null}
          {props.onRemove ? <button type="button" className="tk-btn tk-btn-outline-gold" style={BUTTON} disabled={busy} aria-label={`Remove ${label}`} onClick={props.onRemove}>Remove</button> : null}
        </div>
      ) : null}
    </li>
  );
}
