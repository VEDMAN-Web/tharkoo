"use client";

import { useMemo, useState, useTransition } from "react";
import { Notice, SaveBar, TextField } from "@/components/admin/ui";
import { TEXT_GROUPS, TEXT_MAX } from "@/lib/ui/text";
import { resetUiTextAction, saveUiTextAction } from "./actions";

type Values = Record<string, string>;

export function UiTextEditor({ defaults, initial }: { defaults: Values; initial: Values }) {
  const [saved, setSaved] = useState<Values>(() => ({ ...defaults, ...initial }));
  const [draft, setDraft] = useState<Values>(saved);
  const [query, setQuery] = useState("");
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<{ key?: string; text: string } | null>(null);

  const dirtyKeys = useMemo(() => Object.keys(draft).filter((key) => draft[key] !== saved[key]), [draft, saved]);
  const needle = query.trim().toLowerCase();
  const visible = (key: string) => !needle || key.toLowerCase().includes(needle) || draft[key].toLowerCase().includes(needle) || defaults[key].toLowerCase().includes(needle);

  function save() {
    setError(null);
    setMessage("");
    startTransition(async () => {
      const result = await saveUiTextAction(dirtyKeys.map((key) => ({ key, value: draft[key] })));
      if (!result.ok) {
        setError({ key: result.key, text: result.error });
        return;
      }
      const next = { ...saved };
      for (const item of result.saved) next[item.key] = item.value;
      setSaved(next);
      setDraft((current) => ({ ...current, ...Object.fromEntries(result.saved.map((item) => [item.key, item.value])) }));
      setMessage(`Saved ${result.saved.length} text${result.saved.length === 1 ? "" : "s"}.`);
    });
  }

  function reset(key: string) {
    setError(null);
    setMessage("");
    startTransition(async () => {
      const result = await resetUiTextAction(key);
      if (!result.ok) {
        setError({ key: result.key, text: result.error });
        return;
      }
      setSaved((current) => ({ ...current, [key]: defaults[key] }));
      setDraft((current) => ({ ...current, [key]: defaults[key] }));
      setMessage("Back to the default text.");
    });
  }

  return (
    <div className="adm-stack" style={{ paddingBottom: 72 }}>
      <input
        type="search"
        className="adm-input"
        placeholder="Search text or key"
        aria-label="Search text or key"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ maxWidth: 420 }}
      />
      {error && !error.key ? <Notice kind="error">{error.text}</Notice> : null}
      {TEXT_GROUPS.map((group) => {
        const keys = Object.keys(defaults).filter((key) => key.startsWith(group.prefix) && visible(key));
        if (!keys.length) return null;
        return (
          <section key={group.id} className="adm-card" aria-labelledby={`g-${group.id}`}>
            <h2 id={`g-${group.id}`} className="adm-title" style={{ marginBottom: 12 }}>
              {group.label}
            </h2>
            <div className="adm-stack">
              {keys.map((key) => (
                <div key={key} style={{ display: "grid", gap: 4 }}>
                  <TextField
                    label={key}
                    value={draft[key]}
                    max={TEXT_MAX}
                    onChange={(next) => setDraft((current) => ({ ...current, [key]: next }))}
                    error={error?.key === key ? error.text : undefined}
                    help={draft[key] === defaults[key] ? "Default text" : `Default: ${defaults[key]}`}
                  />
                  <div>
                    <button type="button" className="adm-btn adm-btn-quiet" disabled={busy || (draft[key] === defaults[key] && saved[key] === defaults[key])} onClick={() => reset(key)}>
                      Reset to default
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <SaveBar dirty={dirtyKeys.length > 0} busy={busy} onPublish={dirtyKeys.length ? save : undefined} message={message || undefined} />
    </div>
  );
}
