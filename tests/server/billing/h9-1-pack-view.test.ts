import { describe, expect, it } from "vitest";
import { adsFor, adsWord, bestValueId, firstPacks, popularId, preselectedId, rupees, type PackLike } from "@/lib/credit-pack-view";

const pack = (id: string, credits: number, price: number, bonus = 0, badge: PackLike["badge"] = null): PackLike => ({ id, credits, bonus, total: credits + bonus, price, badge });

const PACKS = [
  pack("p100", 100, 1000),
  pack("p200", 200, 1900, 10),
  pack("p300", 300, 2700, 30),
  pack("p500", 500, 4250, 75, "popular"),
  pack("p800", 800, 6400, 160),
  pack("p1000", 1000, 7500, 250),
  pack("p2000", 2000, 13000, 700),
];

describe("H9.1 credit pack view", () => {
  it("shows at most four packs first: the cheapest, the popular one, the best value and a bigger one, smallest first", () => {
    const first = firstPacks(PACKS);
    expect(first).toHaveLength(4);
    expect(first.map((item) => item.id)).toEqual(["p100", "p200", "p500", "p2000"]);
    expect(first[0].id).toBe("p100");
    expect(first.some((item) => item.id === "p500")).toBe(true);
    expect(first[first.length - 1].id).toBe("p2000");
    expect(first.map((item) => item.total)).toEqual([...first.map((item) => item.total)].sort((a, b) => a - b));
  });

  it("shows every pack when there are four or fewer", () => {
    expect(firstPacks(PACKS.slice(0, 3)).map((item) => item.id)).toEqual(["p100", "p200", "p300"]);
  });

  it("always includes the pack that covers a shortfall, and starts with it selected", () => {
    const first = firstPacks(PACKS, 600);
    expect(first.some((item) => item.id === "p800")).toBe(true);
    expect(preselectedId(PACKS, 600)).toBe("p800");
    expect(preselectedId(PACKS, 99999)).toBe("p2000");
  });

  it("pre-selects the popular pack, else the cheapest, and one pack carries Most popular", () => {
    expect(preselectedId(PACKS)).toBe("p500");
    expect(popularId(PACKS)).toBe("p500");
    expect(preselectedId(PACKS.map((item) => ({ ...item, badge: null })))).toBe("p100");
    expect(preselectedId([])).toBe("");
    expect(popularId([{ ...PACKS[1], badge: "popular" }, { ...PACKS[3], badge: "popular" }])).toBe("p200");
  });

  it("calls a pack best value only when it really gives more credits per rupee than the cheapest and is not the popular one", () => {
    expect(bestValueId(PACKS)).toBe("p2000");
    expect(bestValueId(PACKS.map((item) => ({ ...item, bonus: 0, total: item.credits, price: item.credits * 10 })))).toBeNull();
    expect(bestValueId(PACKS.slice(0, 2))).toBeNull();
  });

  it("says About N ads from the credits and the posting fee, rounded down, and nothing while posting is free", () => {
    expect(adsFor(575, 30)).toBe(19);
    expect(adsFor(100, 30)).toBe(3);
    expect(adsFor(29, 30)).toBeNull();
    expect(adsFor(500, 0)).toBeNull();
    expect(adsWord(1)).toBe("About 1 ad");
    expect(adsWord(19)).toBe("About 19 ads");
  });

  it("writes prices in whole rupees with Indian grouping", () => {
    expect(rupees(1000)).toBe("₹1,000");
    expect(rupees(13000)).toBe("₹13,000");
    expect(rupees(100000)).toBe("₹1,00,000");
    expect(rupees(4250.4)).toBe("₹4,250");
  });
});
