import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) {
    return (
      <div className="mx-auto max-w-sm bg-white p-6">
        <h1 className="text-[22px]">Staff access</h1>
        <p className="mt-3 text-[14px] leading-6">
          Staff CMS is limited to the private-app owner or a Cursor team admin. Team members and public visitors cannot change listings or site content.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
