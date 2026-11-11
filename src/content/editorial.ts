import { BLOG_POSTS, HELP_ARTICLES } from "@/data/help";

export const ABOUT_BODY = [
  "Tharkoo is a free classifieds site for India. People use it to post dating and friendship notes, jobs, homes, vehicles, pets, classes, and local wellness such as yoga or a fitness studio. Each ad belongs to a category and a city, so you can open a page that is already narrowed to the place you care about.",
  "You can browse without an account. Posting needs an email, a confirmation that you are 18 or older, and sometimes an ID check before the ad is public. The check is there to make accounts harder to spin up in bulk. It does not mean we have met the poster or inspected what they are offering.",
  "Contact stays on the ad. You choose a method when you post, and the reader uses that method. We do not print a private phone number in the page markup, and we do not arrange the meeting. Read the safety page before you agree to meet or to pay anyone.",
  "City pages, category pages, and the guide pages are the public face of the site. Account pages, the post form, and the admin tools are not meant for search engines. A listing that the poster removes, or that has been expired for more than 30 days, stops answering as a normal page.",
  "The site name, the colours, and the words on the home page can be edited by an admin. The category names come from the catalogue, not from a fixed menu in the code. If a city or a category is renamed, the previous address points to the new one.",
].join("\n\n");

export const GRIEVANCE_BODY = [
  "If a listing, a photo, or an account on Tharkoo has harmed you, write to us through the contact page and include the link to the ad. We read reports in the order they arrive. If the ad breaks the terms or the prohibited items list, we can remove it and close the account that posted it.",
  "Tell us what is wrong in plain language, and whether you want the ad taken down or a correction. If you are the person in a photo and you did not agree to it, say so. We may ask for the email on the account so we can reply to the right person.",
  "This grievance note is a draft. The postal address is a placeholder until it is confirmed, and a lawyer should review the process before the site is indexed. Emergency danger should go to local services first. Tharkoo cannot send someone to a street address.",
].join("\n\n");

export const DRAFT_POSTS = [
  ["How to write a clear classified title", "how-to-write-a-clear-title"],
  ["Choosing a city page", "choosing-a-city-page"],
  ["What an ID check means", "what-an-id-check-means"],
  ["How a promotion changes order", "how-a-promotion-changes-order"],
  ["Meeting in a public place", "meeting-in-a-public-place"],
  ["How to report a suspicious listing", "how-to-report-a-listing"],
  ["Photos you have the right to upload", "photos-you-can-upload"],
  ["Reading a listing before you reply", "reading-a-listing-before-you-reply"],
] as const;

export function publishedGuides() {
  return [
    ...HELP_ARTICLES.map((article) => ({
      kind: "help" as const,
      slug: article.slug,
      title: article.title,
      body: `${article.body}\n\nRelated pages: the safety guide and a city hub such as dating in Delhi.`,
      status: "published",
    })),
    ...BLOG_POSTS.map((post) => ({
      kind: "blog" as const,
      slug: post.slug,
      title: post.title,
      body: `${post.body}\n\nRead the safety page before you reply, and open a city hub such as jobs in Bengaluru when you want a live list.`,
      status: "published",
    })),
    ...DRAFT_POSTS.map(([title, slug]) => ({
      kind: "blog" as const,
      slug,
      title,
      body: "Draft. Not for publication until an editor writes the guide. Links for later: /safety/ and /dating/delhi/.",
      status: "draft",
    })),
  ];
}
