"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LogOut, UserCheck, UserX } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Button, MoreMenu, ReasonDialog, useToast, type MoreItem } from "@/components/admin/ui";
import { closeAccountAction } from "../_profile/actions";
import { CLOSE_WORD } from "@/server/admin/close-word";
import { banPreviewAction, banUserAction, logoutEverywhereAction, unbanUserAction, type ActionResult } from "./actions";

export type UserAccess = { ban: boolean; logout: boolean; credits: boolean; adjust: boolean; edit: boolean; badge: boolean; close: boolean };

const CLOSE_REASONS = ["The user asked us to", "Fraud or abuse", "Duplicate account", "Other"] as const;
const BAN_REASONS = ["Spam", "Fake or junk ads", "Abusive messages", "Other"] as const;

/** The footer of the Users drawer (H8.11): Ban user... on the left, More in the middle, Unban on the right for a banned user. */
export function UserActions({ userId, name, status, isStaff, access, onAdjust }: { userId: string; name: string; status: "active" | "suspended" | "deleted"; isStaff: boolean; access: UserAccess; onAdjust: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [dialog, setDialog] = useState<"" | "ban" | "logout" | "close">("");
  const [preview, setPreview] = useState<{ liveAds: number; sessions: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [banRound, setBanRound] = useState(0);

  async function undo(eventId: string, what: string) {
    const outcome = await undoAction(eventId);
    if (outcome.ok) {
      toast.show({ kind: "success", message: `${what} undone.` });
      router.refresh();
    } else {
      toast.show({ kind: "error", message: outcome.message });
    }
  }

  function answer(result: ActionResult, done: string, undoable: boolean, what: string) {
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return;
    }
    if (undoable && result.eventId) toast.show({ kind: "undo", message: done, onUndo: () => void undo(result.eventId, what) });
    else toast.show({ kind: "success", message: done });
    router.refresh();
  }

  async function openBan() {
    setPreview(null);
    setBanRound((round) => round + 1);
    setDialog("ban");
    const result = await banPreviewAction(userId);
    if (result.ok) setPreview({ liveAds: result.liveAds, sessions: result.sessions });
  }

  const canBan = access.ban && !isStaff && status === "active";
  const canUnban = access.ban && !isStaff && status === "suspended";
  const canClose = access.close && !isStaff && status !== "deleted";
  const more: MoreItem[] = [
    ...(access.logout ? [{ key: "logout", label: "Log out everywhere...", icon: LogOut, onSelect: () => setDialog("logout") }] : []),
    ...(canClose ? [{ key: "close", label: "Close account...", icon: UserX, onSelect: () => setDialog("close") }] : []),
  ];
  const canAdjust = access.adjust && status !== "deleted";
  if (!canBan && !canUnban && !canAdjust && more.length === 0) return null;

  return (
    <>
      {canBan ? (
        <Button kind="danger" icon={Ban} onClick={() => void openBan()}>
          Ban user...
        </Button>
      ) : null}
      <span className="adm-k-sp" />
      {more.length ? <MoreMenu items={more} placement="up" /> : null}
      {canAdjust ? (
        <Button kind={canUnban ? "secondary" : "primary"} onClick={onAdjust}>
          Add or remove credits
        </Button>
      ) : null}
      {canUnban ? (
        <Button
          kind="primary"
          icon={UserCheck}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            const result = await unbanUserAction({ userId });
            setBusy(false);
            answer(result, `${name} unbanned.`, false, "Unban");
          }}
        >
          Unban user
        </Button>
      ) : null}

      <ReasonDialog
        key={banRound}
        open={dialog === "ban"}
        title={`Ban ${name}?`}
        body={
          <>
            <p>This will:</p>
            <ul style={{ margin: "6px 0", paddingLeft: 20, listStyle: "disc" }}>
              <li>{preview ? `pause their ${preview.liveAds} live ${preview.liveAds === 1 ? "ad" : "ads"}` : "pause their live ads"}</li>
              <li>log them out on every device</li>
              <li>block new sign-ins for this account</li>
            </ul>
            <p className="adm-k-help">You can undo this for 7 days. Undo brings back the ads this ban paused; it does not sign them back in.</p>
          </>
        }
        reasons={BAN_REASONS}
        requireReason
        textLabel="Tell the team more"
        confirmLabel="Ban user"
        danger
        onCancel={() => setDialog("")}
        onConfirm={async (result) => {
          setDialog("");
          setBusy(true);
          const reason = result.text ? `${result.reason}: ${result.text}` : result.reason;
          const done = await banUserAction({ userId, reason });
          setBusy(false);
          answer(done, `${name} banned.`, true, "The ban");
        }}
      />
      <ReasonDialog
        open={dialog === "close"}
        title={`Close the account of ${name}?`}
        body={
          <>
            <p>This will:</p>
            <ul style={{ margin: "6px 0", paddingLeft: 20, listStyle: "disc" }}>
              <li>hide all their live ads</li>
              <li>log them out on every device</li>
              <li>block sign-in for this account</li>
            </ul>
            <p className="adm-k-help">Nothing is deleted from the database. You can undo this for 7 days; undo brings the account and those ads back, but they sign in again.</p>
          </>
        }
        reasons={CLOSE_REASONS}
        requireReason
        textLabel="Tell the team more"
        typedConfirm={CLOSE_WORD}
        confirmLabel="Close account"
        danger
        onCancel={() => setDialog("")}
        onConfirm={async (result) => {
          setDialog("");
          setBusy(true);
          const done = await closeAccountAction({ userId, reason: result.text ? `${result.reason}: ${result.text}` : result.reason, confirm: CLOSE_WORD });
          setBusy(false);
          if (!done.ok) {
            toast.show({ kind: "error", message: done.message });
            return;
          }
          answer({ ok: true, eventId: done.eventId, undoUntil: done.undoUntil, summary: done.summary }, `${name}'s account closed.`, Boolean(done.undoUntil), "Closing the account");
        }}
      />
      <ReasonDialog
        open={dialog === "logout"}
        title={`Log ${name} out everywhere?`}
        body={<p>They are signed out on every device and sign in again with a code. This cannot be undone, and nothing else changes.</p>}
        confirmLabel="Log out everywhere"
        onCancel={() => setDialog("")}
        onConfirm={async () => {
          setDialog("");
          const done = await logoutEverywhereAction({ userId });
          answer(done, `${name} is logged out everywhere.`, false, "Log out");
        }}
      />
    </>
  );
}
