/**
 * The page address as the browser sees it. While a page is prerendered (Vercel's cached copy of Home and the other pages) the
 * server reports "/index" for Home and "/categories" without the closing slash, while the browser reports "/" and "/categories/".
 * A component that shows something because of the address (the Home strip, the current menu link) would then differ between the
 * server and the browser, which is React error 418. Every component reads the address through this one function (H10.3b).
 */
export function normalizePathname(raw: string | null | undefined): string {
  let path = (raw ?? "").trim() || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path === "/index" || path === "/index/") return "/";
  return path.endsWith("/") ? path : `${path}/`;
}
