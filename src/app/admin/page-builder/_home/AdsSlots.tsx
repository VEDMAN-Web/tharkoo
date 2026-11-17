"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveHomeSelectionAction, searchHomeAdsAction } from "@/app/admin/ads/home-actions";
import { Badge } from "@/components/admin/ui/Badge";
import { Button, buttonClass } from "@/components/admin/ui/Button";
import { Drawer } from "@/components/admin/ui/Drawer";
import { MoveButtons } from "@/components/admin/ui/MoveButtons";
import { useToast } from "@/components/admin/ui/Toast";
import type { HomeSelectionRow } from "@/server/listings/home-selection";

export const SLOT_COUNT = 8;

type Props = { slots: HomeSelectionRow[]; onSlots: (next: HomeSelectionRow[]) => void };

function payload(previous: readonly HomeSelectionRow[], next: readonly HomeSelectionRow[]) {
  const kept = new Set(next.map((row) => row.id));
  return [
    ...next.map((row, index) => ({ listingId: row.id, show: true, order: index + 1 })),
    ...previous.filter((row) => !kept.has(row.id)).map((row) => ({ listingId: row.id, show: false, order: row.order })),
  ];
}

function Thumb({ row }: { row: HomeSelectionRow }) {
  // eslint-disable-next-line @next/next/no-img-element
  return row.thumb ? <img className="adm-pb-thumb" src={row.thumb} alt="" width={48} height={36} /> : <span className="adm-pb-thumb" aria-hidden="true" />;
}

function kindBadge(row: HomeSelectionRow) {
  if (row.status && row.status !== "active") return <Badge tone="warn">Not live</Badge>;
  return row.demo ? <Badge tone="warn">Demo</Badge> : <Badge tone="ok">Real</Badge>;
}

export function AdsSlots({ slots, onSlots }: Props) {
  const toast = useToast();
  const [picking, setPicking] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HomeSelectionRow[]>([]);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (picking === null) return;
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      const res = await searchHomeAdsAction(query);
      if (mine !== seq.current) return;
      if (res.ok) {
        setProblem("");
        setResults(res.results);
      } else setProblem(res.message);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [picking, query]);

  async function commit(next: HomeSelectionRow[], done: string, undoTo?: HomeSelectionRow[]) {
    if (busy) return;
    setBusy(true);
    const res = await saveHomeSelectionAction(payload(slots, next));
    setBusy(false);
    if (!res.ok) {
      toast.show({ kind: "error", message: res.message, onRetry: () => void commit(next, done, undoTo) });
      return;
    }
    const before = slots;
    onSlots(next);
    toast.show(undoTo ? { kind: "undo", message: done, onUndo: () => void commit(before, "Slots restored") } : { kind: "success", message: done });
  }

  const shown = slots.slice(0, SLOT_COUNT);
  const hidden = slots.length - shown.length;
  const move = (from: number, to: number) => {
    const next = slots.slice();
    [next[from], next[to]] = [next[to], next[from]];
    void commit(next, "Order of the slots changed");
  };

  return (
    <div className="adm-pb-slots" data-tk="home-slots">
      <p className="adm-pb-note" data-tk="slots-live-note">
        <strong>The 8 slots save at once and change the Home page now. Everything else waits for Publish.</strong>
      </p>
      <p className="adm-pb-note">
        You choose the 8 ads, demo ads included. A demo ad leaves its slot when demo ads end; the slot then shows the newest ad.
      </p>
      <ol className="adm-pb-slotlist">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const row = shown[index];
          return (
            <li key={index} className="adm-pb-slot" data-tk={row ? "slot-filled" : "slot-empty"}>
              <span className="adm-pb-slotno" aria-hidden="true">{index + 1}</span>
              {row ? (
                <>
                  <Thumb row={row} />
                  <span className="adm-pb-slottext">
                    <strong>{row.title}</strong>
                    <small>{[row.category, row.city].filter(Boolean).join(" · ")}</small>
                  </span>
                  {kindBadge(row)}
                  <MoveButtons name={`Home slot ${index + 1}`} canUp={index > 0 && !busy} canDown={index < shown.length - 1 && !busy} onUp={() => move(index, index - 1)} onDown={() => move(index, index + 1)} />
                  <button type="button" className={buttonClass({ size: "sm", icon: true })} aria-label={`Remove ${row.title} from slot ${index + 1}`} title="Remove from slot" disabled={busy} onClick={() => void commit(slots.filter((_, at) => at !== index), `Removed from slot ${index + 1}`, slots)}>
                    <X aria-hidden="true" focusable="false" />
                  </button>
                </>
              ) : (
                <>
                  <span className="adm-pb-slottext">
                    <strong>Empty</strong>
                    <small>Shows the newest ad</small>
                  </span>
                  {index === shown.length ? (
                    <Button size="sm" icon={Plus} onClick={() => { setQuery(""); setResults([]); setPicking(index); }}>
                      Pick an ad
                    </Button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ol>
      {hidden > 0 ? <p className="adm-pb-note">{hidden} more {hidden === 1 ? "ad is" : "ads are"} chosen beyond slot 8 and not shown on Home. Remove one above to bring the next in.</p> : null}

      <Drawer
        open={picking !== null}
        title={`Pick an ad for slot ${(picking ?? 0) + 1}`}
        subtitle="Search any ad, demo ads included."
        onClose={() => setPicking(null)}
        footer={<Button kind="quiet" onClick={() => setPicking(null)}>Cancel</Button>}
      >
        <div className="adm-field">
          <label className="adm-field-label" htmlFor="pb-ad-search">Search by title, category or city</label>
          <input id="pb-ad-search" className="adm-input" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {problem ? <p className="adm-k-err" role="alert">{problem}</p> : null}
        <ul className="adm-pb-results" data-tk="slot-results">
          {results.map((row) => (
            <li key={row.id}>
              <Thumb row={row} />
              <span className="adm-pb-slottext">
                <strong>{row.title}</strong>
                <small>{[row.category, row.city].filter(Boolean).join(" · ")}</small>
              </span>
              {kindBadge(row)}
              <Button kind="primary" size="sm" disabled={busy} onClick={() => { const at = picking ?? shown.length; setPicking(null); void commit([...slots.slice(0, at), row, ...slots.slice(at)], `Put in slot ${at + 1}`, slots); }}>
                {`Put in slot ${(picking ?? 0) + 1}`}
              </Button>
            </li>
          ))}
          {results.length === 0 && !problem ? <li className="adm-pb-note">No ads found.</li> : null}
        </ul>
      </Drawer>
    </div>
  );
}
