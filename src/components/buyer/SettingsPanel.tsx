"use client";

import Link from "next/link";
import type { PanelSummary } from "@/server/notifications/summary";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

export function SettingsPanel({ summary }: { summary: PanelSummary }) {
  if (!summary.signedIn) {
    return (
      <UserPanelShell active="settings" summary={summary}>
        <SignedOutPanel next="/u/account/edit-account/" title="Log in to see your settings" body="Your name and email appear here after you log in." />
      </UserPanelShell>
    );
  }

  return (
    <UserPanelShell active="settings" summary={summary}>
      <section aria-labelledby="settings-title" className="up-glass up-panel up-stack">
        <h1 id="settings-title" className="up-h2">Settings</h1>
        <div className="up-setting" data-tk="setting-name">
          <div>
            <p className="up-label-plain">Name on your account</p>
            <p className="up-name">{summary.displayName}</p>
          </div>
          <Link href="/u/seller-profile/?next=/u/account/edit-account/" className="up-btn-ghost">Change</Link>
        </div>
        <div className="up-setting" data-tk="setting-email">
          <div>
            <p className="up-label-plain">Email</p>
            <p className="up-name">{summary.email}</p>
          </div>
        </div>
        <div className="up-setting" data-tk="setting-id">
          <div>
            <p className="up-name">Identity check</p>
            <p className="up-muted">Needed for some categories</p>
          </div>
          <Link href="/u/account/kyc/" className="up-btn-ghost">View</Link>
        </div>
        <section aria-labelledby="phone-title" className="up-disabled-box">
          <p id="phone-title" className="up-phone-title">Login phone</p>
          <p className="up-muted">Text message codes are coming soon</p>
        </section>
        <p>
          <Link href="/u/account/delete/" className="up-muted-link">Delete account</Link>
        </p>
      </section>
    </UserPanelShell>
  );
}
