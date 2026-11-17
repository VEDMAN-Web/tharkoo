"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, UserPlus } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge, Button, Drawer, PageHeader, ReasonDialog, ToastProvider, useToast, type BadgeTone } from "@/components/admin/ui";
import { ROLE_WORDS } from "@/lib/admin/role-words";
import type { StaffRole } from "@/lib/admin/perms";
import type { StaffRow } from "@/server/admin/team";
import { changeRolesAction, inviteStaffAction, removeAccessAction, resendInviteAction, type TeamResult } from "./actions";
import { CHOICE_ORDER, ROLE_GUIDE, SUPERADMIN_WARNING } from "./guide";
import "./team.css";

const REMOVE_REASONS = ["Left the team", "Role no longer needed", "Account safety", "Other"] as const;
const ROLE_TONE: Partial<Record<StaffRole, BadgeTone>> = { superadmin: "pri", blog_editor: "info" };

type Mode = { kind: "none" } | { kind: "invite" } | { kind: "edit"; id: string };

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function lastSignIn(row: StaffRow): string {
  return row.lastSignIn ? IST.format(new Date(row.lastSignIn)) : "Not yet";
}

function RoleBadges({ row }: { row: StaffRow }) {
  return (
    <span className="adm-tm-badges">
      {row.roles.map((role) => (
        <Badge key={role} tone={ROLE_TONE[role] ?? "neutral"}>{ROLE_WORDS[role]}</Badge>
      ))}
      {row.invited ? <Badge tone="warn">Invited</Badge> : null}
      {row.status === "suspended" ? <Badge tone="bad">Banned</Badge> : null}
    </span>
  );
}

