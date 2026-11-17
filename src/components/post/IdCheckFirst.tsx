import Link from "next/link";
import { makeT, type TextFn } from "@/lib/ui/text";
import type { IdCheckScreen } from "@/server/settings/id-check";

/**
 * H6.14: the one screen post-ad shows before step 1 when the ID-check switch is on and the person
 * is not approved. "verify" asks for the check; "checking" says it is with the team. The words are UI text keys (H8.35).
 */
export function IdCheckFirst({ screen, postPath, t = makeT() }: { screen: Exclude<IdCheckScreen, "form">; postPath: string; t?: TextFn }) {
  if (screen === "checking") {
    return (
      <div className="tk-container" style={{ padding: "24px 0 40px" }} data-tk="id-check-first">
        <h1 className="tk-page-h1" data-tk="step-title">{t("post.idcheck.checkingTitle")}</h1>
        <p style={{ textAlign: "center" }}>{t("post.idcheck.checkingText")}</p>
        <p style={{ textAlign: "center" }}>
          <Link href="/u/account/dashboard/">{t("post.idcheck.backToAccount")}</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="tk-container" style={{ padding: "24px 0 40px" }} data-tk="id-check-first">
      <h1 className="tk-page-h1" data-tk="step-title">{t("post.idcheck.verifyTitle")}</h1>
      <p style={{ textAlign: "center" }}>{t("post.idcheck.verifyText")}</p>
      <p style={{ textAlign: "center" }}>
        <Link className="tk-btn tk-btn-cta" href="/u/account/kyc/" data-tk="verify-id">{t("post.idcheck.verifyButton")}</Link>
      </p>
      <p className="t-small" style={{ textAlign: "center" }}>
        {t("post.idcheck.afterPre")} <Link href={postPath}>{t("post.idcheck.afterLink")}</Link>
        {t("post.idcheck.afterPost")}
      </p>
    </div>
  );
}
