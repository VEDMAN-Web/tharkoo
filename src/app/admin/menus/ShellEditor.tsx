"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { SUPPORT_TOPICS, TOPIC_LABELS } from "@/server/support/constants";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { saveShellAction } from "./actions";

type Banner = { kind: "error" | "info"; text: string };

function Text({ label, value, onChange, max = 200, multiline }: { label: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean }) {
  return (
    <label className="mb-3 flex flex-col t-small">
      {label}
      {multiline ? (
        <textarea className="adm-input" rows={3} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="adm-input" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

/**
 * H7.1: admin edits the support chat. Menus and footer have their own screen (H8.54); both save the whole config,
 * so the other section is never lost. Every save is audited on the server.
 */
export function ShellEditor({ initial }: { initial: ShellConfig; section?: "chat" }) {
  const [draft, setDraft] = useState<ShellConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    const result = await saveShellAction(draft);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setDraft(result.config);
    setNotice({ kind: "info", text: "Saved. The new design picks this up within a minute." });
  }

  const { chat } = draft;
  return (
    <div className="grid gap-4">
      <section aria-labelledby="chat-edit">
          <h2 className="t-h3" id="chat-edit">Support chat</h2>
          <Text label="Panel title" value={chat.title} onChange={(v) => setDraft({ ...draft, chat: { ...chat, title: v } })} />
          <Text label="Welcome message" value={chat.welcome} multiline onChange={(v) => setDraft({ ...draft, chat: { ...chat, welcome: v } })} />
          <Text label="Guest hint (name and contact first)" value={chat.guestHint} multiline onChange={(v) => setDraft({ ...draft, chat: { ...chat, guestHint: v } })} />
          <Text label="WhatsApp link (wa.me/...)" value={chat.whatsapp} max={2048} onChange={(v) => setDraft({ ...draft, chat: { ...chat, whatsapp: v } })} />
          <Text label="Telegram link (t.me/...)" value={chat.telegram} max={2048} onChange={(v) => setDraft({ ...draft, chat: { ...chat, telegram: v } })} />
          <Text label="Call number (tel:+91...)" value={chat.phone} max={2048} onChange={(v) => setDraft({ ...draft, chat: { ...chat, phone: v } })} />
          <fieldset className="mb-4 grid gap-2">
            <legend className="t-small font-semibold">Topic buttons</legend>
            {chat.topics.map((topic, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-[10rem] flex-1 flex-col t-small">
                  Button text
                  <input
                    className="adm-input"
                    value={topic.label}
                    maxLength={200}
                    onChange={(e) => setDraft({ ...draft, chat: { ...chat, topics: chat.topics.map((t, i) => (i === index ? { ...t, label: e.target.value } : t)) } })}
                  />
                </label>
                <label className="flex flex-col t-small">
                  Sends to
                  <select
                    className="adm-input"
                    value={topic.topic}
                    onChange={(e) => setDraft({ ...draft, chat: { ...chat, topics: chat.topics.map((t, i) => (i === index ? { ...t, topic: e.target.value as (typeof SUPPORT_TOPICS)[number] } : t)) } })}
                  >
                    {SUPPORT_TOPICS.map((value) => <option key={value} value={value}>{TOPIC_LABELS[value]}</option>)}
                  </select>
                </label>
                <button type="button" className="adm-btn" aria-label={`Remove ${topic.label || "topic"}`} onClick={() => setDraft({ ...draft, chat: { ...chat, topics: chat.topics.filter((_, i) => i !== index) } })}>Remove</button>
              </div>
            ))}
            {chat.topics.length < 6 ? (
              <button type="button" className="adm-btn w-fit" onClick={() => setDraft({ ...draft, chat: { ...chat, topics: [...chat.topics, { label: "", topic: "something_else" }] } })}>Add a topic button</button>
            ) : null}
          </fieldset>
      </section>
      <div>
        <button type="button" className="adm-btn" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
      </div>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </div>
  );
}
