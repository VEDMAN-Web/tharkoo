import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const expected = process.env.INDEXNOW_KEY;
  const { key } = await context.params;
  if (!expected || key !== expected) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(expected, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
