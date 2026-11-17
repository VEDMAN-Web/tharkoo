import { RecordsPage } from "../_records/RecordsPage";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <RecordsPage kind="banned-words" searchParams={searchParams} />;
}
