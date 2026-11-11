"use client";

import { useState } from "react";
import {
  BarList,
  ConfirmDialog,
  DataTable,
  EmptyState,
  KpiCard,
  Notice,
  SaveBar,
  SerpPreview,
  Skeleton,
  SortableList,
  TextField,
  Toggle,
  type Column,
  type SortableItem,
} from "@/components/admin/ui";

type Row = { id: string; name: string; city: string; ads: number };

const ROWS: Row[] = Array.from({ length: 120 }, (_, index) => ({
  id: `row-${index + 1}`,
  name: `Sample user ${index + 1}`,
  city: ["Mumbai", "Delhi", "Surat", "Chennai", "Kolkata"][index % 5],
  ads: (index * 7) % 23,
}));

const COLUMNS: Column<Row>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "city", label: "City", sortable: true },
  { key: "ads", label: "Ads", sortable: true },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="adm-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

export function Demo() {
  const [title, setTitle] = useState("Dating in Mumbai: verified profiles near you");
  const [desc, setDesc] = useState("Browse verified profiles in Mumbai.");
  const [on, setOn] = useState(true);
  const [order, setOrder] = useState<SortableItem[]>([
    { id: "a", label: "Hero" },
    { id: "b", label: "Categories" },
    { id: "c", label: "Cities" },
    { id: "d", label: "Safety" },
  ]);
  const [confirm, setConfirm] = useState(false);
  const [dirty, setDirty] = useState(true);

  return (
    <div>
      <Section title="KpiCard">
        <div className="adm-grid">
          <KpiCard label="Active ads" value={1284} hint="Live on the site now" />
          <KpiCard label="New users, 7 days" value={96} delta="+12%" />
          <KpiCard label="Reports open" value={7} delta="-3" />
          <KpiCard label="Revenue" value={null} hint="No payments yet" />
        </div>
      </Section>
      <Section title="BarList">
        <BarList items={[{ label: "Mumbai", value: 420 }, { label: "Delhi", value: 310 }, { label: "Surat", value: 150 }]} />
      </Section>
      <Section title="DataTable (sort, filter, Show 50 more, Export CSV)">
        <DataTable columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} csvName="sample-users" />
      </Section>
      <Section title="TextField with character counter">
        <div style={{ display: "grid", gap: 12 }}>
          <TextField label="SEO title" value={title} onChange={setTitle} min={30} max={60} help="Aim for 30 to 60 characters." />
          <TextField label="Description" value={desc} onChange={setDesc} min={70} max={160} multiline error={desc.length < 70 ? "Too short for a good snippet." : undefined} />
        </div>
      </Section>
      <Section title="SerpPreview">
        <SerpPreview title={title} description={desc} url="https://tharkoo.com › dating › mumbai" />
      </Section>
      <Section title="Toggle">
        <Toggle checked={on} onChange={setOn} label="Show this block" />
      </Section>
      <Section title="SortableList (drag or use the arrows)">
        <SortableList items={order} onChange={setOrder} label="Home page blocks" />
      </Section>
      <Section title="Notice">
        <div style={{ display: "grid", gap: 8 }}>
          <Notice kind="info" title="Info">Changes go live after Publish.</Notice>
          <Notice kind="warn" title="Demo data">Demo data, not real users.</Notice>
          <Notice kind="error" title="Could not save">Check the highlighted fields.</Notice>
        </div>
      </Section>
      <Section title="EmptyState and Skeleton">
        <EmptyState title="No reports yet" why="Reports appear here when visitors flag an ad." action={{ label: "Go to dashboard", href: "/admin/" }} />
        <div style={{ marginTop: 16 }}>
          <Skeleton lines={3} />
        </div>
      </Section>
      <Section title="ConfirmDialog (type to confirm)">
        <button type="button" className="adm-btn adm-btn-danger" onClick={() => setConfirm(true)}>
          Delete sample page
        </button>
        <ConfirmDialog
          open={confirm}
          title="Delete this page?"
          body="This cannot be undone."
          confirmText="delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
        />
      </Section>
      <Section title="SaveBar">
        <SaveBar dirty={dirty} onSaveDraft={() => setDirty(false)} onPreview={() => undefined} onPublish={() => setDirty(false)} />
        <p className="adm-field-help" style={{ marginTop: 8 }}>
          <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setDirty(true)}>Make a change</button>
        </p>
      </Section>
    </div>
  );
}
