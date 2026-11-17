"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button, Notice, PageHeader, TextField, ToastProvider, useToast } from "@/components/admin/ui";
import { TEXT_MAX } from "@/lib/ui/text";
import type { TextArea, TextRow } from "@/lib/ui/text-labels";
import { resetUiTextAction, saveUiTextAction, undoUiTextAction } from "./actions";
import "./ui-text.css";

type Values = Record<string, string>;
type Group = { area: TextArea; rows: TextRow[] };

function Screen({ groups, defaults, initial, tabs }: { groups: Group[]; defaults: Values; initial: Values; tabs: React.ReactNode }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Values>(() => ({ ...defaults, ...initial }));
  const [draft, setDraft] = useState<Values>(saved);
  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState(groups[0]?.area.id ?? "");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<{ key?: string; text: string } | null>(null);

  const dirtyKeys = useMemo(() => Object.keys(draft).filter((key) => draft[key] !== saved[key]), [draft, saved]);
  const needle = query.trim().toLowerCase();
  const matches = (row: TextRow) => !needle || row.key.toLowerCase().includes(needle) || row.label.toLowerCase().includes(needle) || row.where.toLowerCase().includes(needle) || draft[row.key].toLowerCase().includes(needle) || defaults[row.key].toLowerCase().includes(needle);
  const shown = needle ? groups.map((group) => ({ ...group, rows: group.rows.filter(matches) })).filter((group) => group.rows.length > 0) : groups.filter((group) => group.area.id === areaId);
  const changedIn = (group: Group) => group.rows.filter((row) => draft[row.key] !== defaults[row.key]).length;

  function undo(eventIds: string[], was: Values) {
    startTransition(async () => {
      const result = await undoUiTextAction(eventIds);
      toast.show({ kind: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        setSaved((current) => ({ ...current, ...was }));
        setDraft((current) => ({ ...current, ...was }));
      }
    });
  }

  function save() {
    setError(null);
    const was = Object.fromEntries(dirtyKeys.map((key) => [key, saved[key]]));
    startTransition(async () => {
      const result = await saveUiTextAction(dirtyKeys.map((key) => ({ key, value: draft[key] })));
      if (!result.ok) {
        setError({ key: result.key, text: result.error });
        toast.show({ kind: "error", message: result.error });
        return;
      }
      const next = { ...saved };
      for (const item of result.saved) next[item.key] = item.value;
      setSaved(next);
      setDraft((current) => ({ ...current, ...Object.fromEntries(result.saved.map((item) => [item.key, item.value])) }));
      const message = `Saved ${result.saved.length} text${result.saved.length === 1 ? "" : "s"}.`;
      toast.show(result.eventIds.length ? { kind: "undo", message, onUndo: () => undo(result.eventIds, was) } : { kind: "success", message });
    });
  }

  function reset(key: string) {
    setError(null);
    startTransition(async () => {
      const result = await resetUiTextAction(key);
      if (!result.ok) {
        setError({ key: result.key, text: result.error });
        return;
      }
      setSaved((current) => ({ ...current, [key]: defaults[key] }));
      setDraft((current) => ({ ...current, [key]: defaults[key] }));
      toast.show({ kind: "success", message: "Back to the default text." });
    });
  }

  return (
    <div className="adm-k adm-ut" data-tk="site-text">
      <PageHeader crumbs={[{ label: "Website" }, { label: "Menus & site text" }]} title="Site text" purpose="Change the words of the site: buttons, labels and short messages. Words in curly brackets, like {count}, are filled in by the site: keep them." />
      {tabs}
      <div className="adm-ut-bar">
        <label className="adm-k-search adm-ut-search">
          <span className="adm-k-sr">Search the site text</span>
          <Search aria-hidden="true" focusable="false" />
          <input type="search" value={query} placeholder="Search words, names or places" onChange={(event) => setQuery(event.target.value)} />
        </label>
        {!needle ? (
          <div className="adm-ut-areas" role="tablist" aria-label="Areas of the site">
            {groups.map((group) => (
              <button key={group.area.id} type="button" role="tab" aria-selected={group.area.id === areaId} className="adm-ut-area" onClick={() => setAreaId(group.area.id)}>
                {group.area.label}
                {changedIn(group) ? <span className="adm-ut-badge" title="Words changed from the default">{changedIn(group)}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error && !error.key ? <Notice kind="error">{error.text}</Notice> : null}
      {shown.length === 0 ? (
        <div className="adm-card adm-ut-empty" data-tk="site-text-empty">
          <h2>{`No text matches "${query}"`}</h2>
          <p>Try a word from the text, or the name of the place on the site.</p>
        </div>
      ) : null}
      {shown.map((group) => (
        <section key={group.area.id} className="adm-card" aria-labelledby={`ut-${group.area.id}`} data-area={group.area.id}>
          <h2 id={`ut-${group.area.id}`} className="adm-ut-h">{group.area.label}</h2>
          <p className="adm-ut-where">{group.area.where}</p>
          <div className="adm-ut-rows">
            {group.rows.map((row) => (
              <div key={row.key} className="adm-ut-row" data-tk="text-row">
                <TextField
                  label={row.label}
                  value={draft[row.key]}
                  max={TEXT_MAX}
                  onChange={(next) => setDraft((current) => ({ ...current, [row.key]: next }))}
                  error={error?.key === row.key ? error.text : undefined}
                  help={`${row.where}. ${draft[row.key] === defaults[row.key] ? "This is the standard text." : `Standard text: ${defaults[row.key]}`}`}
                />
                <Button kind="quiet" size="sm" disabled={busy || (draft[row.key] === defaults[row.key] && saved[row.key] === defaults[row.key])} onClick={() => reset(row.key)}>
                  Back to standard text
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="adm-k-savebar adm-ut-save" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirtyKeys.length ? "yes" : "no"}>
        <span className={`adm-k-savedot${dirtyKeys.length ? " is-dirty" : ""}`} aria-hidden="true" />
        <span className="adm-k-savetext" aria-live="polite">{dirtyKeys.length ? <strong>{dirtyKeys.length === 1 ? "1 unsaved change" : `${dirtyKeys.length} unsaved changes`}</strong> : <span>All changes saved</span>}</span>
        <span className="adm-k-sp" />
        <Button kind="quiet" disabled={!dirtyKeys.length || busy} onClick={() => { setDraft(saved); setError(null); }}>Discard</Button>
        <Button kind="primary" busy={busy} disabled={!dirtyKeys.length} onClick={save}>Save changes</Button>
      </div>
    </div>
  );
}

export function UiTextEditor(props: { groups: Group[]; defaults: Values; initial: Values; tabs: React.ReactNode }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
