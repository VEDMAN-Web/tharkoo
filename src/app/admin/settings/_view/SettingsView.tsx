"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader, ToastProvider } from "@/components/admin/ui";
import type { SettingsData } from "@/server/settings/settings-admin";
import { AdvancedCard, EmergencyCard, PostModerationCard, SearchEnginesCard, UndoWindowsCard } from "./SettingsCards";
import "./settings.css";

export type SettingsSection = { id: string; label: string };

/**
 * The Settings screen (H8.25): a section list, the emergency switches on top, then the sections. The older switches (sign-in, photos, design)
 * are passed in as ready-made blocks so they keep working unchanged.
 */
export function SettingsView({
  data,
  canEmergency,
  canEdit,
  signIn,
  photos,
  logo,
  site,
  advanced,
}: {
  data: SettingsData;
  canEmergency: boolean;
  canEdit: boolean;
  signIn: ReactNode;
  photos: ReactNode;
  logo: ReactNode;
  site: ReactNode;
  advanced: boolean;
}) {
  const sections: SettingsSection[] = [
    { id: "emergency", label: "Emergency switches" },
    ...(signIn ? [{ id: "sign-in", label: "Sign-in and safety" }] : []),
    { id: "posting", label: "Posting rules" },
    ...(photos ? [{ id: "photos", label: "Photos and watermark" }] : []),
    ...(logo ? [{ id: "logo", label: "Logo" }] : []),
    { id: "undo", label: "Undo windows" },
    { id: "site", label: "Site and chat" },
    { id: "search", label: "Search engines" },
    ...(advanced ? [{ id: "advanced", label: "Advanced" }] : []),
  ];
  return (
    <ToastProvider>
      <div className="adm-k" data-tk="settings-screen">
        <PageHeader
          crumbs={[{ label: "System" }]}
          title="Settings"
          purpose="Site-wide switches. Each change is logged and can be undone for 30 days."
          more={[{ key: "history", label: "History and undo", href: "/admin/history/" }]}
        />
        <div className="adm-s-layout">
          <nav className="adm-card adm-s-nav" aria-label="Settings sections" data-tk="settings-nav">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
          <div className="adm-s-main">
            <EmergencyCard state={data.emergency} canEdit={canEmergency} />
            {signIn ? (
              <section className="adm-card adm-s-card" id="sign-in" aria-labelledby="signin-title">
                <header className="adm-s-head">
                  <h2 id="signin-title">Sign-in and safety</h2>
                </header>
                <div className="adm-s-body adm-s-blocks">{signIn}</div>
              </section>
            ) : null}
            <PostModerationCard since={data.postModerationSince} canEdit={canEdit} />
            {photos ? (
              <section className="adm-card adm-s-card" id="photos" aria-labelledby="photos-title">
                <header className="adm-s-head">
                  <h2 id="photos-title">Photos and watermark</h2>
                </header>
                <div className="adm-s-body adm-s-blocks">{photos}</div>
              </section>
            ) : null}
            {logo ? (
              <section className="adm-card adm-s-card" id="logo" aria-labelledby="logo-title" data-tk="logo-settings">
                <header className="adm-s-head">
                  <h2 id="logo-title">Logo</h2>
                </header>
                <div className="adm-s-body adm-s-blocks">{logo}</div>
              </section>
            ) : null}
            <UndoWindowsCard key={JSON.stringify(data.undoWindows)} windows={data.undoWindows} canEdit={canEdit} />
            <section className="adm-card adm-s-card" id="site" aria-labelledby="site-title">
              <header className="adm-s-head">
                <h2 id="site-title">Site and chat</h2>
              </header>
              <div className="adm-s-body adm-s-blocks">
                {site}
                <ul className="adm-s-links" data-tk="settings-links">
                  <li><Link href="/admin/settings/video-tours/">Live video tours</Link>: switch on per category and set the credit price.</li>
                  <li><Link href="/admin/settings/chat/">Live chat</Link>: support chat text and buttons.</li>
                  <li><Link href="/admin/menus/">Menus and footer</Link>: header and footer.</li>
                  <li><Link href="/admin/prices/">Prices &amp; plans</Link>: money.</li>
                </ul>
              </div>
            </section>
            <SearchEnginesCard hidden={data.hiddenFromSearch} />
            {advanced ? <AdvancedCard /> : null}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
