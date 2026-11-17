"use client";

import { useState } from "react";
import { Badge, Drawer, Tabs } from "@/components/admin/ui";
import type { UserDetail } from "@/server/admin/users";
import type { CreditsTab as CreditsData } from "@/server/billing/staff-credits";
import { CreditsDialog } from "../_credits/CreditsDialog";
import type { CreditsStart } from "../_credits/credits-format";
import { CreditsTab } from "../_credits/CreditsTab";
import { UserActions, type UserAccess } from "../_actions/UserActions";
import { BadgeCard } from "../_profile/BadgeCard";
import { ProfileTab } from "../_profile/ProfileTab";
import { VendorTab } from "../_profile/VendorTab";
import { dateLabel, lastSeenLabel, staffRoleLabels, statusLook } from "./format";

type Section = "overview" | "profile" | "vendor" | "ads" | "credits" | "tickets" | "history";

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
export function UserDrawer({ detail, credits, onClose, access }: { detail: UserDetail | null; credits: CreditsData | null; onClose: () => void; access: UserAccess }) {
  const [section, setSection] = useState<Section>("overview");
  const [adjust, setAdjust] = useState<CreditsStart | null>(null);
  if (!detail) return null;
  const { user } = detail;
  const look = statusLook(user);
  const staff = staffRoleLabels(user.roles);
  const now = new Date();
  const sub = [`joined ${dateLabel(user.createdAt, now, false)}`, user.city ? user.cityName : ""].filter(Boolean).join(" · ");

  return (
    <Drawer
      open
      title={user.name}
      subtitle={`${user.email} · ${sub}`}
      size="lg"
      onClose={onClose}
      footer={<UserActions userId={user.id} name={user.name} status={user.status} isStaff={staff.length > 0} access={access} onAdjust={() => setAdjust({ mode: "add", amount: "" })} />}
    >
      <div className="adm-k-hist" data-tk="user-drawer">
        <Tabs
          idPrefix="user"
          wrap
          label="About this user"
          active={section}
          onChange={(key) => setSection(key as Section)}
          items={[
            { key: "overview", label: "Overview" },
            { key: "profile", label: "Profile" },
            ...(detail.vendor ? [{ key: "vendor", label: "Vendor" }] : []),
            { key: "ads", label: "Ads", count: detail.ads.length },
            ...(credits ? [{ key: "credits", label: "Credits" }] : []),
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
                <Row label="City">{user.cityName}</Row>
                <Row label="Seller">{user.seller ? "Yes" : "No"}</Row>
                <Row label="Last seen">{lastSeenLabel(user.lastSeen, now)}</Row>
                <Row label="Joined">{dateLabel(user.createdAt, now)}</Row>
              </dl>
              {staff.length === 0 ? <BadgeCard detail={detail} canRemove={access.badge} /> : null}
            </>
          ) : null}
          {section === "profile" ? <ProfileTab key={`${user.id}-${user.name}-${user.city}-${user.phone}`} detail={detail} canEdit={access.edit && staff.length === 0} /> : null}
          {section === "vendor" && detail.vendor ? <VendorTab key={`${user.id}-${detail.vendor.about}-${detail.vendor.hidden}-${detail.vendor.photo?.id}-${detail.vendor.whatsapp}`} detail={detail} canEdit={access.edit && staff.length === 0} /> : null}
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
          {section === "credits" && credits ? <CreditsTab data={credits} canAdjust={access.adjust} onAdjust={setAdjust} /> : null}
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
      {adjust && credits ? <CreditsDialog userId={user.id} name={user.name} balance={credits.balance} start={adjust} onClose={() => setAdjust(null)} /> : null}
    </Drawer>
  );
}
