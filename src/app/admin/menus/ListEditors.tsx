"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { buttonClass, Button } from "@/components/admin/ui/Button";
import { useDragRows } from "@/components/admin/layout-editor/useDragRows";
import { CONTACT_KINDS, SHELL_ICONS, type ContactKind, type ShellContact, type ShellIcon, type ShellLink } from "@/server/site-links/shell-config-rules";

const MAX_LINKS = 12;
const MAX_CONTACTS = 6;
const KIND_LABEL: Record<ContactKind, string> = { email: "Email", phone: "Phone", whatsapp: "WhatsApp", telegram: "Telegram", hours: "Hours", address: "Address" };

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function IconButton({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof X; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${buttonClass({ kind: "quiet", size: "sm", icon: true })} adm-menu-icon`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon aria-hidden="true" focusable="false" size={16} />
    </button>
  );
}

/**
 * One list of links as compact rows: a drag handle, Text, Link, Icon, Show, and small quiet buttons to move a row up or down and to remove it.
 * The column names are written once above the rows (a phone shows the names inside the fields instead).
 */
export function LinkList({ name, items, onChange, emptyText }: { name: string; items: ShellLink[]; onChange: (next: ShellLink[]) => void; emptyText?: string }) {
  const drag = useDragRows((from, to) => onChange(move(items, from, to)));
  const update = (index: number, patch: Partial<ShellLink>) => onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  return (
    <div className="adm-menu-list" data-tk="link-list" data-list={name}>
      {items.length > 0 ? (
        <div className="adm-menu-head adm-menu-linkgrid" aria-hidden="true">
          <span />
          <span>Text</span>
          <span>Link</span>
          <span>Icon</span>
          <span>Show</span>
          <span />
        </div>
      ) : (
        <p className="adm-k-help" data-tk="list-empty">{emptyText ?? "No links yet."}</p>
      )}
      <ul className="adm-menu-rows">
        {items.map((item, index) => {
          const label = item.label.trim() || `link ${index + 1}`;
          return (
            <li key={index} className={`adm-menu-row adm-menu-linkgrid${drag.over === index ? " is-over" : ""}${item.visible ? "" : " is-off"}`} data-drag-row data-tk="link-row" {...drag.rowProps(index)}>
              <span className="adm-menu-grip" aria-hidden="true" title="Drag to reorder" {...drag.handleProps(index)}>
                <GripVertical size={16} />
              </span>
              <input className="adm-k-input" aria-label={`Text of ${label}`} placeholder="Text" value={item.label} maxLength={200} onChange={(event) => update(index, { label: event.target.value })} />
              <input className="adm-k-input" aria-label={`Link of ${label}`} placeholder="/categories/" value={item.href} maxLength={2048} onChange={(event) => update(index, { href: event.target.value })} />
              <select className="adm-k-input" aria-label={`Icon of ${label}`} value={item.icon} onChange={(event) => update(index, { icon: event.target.value as ShellIcon })}>
                {SHELL_ICONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <label className="adm-menu-show">
                <input type="checkbox" checked={item.visible} aria-label={`Show ${label}`} onChange={(event) => update(index, { visible: event.target.checked })} />
                <span>Show</span>
              </label>
              <span className="adm-menu-tools">
                <IconButton label={`Move ${label} up`} icon={ArrowUp} disabled={index === 0} onClick={() => onChange(move(items, index, index - 1))} />
                <IconButton label={`Move ${label} down`} icon={ArrowDown} disabled={index === items.length - 1} onClick={() => onChange(move(items, index, index + 1))} />
                <IconButton label={`Remove ${label}`} icon={X} onClick={() => onChange(items.filter((_, at) => at !== index))} />
              </span>
            </li>
          );
        })}
      </ul>
      {items.length < MAX_LINKS ? (
        <div>
          <Button kind="quiet" size="sm" icon={Plus} onClick={() => onChange([...items, { label: "", href: "", visible: true, icon: "tag" }])}>Add a link</Button>
        </div>
      ) : null}
    </div>
  );
}

/** The Get in touch rows: Type, Label, Value, Link, with a quiet Remove. */
export function ContactList({ items, onChange }: { items: ShellContact[]; onChange: (next: ShellContact[]) => void }) {
  const update = (index: number, patch: Partial<ShellContact>) => onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  return (
    <div className="adm-menu-list" data-tk="contact-list">
      {items.length > 0 ? (
        <div className="adm-menu-head adm-menu-contactgrid" aria-hidden="true">
          <span>Type</span>
          <span>Label</span>
          <span>Value</span>
          <span>Link (optional)</span>
          <span />
        </div>
      ) : (
        <p className="adm-k-help">No contact rows yet.</p>
      )}
      <ul className="adm-menu-rows">
        {items.map((item, index) => {
          const label = item.label.trim() || KIND_LABEL[item.kind];
          return (
            <li key={index} className="adm-menu-row adm-menu-contactgrid" data-tk="contact-row">
              <select className="adm-k-input" aria-label={`Type of ${label}`} value={item.kind} onChange={(event) => update(index, { kind: event.target.value as ContactKind })}>
                {CONTACT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
                ))}
              </select>
              <input className="adm-k-input" aria-label={`Label of ${label}`} placeholder="Label" value={item.label} maxLength={200} onChange={(event) => update(index, { label: event.target.value })} />
              <input className="adm-k-input" aria-label={`Value of ${label}`} placeholder="Value" value={item.value} maxLength={200} onChange={(event) => update(index, { value: event.target.value })} />
              <input className="adm-k-input" aria-label={`Link of ${label}`} placeholder="mailto:hello@example.com" value={item.href} maxLength={2048} onChange={(event) => update(index, { href: event.target.value })} />
              <span className="adm-menu-tools">
                <IconButton label={`Remove ${label}`} icon={X} onClick={() => onChange(items.filter((_, at) => at !== index))} />
              </span>
            </li>
          );
        })}
      </ul>
      {items.length < MAX_CONTACTS ? (
        <div>
          <Button kind="quiet" size="sm" icon={Plus} onClick={() => onChange([...items, { kind: "email", label: "", value: "", href: "", visible: true }])}>Add a contact row</Button>
        </div>
      ) : null}
    </div>
  );
}
