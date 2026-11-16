"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";

export function DashboardHeader({ purpose, canReview }: { purpose: string; canReview: boolean }) {
  return (
    <PageHeader
      crumbs={[{ label: "Today" }]}
      title="Dashboard"
      purpose={purpose}
      more={[{ key: "history", label: "History & undo", href: "/admin/history/" }]}
      secondary={[{ key: "site", label: "View site", icon: ExternalLink, href: "/" }]}
      primary={canReview ? { key: "review", label: "Start reviewing", icon: ShieldCheck, href: "/admin/moderation/" } : undefined}
    />
  );
}
