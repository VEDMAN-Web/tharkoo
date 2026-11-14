import { NextRequest, NextResponse } from "next/server";
import { requireStaffRequest } from "@/lib/admin-auth";
import { importTemplateCsv } from "@/server/import/template";

export const dynamic = "force-dynamic";

/** The partner import template: every base column, with example rows. Staff only. */
export async function GET(request: NextRequest) {
  const staff = await requireStaffRequest(request);
  if (!staff) return NextResponse.json({ ok: false, error: "Sign in as staff to download the template" }, { status: 403 });
  return new NextResponse(importTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="tharkoo-import-template.csv"',
      "cache-control": "no-store",
    },
  });
}
