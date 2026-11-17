"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader, ToastProvider } from "@/components/admin/ui";
import type { SettingsData } from "@/server/settings/settings-admin";
import { EmergencyCard, PostModerationCard, SearchEnginesCard, UndoWindowsCard } from "./SettingsCards";
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
  site,
  rawJson,
}: {
  data: SettingsData;
  canEmergency: boolean;
  canEdit: boolean;
  signIn: ReactNode;
  photos: ReactNode;
  site: ReactNode;
  rawJson: string | null;
}) {
  const sections: SettingsSection[] = [
    { id: "emergency", label: "Emergency switches" },
    ...(signIn ? [{ id: "sign-in", label: "Sign-in and safety" }] : []),
    { id: "posting", label: "Posting rules" },
    ...(photos ? [{ id: "photos", label: "Photos and watermark" }] : []),
    { id: "undo", label: "Undo windows" },
    { id: "site", label: "Site and chat" },
    { id: "search", label: "Search engines" },
    ...(rawJson !== null ? [{ id: "raw", label: "Raw site record" }] : []),
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
            <UndoWindowsCard key={JSON.stringify(data.undoWindows)} windows={data.undoWindows} canEdit={canEdit} />
            <section className="adm-card adm-s-card" id="site" aria-labelledby="site-title">
              <header className="adm-s-head">
                <h2 id="site-title">Site and chat</h2>
              </header>
              <div className="adm-s-body adm-s-blocks">
                {site}
                <p className="adm-k-help">
                  Live video tours: <Link href="/admin/settings/video-tours/">switch on per category and set the credit price</Link>. Support chat text and buttons:{" "}
                  <Link href="/admin/settings/chat/">edit the live chat</Link>. Header and footer: <Link href="/admin/menus/">menus and footer</Link>. Money: <Link href="/admin/prices/">Prices &amp; plans</Link>.
                </p>
              </div>
            </section>
            <SearchEnginesCard hidden={data.hiddenFromSearch} />
            {rawJson !== null ? (
              <section className="adm-card adm-s-card" id="raw" aria-labelledby="raw-title" data-tk="raw-site">
                <header className="adm-s-head">
                  <h2 id="raw-title">Raw site record</h2>
                  <span className="adm-k-help">Read only</span>
                </header>
                <div className="adm-s-body">
                  <details>
                    <summary>Show the saved record</summary>
                    <pre className="adm-s-raw" tabIndex={0}>{rawJson}</pre>
                  </details>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
