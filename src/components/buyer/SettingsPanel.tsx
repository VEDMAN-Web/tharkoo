"use client";

import Link from "next/link";
import type { PanelSummary } from "@/server/notifications/summary";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

/** H7.17: account settings on the user panel: email, notification preferences, login phone and delete account. */
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
        <div>
          <p className="up-label">Email</p>
          <p className="up-name">{summary.email}</p>
        </div>
        <div className="up-setting">
          <div>
            <p className="up-name">Notification preferences</p>
            <p className="up-muted">Choose what we send you</p>
          </div>
          <Link href="/u/account/notifications/" className="up-btn-ghost">Manage</Link>
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
