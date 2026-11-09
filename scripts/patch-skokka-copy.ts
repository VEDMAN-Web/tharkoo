import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import { CATEGORIES } from "../src/data/catalog";
import { DEFAULT_SEO } from "../src/lib/seo";
import { Category, SeoTemplate, Site } from "../src/lib/models";

function uri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (!existsSync(".env.local")) return "";
  return readFileSync(".env.local", "utf8").match(/MONGODB_URI\s*=\s*['"]?([^'"\n]+)['"]?/)?.[1]?.trim() || "";
}

async function main() {
  const mongo = uri();
  if (!mongo) throw new Error("MONGODB_URI missing");
  await mongoose.connect(mongo);
  const homeCities = ["bangalore", "hyderabad", "delhi"];
  for (const cat of CATEGORIES) {
    await Category.updateOne(
      { slug: cat.slug },
      { $set: { description: cat.description, homeBlurb: cat.description, homeCities, showOnHome: true, color: cat.color } },
    );
  }
  for (const seo of Object.values(DEFAULT_SEO)) {
    await SeoTemplate.updateOne({ pageType: seo.pageType }, { $set: seo }, { upsert: true });
  }
  await Site.updateOne(
    { key: "default" },
    {
      $set: {
        tagline:
          "Welcome to Tharkoo, #1 Adult Classifieds in India. Browse Call Girls, massages, escorts, transsexual ads and Adult Meetings. POST YOUR AD absolutely FREE!",
        searchPlaceholder: "Search by City, Category...",
        postCta: "Post your ad",
        cookieBody:
          "We use cookies to optimize the performance of this website and provide you with a better user experience in a personalized way. In the options you can choose your preferences for the use of cookies:",
        ageGateTitle: "Please read the following warning before continuing",
        ageGateBody:
          " <b>I am over 18 years old</b>  and I accept the viewing of explicit texts and images intended for an <b>adult audience</b>.",
        ageYes: "Accept",
        ageNo: "Decline",
        "homepage.blocks": [
          { id: "hero", type: "hero", enabled: true, title: "Hot meetings in your city", subtitle: "Find your favourite Escort in Tharkoo" },
          { id: "categories", type: "categories", enabled: true, cityCount: 3, moreLabel: "More cities" },
          {
            id: "boost",
            type: "boost",
            enabled: true,
            title: "Boost your visibility",
            body: "Post your ad free. Promote with Top, Flash or Star to sit above the feed in your city.",
            cta: "Post your ad",
            href: "/u/post-insert/",
          },
          {
            id: "intro",
            type: "html",
            enabled: true,
            html: `<p>${DEFAULT_SEO.home.intro}</p>`,
          },
        ],
      },
    },
  );
  await mongoose.disconnect();
  console.log("skokka_copy_patched");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "patch failed");
  process.exit(1);
});
