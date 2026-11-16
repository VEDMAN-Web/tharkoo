"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import "@/styles/admin-kit.css";
import { Badge, type BadgeTone } from "./Badge";
import { Button } from "./Button";
import { DiffView } from "./DiffView";
import { Drawer } from "./Drawer";
import type { DiffRow } from "./kit-helpers";
import { Tabs } from "./Tabs";

export type HistoryEntry = {
  id: string;
  /** "v5" */
  version: string;
  title: string;
  meta: string;
  current?: boolean;
  badge?: { tone: BadgeTone; text: string };
  /** What restoring this entry would change on the record today. */
  changes?: DiffRow[];
  /** Entries that can never be undone or restored (payments, emails): shown with the reason, no select. */
  lockedReason?: string;
};

export type HistoryTab = { key: string; label: string; entries: HistoryEntry[] };

/**
 * The history drawer (mockup 03b): tabs (Versions, Decisions, Money), a list with the current entry marked, and for a chosen
 * older entry the field-level changes, a plain note, and a Restore button. Restore makes a new version; nothing is deleted.
 */
export function HistoryDrawer({
  open,
  title,
  subtitle,
  tabs,
  fieldLabels,
  onClose,
  onRestore,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  tabs: HistoryTab[];
  fieldLabels?: Record<string, string>;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const [chosenId, setChosenId] = useState("");
  const tab = tabs.find((item) => item.key === active) ?? tabs[0];
  const chosen = tab?.entries.find((entry) => entry.id === chosenId && !entry.current && !entry.lockedReason);

  return (
    <Drawer
      open={open}
      title={title}
      subtitle={subtitle}
      size="md"
      onClose={onClose}
      footer={
        chosen ? (
          <>
            <Button onClick={() => setChosenId("")}>Cancel</Button>
            <span className="adm-k-sp" />
            <Button kind="primary" icon={Undo2} onClick={() => onRestore(chosen)}>
              Restore {chosen.version}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="adm-k-hist" data-tk="history">
        <Tabs
          idPrefix="hist"
          label="History sections"
          items={tabs.map((item) => ({ key: item.key, label: item.label, count: item.entries.length }))}
          active={tab?.key ?? ""}
          onChange={(key) => {
            setActive(key);
            setChosenId("");
          }}
        />
        <ol className="adm-k-hlist" role="tabpanel" id={`hist-panel-${tab?.key}`} aria-labelledby={`hist-${tab?.key}`}>
          {(tab?.entries ?? []).map((entry) => (
            <li key={entry.id} data-current={entry.current ? "yes" : undefined} data-chosen={chosen?.id === entry.id ? "yes" : undefined}>
              <button type="button" className="adm-k-hrow" disabled={Boolean(entry.current || entry.lockedReason)} aria-pressed={chosen?.id === entry.id} onClick={() => setChosenId(entry.id)}>
                <span className="adm-k-hdot" aria-hidden="true" />
                <span className="adm-k-htext">
                  <span className="adm-k-hhead">
                    <strong>{entry.version}</strong>
                    {entry.current ? <span> now</span> : null}
                    {entry.badge ? <Badge tone={entry.badge.tone}>{entry.badge.text}</Badge> : null}
                  </span>
                  <span>{entry.title}</span>
                  <small>{entry.meta}</small>
                  {entry.lockedReason ? <small className="adm-k-hlock">{entry.lockedReason}</small> : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {chosen ? (
          <div className="adm-k-hdiff" data-tk="history-diff">
            <h3>Going back to {chosen.version} changes</h3>
            <DiffView rows={chosen.changes ?? []} labels={fieldLabels} />
            <p className="adm-k-note">Restore makes a new version with the {chosen.version} values. Nothing is deleted and the record stays as it is.</p>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
