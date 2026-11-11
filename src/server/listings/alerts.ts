import { connectDb } from "@/lib/db";
import { mailerFromEnv } from "@/server/mailer";
import { SavedSearch } from "@/server/models";
import { queryListings } from "@/server/search";

export async function saveSearchAlert(input: {
  email: string;
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  userId?: string;
}) {
  await connectDb();
  const email = input.email.trim().toLowerCase();
  await SavedSearch.updateOne(
    { email, q: input.q || "", categorySlug: input.categorySlug || "", citySlug: input.citySlug || "" },
    {
      $setOnInsert: {
        email,
        q: input.q || "",
        categorySlug: input.categorySlug || "",
        citySlug: input.citySlug || "",
        userId: input.userId,
        lastSentAt: new Date(),
      },
    },
    { upsert: true },
  );
  await mailerFromEnv().send({
    to: email,
    subject: "Saved search on Tharkoo",
    text: "Tharkoo will email this address when a new ad matches your saved search.",
  });
  return { saved: true as const };
}

export async function sendSavedSearchDigests(requestId: string) {
  await connectDb();
  const rows = await SavedSearch.find().sort({ lastSentAt: 1 }).limit(20);
  let sent = 0;
  for (const row of rows) {
    const since = row.lastSentAt ?? row.createdAt ?? new Date(0);
    const result = await queryListings({
      q: row.q || undefined,
      categorySlug: row.categorySlug || undefined,
      citySlug: row.citySlug || undefined,
      page: 1,
      pageSize: 5,
      sort: "fresh",
    });
    const fresh = result.legacy.filter((item) => item.publishedAt && new Date(item.publishedAt).getTime() > new Date(since).getTime());
    row.lastSentAt = new Date();
    await row.save();
    if (!fresh.length) continue;
    const lines = fresh.map((item) => item.title || item.slug || "New ad").join("\n");
    await mailerFromEnv().send({
      to: row.email,
      subject: "New ads for your saved search",
      text: `${lines}\n\nrequest ${requestId}`,
    });
    sent += 1;
  }
  return { alerts: sent };
}
