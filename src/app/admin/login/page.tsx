import Link from "next/link";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) {
    return (
      <div className="mx-auto max-w-sm bg-white p-6">
        <h1 className="text-[22px]">Staff access</h1>
        <p className="mt-3 text-[14px] leading-6">Sign in as the app owner or a Cursor team admin.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-sm bg-white p-6">
      <h1 className="text-[22px]">Staff</h1>
      <p className="mt-2 text-[13px]">Signed in as {identity.email || identity.name || "staff"}.</p>
      <Link href="/admin/" className="btn-post mt-4 inline-block">
        Open dashboard
      </Link>
    </div>
  );
}
