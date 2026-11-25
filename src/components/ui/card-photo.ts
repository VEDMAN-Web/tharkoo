import type { CSSProperties } from "react";

/** H21.10: the style that hands a card photo's address to the blurred layer behind it (a CSS background, so no second download). */
export function bgPhotoStyle(src: string, extra: CSSProperties = {}): CSSProperties {
  return { ...extra, ["--tk-bg" as string]: `url(${JSON.stringify(src)})` } as CSSProperties;
}