function RoleChoices({ value, onChange, disabled }: { value: StaffRole[]; onChange: (next: StaffRole[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="adm-tm-roles" disabled={disabled}>
      <legend className="adm-k-label">Roles</legend>
      {CHOICE_ORDER.map((role) => {
        const guide = ROLE_GUIDE.find((item) => item.role === role);
        const checked = value.includes(role);
        return (
          <label key={role} className="adm-tm-choice">
            <input type="checkbox" className="adm-k-check" checked={checked} onChange={() => onChange(checked ? value.filter((item) => item !== role) : [...value, role])} />
            <span>
              <strong>{ROLE_WORDS[role]}</strong>
              <small>{guide ? [guide.opens, guide.note].filter(Boolean).join(". ") : ""}</small>
              {role === "superadmin" ? <small className="adm-tm-warn" data-tk="superadmin-warning">{SUPERADMIN_WARNING}</small> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Invite staff: name, email and roles. The new person gets a link by email to choose a password. */
function InviteDrawer({ onClose, onDone }: { onClose: () => void; onDone: (result: TeamResult) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsReason = roles.includes("superadmin");

  async function send() {
    setError("");
    if (!name.trim()) return setError("Enter their name.");
    if (!email.trim()) return setError("Enter their email.");
    if (roles.length === 0) return setError("Choose at least one role.");
    if (needsReason && !reason.trim()) return setError("Say why this person becomes a superadmin.");
    setBusy(true);
    const result = await inviteStaffAction({ name, email, roles, reason });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone(result);
  }

  return (
    <Drawer
      open
      title="Invite staff"
      subtitle="They get an email with a link to choose a password."
      onClose={onClose}
      footer={
        <>
          <Button kind="quiet" onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" icon={UserPlus} busy={busy} onClick={() => void send()}>Send invite</Button>
        </>
      }
    >
      {error ? <p className="adm-k-err" role="alert" data-tk="team-error">{error}</p> : null}
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="tm-name">Name <span aria-hidden="true" className="adm-k-req">*</span></label>
        <input id="tm-name" className="adm-k-input" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </div>
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="tm-email">Email <span aria-hidden="true" className="adm-k-req">*</span></label>
        <input id="tm-email" className="adm-k-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
        <p className="adm-k-help">Use an email that has no account on the site yet. The link works for 3 days.</p>
      </div>
      <RoleChoices value={roles} onChange={setRoles} />
      {needsReason ? (
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="tm-reason">Reason <span aria-hidden="true" className="adm-k-req">*</span></label>
          <textarea id="tm-reason" className="adm-k-input" required value={reason} onChange={(event) => setReason(event.target.value)} />
          <p className="adm-k-help">A superadmin can open everything. This is saved in History.</p>
        </div>
      ) : null}
    </Drawer>
  );
}

/** Change role: the roles, a reason, and Remove access at the end of the drawer. */
function EditDrawer({ row, lastSuper, onClose, onDone }: { row: StaffRow; lastSuper: boolean; onClose: () => void; onDone: (result: TeamResult, what: string) => void }) {
  const toast = useToast();
  const [roles, setRoles] = useState<StaffRole[]>(row.roles);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const same = roles.slice().sort().join() === row.roles.slice().sort().join();
  const touchesSuper = row.roles.includes("superadmin") || roles.includes("superadmin");
  const blockedBySelf = row.isYou;

  async function save() {
    setError("");
    if (roles.length === 0) return setError("Choose at least one role, or use Remove access.");
    if (touchesSuper && !reason.trim()) return setError("Say why a superadmin role is changing.");
    setBusy(true);
    const result = await changeRolesAction({ userId: row.id, roles, reason });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone(result, "The role change");
  }

  async function resend() {
    setBusy(true);
    const result = await resendInviteAction({ userId: row.id });
    setBusy(false);
    toast.show({ kind: result.ok && result.emailed !== false ? "success" : "error", message: result.ok ? result.summary : result.message });
  }

  return (
    <>
      <Drawer
        open
        title={row.name}
        subtitle={row.email}
        onClose={onClose}
        footer={
          <>
            <Button kind="quiet" onClick={onClose}>Cancel</Button>
            <span className="adm-k-sp" />
            <Button kind="primary" busy={busy} disabled={same || blockedBySelf} onClick={() => void save()}>Save roles</Button>
          </>
        }
      >
        {blockedBySelf ? <p className="adm-k-help" data-tk="team-self">This is your own account. Ask another superadmin to change your roles.</p> : null}
        {lastSuper ? <p className="adm-k-help" data-tk="team-last">This is the only superadmin. Make someone else a superadmin before changing this.</p> : null}
        {error ? <p className="adm-k-err" role="alert" data-tk="team-error">{error}</p> : null}
        <RoleChoices value={roles} onChange={setRoles} disabled={blockedBySelf} />
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="tm-edit-reason">
            Reason{touchesSuper ? <span aria-hidden="true" className="adm-k-req"> *</span> : " (optional)"}
          </label>
          <textarea id="tm-edit-reason" className="adm-k-input" required={touchesSuper} value={reason} onChange={(event) => setReason(event.target.value)} disabled={blockedBySelf} />
        </div>
        {row.invited ? (
          <div className="adm-tm-end">
            <p className="adm-k-help">They have not signed in yet. A new link stops the older ones.</p>
            <Button kind="secondary" busy={busy} onClick={() => void resend()}>Send invite again</Button>
          </div>
        ) : null}
        <div className="adm-tm-end">
          <p className="adm-k-help">Remove access takes away every staff role and signs them out. Their account stays as an ordinary user. You can undo this for 7 days.</p>
          <Button kind="danger" disabled={blockedBySelf || lastSuper} onClick={() => setConfirm(true)}>Remove access...</Button>
        </div>
      </Drawer>
      <ReasonDialog
        open={confirm}
        title={`Remove staff access of ${row.name}?`}
        body={<p>They are signed out everywhere and can no longer open the admin. You can undo this for 7 days; undo gives the roles back but they sign in again.</p>}
        reasons={REMOVE_REASONS}
        requireReason
        textLabel="Tell the team more"
        confirmLabel="Remove access"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async (result) => {
          setConfirm(false);
          setBusy(true);
          const done = await removeAccessAction({ userId: row.id, reason: result.text ? `${result.reason}: ${result.text}` : result.reason });
          setBusy(false);
          if (!done.ok) return setError(done.message);
          onDone(done, "Removing access");
        }}
      />
    </>
  );
}

function Inner({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const activeSupers = staff.filter((row) => row.roles.includes("superadmin") && row.status === "active");
  const editing = mode.kind === "edit" ? staff.find((row) => row.id === mode.id) : undefined;

  async function undo(eventId: string, what: string) {
    const outcome = await undoAction(eventId);
    toast.show({ kind: outcome.ok ? "success" : "error", message: outcome.ok ? `${what} undone.` : outcome.message });
    if (outcome.ok) router.refresh();
  }

  function finished(result: TeamResult, what: string) {
    setMode({ kind: "none" });
    if (!result.ok) return;
    if (result.undoUntil && result.eventId) toast.show({ kind: "undo", message: result.summary, onUndo: () => void undo(result.eventId, what) });
    else toast.show({ kind: result.emailed === false ? "error" : "success", message: result.summary });
    router.refresh();
  }

  return (
    <div className="adm-k" data-tk="team">
      <PageHeader
        crumbs={[{ label: "System" }]}
        title="Team & roles"
        purpose="Who can open which part of the admin."
        secondary={[{ key: "log", label: "Full audit log", icon: History, href: "/admin/history/" }]}
        primary={{ key: "invite", label: "Invite staff", icon: UserPlus, onClick: () => setMode({ kind: "invite" }) }}
      />
      <div className="adm-tm-grid">
        <section className="adm-card adm-tm-staff" aria-labelledby="tm-staff-h" data-tk="team-staff">
          <div className="adm-tm-head">
            <h2 id="tm-staff-h">Staff</h2>
            <span className="adm-k-help">
              {staff.length} {staff.length === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="adm-tm-cols" aria-hidden="true">
            <span>Person</span>
            <span>Roles</span>
            <span>Last sign-in (IST)</span>
            <span />
          </div>
          <ul className="adm-tm-rows">
            {staff.map((row) => (
              <li key={row.id}>
                <button type="button" className="adm-tm-row" data-tk="team-row" aria-current={editing?.id === row.id ? "true" : undefined} onClick={() => setMode({ kind: "edit", id: row.id })}>
                  <span className="adm-tm-person">
                    <strong>
                      {row.name}
                      {row.isYou ? " (you)" : ""}
                    </strong>
                    <small>{row.email}</small>
                  </span>
                  <RoleBadges row={row} />
                  <span className="adm-tm-last">{lastSignIn(row)}</span>
                  <span className="adm-k-btn adm-tm-change" aria-hidden="true">Change role</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="adm-card adm-tm-guide" aria-labelledby="tm-guide-h" data-tk="team-guide">
          <h2 id="tm-guide-h">What each role can open</h2>
          <ul>
            {ROLE_GUIDE.map((item) => (
              <li key={item.role}>
                <strong>
                  {item.label}
                  {item.role === "blog_editor" ? " (new)" : ""}
                </strong>
                <span>{[item.opens, item.note].filter(Boolean).join(". ")}</span>
              </li>
            ))}
          </ul>
          <p className="adm-k-help">The menu shows only what a role can open. Dashboard and History &amp; undo are open to all staff. Every action is in History &amp; undo and the Full audit log.</p>
        </section>
      </div>
      {mode.kind === "invite" ? <InviteDrawer onClose={() => setMode({ kind: "none" })} onDone={(result) => finished(result, "The invite")} /> : null}
      {editing ? (
        <EditDrawer
          key={editing.id}
          row={editing}
          lastSuper={editing.roles.includes("superadmin") && activeSupers.length === 1 && activeSupers[0].id === editing.id}
          onClose={() => setMode({ kind: "none" })}
          onDone={finished}
        />
      ) : null}
    </div>
  );
}

export function TeamView({ staff }: { staff: StaffRow[] }) {
  return (
    <ToastProvider>
      <Inner staff={staff} />
    </ToastProvider>
  );
}
