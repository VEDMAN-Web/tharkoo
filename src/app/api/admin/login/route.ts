import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password, otp } = await req.json();
  const ok =
    (email || "").toLowerCase() === "admin@tharkoo.demo" &&
    password === (process.env.ADMIN_PASSWORD || "admin") &&
    (otp === "000000" || !otp);
  if (!ok) return NextResponse.json({ error: "Wrong details or 2FA code" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("tharkoo_admin", "1", { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
