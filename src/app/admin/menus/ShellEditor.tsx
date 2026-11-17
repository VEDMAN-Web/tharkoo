"use client";

import { FocalPicker } from "@/components/admin/FocalPicker";
import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { SUPPORT_TOPICS, TOPIC_LABELS } from "@/server/support/constants";
import {
  CONTACT_KINDS,
  SHELL_ICONS,
  type ContactKind,
  type ShellConfig,
  type ShellContact,
  type ShellIcon,
  type ShellImage,
  type ShellLink,
} from "@/server/site-links/shell-config-rules";
import { saveShellAction } from "./actions";

type Banner = { kind: "error" | "info"; text: string };
type Section = "menus" | "chat";

const MAX_LINKS = 12;
const KIND_LABEL: Record<ContactKind, string> = { email: "Email", phone: "Phone", whatsapp: "WhatsApp", telegram: "Telegram", hours: "Hours", address: "Address" };

function move<T>(items: T[], index: number, step: number): T[] {
  const target = index + step;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** One editable row list: label, address, icon, show or hide, reorder, remove. */
function LinkRows({ title, items, onChange }: { title: string; items: ShellLink[]; onChange: (next: ShellLink[]) => void }) {
  const update = (index: number, patch: Partial<ShellLink>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className="mb-4 grid gap-2">
      <legend className="t-small font-semibold">{title}</legend>
      {items.map((item, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[10rem] flex-1 flex-col t-small">
            Text
            <input className="adm-input" value={item.label} maxLength={200} onChange={(e) => update(index, { label: e.target.value })} />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col t-small">
            Link
            <input className="adm-input" value={item.href} maxLength={2048} placeholder="/categories/" onChange={(e) => update(index, { href: e.target.value })} />
          </label>
          <label className="flex flex-col t-small">
            Icon
            <select className="adm-input" value={item.icon} onChange={(e) => update(index, { icon: e.target.value as ShellIcon })}>
              {SHELL_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 t-small">
            <input type="checkbox" checked={item.visible} onChange={(e) => update(index, { visible: e.target.checked })} />
            Show
          </label>
          <button type="button" className="adm-btn" aria-label={`Move ${item.label || "link"} up`} onClick={() => onChange(move(items, index, -1))}>Up</button>
          <button type="button" className="adm-btn" aria-label={`Move ${item.label || "link"} down`} onClick={() => onChange(move(items, index, 1))}>Down</button>
          <button type="button" className="adm-btn" aria-label={`Remove ${item.label || "link"}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
        </div>
      ))}
      {items.length < MAX_LINKS ? (
        <button type="button" className="adm-btn w-fit" onClick={() => onChange([...items, { label: "", href: "", visible: true, icon: "tag" }])}>Add a link</button>
      ) : null}
    </fieldset>
  );
}

function ContactRows({ items, onChange }: { items: ShellContact[]; onChange: (next: ShellContact[]) => void }) {
  const update = (index: number, patch: Partial<ShellContact>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className="mb-4 grid gap-2">
      <legend className="t-small font-semibold">Get in touch rows</legend>
      {items.map((item, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col t-small">
            Type
            <select className="adm-input" value={item.kind} onChange={(e) => update(index, { kind: e.target.value as ContactKind })}>
              {CONTACT_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
            </select>
          </label>
          <label className="flex min-w-[8rem] flex-1 flex-col t-small">
            Label
            <input className="adm-input" value={item.label} maxLength={200} onChange={(e) => update(index, { label: e.target.value })} />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col t-small">
            Value
            <input className="adm-input" value={item.value} maxLength={200} onChange={(e) => update(index, { value: e.target.value })} />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col t-small">
            Link (optional)
            <input className="adm-input" value={item.href} maxLength={2048} placeholder="mailto:hello@example.com" onChange={(e) => update(index, { href: e.target.value })} />
          </label>
          <button type="button" className="adm-btn" aria-label={`Remove ${item.label || "contact row"}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
        </div>
      ))}
      {items.length < 6 ? (
        <button type="button" className="adm-btn w-fit" onClick={() => onChange([...items, { kind: "email", label: "", value: "", href: "", visible: true }])}>Add a contact row</button>
      ) : null}
    </fieldset>
  );
}


/**
 * H7.4: category photos (cards on the home page) and the listing title band images for a category or a city.
 * Paste a site path (/uploads/...) or an https address. Empty fields show the built-in gradient.
 */
function ImageRows({ items, onChange }: { items: ShellImage[]; onChange: (next: ShellImage[]) => void }) {
  const update = (index: number, patch: Partial<ShellImage>) => onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="mb-4 grid gap-2">
      <legend className="t-small font-semibold">Photos and listing bands (category or city slug)</legend>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded border border-line p-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col t-small">
              For
              <select className="adm-input" value={item.scope} onChange={(e) => update(index, { scope: e.target.value as ShellImage["scope"] })}>
                <option value="category">Category</option>
                <option value="city">City</option>
              </select>
            </label>
            <label className="flex min-w-[8rem] flex-1 flex-col t-small">
              Slug
              <input className="adm-input" value={item.slug} maxLength={120} placeholder="dating" onChange={(e) => update(index, { slug: e.target.value })} />
            </label>
            <button type="button" className="adm-btn" aria-label={`Remove image row ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
          </div>
          <label className="flex flex-col t-small">
            Card photo (category only)
            <input className="adm-input" value={item.photo} maxLength={2048} onChange={(e) => update(index, { photo: e.target.value })} />
          </label>
          <label className="flex flex-col t-small">
            Band image, desktop
            <input className="adm-input" value={item.band} maxLength={2048} onChange={(e) => update(index, { band: e.target.value })} />
          </label>
          <label className="flex flex-col t-small">
            Band image, phone (optional)
            <input className="adm-input" value={item.bandPhone} maxLength={2048} onChange={(e) => update(index, { bandPhone: e.target.value })} />
          </label>
          {item.photo ? (
            <FocalPicker
              label="Card photo focus point"
              aspect="4 / 3"
              src={item.photo}
              x={item.focusX ?? 50}
              y={item.focusY ?? 18}
              onChange={(next) => update(index, { focusX: next.x, focusY: next.y })}
            />
          ) : null}
          {item.band ? (
            <FocalPicker
              label="Band focus point, desktop"
              aspect="1232 / 400"
              src={item.band}
              x={item.bandFocusX ?? 72}
              y={item.bandFocusY ?? 18}
              onChange={(next) => update(index, { bandFocusX: next.x, bandFocusY: next.y })}
            />
          ) : null}
          {item.bandPhone ? (
            <FocalPicker
              label="Band focus point, phone"
              aspect="358 / 260"
              src={item.bandPhone}
              x={item.bandPhoneFocusX ?? 50}
              y={item.bandPhoneFocusY ?? 12}
              onChange={(next) => update(index, { bandPhoneFocusX: next.x, bandPhoneFocusY: next.y })}
            />
          ) : null}
        </div>
      ))}
      {items.length < 40 ? (
        <button type="button" className="adm-btn w-fit" onClick={() => onChange([...items, { scope: "category", slug: "", photo: "", band: "", bandPhone: "" }])}>Add an image row</button>
      ) : null}
    </fieldset>
  );
}

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
 * H7.1: admin edits the header and footer ("menus") or the support chat ("chat"). Both save the whole config,
 * so the other section is never lost. Every save is audited on the server.
 */
export function ShellEditor({ initial, section }: { initial: ShellConfig; section: Section }) {
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

  const { header, footer, chat } = draft;
  return (
    <div className="grid gap-4">
      {section === "menus" ? (
        <>
          <section aria-labelledby="home-edit">
            <h2 className="t-h3" id="home-edit">Home page (New design)</h2>
            <p className="mb-4 t-small" data-tk="home-blocks-moved">
              The trust bar and the How it works steps are edited in the <Link href="/admin/page-builder/" className="text-accent">Page builder</Link> now. They show here as read-only text.
            </p>
            <ul className="mb-4 t-small" data-tk="home-blocks-readonly">
              {draft.home.trust.map((pill, index) => (
                <li key={`trust-${index}`}>Trust bar: {pill.label}</li>
              ))}
              {draft.home.steps.map((step, index) => (
                <li key={`step-${index}`}>Step {index + 1}: {step.title}</li>
              ))}
            </ul>
            <ImageRows items={draft.media.images} onChange={(next) => setDraft({ ...draft, media: { images: next } })} />
          </section>
          <section aria-labelledby="header-edit">
            <h2 className="t-h3" id="header-edit">Header</h2>
            <Text label="Log in button" value={header.loginLabel} onChange={(v) => setDraft({ ...draft, header: { ...header, loginLabel: v } })} />
            <Text label="Post your ad button" value={header.postLabel} onChange={(v) => setDraft({ ...draft, header: { ...header, postLabel: v } })} />
            <LinkRows title="Menu links" items={header.navLinks} onChange={(next) => setDraft({ ...draft, header: { ...header, navLinks: next } })} />
          </section>
          <section aria-labelledby="footer-edit">
            <h2 className="t-h3" id="footer-edit">Footer</h2>
            <Text label="About text" value={footer.about} max={400} multiline onChange={(v) => setDraft({ ...draft, footer: { ...footer, about: v } })} />
            <Text
              label="Trust pills (one per line)"
              value={footer.trust.join("\n")}
              multiline
              onChange={(v) => setDraft({ ...draft, footer: { ...footer, trust: v.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 6) } })}
            />
            <LinkRows title="Quick links" items={footer.quickLinks} onChange={(next) => setDraft({ ...draft, footer: { ...footer, quickLinks: next } })} />
            <LinkRows
              title="Top categories (leave empty to show the first six categories)"
              items={footer.topCategories}
              onChange={(next) => setDraft({ ...draft, footer: { ...footer, topCategories: next } })}
            />
            <ContactRows items={footer.contacts} onChange={(next) => setDraft({ ...draft, footer: { ...footer, contacts: next } })} />
            <LinkRows title="Legal pills" items={footer.legal} onChange={(next) => setDraft({ ...draft, footer: { ...footer, legal: next } })} />
            <LinkRows title="Social links" items={footer.socials} onChange={(next) => setDraft({ ...draft, footer: { ...footer, socials: next } })} />
            <Text label="Adults notice" value={footer.adultNotice} onChange={(v) => setDraft({ ...draft, footer: { ...footer, adultNotice: v } })} />
            <Text label="Copyright line" value={footer.copyright} onChange={(v) => setDraft({ ...draft, footer: { ...footer, copyright: v } })} />
          </section>
        </>
      ) : (
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
      )}
      <div>
        <button type="button" className="adm-btn" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
      </div>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </div>
  );
}
