import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) {
    return (
      <div className="mx-auto max-w-sm bg-white p-6">
        <h1 className="text-[22px]">Staff access</h1>
        <p className="mt-3 text-[14px] leading-6">
          This staging admin is only for people signed in to this Cursor app. Open it as a private or team app, or run it locally where a simulated staff viewer is used.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
