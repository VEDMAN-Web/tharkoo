"use client";

import { useState } from "react";
import { Badge, Drawer, LockBadge, Tabs } from "@/components/admin/ui";
import type { UserDetail } from "@/server/admin/users";
import { dateLabel, lastSeenLabel, staffRoleLabels, statusLook } from "./format";

type Section = "overview" | "ads" | "tickets" | "history";

const AD_TONE: Record<string, "ok" | "warn" | "bad" | "info" | "neutral"> = { active: "ok", pending: "warn", paused: "neutral", rejected: "bad", expired: "neutral", removed: "bad", draft: "neutral" };
const AD_WORDS: Record<string, string> = { active: "Live", pending: "In review", paused: "Paused", rejected: "Rejected", expired: "Ended", removed: "Removed", draft: "Draft" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-u-kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The drawer for one user (read only): profile, ads, tickets and the last changes. 460 px wide. */
export function UserDrawer({ detail, onClose }: { detail: UserDetail | null; onClose: () => void }) {
  const [section, setSection] = useState<Section>("overview");
  if (!detail) return null;
  const { user } = detail;
  const look = statusLook(user);
  const staff = staffRoleLabels(user.roles);
  const now = new Date();
  const sub = [`joined ${dateLabel(user.createdAt, now, false)}`, user.city].filter(Boolean).join(" · ");

  return (
    <Drawer open title={user.name} subtitle={`${user.email} · ${sub}`} size="lg" onClose={onClose}>
      <div className="adm-k-hist" data-tk="user-drawer">
        <Tabs
          idPrefix="user"
          label="About this user"
          active={section}
          onChange={(key) => setSection(key as Section)}
          items={[
            { key: "overview", label: "Overview" },
            { key: "ads", label: "Ads", count: detail.ads.length },
            { key: "tickets", label: "Tickets", count: detail.tickets.length },
            { key: "history", label: "History", count: detail.history.length },
          ]}
        />
        <div className="adm-u-pane" role="tabpanel" id={`user-panel-${section}`} aria-labelledby={`user-${section}`}>
          {section === "overview" ? (
            <>
              <div className="adm-u-stats">
                <div className="adm-u-stat">
                  <span>Credits</span>
                  <strong data-tk="user-balance">{detail.balance === null ? "unknown" : detail.balance.toLocaleString("en-IN")}</strong>
                </div>
                <div className="adm-u-stat">
                  <span>Live ads</span>
                  <strong>{user.ads}</strong>
                </div>
              </div>
              <dl className="adm-u-kvs">
                <Row label="Status"><Badge tone={look.tone}>{look.text}</Badge></Row>
                {staff.length ? <Row label="Staff role">{staff.map((name) => <Badge key={name} tone="pri">{name}</Badge>)}</Row> : null}
                <Row label="Email">{user.email}</Row>
                <Row label="Phone">{user.phone ?? "not added"}</Row>
                <Row label="City">{user.city ?? "unknown"}</Row>
                <Row label="Seller">{user.seller ? "Yes" : "No"}</Row>
                <Row label="Last seen">{lastSeenLabel(user.lastSeen, now)}</Row>
                <Row label="Joined">{dateLabel(user.createdAt, now)}</Row>
              </dl>
              <p className="adm-k-help">
                <LockBadge reason="Ban, log out and credit changes arrive in the next release. This view only reads." />
              </p>
            </>
          ) : null}
          {section === "ads" ? (
            detail.ads.length === 0 ? (
              <p className="adm-k-help">No ads yet.</p>
            ) : (
              <ul className="adm-u-rows" data-tk="user-ads">
                {detail.ads.map((ad) => (
                  <li key={ad.id}>
                    <span>
                      <strong>{ad.title}</strong>
                      <small>{dateLabel(ad.createdAt, now)}</small>
                    </span>
                    <Badge tone={AD_TONE[ad.status] ?? "neutral"}>{AD_WORDS[ad.status] ?? ad.status}</Badge>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {section === "tickets" ? (
            detail.tickets.length === 0 ? (
              <p className="adm-k-help">No support tickets.</p>
            ) : (
              <ul className="adm-u-rows" data-tk="user-tickets">
                {detail.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <span>
                      <strong>#{ticket.number} {ticket.subject}</strong>
                      <small>{dateLabel(ticket.lastMessageAt, now)}</small>
                    </span>
                    <Badge tone={ticket.status === "closed" ? "neutral" : "warn"}>{ticket.status === "closed" ? "Closed" : "Open"}</Badge>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {section === "history" ? (
            detail.history.length === 0 ? (
              <p className="adm-k-help">No staff changes on this user yet.</p>
            ) : (
              <ul className="adm-u-rows" data-tk="user-history">
                {detail.history.map((event) => (
                  <li key={event.id}>
                    <span>
                      <strong>{event.summary}</strong>
                      <small>{dateLabel(event.at, now)}{event.actorRole ? ` · ${event.actorRole.replace(/_/g, " ")}` : ""}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
