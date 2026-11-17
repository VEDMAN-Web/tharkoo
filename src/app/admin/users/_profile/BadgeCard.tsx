"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Badge, Button, ReasonDialog } from "@/components/admin/ui";
import type { UserDetail } from "@/server/admin/users";
import { removeBadgeAction } from "./actions";
import { useAnswer } from "./useAnswer";
import "./profile.css";

const WORDS: Record<UserDetail["user"]["verification"], { tone: "ok" | "warn" | "bad" | "neutral"; text: string; line: string }> = {
  approved: { tone: "ok", text: "ID verified", line: "The ID check was approved, so the verified badge shows on their ads." },
  pending_review: { tone: "warn", text: "ID waiting", line: "An ID check is waiting for a decision." },
  rejected: { tone: "bad", text: "ID refused", line: "The last ID check was refused." },
  unsubmitted: { tone: "neutral", text: "No ID check yet", line: "They have not done the ID check, or the badge was removed." },
};
const REASONS = ["Photo no longer matches", "Fake or changed document", "Asked by the user", "Other"] as const;

/** The Verified badge: the ID check state with a link to ID checks, and Remove badge with a reason (undo for 7 days). No ID document is shown here. */
export function BadgeCard({ detail, canRemove }: { detail: UserDetail; canRemove: boolean }) {
  const state = WORDS[detail.user.verification];
  const answer = useAnswer();
  const [open, setOpen] = useState(false);
  return (
    <section className="adm-up-box" aria-labelledby="ub-h" data-tk="badge-card">
      <div className="adm-up-head">
        <h3 id="ub-h"><BadgeCheck aria-hidden="true" size={16} /> Verified badge</h3>
        <Badge tone={state.tone}>{state.text}</Badge>
      </div>
      <p className="adm-k-help">{state.line}</p>
      <div className="adm-up-actions adm-up-left">
        <Link className="adm-k-btn adm-k-btn-sm" href="/admin/kyc/">Open ID checks</Link>
        {canRemove && detail.user.verification === "approved" ? (
          <Button size="sm" kind="danger" onClick={() => setOpen(true)}>Remove badge...</Button>
        ) : null}
      </div>
      <ReasonDialog
        open={open}
        title={`Remove the verified badge of ${detail.user.name}?`}
        body={<p>The ID check goes back to &quot;not done&quot; and they have to do it again. Their documents are not touched. You can undo this for 7 days.</p>}
        reasons={REASONS}
        requireReason
        textLabel="Tell the team more"
        confirmLabel="Remove badge"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={async (result) => {
          setOpen(false);
          answer(await removeBadgeAction({ userId: detail.user.id, reason: result.text ? `${result.reason}: ${result.text}` : result.reason }), "Removing the badge");
        }}
      />
    </section>
  );
}
