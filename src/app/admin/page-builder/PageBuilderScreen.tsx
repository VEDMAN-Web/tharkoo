"use client";

import { Eye, History } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Tabs } from "@/components/admin/ui/Tabs";
import { HomeBuilder } from "./_home/HomeBuilder";
import type { CardWidth } from "@/server/listings/card-width-config";
import { ListingBuilder, type CategoryOption } from "./_listing/ListingBuilder";
import { PostBuilder } from "./_post/PostBuilder";
import { TABS, tabOf, type TabKey } from "./tabs";

export function PageBuilderScreen({ categories = [], initialTab = "home", initialCategory = "", initialAddress = "", cardWidth }: { categories?: CategoryOption[]; initialTab?: TabKey; initialCategory?: string; initialAddress?: string; cardWidth: CardWidth }) {
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    const onPop = () => setTab(tabOf(new URLSearchParams(window.location.search).get("tab")));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function changeTab(next: string) {
    setTab(next);
    window.history.pushState(null, "", next === "home" ? "/admin/page-builder/" : `/admin/page-builder/?tab=${next}`);
  }
  return (
    <div className="adm-k" data-tk="page-builder">
      <PageHeader
        crumbs={[{ label: "Website" }]}
        title="Page builder"
        purpose="Pick a page, turn blocks on or off, change their order and words. Drafts save by themselves; publish when ready."
        secondary={tab === "home" ? [{ key: "history", label: "History", icon: History, href: "#versions" }, { key: "preview", label: "Preview", icon: Eye, href: "/admin/page-builder/preview/" }] : []}
      />
      <div className="adm-pb-tabs">
        <Tabs items={[...TABS]} active={tab} onChange={changeTab} label="Pages" idPrefix="pb" />
      </div>
      <div role="tabpanel" id={`pb-panel-${tab}`} aria-labelledby={`pb-${tab}`}>
        {tab === "home" ? (
          <HomeBuilder />
        ) : tab === "listing" ? (
          <ListingBuilder categories={categories} initialCategory={initialCategory} initialAddress={initialAddress} cardWidth={cardWidth} />
        ) : (
          <PostBuilder />
        )}
      </div>
    </div>
  );
}
