"use client";

import { useState } from "react";
import { Ban, Eye, History, House, MessageSquare, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  BottomBar,
  Button,
  Drawer,
  LockBadge,
  MoveButtons,
  PageHeader,
  ReasonDialog,
  Tabs,
  ToastProvider,
  moveItem,
  useToast,
} from "@/components/admin/ui";

const TABS = [
  { key: "live", label: "Live, not checked", count: 14 },
  { key: "held", label: "Held by rules", count: 3 },
  { key: "edited", label: "Edited, photos waiting", count: 0 },
];

const SLOTS = ["Study table, teak", "Two seater sofa", "City cycle, blue", "Maths tutoring"];

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
  const [dialog, setDialog] = useState<"" | "ban" | "demo">("");
  const [slots, setSlots] = useState(SLOTS);
  const row = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } as const;

  return (
    <div className="adm-k" data-tk="kit-gallery">
      <PageHeader
        level={2}
        crumbs={[{ label: "System", href: "/admin/" }, { label: "Admin kit" }]}
        title="Ads to review"
        purpose="Look at new ads after they are live, and take down anything that breaks the rules."
        more={[
          { key: "history", label: "History", icon: History, href: "/admin/kit/" },
          { key: "remove", label: "Remove ad...", icon: Trash2, danger: true, onSelect: () => setDialog("ban") },
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
          <Button kind="danger" onClick={() => setDialog("demo")}>End demo ads...</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
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

      <Drawer
        open={drawer}
        title="Study table, teak"
        subtitle="Furniture, Mumbai"
        onClose={() => setDrawer(false)}
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
          <Button kind="danger" icon={Trash2} onClick={() => { setDrawer(false); setDialog("ban"); }}>Remove ad...</Button>
          <p className="adm-k-help">The ad comes down at once and the advertiser gets an email.</p>
        </div>
      </Drawer>

      <ReasonDialog
        open={dialog === "ban"}
        title="Ban spam.bot22?"
        body={<p>Their live ads are paused and they are logged out on every device. You can undo this for 7 days.</p>}
        reasons={["Spam", "Fake ads", "Abusive messages", "Other"]}
        requireReason
        textLabel="Tell the team more"
        giveBack={{ label: "Give back the 30 credits to Riya", help: "Off by default. Saved in History." }}
        confirmLabel="Ban user"
        danger
        onCancel={() => setDialog("")}
        onConfirm={() => {
          setDialog("");
          toast.show({ kind: "undo", message: "spam.bot22 banned.", onUndo: () => toast.show({ kind: "success", message: "Ban undone." }) });
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
