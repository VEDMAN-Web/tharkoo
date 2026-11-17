"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bold, HelpCircle, Image as ImageIcon, Italic, Link2, List, Megaphone, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/admin/ui/ImagePicker";
import type { RichNode } from "@/lib/content/rich";
import { nextKey, type KeyedNode } from "./data";
import { wrapLink, wrapMark } from "./links";

export type MediaMap = Record<string, { src: string; alt: string }>;

const ALT_LIMIT = 125;
const TYPE_LABEL: Record<RichNode["t"], string> = { p: "Paragraph", quote: "Quote", h2: "Heading", h3: "Sub-heading", ul: "List", ol: "Numbered list", img: "Picture", faq: "Questions", ads: "Ads page card" };

type Focus = { key: string; item: number };
type TextNode = Extract<RichNode, { t: "p" | "quote" | "h2" | "h3" }>;

function fresh(t: "p" | "h2" | "h3" | "ul" | "img" | "faq" | "ads"): RichNode {
  if (t === "ul") return { t: "ul", items: [""] };
  if (t === "img") return { t: "img", mediaId: "", alt: "" };
  if (t === "faq") return { t: "faq", items: [{ q: "", a: "" }] };
  if (t === "ads") return { t: "ads", path: "/", label: "" };
  return { t, text: "" };
}

function ToolButton({ label, icon, text, onRun }: { label: string; icon?: React.ReactNode; text?: string; onRun: () => void }) {
  return (
    <button type="button" className="adm-k-btn adm-k-btn-sm adm-st-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onRun}>
      {icon}
      {text ? <span>{text}</span> : null}
    </button>
  );
}

/**
 * The text editor of the content studio (H8.31): a list of blocks. A toolbar adds headings, lists, pictures, questions and an ads card,
 * and puts bold, italic and links around the selected words. Every block moves up and down with buttons, so no dragging is needed.
 * It edits data (the same shape the site draws); nothing here makes HTML.
 */
