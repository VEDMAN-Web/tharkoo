"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import { api, friendlyError } from "@/lib/ui/api";
import { SettingItem } from "./_view/SettingItem";

type Banner = { kind: "error" | "info"; text: string };

/** H6.14: superadmin only. Off by default: nobody is asked for an ID check before posting. */
export function IdCheckSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setNotice(null);
    const res = await api<{ required: boolean }>("/api/admin/settings/id-check", {
      method: "PUT",
      body: JSON.stringify({ required: next }),
    });
    setBusy(false);
    if (!res.ok) return setNotice({ kind: "error", text: friendlyError(res.error) });
    setOn(res.data.required);
    setNotice({
      kind: "info",
      text: res.data.required
        ? "Saved. People need an approved ID check before they can post an ad."
        : "Saved. People can post an ad without an ID check.",
    });
  }

  return (
    <SettingItem id="id-check-title" title="ID check before posting" help="Off by the site default. When on, post-ad asks for an approved ID check first. The ID check page stays available either way.">
      <Toggle checked={on} onChange={change} label="Require ID check before posting" disabled={busy} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </SettingItem>
  );
}
