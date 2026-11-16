import { connectDb } from "@/lib/db";
import { HelpArticle } from "@/server/models";
import type { SupportTopic } from "@/server/support/constants";

const MAX_SUGGESTIONS = 3;
const TITLE_WEIGHT = 4;
const SECTION_WEIGHT = 2;
const MIN_WORD_LENGTH = 3;
const STOP_WORDS = new Set(["with", "and", "the", "for", "how", "can", "what", "this", "that", "from", "have", "not", "are", "you", "your", "was", "get"]);

const TOPIC_WORDS: Record<SupportTopic, string[]> = {
  coins_payments: ["coin", "credit", "payment", "pay", "refund", "invoice", "wallet", "buy"],
  my_ads: ["ad", "ads", "post", "posting", "edit", "renew", "delete", "listing", "photo"],
  my_account: ["account", "login", "log", "password", "profile", "email", "code", "verify"],
  report_problem: ["report", "scam", "fake", "abuse", "safety", "problem", "block", "safe"],
  something_else: [],
};

export type SupportArticle = { slug: string; title: string; section: string };

function stem(word: string): string {
  return word.length > 2 ? word.replace(/s$/, "") : word;
}

function rawWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function tokens(text: string): string[] {
  return rawWords(text).map(stem);
}

function wordsOf(text: string): string[] {
  return rawWords(text)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word))
    .map(stem);
}

function occurrences(text: string, words: string[]): number {
  const present = new Set(tokens(text));
  return words.reduce((sum, word) => sum + (present.has(word) ? 1 : 0), 0);
}

export async function suggestSupportArticles(topic: SupportTopic, query: string): Promise<SupportArticle[]> {
  await connectDb();
  const words = [...new Set([...TOPIC_WORDS[topic].map(stem), ...wordsOf(query)])];
  if (!words.length) return [];
  const articles = await HelpArticle.find({ status: "published" }).sort({ order: 1 }).lean();
  return articles
    .map((article) => ({
      article,
      score:
        occurrences(article.title || "", words) * TITLE_WEIGHT +
        occurrences(article.section || "", words) * SECTION_WEIGHT +
        occurrences(article.body || "", words),
    }))
    .filter((row) => row.score > 0 && row.article.slug && row.article.title)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ article }) => ({ slug: article.slug || "", title: article.title || "", section: article.section || "" }));
}
