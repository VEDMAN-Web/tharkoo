"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PanelSummary } from "@/server/notifications/summary";
import { AvailabilityControls } from "@/components/vendor/AvailabilityControls";
import { api } from "@/lib/ui/api";
import { makeT } from "@/lib/ui/text";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import { ProfilePhoto } from "./ProfilePhoto";

const t = makeT();

/** What the Identity check row says for each real status (E1-B8). Before the status is known, or when there is none, it says when a check is needed. */
const ID_WORDS: Record<string, string> = { approved: "ID checked", pending_review: "Being checked", rejected: "Needs another look" };
const ID_NEEDED = "Needed for some categories";

export function SettingsPanel({ summary }: { summary: PanelSummary }) {
  const [idStatus, setIdStatus] = useState("");
  useEffect(() => {
    if (!summary.signedIn) return;
    void api<{ status?: string }>("/api/verification/status").then((res) => setIdStatus(res.ok ? res.data.status || "" : ""));
  }, [summary.signedIn]);

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
        <ProfilePhoto url={summary.avatarUrl ?? null} letter={summary.displayName.slice(0, 1).toUpperCase()} />
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
            <p className="up-muted" data-tk="setting-id-line">{ID_WORDS[idStatus] ?? ID_NEEDED}</p>
          </div>
          <Link href="/u/account/kyc/" className="up-btn-ghost">View</Link>
        </div>
        <p>
          <Link href="/u/account/delete/" className="up-muted-link">Delete account</Link>
        </p>
      </section>
      {summary.seller ? (
        <div className="up-stack" data-tk="chat-availability">
          <h2 className="up-h2">{t("panel.settings.chatTitle")}</h2>
          <AvailabilityControls />
        </div>
      ) : null}
    </UserPanelShell>
  );
}
