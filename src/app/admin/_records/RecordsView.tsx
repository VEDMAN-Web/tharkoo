"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { Badge, Button, Drawer, FilterBar, PageHeader, ReasonDialog, ServerTable, ToastProvider, useToast, type TableColumn } from "@/components/admin/ui";
import { changedFields, fieldErrors } from "@/components/admin/ui/kit-helpers";
import { emptyValues, KINDS, type FieldDef, type KindConfig, type RecordKind } from "@/lib/admin/record-kinds";
import type { RecordDetail, RecordList, RecordRow } from "@/server/admin/records";
import { deleteRecordAction, saveRawRecordAction, saveRecordAction, undoRecordAction } from "./actions";
import "./records.css";

export type RecordsAccess = { write: boolean; remove: boolean; raw: boolean };
type Values = Record<string, unknown>;

const SEARCH_DEBOUNCE_MS = 350;
const CRUMB: Record<RecordKind, string> = { "banned-words": "System", broadcasts: "Website", flags: "System", "help-sections": "Website" };

function labelOf(field: FieldDef | undefined, value: unknown) {
  if (!field) return String(value ?? "");
  if (field.type === "select") return field.options?.find((option) => option.value === value)?.label ?? String(value ?? "");
  return value === undefined || value === null || value === "" ? "none" : String(value);
}

