export type BlogCoverData = { src: string; alt: string; focus: string };

const FOCUS = /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/;

export const DEFAULT_COVER_FOCUS = "50% 30%";

export function coverOf(post: { cover?: string | null; coverAlt?: string | null; coverFocus?: string | null }): BlogCoverData | null {
  const src = (post.cover || "").trim();
  // An https address, or a picture from this site's own media library when it is stored on the server.
  if (!/^(https:\/\/|\/uploads\/)[^\s"'<>]+$/.test(src)) return null;
  const focus = (post.coverFocus || "").trim();
  return { src, alt: (post.coverAlt || "").trim().slice(0, 200), focus: FOCUS.test(focus) ? focus : DEFAULT_COVER_FOCUS };
}
