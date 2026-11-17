import { NextResponse, type NextRequest } from "next/server";
import { adminContext } from "@/server/admin/context";
import { historyCsv, parseHistoryQuery } from "@/server/admin/history";
import { ForbiddenError, UnauthorizedError } from "@/server/http";

export const dynamic = "force-dynamic";

/** The History & undo list as a CSV file, with the filters of the screen (H8.26). */
export async function GET(request: NextRequest) {
  try {
    const ctx = await adminContext();
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const csv = await historyCsv(ctx, parseHistoryQuery(params));
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="tharkoo-history.csv"', "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) return new NextResponse(error.message, { status: error instanceof UnauthorizedError ? 401 : 403, headers: { "cache-control": "no-store" } });
    throw error;
  }
}
