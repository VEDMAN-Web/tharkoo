"use client";

import { DataTable, type Column } from "@/components/admin/ui";

export type BlockedRefundRow = { id: string; updatedAt?: string | null; userId?: string | null; coins?: number | null; amount?: number | null; eventId?: string | null };

const COLUMNS: Column<BlockedRefundRow>[] = [
  { key: "updatedAt", label: "Updated" },
  { key: "userId", label: "User" },
  { key: "coins", label: "Credits", sortable: true },
  { key: "amount", label: "Paid (INR)", sortable: true },
  { key: "eventId", label: "Provider event" },
];

export function BlockedRefunds({ rows }: { rows: BlockedRefundRow[] }) {
  return <DataTable columns={COLUMNS} rows={rows} rowKey={(row) => row.id} csvName="refund-blocked" />;
}
