import { textOverrides } from "@/app/admin/ui-text/store";
import { HelpArticleView } from "@/components/h714/HelpArticleView";
import { helpPath } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";
import { makeT } from "@/lib/ui/text";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "How to report a scam | Tharkoo",
  description: "What to do when a listing on Tharkoo looks like a scam: never pay a deposit, use the video call, report the ad, contact support.",
  path: "/scam-report/",
});

/** H15.9: a short help page in the Help article style; every sentence is a site-text key (scam.*). */
export default async function Page() {
  const [paths, texts] = await Promise.all([getPaths(), textOverrides()]);
  const t = makeT(texts);
  const body = [
    t("scam.intro"),
    `• ${t("scam.dontPay")}`,
    `• ${t("scam.videoCall")}`,
    `• ${t("scam.meetSafely")}`,
    t("scam.reportAd"),
    t("scam.contact"),
  ].join("\n\n");
  return (
    <HelpArticleView
      helpRoot={helpPath(paths)}
      section={t("scam.section")}
      title={t("scam.title")}
      updatedLabel="Updated Nov 2026"
      readLabel="1 min read"
      related={[
        { title: t("scam.title"), href: "/scam-report/" },
        { title: t("scam.section"), href: "/safety/" },
        { title: "Help Center", href: helpPath(paths) },
      ]}
      body={body}
      contactHref="/contact/"
    />
  );
}