function DrawerBody({ config, detail, access, onClose, onSaved }: { config: KindConfig; detail: RecordDetail | null; access: RecordsAccess; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const uid = useId();
  const initial = detail ? detail.values : emptyValues(config);
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const [raw, setRaw] = useState(detail?.raw ?? "");
  const [rawError, setRawError] = useState("");
  const summary = useRef<HTMLDivElement>(null);
  const parsed = config.schema.safeParse(values);
  const errors = parsed.success ? {} : fieldErrors(parsed.error.issues);
  const dirty = changedFields(initial, values).length > 0;
  const shown = (name: string) => serverErrors[name] ?? (tried || touched.includes(name) ? errors[name] : undefined);
  const editing = Boolean(detail);
  const name = String(values[config.nameField] ?? "") || config.singular;

  function set(field: string, value: unknown) {
    setServerErrors((current) => ({ ...current, [field]: "" }));
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function undo(eventId: string) {
    const answer = await undoRecordAction({ kind: config.kind, eventId });
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    onSaved();
  }

  async function save() {
    setTried(true);
    setNote("");
    if (!parsed.success) {
      window.setTimeout(() => summary.current?.focus(), 0);
      return;
    }
    setBusy(true);
    const answer = await saveRecordAction({ kind: config.kind, id: detail?.id, values });
    setBusy(false);
    if (!answer.ok) {
      const fields = Object.fromEntries(Object.entries(answer.fields ?? {}).map(([key, list]) => [key, list[0] ?? ""]));
      setServerErrors(fields);
      setNote(answer.message);
      return;
    }
    toast.show(
      answer.created
        ? { kind: "success", message: `Created ${answer.name}.` }
        : { kind: "undo", message: `Saved ${answer.name}.`, onUndo: () => void undo(answer.eventId) },
    );
    onSaved();
  }

  async function remove() {
    setDeleting(false);
    setBusy(true);
    const answer = await deleteRecordAction({ kind: config.kind, id: detail?.id ?? "" });
    setBusy(false);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    if (answer.ok) onSaved();
  }

  async function saveRaw() {
    setRawError("");
    setBusy(true);
    const answer = await saveRawRecordAction({ kind: config.kind, id: detail?.id ?? "", raw });
    setBusy(false);
    if (!answer.ok) {
      setRawError(answer.fields?.raw?.[0] ?? answer.message);
      return;
    }
    toast.show({ kind: "undo", message: `Saved raw data of ${answer.name}.`, onUndo: () => void undo(answer.eventId) });
    onSaved();
  }

  const errorNames = tried ? Object.keys(errors) : [];
  return (
    <>
      <Drawer
        open
        title={editing ? `Edit ${config.singular}` : config.newLabel}
        subtitle={editing ? name : undefined}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <span className="adm-k-sp" />
            <Button kind="primary" busy={busy} disabled={!dirty && editing} onClick={() => void save()}>
              {editing ? `Save ${config.singular}` : `Add ${config.singular}`}
            </Button>
          </>
        }
      >
        <form className="adm-k-form adm-rec-form" noValidate data-tk="record-drawer" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {errorNames.length > 0 ? (
            <div className="adm-k-summary" role="alert" tabIndex={-1} ref={summary} data-tk="form-summary">
              <strong>Fix {errorNames.length === 1 ? "this field" : `these ${errorNames.length} fields`} before saving:</strong>
              <ul>
                {errorNames.map((field) => (
                  <li key={field}>
                    <a href={`#${uid}-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`${uid}-${field}`)?.focus(); }}>
                      {config.fields.find((item) => item.name === field)?.label ?? field}: {errors[field]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {note ? <p className="adm-k-err" role="alert">{note}</p> : null}
          {config.fields.map((field) => {
            const id = `${uid}-${field.name}`;
            const error = shown(field.name);
            const value = values[field.name];
            const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
            const locked = editing && field.createOnly;
            const describedBy = [field.help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
            const common = {
              id,
              disabled: locked,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": describedBy,
              required: field.required,
              onBlur: () => setTouched((current) => (current.includes(field.name) ? current : [...current, field.name])),
            };
            const options = field.type === "select" ? [...(field.options ?? []), ...(text && !field.options?.some((option) => option.value === text) ? [{ value: text, label: text }] : [])] : [];
            return (
              <div key={field.name} className="adm-k-field">
                {field.type === "switch" ? (
                  <label className="adm-k-opt" htmlFor={id}>
                    <input id={id} type="checkbox" checked={Boolean(value)} aria-describedby={describedBy} onChange={(event) => set(field.name, event.target.checked)} />
                    <span><strong>{field.label}</strong></span>
                  </label>
                ) : (
                  <label className="adm-k-label adm-k-lab" htmlFor={id}>
                    <span>
                      {field.label}
                      {field.required ? <span className="adm-k-req" aria-hidden="true"> *</span> : null}
                    </span>
                    {field.max ? <span className="adm-k-count">{text.length} / {field.max}</span> : null}
                  </label>
                )}
                {field.type === "text" ? <input {...common} className="adm-k-input" value={text} maxLength={field.max} onChange={(event) => set(field.name, event.target.value)} /> : null}
                {field.type === "textarea" ? <textarea {...common} className="adm-k-input" rows={field.max && field.max > 1000 ? 12 : 4} value={text} maxLength={field.max} onChange={(event) => set(field.name, event.target.value)} /> : null}
                {field.type === "number" ? (
                  <input {...common} className="adm-k-input" type="text" inputMode="numeric" value={text} onChange={(event) => set(field.name, event.target.value.replace(/[^\d]/g, "") === "" ? "" : Number(event.target.value.replace(/[^\d]/g, "")))} />
                ) : null}
                {field.type === "select" ? (
                  <select {...common} className="adm-k-input" value={text} onChange={(event) => set(field.name, event.target.value)}>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : null}
                {field.help ? <p className="adm-k-help" id={`${id}-h`}>{field.help}</p> : null}
                {error ? <p className="adm-k-err" id={`${id}-e`}>{error}</p> : null}
              </div>
            );
          })}
          {editing ? (
            <div className="adm-rec-foot">
              {access.raw ? (
                <details className="adm-rec-raw" data-tk="raw-data">
                  <summary>Raw data (superadmin only)</summary>
                  <label className="adm-k-label" htmlFor={`${uid}-raw`}>Raw data as JSON</label>
                  <textarea id={`${uid}-raw`} className="adm-k-input adm-rec-code" rows={9} spellCheck={false} value={raw} onChange={(event) => setRaw(event.target.value)} aria-describedby={rawError ? `${uid}-raw-e` : undefined} />
                  <p className="adm-k-help">Fields you leave out stay as they are. A change here is logged and can be undone.</p>
                  {rawError ? <p className="adm-k-err" id={`${uid}-raw-e`} role="alert">{rawError}</p> : null}
                  <Button busy={busy} onClick={() => void saveRaw()}>Save raw data</Button>
                </details>
              ) : (
                <span className="adm-rec-lock"><Lock aria-hidden="true" size={14} /> Raw data: superadmin only</span>
              )}
              {access.remove ? (
                <Button kind="danger" icon={Trash2} onClick={() => setDeleting(true)}>{`Delete ${config.singular}...`}</Button>
              ) : null}
            </div>
          ) : null}
        </form>
      </Drawer>
      <ReasonDialog
        key={deleting ? "open" : "closed"}
        open={deleting}
        title={`Delete this ${config.singular}?`}
        body={config.deleteNote}
        confirmLabel={`Delete ${config.singular}`}
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function Screen({ kind, list, detail, isNew, access }: { kind: RecordKind; list: RecordList; detail: RecordDetail | null; isNew: boolean; access: RecordsAccess }) {
  const config = KINDS[kind];
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(list.query.q);
  const sentSearch = useRef(list.query.q);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (search.trim() === sentSearch.current) return;
    const id = window.setTimeout(() => {
      sentSearch.current = search.trim();
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const field = (name: string) => config.fields.find((item) => item.name === name);
  const columns: TableColumn<RecordRow>[] = [
    {
      key: "name",
      header: config.fields.find((item) => item.name === config.nameField)?.label ?? "Name",
      primary: true,
      cell: (row) => {
        const sub = config.subField ? String(row.values[config.subField] ?? "") : "";
        return (
          <>
            <strong>{String(row.values[config.nameField] ?? "") || "(empty)"}</strong>
            {sub ? <small>{sub.length > 90 ? `${sub.slice(0, 90)}...` : sub}</small> : null}
          </>
        );
      },
    },
    ...config.columns.map((name): TableColumn<RecordRow> => ({ key: name, header: field(name)?.label ?? name, hideOnPhone: name !== config.columns[0], cell: (row) => labelOf(field(name), row.values[name]) })),
    ...(config.switchField
      ? [{ key: "state", header: "Status", cell: (row: RecordRow) => (row.values[config.switchField as string] ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>) }]
      : []),
  ];

  const open = detail?.id ?? (isNew ? "new" : null);
  const searching = list.query.q !== "";
  return (
    <div className="adm-k" data-tk="records-screen" data-kind={kind}>
      <PageHeader
        crumbs={[{ label: CRUMB[kind] }]}
        title={config.title}
        purpose={config.purpose}
        primary={access.write ? { key: "new", label: config.newLabel, icon: Plus, onClick: () => go({ open: "new" }), kind: "primary" } : undefined}
      />
      <div className="adm-card adm-rec-flat">
        <FilterBar search={search} onSearch={setSearch} searchLabel={config.searchPlaceholder} placeholder={config.searchPlaceholder} chips={[]} onRemoveChip={() => undefined} />
        <ServerTable
          label={config.title}
          columns={columns}
          rows={list.rows}
          rowId={(row) => row.id}
          rowLabel={(row) => String(row.values[config.nameField] ?? "") || config.singular}
          total={list.total}
          page={list.query.page}
          pageSize={list.query.pageSize}
          onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
          onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
          openId={detail?.id ?? null}
          onOpen={(row) => go({ open: row.id })}
          rowActions={(row) => (
            <Button icon={Pencil} className="adm-rec-edit" onClick={() => go({ open: row.id })}>Edit</Button>
          )}
          empty={
            <div className="adm-rec-state" data-tk="records-empty">
              <span className="adm-rec-state-icon" aria-hidden="true"><SearchX /></span>
              <h3>{searching ? `No ${config.title.toLowerCase()} match "${list.query.q}"` : `No ${config.title.toLowerCase()} yet`}</h3>
              <p>{searching ? "Try fewer letters." : access.write ? `Add the first ${config.singular} with the button at the top.` : "Nothing has been added yet."}</p>
              {searching ? (
                <Button onClick={() => { setSearch(""); sentSearch.current = ""; go({ q: null, page: null }); }}>Clear search</Button>
              ) : null}
            </div>
          }
        />
      </div>
      {open ? (
        <DrawerBody
          key={open}
          config={config}
          detail={detail}
          access={access}
          onClose={() => go({ open: null })}
          onSaved={() => {
            go({ open: null });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** One generic list and edit screen (H8.36): a table, a search, and a drawer with a form per record. Each kind is described in src/lib/admin/record-kinds.ts. */
export function RecordsView(props: { kind: RecordKind; list: RecordList; detail: RecordDetail | null; isNew: boolean; access: RecordsAccess }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
