import { describe, expect, it } from "vitest";
import { addInterest, INTEREST_KEY, INTEREST_LENGTH_MAX, INTEREST_MAX } from "@/components/post/interests";
import { citiesFor, statesOf, type PostPlace } from "@/components/post/PlaceFields";
import { INTEREST_KEY as SERVER_KEY, INTEREST_LENGTH_MAX as SERVER_LENGTH, INTEREST_MAX as SERVER_MAX } from "@/server/shared/fields";
import { makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

const city = (id: string, name: string, stateSlug: string): PostPlace => ({ id, name, slug: name.toLowerCase(), stateSlug });
const CITIES = [city("1", "Mumbai", "maharashtra"), city("2", "Pune", "maharashtra"), city("3", "Nagpur", "maharashtra"), city("4", "Surat", "gujarat"), city("5", "Pune Road", "gujarat"), city("6", "Orphan", "")];

describe("H19.6 interest chips", () => {
  it("uses the same limits as the server", () => {
    expect([INTEREST_KEY, INTEREST_MAX, INTEREST_LENGTH_MAX]).toEqual([SERVER_KEY, SERVER_MAX, SERVER_LENGTH]);
  });

  it("adds a trimmed word, once, up to five", () => {
    let list: string[] = [];
    for (const word of ["  Music ", "music", "Travel", "", "   ", "Film  noir", "Cricket", "Cooking", "Sixth"]) list = addInterest(list, word);
    expect(list).toEqual(["Music", "Travel", "Film noir", "Cricket", "Cooking"]);
  });

  it("cuts a word that is too long and never changes the list it was given", () => {
    const base = ["Music"];
    const next = addInterest(base, "x".repeat(60));
    expect(next[1]).toHaveLength(INTEREST_LENGTH_MAX);
    expect(base).toEqual(["Music"]);
  });
});

describe("H19.6 state, city and area lists", () => {
  it("lists each state once, by name, and leaves out cities with no state", () => {
    expect(statesOf(CITIES)).toEqual([{ slug: "gujarat", name: "Gujarat" }, { slug: "maharashtra", name: "Maharashtra" }]);
  });

  it("shows only the cities of the chosen state", () => {
    expect(citiesFor(CITIES, "maharashtra", "").map((item) => item.name)).toEqual(["Mumbai", "Pune", "Nagpur"]);
    expect(citiesFor(CITIES, "gujarat", "").map((item) => item.name)).toEqual(["Surat", "Pune Road"]);
  });

  it("shows no city before a state is chosen", () => {
    expect(citiesFor(CITIES, "", "")).toEqual([]);
  });

  it("searches inside that state only, names that start with the word first", () => {
    expect(citiesFor(CITIES, "maharashtra", "pu").map((item) => item.name)).toEqual(["Pune", "Nagpur"]);
    expect(citiesFor(CITIES, "gujarat", "pu").map((item) => item.name)).toEqual(["Pune Road"]);
    expect(citiesFor(CITIES, "maharashtra", "ag").map((item) => item.name)).toEqual(["Nagpur"]);
    expect(citiesFor(CITIES, "maharashtra", "zzz")).toEqual([]);
  });
});

describe("H19.6 wording", () => {
  const t = makeT();
  it("has the words the card asks for", () => {
    expect(t("post.select.area")).toBe("Select area or skip");
    expect(t("post.interest.tip")).toBe("Type an interest and press Enter. Up to 5.");
    expect(t("post.tile.makeCover")).toBe("Make cover");
    expect(t("post.tile.moveLeftShort")).toBe("Move left");
    expect(t("post.tile.moveRightShort")).toBe("Move right");
    expect(t("post.tile.removeShort")).toBe("Remove");
  });

  it("no longer asks for a 20 character description", () => {
    expect(JSON.stringify(TEXT_DEFAULTS)).not.toMatch(/20 characters (or more|required)/);
  });
});
