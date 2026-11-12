import Link from "next/link";
import { HomeLayout } from "@/components/blocks/HomeLayout";
import { inWindow } from "@/lib/layout/read";
import { getDraft } from "@/server/layout/service";

export const dynamic = "force-dynamic";

/** The home page as it will look after Publish, built from the saved draft. Staff only (the admin layout checks the session). */
export default async function HomePreview() {
  const draft = await getDraft("home", "default");
  const now = new Date();
  const blocks = (draft ?? []).filter((block) => block.visible && inWindow(block, now));
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff7e6", borderBottom: "1px solid #f6d79b", padding: "10px 16px", fontSize: 14 }}>
        <strong>Preview of the saved draft.</strong> Visitors see the published version until you press Publish.{" "}
        <Link href="/admin/homepage/">Back to the editor</Link>
      </div>
      {blocks.length ? <HomeLayout blocks={blocks} /> : <p style={{ padding: 24 }}>The draft has no visible blocks yet.</p>}
    </>
  );
}
