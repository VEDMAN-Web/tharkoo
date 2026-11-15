"use client";

import Link from "next/link";
import { useState } from "react";
import { PhoneLinkCard } from "@/components/PhoneLinkCard";
import { api, friendlyError } from "@/lib/ui/api";
import type { PanelSummary } from "@/server/notifications/summary";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

/** H7.17: account settings on the user panel: email, password, notification preferences and delete account. */
export function SettingsPanel({ summary }: { summary: PanelSummary }) {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  if (!summary.signedIn) {
    return (
      <UserPanelShell active="settings" summary={summary}>
        <SignedOutPanel next="/u/account/edit-account/" title="Log in to see your settings" body="Your name and email appear here after you log in." />
      </UserPanelShell>
    );
  }

  const email = summary.email;
  async function changePassword() {
    const res = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email }) });
    if (!res.ok) return setMessage(friendlyError(res.error));
    setSent(true);
  }

  return (
    <UserPanelShell active="settings" summary={summary}>
      <section aria-labelledby="settings-title" className="up-glass up-panel up-stack">
        <h1 id="settings-title" className="up-h2">Settings</h1>
        <div>
          <p className="up-label">Email</p>
          <p className="up-name">{email}</p>
        </div>
        <div className="up-setting">
          <div>
            <p className="up-name">Password</p>
            <p className="up-muted">We will send you an email to change your password</p>
          </div>
          <button type="button" className="up-btn" onClick={changePassword} disabled={sent}>
            {sent ? "Email sent" : "Change password"}
          </button>
        </div>
        <p aria-live="polite" className="up-muted">{message}</p>
        <div className="up-setting">
          <div>
            <p className="up-name">Notification preferences</p>
            <p className="up-muted">Choose what we send you</p>
          </div>
          <Link href="/u/account/notifications/" className="up-btn-ghost">Manage</Link>
        </div>
        <PhoneLinkCard />
        <p>
          <Link href="/u/account/delete/" className="up-muted-link">Delete account</Link>
        </p>
      </section>
    </UserPanelShell>
  );
}
