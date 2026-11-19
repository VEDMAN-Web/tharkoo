import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT } from "@/lib/ui/text";

/** H17.1: the words that stand in for "0 live ads" while a page shows only sample ads. They come from the site text store (listing.sampleCount). */
export async function sampleNoteText(): Promise<string> {
  return makeT(await textOverrides())("listing.sampleCount");
}
