"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { openSupportWith } from "@/components/recharge/openRecharge";
import { LOGO_LIGHT_DEFAULT } from "@/lib/brand";
import { useAccount } from "@/components/account/AccountContext";
import { useT } from "@/components/help/UiTextProvider";
import { openRecharge } from "@/components/recharge/openRecharge";
import "./post-shell.css";

/** H21.0: the one shell around every screen of the post-ad flow: header with the ad-credit pill, progress line, and the page below. */

type SaveState = "idle" | "saving" | "saved";

/** H21.12c: the site's logo file (Admin, Site settings), the same one the main header shows. */
const PostLogoContext = createContext(LOGO_LIGHT_DEFAULT);

export function PostLogoProvider({ src, children }: { src: string; children: ReactNode }) {
  return <PostLogoContext.Provider value={src}>{children}</PostLogoContext.Provider>;
}

type HeaderProps = {
  /** The draft chip (Saving, Saved); left out on screens that have no draft. */
  saveState?: SaveState;
  exitHref?: string;
  /** H21.7: the done screens have no draft to save: logo on the left, the credit pill and a My ads link on the right. */
  variant?: "flow" | "done";
};

export function PostHeader({ saveState, exitHref = "/u/account/ads/", variant = "flow" }: HeaderProps) {
  const t = useT();
  const logo = useContext(PostLogoContext);
  const { balance, balanceReady } = useAccount();
  const known = balanceReady && balance !== null;
  const shown = known ? balance.toLocaleString("en-IN") : "";
  return (
    <header className="tkp-header" data-tk="post-header" data-variant={variant}>
      <div className="tkp-header-row">
        <span className="tkp-logo" data-tk="post-logo">
          <BrandLogo src={logo} name={t("post.v2.header.brand")} height={34} className="tkp-logo-img" priority />
        </span>
        {variant === "done" ? null : <Link href={exitHref} className="tkp-exit" data-tk="exit-post" aria-label={t("post.v2.header.exit")}>
          <svg className="tkp-exit-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          <span className="tkp-exit-txt">{t("post.v2.header.exit")}</span>
        </Link>}
        {variant === "done" ? null : <p className="tkp-header-mid" data-tk="post-header-title">{t("post.v2.header.title")}</p>}
        {saveState ? (
          <span className="tkp-saved" data-state={saveState} data-tk="draft-saved" role="status">
            {saveState === "saving" ? t("post.save.saving") : t("post.save.saved")}
          </span>
        ) : null}
        <button
          type="button"
          className="tkp-credit-pill"
          data-tk="header-credit-pill"
          aria-label={known ? t("post.v2.header.creditsLabel", { balance: shown }) : t("post.v2.header.creditsWait")}
          onClick={() => openRecharge({ wallet: "ad" })}
        >
          <svg className="tkp-pill-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0106a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" /><path d="M3 9h18" /></svg>
          <span className="tkp-pill-text">
            <span data-tk="header-credit-balance">{known ? shown : "…"}</span>
            <span className="tkp-pill-unit"> {t("post.v2.header.creditsUnit")}</span>
          </span>
          <span className="tkp-pill-plus" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
        </button>
        {variant === "done" ? <Link href="/u/account/ads/" className="tkp-myads" data-tk="header-my-ads">{t("post.v2.header.myAds")}</Link> : null}
      </div>
    </header>
  );
}

/** H21.12c: below 1024 px the floating chat bubble is hidden on the post-ad steps, so each step ends with this link instead. */
function HelpLink() {
  const t = useT();
  return (
    <p className="tkp-needhelp">
      <button type="button" data-tk="step-help-link" onClick={() => openSupportWith("")}>{t("post.success.help")}</button>
    </p>
  );
}

/** The 3 px line under the header. Pass null for the ID check screen, which has none. */
export function ProgressLine({ percent }: { percent: number | null }) {
  const t = useT();
  if (percent === null) return null;
  return (
    <div className="tkp-line" role="progressbar" aria-label={t("post.v2.progress.label")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-tk="post-progress">
      <div className="tkp-line-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Wraps a screen of the flow. The site header and footer give way to this shell (see post-shell.css). */
export function PostShell({ percent, children, saveState, variant = "flow" }: { percent: number | null; children: ReactNode; saveState?: SaveState; variant?: "flow" | "done" }) {
  return (
    <div className="tkp-shell" data-tk="post-shell">
      <PostHeader saveState={saveState} variant={variant} />
      <ProgressLine percent={percent} />
      {children}
      {variant === "flow" ? <HelpLink /> : null}
    </div>
  );
}
