"use client";

import { ExternalLink, History, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";

export function DashboardHeader({ purpose, canReview }: { purpose: string; canReview: boolean }) {
  return (
    <PageHeader
      crumbs={[{ label: "Today" }]}
      title="Dashboard"
      purpose={purpose}
      secondary={[
        { key: "history", label: "History & undo", icon: History, href: "/admin/history/" },
        { key: "site", label: "View site", icon: ExternalLink, href: "/" },
      ]}
      primary={canReview ? { key: "review", label: "Start reviewing", icon: ShieldCheck, href: "/admin/moderation/" } : undefined}
    />
  );
}
