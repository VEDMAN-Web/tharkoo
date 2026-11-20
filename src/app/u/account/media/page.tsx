import { cookies } from "next/headers";
import { PanelPage } from "@/components/buyer/PanelPage";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { adHref } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";
import { listMyMedia, type MediaFilter } from "@/server/media/mine";
import { getPaths } from "@/server/urls/service";
import { MediaLibrary, type LibraryRow } from "./MediaLibrary";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "My photos & videos | Tharkoo",
  description: "Every photo and video you uploaded for your ads, with its status.",
  path: "/u/account/media/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  const params = await searchParams;
  const filter: MediaFilter = params.type === "photos" ? "photos" : params.type === "videos" ? "videos" : "all";
  const paths = await getPaths();
  const listed = session ? await listMyMedia(session.user.id, filter) : { rows: [], truncated: false };
  const libraryRows: LibraryRow[] = listed.rows.map((row) => ({
    ...row,
    adHref: row.adStatus === "active" && row.adSlug ? adHref(paths, { slug: row.adSlug, address: row.adAddress }) : `/u/post-insert/?draft=${row.listingId}&step=photos`,
  }));
  return (
    <PanelPage active="media" next="/u/account/media/" title="Log in to see your photos" body="Photos and videos for your ads appear here after you log in.">
      <section aria-labelledby="media-title" className="up-glass up-panel up-stack">
        <div>
          <h1 id="media-title" className="up-h2">My photos &amp; videos</h1>
          <p className="up-muted">Everything you uploaded for your ads, newest first.</p>
        </div>
        <MediaLibrary rows={libraryRows} filter={filter} truncated={listed.truncated} />
      </section>
    </PanelPage>
  );
}