export function BodyEditor({ value, onChange, media, onMedia }: { value: KeyedNode[]; onChange: (next: KeyedNode[]) => void; media: MediaMap; onMedia: (id: string, picture: { src: string; alt: string }) => void }) {
  const fields = useRef(new Map<string, HTMLTextAreaElement | HTMLInputElement>());
  const [focus, setFocus] = useState<Focus | null>(null);
  const [linking, setLinking] = useState<{ start: number; end: number; href: string } | null>(null);

  const replace = (key: string, node: RichNode) => onChange(value.map((item) => (item.key === key ? { key, node } : item)));
  const insert = (node: RichNode) => {
    const at = focus ? value.findIndex((item) => item.key === focus.key) : -1;
    const next = [...value];
    next.splice(at >= 0 ? at + 1 : value.length, 0, { key: nextKey(), node });
    onChange(next);
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  function textOf(key: string): string | null {
    const node = value.find((item) => item.key === key)?.node;
    if (!node) return null;
    if (node.t === "p" || node.t === "quote" || node.t === "h2" || node.t === "h3") return node.text;
    return null;
  }

  function setText(key: string, text: string) {
    const node = value.find((item) => item.key === key)?.node as TextNode | undefined;
    if (node) replace(key, { ...node, text });
  }

  function currentField() {
    if (!focus) return null;
    const el = fields.current.get(`${focus.key}:${focus.item}`);
    return el && textOf(focus.key) !== null ? (el as HTMLTextAreaElement) : null;
  }

  function mark(kind: "**" | "*") {
    const el = currentField();
    if (!el || !focus) return;
    const done = wrapMark(el.value, el.selectionStart, el.selectionEnd, kind);
    setText(focus.key, done.value);
    const key = `${focus.key}:${focus.item}`;
    requestAnimationFrame(() => {
      const target = fields.current.get(key) as HTMLTextAreaElement | undefined;
      target?.focus();
      target?.setSelectionRange(done.start, done.end);
    });
  }

  function startLink() {
    const el = currentField();
    if (!el) return;
    setLinking({ start: el.selectionStart, end: el.selectionEnd, href: "/" });
  }

  function applyLink() {
    const el = currentField();
    if (!el || !focus || !linking) return;
    const done = wrapLink(el.value, linking.start, linking.end, linking.href.trim() || "/");
    setText(focus.key, done.value);
    setLinking(null);
  }

  const bind = (id: string) => (el: HTMLTextAreaElement | HTMLInputElement | null) => {
    if (el) fields.current.set(id, el);
    else fields.current.delete(id);
  };

  return (
    <div className="adm-st-body" data-tk="body-editor">
      <div className="adm-st-toolbar" role="toolbar" aria-label="Text tools">
        <ToolButton label="Bold" icon={<Bold aria-hidden="true" size={16} />} onRun={() => mark("**")} />
        <ToolButton label="Italic" icon={<Italic aria-hidden="true" size={16} />} onRun={() => mark("*")} />
        <ToolButton label="Heading" text="H2" onRun={() => insert(fresh("h2"))} />
        <ToolButton label="Sub-heading" text="H3" onRun={() => insert(fresh("h3"))} />
        <ToolButton label="Paragraph" text="Text" onRun={() => insert(fresh("p"))} />
        <ToolButton label="List" icon={<List aria-hidden="true" size={16} />} text="List" onRun={() => insert(fresh("ul"))} />
        <ToolButton label="Link" icon={<Link2 aria-hidden="true" size={16} />} onRun={startLink} />
        <ToolButton label="Picture" icon={<ImageIcon aria-hidden="true" size={16} />} onRun={() => insert(fresh("img"))} />
        <ToolButton label="Questions and answers" icon={<HelpCircle aria-hidden="true" size={16} />} text="FAQ" onRun={() => insert(fresh("faq"))} />
        <ToolButton label="Ads page card" icon={<Megaphone aria-hidden="true" size={16} />} text="Ads page" onRun={() => insert(fresh("ads"))} />
      </div>
      {linking ? (
        <div className="adm-st-linkbar" data-tk="link-bar">
          <label htmlFor="st-link-href" className="adm-k-label">Link address</label>
          <input id="st-link-href" className="adm-k-input" value={linking.href} onChange={(event) => setLinking({ ...linking, href: event.target.value })} placeholder="/property/surat/ or https://..." autoFocus />
          <button type="button" className="adm-k-btn adm-k-btn-primary" onClick={applyLink}>Add link</button>
          <button type="button" className="adm-k-btn adm-k-btn-quiet" onClick={() => setLinking(null)}>Cancel</button>
        </div>
      ) : null}
      {value.length === 0 ? <p className="adm-k-help adm-st-empty" data-tk="body-empty">Nothing here yet. Use Text, H2, List or Picture above to start.</p> : null}
      <ol className="adm-st-nodes">
        {value.map(({ key, node }, index) => (
          <li key={key} className="adm-st-node" data-tk="body-node" data-type={node.t}>
            <div className="adm-st-nodehead">
              <span className="adm-st-nodetype">{TYPE_LABEL[node.t]}</span>
              <span className="adm-st-nodectl">
                <button type="button" className="adm-k-btn adm-k-btn-sm adm-k-btn-icon" aria-label={`Move ${TYPE_LABEL[node.t].toLowerCase()} ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" size={16} /></button>
                <button type="button" className="adm-k-btn adm-k-btn-sm adm-k-btn-icon" aria-label={`Move ${TYPE_LABEL[node.t].toLowerCase()} ${index + 1} down`} title="Move down" disabled={index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" size={16} /></button>
                <button type="button" className="adm-k-btn adm-k-btn-sm adm-k-btn-icon" aria-label={`Remove ${TYPE_LABEL[node.t].toLowerCase()} ${index + 1}`} title="Remove" onClick={() => onChange(value.filter((item) => item.key !== key))}><Trash2 aria-hidden="true" size={16} /></button>
              </span>
            </div>
            {node.t === "p" || node.t === "quote" || node.t === "h2" || node.t === "h3" ? (
              <textarea
                ref={bind(`${key}:0`)}
                className={`adm-k-input adm-st-text adm-st-${node.t}`}
                aria-label={`${TYPE_LABEL[node.t]} ${index + 1}`}
                value={node.text}
                rows={node.t === "p" || node.t === "quote" ? 3 : 1}
                maxLength={node.t === "h2" || node.t === "h3" ? 300 : 5000}
                onFocus={() => setFocus({ key, item: 0 })}
                onChange={(event) => replace(key, { ...node, text: event.target.value })}
              />
            ) : null}
            {node.t === "ul" || node.t === "ol" ? (
              <>
                <textarea
                  ref={bind(`${key}:0`)}
                  className="adm-k-input adm-st-text"
                  aria-label={`${TYPE_LABEL[node.t]} ${index + 1}, one item on each line`}
                  value={node.items.join("\n")}
                  rows={Math.max(3, node.items.length + 1)}
                  onFocus={() => setFocus({ key, item: 0 })}
                  onChange={(event) => replace(key, { ...node, items: event.target.value.split("\n") })}
                />
                <p className="adm-k-help">One item on each line.</p>
                <label className="adm-st-inline"><input type="checkbox" className="adm-k-check" checked={node.t === "ol"} onChange={(event) => replace(key, { t: event.target.checked ? "ol" : "ul", items: node.items })} /> Number the items</label>
              </>
            ) : null}
            {node.t === "img" ? (
              <div className="adm-st-img">
                {node.mediaId && media[node.mediaId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media[node.mediaId].src} alt="" className="adm-st-thumb" />
                ) : null}
                <ImagePicker
                  label="Picture from the media library"
                  value={node.mediaId && media[node.mediaId] ? { assetId: node.mediaId, src: media[node.mediaId].src, alt: media[node.mediaId].alt, width: 0, height: 0 } : null}
                  onChange={(picked) => {
                    if (!picked) return replace(key, { ...node, mediaId: "" });
                    onMedia(picked.assetId, { src: picked.src, alt: picked.alt });
                    replace(key, { ...node, mediaId: picked.assetId, alt: node.alt || picked.alt.slice(0, ALT_LIMIT) });
                  }}
                />
                <div className="adm-k-field">
                  <label className="adm-k-label adm-k-lab" htmlFor={`alt-${key}`}>
                    <span>Picture description (alt text)<span className="adm-k-req" aria-hidden="true"> *</span></span>
                    <span className="adm-k-count">{node.alt.length} / {ALT_LIMIT}</span>
                  </label>
                  <input id={`alt-${key}`} className="adm-k-input" value={node.alt} maxLength={ALT_LIMIT + 40} required onChange={(event) => replace(key, { ...node, alt: event.target.value })} />
                </div>
                <div className="adm-k-field">
                  <label className="adm-k-label" htmlFor={`cap-${key}`}>Caption (optional)</label>
                  <input id={`cap-${key}`} className="adm-k-input" value={node.caption ?? ""} maxLength={300} onChange={(event) => replace(key, { ...node, caption: event.target.value || undefined })} />
                </div>
              </div>
            ) : null}
            {node.t === "faq" ? (
              <div className="adm-st-faq">
                {node.items.map((item, at) => (
                  <div key={at} className="adm-st-faqitem">
                    <label className="adm-k-label" htmlFor={`q-${key}-${at}`}>Question {at + 1}</label>
                    <input id={`q-${key}-${at}`} className="adm-k-input" value={item.q} maxLength={300} onChange={(event) => replace(key, { ...node, items: node.items.map((entry, i) => (i === at ? { ...entry, q: event.target.value } : entry)) })} />
                    <label className="adm-k-label" htmlFor={`a-${key}-${at}`}>Answer {at + 1}</label>
                    <textarea id={`a-${key}-${at}`} className="adm-k-input adm-st-text" rows={2} maxLength={2000} value={item.a} onChange={(event) => replace(key, { ...node, items: node.items.map((entry, i) => (i === at ? { ...entry, a: event.target.value } : entry)) })} />
                    {node.items.length > 1 ? <button type="button" className="adm-k-btn adm-k-btn-sm" onClick={() => replace(key, { ...node, items: node.items.filter((_, i) => i !== at) })}>Remove question {at + 1}</button> : null}
                  </div>
                ))}
                <button type="button" className="adm-k-btn adm-k-btn-sm" onClick={() => replace(key, { ...node, items: [...node.items, { q: "", a: "" }] })}>Add a question</button>
              </div>
            ) : null}
            {node.t === "ads" ? (
              <div className="adm-st-ads">
                <div className="adm-k-field">
                  <label className="adm-k-label" htmlFor={`ap-${key}`}>Page to link to</label>
                  <input id={`ap-${key}`} className="adm-k-input" value={node.path} onChange={(event) => replace(key, { ...node, path: event.target.value })} placeholder="/property/surat/" />
                  <p className="adm-k-help">A page of this site, starting with a slash.</p>
                </div>
                <div className="adm-k-field">
                  <label className="adm-k-label" htmlFor={`al-${key}`}>Button words (optional)</label>
                  <input id={`al-${key}`} className="adm-k-input" value={node.label ?? ""} maxLength={120} onChange={(event) => replace(key, { ...node, label: event.target.value || undefined })} />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
