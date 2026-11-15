import { cookies } from "next/headers";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorShell } from "@/components/vendor/VendorShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { adPath } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";
import { listMyMedia, type MediaFilter } from "@/server/media/mine";
import { getPaths } from "@/server/urls/service";
import { MediaLibrary, type LibraryRow } from "./MediaLibrary";

export const metadata = pageMetadata({
  title: "My photos & videos | Tharkoo",
  description: "Every photo and video you uploaded for your ads, with its status.",
  path: "/u/account/media/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return (
      <VendorShell>
        <h1 className="tk-page-h1">My photos &amp; videos</h1>
        <EmptyState title="Sign in to see your photos" body="Photos and videos for your ads appear here after you log in." action={{ href: "/u/login/?next=/u/account/media/", label: "Log in" }} />
      </VendorShell>
    );
  }
  const params = await searchParams;
  const filter: MediaFilter = params.type === "photos" ? "photos" : params.type === "videos" ? "videos" : "all";
  const [{ rows, truncated }, paths] = await Promise.all([listMyMedia(session.user.id, filter), getPaths()]);
  const libraryRows: LibraryRow[] = rows.map((row) => ({
    ...row,
    adHref: row.adStatus === "active" && row.adSlug ? adPath(paths, row.adSlug) : `/u/post-insert/?draft=${row.listingId}&step=photos`,
  }));
  return (
    <VendorShell>
      <h1 className="tk-page-h1">My photos &amp; videos</h1>
      <p className="t-small" style={{ color: "var(--muted)" }}>Everything you uploaded for your ads, newest first.</p>
      <MediaLibrary rows={libraryRows} filter={filter} truncated={truncated} />
    </VendorShell>
  );
}
