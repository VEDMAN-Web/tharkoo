import { cookies } from "next/headers";
import { SupportPanel } from "@/components/buyer/SupportPanel";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Support ticket | Tharkoo",
  description: "Read and reply to a support ticket.",
  path: "/u/account/support/",
  index: false,
});

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return <SupportPanel summary={summary} initialId={id} />;
}
