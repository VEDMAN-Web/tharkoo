import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { assertOrigin } from "@/server/auth/http";
import { HttpError } from "@/server/http";
import { fileReport } from "@/server/reports/service";

export const dynamic = "force-dynamic";

/** Anonymous report of an ad. Five reports per IP per 15 minutes. */
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const ip = clientKey(request.headers);
    if (!allowRequest(`report:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many reports. Try again in a few minutes." }, { status: 429 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Send the report as JSON" }, { status: 400 });
    const result = await fileReport({ ad: body.ad, reason: body.reason, details: body.details, ip });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("report failed", error);
    return NextResponse.json({ ok: false, error: "Could not send the report. Please try again." }, { status: 500 });
  }
}
