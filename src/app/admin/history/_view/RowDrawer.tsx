"use client";

import { Undo2 } from "lucide-react";
import { Badge, Button, DiffView, Drawer, LockBadge } from "@/components/admin/ui";
import { diffFields, type DiffRow } from "@/components/admin/ui/kit-helpers";
import type { HistoryDetail } from "@/server/admin/history";
import { STATE_BADGE, whenLabel, whoLine } from "./format";

const VALUE_MAX = 240;

function shown(rows: DiffRow[]): DiffRow[] {
  const cut = (text: string) => (text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}...` : text);
  return rows.map((row) => ({ ...row, before: cut(row.before), after: cut(row.after) }));
}

/** One change in detail: what changed field by field, the reason, the record's earlier changes, and the undo button (H8.26). */
export function RowDrawer({ detail, busy, onClose, onUndo }: { detail: HistoryDetail | null; busy: boolean; onClose: () => void; onUndo: (actionId: string, label: string) => void }) {
  const row = detail?.row;
  const badge = row ? STATE_BADGE[row.state] : null;
  const rows = detail ? shown(diffFields(detail.before, detail.after)) : [];
  return (
    <Drawer
      open={Boolean(detail)}
      title={row?.title ?? "Change"}
      subtitle={row ? `${row.label ? `${row.label} · ` : ""}${whoLine(row.who, row.role)} · ${whenLabel(row.at)}` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button kind="quiet" onClick={onClose}>Close</Button>
          {row?.actionId && row.actionLabel ? (
            <Button kind="primary" icon={Undo2} busy={busy} onClick={() => onUndo(row.actionId as string, row.actionLabel as string)}>
              {row.actionLabel}
            </Button>
          ) : null}
        </>
      }
    >
      {row ? (
        <div className="adm-h-pane" data-tk="history-drawer">
          <p>
            {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : null} {row.lock ? <LockBadge reason={`${row.lock.text}. This cannot be undone.`} /> : null}
          </p>
          {row.reason ? <p><strong>Reason:</strong> {row.reason}</p> : null}
          <h3>What changed</h3>
          <DiffView rows={rows} empty="This change did not save field values." />
          {detail && detail.earlier.length > 0 ? (
            <>
              <h3>Earlier changes to this record</h3>
              <ul className="adm-h-earlier" data-tk="earlier-changes">
                {detail.earlier.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <small>{whoLine(item.who, item.role)} · {whenLabel(item.at)}</small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
