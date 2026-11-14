import Link from "next/link";
import type { IdCheckScreen } from "@/server/settings/id-check";

/**
 * H6.14: the one screen post-ad shows before step 1 when the ID-check switch is on and the person
 * is not approved. "verify" asks for the check; "checking" says it is with the team.
 */
export function IdCheckFirst({ screen, postPath }: { screen: Exclude<IdCheckScreen, "form">; postPath: string }) {
  if (screen === "checking") {
    return (
      <div className="tk-container" style={{ padding: "24px 0 40px" }} data-tk="id-check-first">
        <h1 className="tk-page-h1" data-tk="step-title">We are checking your ID</h1>
        <p style={{ textAlign: "center" }}>Thanks for sending your ID. Our team is checking it now. You can post your ad once it is approved.</p>
        <p style={{ textAlign: "center" }}>
          <Link href="/u/account/dashboard/">Back to your account</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="tk-container" style={{ padding: "24px 0 40px" }} data-tk="id-check-first">
      <h1 className="tk-page-h1" data-tk="step-title">Verify your ID first</h1>
      <p style={{ textAlign: "center" }}>Before you post an ad, we need an approved ID check. Upload a photo of your ID and a selfie.</p>
      <p style={{ textAlign: "center" }}>
        <Link className="tk-btn tk-btn-gold" href="/u/account/kyc/" data-tk="verify-id">Verify ID</Link>
      </p>
      <p className="t-small" style={{ textAlign: "center" }}>
        Once it is approved, come back to <Link href={postPath}>post an ad</Link>.
      </p>
    </div>
  );
}
