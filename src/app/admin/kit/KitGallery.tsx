"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { Ban, Check, Eye, History, House, MessageSquare, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  BottomBar,
  Button,
  DiffView,
  Drawer,
  FilterBar,
  HistoryDrawer,
  LockBadge,
  MediaPicker,
  MoveButtons,
  PageHeader,
  ReasonDialog,
  RecordForm,
  ServerTable,
  Tabs,
  ToastProvider,
  diffFields,
  mediaProblems,
  moveItem,
  useToast,
  type HistoryEntry,
  type MediaPickerHandle,
  type MediaValue,
  type TableColumn,
} from "@/components/admin/ui";

const TABS = [
  { key: "live", label: "Live, not checked", count: 14 },
  { key: "held", label: "Held by rules", count: 3 },
  { key: "edited", label: "Edited, photos waiting", count: 0 },
];

const SLOTS = ["Study table, teak", "Two seater sofa", "City cycle, blue", "Maths tutoring"];

type AdRow = { id: string; title: string; place: string; flag: string; paid: boolean; owner: string; age: string };

const TITLES = ["Yoga class, mornings", "2 BHK flat near Adajan", "Weekend hiking friend", "Coffee and a walk", "Honda Activa 2022", "Maths tutoring, class 10", "Study table, teak", "Two seater sofa"];
const ALL_ROWS: AdRow[] = Array.from({ length: 64 }, (_, index) => ({
  id: `ad-${index + 1}`,
  title: `${TITLES[index % TITLES.length]}${index >= TITLES.length ? ` ${Math.floor(index / TITLES.length) + 1}` : ""}`,
  place: ["Wellness, Siliguri", "Property, Surat", "Friendship, Srinagar", "Dating, Jammu"][index % 4],
  flag: ["New seller", "Phone in text", "No flags", "Banned word"][index % 4],
  paid: index % 3 === 0,
  owner: ["Priya S.", "Mehul P.", "Aamir K.", "Riya T."][index % 4],
  age: `${(index % 9) + 1} h ${(index * 7) % 60} min`,
}));

const HISTORY_NOW = { title: "2 BHK flat near Adajan", price: 18000, area: { sqft: 9500, name: "Adajan" }, photos: 4 };
const HISTORY_V4 = { title: "2 BHK flat near Adajan", price: 18000, area: { sqft: 950, name: "Adajan" }, photos: 4 };
const HISTORY_V2 = { title: "2 BHK flat, Adajan", price: 20000, area: { sqft: 950, name: "Adajan" }, photos: 3 };

const HISTORY_TABS = [
  {
    key: "versions",
    label: "Versions",
    entries: [
      { id: "v5", version: "v5", title: "Edited by Ayesha", meta: "Today 00:20 · area 950 to 9500", current: true, badge: { tone: "ok" as const, text: "Live" } },
      { id: "v4", version: "v4", title: "Edited by seller", meta: "14 Nov 2026, 18:20 · price 20,000 to 18,000", badge: { tone: "ok" as const, text: "Live" }, changes: diffFields(HISTORY_NOW, HISTORY_V4) },
      { id: "v2", version: "v2", title: "Edited by seller", meta: "12 Nov 2026, 21:40 · 1 photo added", badge: { tone: "ok" as const, text: "Live" }, changes: diffFields(HISTORY_NOW, HISTORY_V2) },
    ] satisfies HistoryEntry[],
  },
  {
    key: "decisions",
    label: "Decisions",
    entries: [{ id: "d1", version: "d1", title: "Approved by Ayesha", meta: "13 Nov 2026, 10:02" }] satisfies HistoryEntry[],
  },
  {
    key: "money",
    label: "Money",
    entries: [{ id: "m1", version: "m1", title: "Paid 30 credits", meta: "12 Nov 2026, 21:15", lockedReason: "Payments taken cannot be undone" }] satisfies HistoryEntry[],
  },
];

const PIXEL = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f7d9e5"/><circle cx="200" cy="130" r="60" fill="#e6e0f7"/></svg>');

