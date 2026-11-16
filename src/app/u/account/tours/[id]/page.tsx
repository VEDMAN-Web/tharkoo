import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TourCallPanel, type TourCall } from "@/components/buyer/TourCallPanel";
import { UserPanelShell } from "@/components/buyer/UserPanelShell";
import { pageMetadata } from "@/lib/ui/meta";
import { HttpError } from "@/server/http";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { VIDEO_CALL_FAILED } from "@/server/tours/room";
import { tourCallFor } from "@/server/tours/service";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Live video call | Tharkoo",
  description: "Your live video call.",
  path: "/u/account/tours/",
  index: false,
});

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  if (!summary.signedIn) redirect(`/u/login/?next=${encodeURIComponent(`/u/account/tours/${id}/`)}`);
  let call: TourCall;
  let error = "";
  try {
    call = await tourCallFor({ userId: summary.userId, tourId: id });
  } catch (failure) {
    if (failure instanceof HttpError && (failure.status === 404 || failure.status === 400)) notFound();
    call = { id, status: "accepted", role: "buyer", title: "", report: "", joinUrl: null };
    error = failure instanceof HttpError ? failure.message : VIDEO_CALL_FAILED;
  }
  return (
    <UserPanelShell active="home" summary={summary}>
      <TourCallPanel call={call} error={error} />
    </UserPanelShell>
  );
}
