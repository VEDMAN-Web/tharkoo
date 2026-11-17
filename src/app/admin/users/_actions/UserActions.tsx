"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LogOut, UserCheck } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Button, MoreMenu, ReasonDialog, useToast, type MoreItem } from "@/components/admin/ui";
import { banPreviewAction, banUserAction, logoutEverywhereAction, unbanUserAction, type ActionResult } from "./actions";

export type UserAccess = { ban: boolean; logout: boolean };

const BAN_REASONS = ["Spam", "Fake or junk ads", "Abusive messages", "Other"] as const;

/** The footer of the Users drawer (H8.11): Ban user... on the left, More in the middle, Unban on the right for a banned user. */
export function UserActions({ userId, name, status, isStaff, access }: { userId: string; name: string; status: "active" | "suspended" | "deleted"; isStaff: boolean; access: UserAccess }) {
  const toast = useToast();
  const router = useRouter();
  const [dialog, setDialog] = useState<"" | "ban" | "logout">("");
  const [preview, setPreview] = useState<{ liveAds: number; sessions: number } | null>(null);
  const [busy, setBusy] = useState(false);

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
    setDialog("ban");
    const result = await banPreviewAction(userId);
    if (result.ok) setPreview({ liveAds: result.liveAds, sessions: result.sessions });
  }

  const canBan = access.ban && !isStaff && status === "active";
  const canUnban = access.ban && !isStaff && status === "suspended";
  const more: MoreItem[] = access.logout ? [{ key: "logout", label: "Log out everywhere...", icon: LogOut, onSelect: () => setDialog("logout") }] : [];
  if (!canBan && !canUnban && more.length === 0) return null;

  return (
    <>
      {canBan ? (
        <Button kind="danger" icon={Ban} onClick={() => void openBan()}>
          Ban user...
        </Button>
      ) : null}
      <span className="adm-k-sp" />
      {more.length ? <MoreMenu items={more} placement="up" /> : null}
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