const FORM_SCHEMA = z.object({
  title: z.string().min(5, "Write at least 5 characters.").max(70, "Shorten the title to 70 characters."),
  price: z.number({ error: "Enter the price in rupees." }).int().min(0, "Enter the price in rupees."),
  city: z.string().min(1, "Choose a city."),
  visible: z.boolean(),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="adm-card" style={{ padding: "18px 20px", marginBottom: 16 }} aria-label={title}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Demo() {
  const toast = useToast();
  const [tab, setTab] = useState("live");
  const [drawer, setDrawer] = useState(false);
  const [history, setHistory] = useState(false);
  const [dialog, setDialog] = useState<"" | "ban" | "demo" | "paid">("");
  const [slots, setSlots] = useState(SLOTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chips, setChips] = useState([{ key: "age", label: "Waiting over 1 h" }]);
  const [media, setMedia] = useState<MediaValue>({ image: { assetId: "demo", src: PIXEL, alt: "", width: 400, height: 300 }, phone: null, focusX: 50, focusY: 40 });
  const [mediaError, setMediaError] = useState<{ image?: string; alt?: string }>({});
  const mediaRef = useRef<MediaPickerHandle>(null);
  const row = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } as const;

  const filtered = ALL_ROWS.filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()));
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const columns: TableColumn<AdRow>[] = [
    {
      key: "title",
      header: "Ad",
      primary: true,
      cell: (item) => (
        <>
          <strong>{item.title}</strong>
          <small>{item.place}</small>
        </>
      ),
    },
    { key: "flag", header: "Status", cell: (item) => <>{item.paid ? <Badge tone="pri">Paid</Badge> : null} <Badge tone={item.flag === "No flags" ? "neutral" : "warn"}>{item.flag}</Badge></> },
    { key: "owner", header: "Seller", hideOnPhone: true, cell: (item) => item.owner },
    { key: "age", header: "Waiting", nowrap: true, cell: (item) => item.age },
  ];

  function saveMedia() {
    const problems = mediaProblems(media, { required: true });
    setMediaError(problems);
    if (problems.alt || problems.image) {
      window.setTimeout(() => mediaRef.current?.focusProblem(), 0);
      return;
    }
    toast.show({ kind: "success", message: "Picture saved." });
  }

  return (
    <div className="adm-k" data-tk="kit-gallery">
      <PageHeader
        level={2}
        crumbs={[{ label: "System", href: "/admin/" }, { label: "Admin kit" }]}
        title="Ads to review"
        purpose="Look at new ads after they are live, and take down anything that breaks the rules."
        more={[
          { key: "history", label: "History", icon: History, onSelect: () => setHistory(true) },
          { key: "remove", label: "Remove ad...", icon: Trash2, danger: true, onSelect: () => setDialog("paid") },
        ]}
        secondary={[{ key: "site", label: "View site", icon: Eye, href: "/" }]}
        primary={{ key: "start", label: "Start reviewing", icon: Plus, onClick: () => toast.show({ kind: "success", message: "Review started." }) }}
      />

      <Section title="Buttons">
        <div style={row}>
          <Button kind="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button kind="quiet">Quiet</Button>
          <Button kind="danger" icon={Ban}>Reject...</Button>
          <Button kind="danger-solid">Remove ad</Button>
          <Button size="sm">Small</Button>
          <Button busy>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Status badges">
        <div style={row}>
          <Badge tone="ok" dot>Live</Badge>
          <Badge tone="warn">Waiting</Badge>
          <Badge tone="bad">Rejected</Badge>
          <Badge tone="info">Scheduled</Badge>
          <Badge tone="pri">Paid TOP</Badge>
          <Badge>Paused</Badge>
        </div>
      </Section>

      <Section title="Tabs">
        <div style={{ margin: "0 -20px" }}>
          <Tabs items={TABS} active={tab} onChange={setTab} label="Ads to review sections" idPrefix="kit" />
        </div>
        <div role="tabpanel" id={`kit-panel-${tab}`} aria-labelledby={`kit-${tab}`} style={{ paddingTop: 12 }} data-tk="tab-panel">
          Showing: {TABS.find((item) => item.key === tab)?.label}
        </div>
      </Section>

      <Section title="Toasts, dialogs and the drawer">
        <div style={row}>
          <Button onClick={() => toast.show({ kind: "undo", message: "Study table, teak, rejected. The advertiser was told.", onUndo: () => toast.show({ kind: "success", message: "Undone." }) })}>Show undo toast</Button>
          <Button onClick={() => toast.show({ kind: "success", message: "Settings saved." })}>Show success toast</Button>
          <Button onClick={() => toast.show({ kind: "error", message: "Could not save. Check your connection.", onRetry: () => toast.show({ kind: "success", message: "Saved." }) })}>Show error toast</Button>
          <Button onClick={() => setDialog("ban")}>Ban user...</Button>
          <Button onClick={() => setDialog("paid")}>Remove paid ad...</Button>
          <Button kind="danger" onClick={() => setDialog("demo")}>End demo ads...</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
          <Button onClick={() => setHistory(true)}>Open history</Button>
        </div>
      </Section>

      <Section title="Lock badge and move buttons">
        <p style={{ margin: "0 0 12px" }}><LockBadge reason="Payments taken cannot be undone" /></p>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }} data-tk="slot-list">
          {slots.map((slot, index) => (
            <li key={slot} style={{ ...row, justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--adm-line2)" }}>
              <span>
                <Badge tone="info">Home slot {index + 1}</Badge> {slot}
              </span>
              <MoveButtons
                name={slot}
                canUp={index > 0}
                canDown={index < slots.length - 1}
                onUp={() => {
                  setSlots(moveItem(slots, index, -1));
                  toast.show({ kind: "undo", message: `${slot} moved up.`, onUndo: () => setSlots(SLOTS) });
                }}
                onDown={() => {
                  setSlots(moveItem(slots, index, 1));
                  toast.show({ kind: "undo", message: `${slot} moved down.`, onUndo: () => setSlots(SLOTS) });
                }}
              />
            </li>
          ))}
        </ol>
      </Section>

      <section className="adm-card" style={{ marginBottom: 16, overflow: "hidden" }} aria-label="Table with filters">
        <div style={{ padding: "18px 20px 0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Table with filters</h2>
        </div>
        <FilterBar
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchLabel="Search ads"
          placeholder="Title, seller or phone"
          chips={chips}
          onRemoveChip={(key) => setChips((current) => current.filter((chip) => chip.key !== key))}
          addable={[
            { key: "paid", label: "Paid only" },
            { key: "city", label: "City" },
          ]}
          onAdd={(key) => setChips((current) => (current.some((chip) => chip.key === key) ? current : [...current, { key, label: key === "paid" ? "Paid only" : "City" }]))}
          hint="J K move, A approve, R reject"
        />
        <ServerTable
          label="Ads waiting for a look"
          columns={columns}
          rows={pageRows}
          rowId={(item) => item.id}
          rowLabel={(item) => item.title}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          selectable
          selected={selected}
          onSelected={setSelected}
          bulkActions={
            <>
              <Button size="sm" icon={Check} onClick={() => toast.show({ kind: "success", message: `${selected.length} ads approved.` })}>Approve</Button>
              <Button size="sm" kind="danger" icon={Ban} onClick={() => setDialog("paid")}>Reject...</Button>
            </>
          }
          openId={openId}
          onOpen={(item) => {
            setOpenId(item.id);
            setDrawer(true);
          }}
          rowActions={() => (
            <>
              <Button size="sm" icon={Check}>Approve</Button>
              <Button size="sm" kind="danger">Reject...</Button>
            </>
          )}
          empty={<p style={{ padding: 24, textAlign: "center" }}>No ads waiting.</p>}
        />
      </section>

      <Section title="Changes between two versions">
        <DiffView rows={diffFields(HISTORY_NOW, HISTORY_V2)} labels={{ "area.sqft": "Area (sq ft)", title: "Title", price: "Price", photos: "Photos" }} />
      </Section>

      <Section title="Picture field">
        <MediaPicker ref={mediaRef} label="Banner picture" value={media} onChange={(next) => { setMedia(next); setMediaError({}); }} error={mediaError} aspect="1920 / 700" />
        <div style={{ marginTop: 12 }}>
          <Button kind="primary" onClick={saveMedia}>Save picture</Button>
        </div>
      </Section>

      <Section title="Record form">
        <RecordForm
          schema={FORM_SCHEMA}
          fields={[
            { name: "title", label: "Title", type: "text", max: 70, required: true, help: "What people see first." },
            { name: "price", label: "Price", type: "number", required: true, help: "In rupees. Leave 0 to show Ask the seller." },
            { name: "city", label: "City", type: "select", required: true, options: [{ value: "", label: "Choose a city" }, { value: "surat", label: "Surat" }, { value: "pune", label: "Pune" }] },
            { name: "visible", label: "Show this ad on the site", type: "switch" },
          ]}
          initial={{ title: "2 BHK flat near Adajan", price: 18000, city: "surat", visible: true }}
          onSave={() => {
            toast.show({ kind: "undo", message: "Changes saved.", onUndo: () => toast.show({ kind: "success", message: "Undone." }) });
          }}
        />
      </Section>

      <Drawer
        open={drawer}
        title="Study table, teak"
        subtitle="Furniture, Mumbai"
        onClose={() => {
          setDrawer(false);
          setOpenId(null);
        }}
        footer={
          <>
            <Button onClick={() => setDrawer(false)}>Cancel</Button>
            <span className="adm-k-sp" />
            <Button kind="primary" onClick={() => { setDrawer(false); toast.show({ kind: "success", message: "Changes saved." }); }}>Save changes</Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Edit the record here. The list stays visible behind this panel.</p>
        <label className="adm-k-field">
          <span className="adm-k-label">Title</span>
          <input className="adm-k-input" defaultValue="Study table, teak" />
        </label>
        <div>
          <Button kind="danger" icon={Trash2} onClick={() => { setDrawer(false); setDialog("paid"); }}>Remove ad...</Button>
          <p className="adm-k-help">The ad comes down at once and the advertiser gets an email.</p>
        </div>
      </Drawer>

      <HistoryDrawer
        open={history}
        title="Ad history"
        subtitle="2 BHK flat near Adajan · #TK-48211"
        tabs={HISTORY_TABS}
        fieldLabels={{ "area.sqft": "Area (sq ft)", title: "Title", price: "Price", photos: "Photos" }}
        onClose={() => setHistory(false)}
        onRestore={(entry) => {
          setHistory(false);
          toast.show({ kind: "undo", message: `Restored ${entry.version} as a new version.`, onUndo: () => toast.show({ kind: "success", message: "Undone." }) });
        }}
      />

      <ReasonDialog
        open={dialog === "ban"}
        title="Ban spam.bot22?"
        body={<p>Their live ads are paused and they are logged out on every device. You can undo this for 7 days.</p>}
        reasons={["Spam", "Fake ads", "Abusive messages", "Other"]}
        requireReason
        textLabel="Tell the team more"
        confirmLabel="Ban user"
        danger
        onCancel={() => setDialog("")}
        onConfirm={() => {
          setDialog("");
          toast.show({ kind: "undo", message: "spam.bot22 banned.", onUndo: () => toast.show({ kind: "success", message: "Ban undone." }) });
        }}
      />
      <ReasonDialog
        open={dialog === "paid"}
        title="Remove this ad?"
        body={<p>The ad comes down at once and Riya gets an email. You can undo this for 7 days.</p>}
        reasons={["Breaks the rules", "Fake or junk", "Asked by the owner", "Other"]}
        requireReason
        textLabel="Tell the advertiser why"
        paidAd={{ name: "Riya", credits: 30 }}
        confirmLabel="Remove ad"
        danger
        onCancel={() => setDialog("")}
        onConfirm={(result) => {
          setDialog("");
          toast.show({ kind: "undo", message: result.giveBack ? "Ad removed. 30 credits given back to Riya." : "Ad removed.", onUndo: () => toast.show({ kind: "success", message: "Undone." }) });
        }}
      />
      <ReasonDialog
        open={dialog === "demo"}
        title="End all demo ads?"
        body={<p>All demo ads leave the site at once. A superadmin can bring them back for 7 days; after that they are deleted for good.</p>}
        typedConfirm="END DEMO"
        confirmLabel="End demo ads"
        danger
        onCancel={() => setDialog("")}
        onConfirm={() => {
          setDialog("");
          toast.show({ kind: "success", message: "Demo ads ended." });
        }}
      />

      <BottomBar
        items={[
          { key: "today", label: "Today", href: "/admin/", icon: House },
          { key: "review", label: "Review", href: "/admin/moderation/", icon: ShieldCheck, count: 14, active: true },
          { key: "support", label: "Support", href: "/admin/support/", icon: MessageSquare, count: 11 },
          { key: "search", label: "Search", href: "/admin/", icon: Search },
          { key: "more", label: "More", href: "/admin/kit/", icon: Eye },
        ]}
      />
    </div>
  );
}

export function KitGallery() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}
