"use client";

import { Eye, History } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Tabs } from "@/components/admin/ui/Tabs";
import { HomeBuilder } from "./_home/HomeBuilder";

const TABS = [
  { key: "home", label: "Home" },
  { key: "listing", label: "Listing pages" },
  { key: "post", label: "Post-ad page" },
];

const OLD: Record<string, { href: string; label: string }> = {
  listing: { href: "/admin/listing-pages/", label: "Open the Listing pages editor" },
  post: { href: "/admin/post-page/", label: "Open the Post-ad page editor" },
};

export function PageBuilderScreen() {
  const [tab, setTab] = useState("home");
  const old = OLD[tab];
  return (
    <div className="adm-k" data-tk="page-builder">
      <PageHeader
        crumbs={[{ label: "Website" }]}
        title="Page builder"
        purpose="Pick a page, turn blocks on or off, change their order and words. Drafts save by themselves; publish when ready."
        secondary={tab === "home" ? [{ key: "history", label: "History", icon: History, href: "#versions" }, { key: "preview", label: "Preview", icon: Eye, href: "/admin/page-builder/preview/" }] : []}
      />
      <div className="adm-pb-tabs">
        <Tabs items={TABS} active={tab} onChange={setTab} label="Pages" idPrefix="pb" />
      </div>
      <div role="tabpanel" id={`pb-panel-${tab}`} aria-labelledby={`pb-${tab}`}>
        {tab === "home" ? (
          <HomeBuilder />
        ) : (
          <EmptyState title="Coming" why="This tab is planned and not built yet. The old editor still works for now." action={old ? { label: old.label, href: old.href } : undefined} />
        )}
      </div>
    </div>
  );
}
