"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Notice } from "@/components/admin/ui";
import { api, friendlyError, type ApiError } from "@/lib/ui/api";

export type VideoTourCategory = {
  id: string;
  name: string;
  slug: string;
  kind: string | null;
  videoTourEnabled: boolean;
  videoTourCoins: number;
};

type Draft = { enabled: boolean; coins: string };
type Banner = { kind: "error" | "info"; text: string };

const COIN_MIN = 1;
const COIN_MAX = 100;
const LOCK_PEOPLE = "Not available for people listings";
const LOCK_NO_KIND = "Set the category kind first";

/** The first field message from the server, or the generic text. */
function errorText(error: ApiError) {
  const fields = Object.values(error.fields ?? error.details ?? {}).flat();
  return fields[0] || friendlyError(error);
}

function isCoinPrice(value: string) {
  const number = Number(value);
  return /^\d+$/.test(value.trim()) && number >= COIN_MIN && number <= COIN_MAX;
}

/** A people category can never have live tours; a category with no kind cannot be switched on until it has one. */
function lockReason(kind: string | null) {
  if (kind === "people") return LOCK_PEOPLE;
  if (!kind) return LOCK_NO_KIND;
  return "";
}

export function VideoTourSettings() {
  const [rows, setRows] = useState<VideoTourCategory[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<Banner | null>(null);

  useEffect(() => {
    let live = true;
    api<VideoTourCategory[]>("/api/tours/admin/categories").then((res) => {
      if (!live) return;
      if (res.ok) setRows(res.data);
      else setNotice({ kind: "error", text: errorText(res.error) });
    });
    return () => {
      live = false;
    };
  }, []);

  function draftFor(row: VideoTourCategory): Draft {
    return drafts[row.id] ?? { enabled: row.videoTourEnabled, coins: String(row.videoTourCoins) };
  }

  function patchDraft(row: VideoTourCategory, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [row.id]: { ...draftFor(row), ...patch } }));
  }

  async function save(row: VideoTourCategory) {
    const draft = draftFor(row);
    setBusyId(row.id);
    setNotice(null);
    const res = await api<VideoTourCategory>("/api/tours/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ categoryId: row.id, enabled: draft.enabled, coins: Number(draft.coins) }),
    });
    setBusyId("");
    if (!res.ok) return setNotice({ kind: "error", text: `${row.name}: ${errorText(res.error)}` });
    const saved = res.data;
    setRows((prev) =>
      (prev ?? []).map((item) =>
        item.id === row.id ? { ...item, kind: saved.kind, videoTourEnabled: saved.videoTourEnabled, videoTourCoins: saved.videoTourCoins } : item,
      ),
    );
    setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== row.id)));
    setNotice({ kind: "info", text: `${row.name} saved.` });
  }

  if (!rows) {
    return notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : <p className="t-small text-muted">Loading categories…</p>;
  }

  return (
    <>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
      {rows.length === 0 ? <p className="t-small text-muted">No categories yet.</p> : null}
      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Live video tours</th>
                <th scope="col">Coin price</th>
                <th scope="col">
                  <span className="sr-only">Save</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = draftFor(row);
                const reason = lockReason(row.kind);
                const locked = reason !== "";
                const coinsValid = isCoinPrice(draft.coins);
                const dirty = draft.enabled !== row.videoTourEnabled || draft.coins !== String(row.videoTourCoins);
                const on = !locked && draft.enabled;
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td data-label="Category">
                      <strong>{row.name}</strong>
                      <br />
                      <span className="t-small text-muted">
                        {row.slug} · {row.kind ? `kind: ${row.kind}` : "kind not set"}
                      </span>
                    </td>
                    <td data-label="Live video tours">
                      <span className="adm-toggle">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`Live video tours for ${row.name}`}
                          aria-describedby={locked ? `tour-lock-${row.id}` : undefined}
                          disabled={locked || busy}
                          className="adm-toggle-box"
                          style={{ opacity: locked ? 0.45 : 1 }}
                          onClick={() => patchDraft(row, { enabled: !draft.enabled })}
                        />
                        <span aria-hidden>{on ? "On" : "Off"}</span>
                      </span>
                      {locked ? (
                        <span id={`tour-lock-${row.id}`} className="adm-field-help" style={{ display: "block" }}>
                          {reason}
                          {reason === LOCK_NO_KIND ? (
                            <>
                              {" "}
                              <Link href="/admin/categories/">Open categories</Link>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Coin price">
                      <input
                        type="number"
                        className="adm-input"
                        inputMode="numeric"
                        min={COIN_MIN}
                        max={COIN_MAX}
                        step={1}
                        aria-label={`Coin price for ${row.name}`}
                        aria-invalid={!coinsValid}
                        aria-describedby={`coins-note-${row.id}`}
                        value={draft.coins}
                        disabled={busy}
                        onChange={(event) => patchDraft(row, { coins: event.target.value })}
                        style={{ width: 96 }}
                      />
                      <span id={`coins-note-${row.id}`} className={coinsValid ? "adm-field-help" : "adm-field-error"} style={{ display: "block" }}>
                        {coinsValid ? `${COIN_MIN} to ${COIN_MAX} coins` : `Enter a whole number from ${COIN_MIN} to ${COIN_MAX}`}
                      </span>
                    </td>
                    <td data-label="Save">
                      <button type="button" className="adm-btn" disabled={!dirty || !coinsValid || busy} onClick={() => save(row)}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
