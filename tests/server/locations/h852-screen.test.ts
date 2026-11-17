import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Listing, Location, SiteMedia } from "@/server/models";
import { loadPlacesScreen, parsePlacesQuery, PLACE_PAGE_SIZE } from "@/server/locations/screen";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function seed(cityCount = 70) {
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN", parentId: null, order: 0 });
  const states = await Location.create([
    { type: "state", slug: "goa", name: "Goa", parentId: country._id },
    { type: "state", slug: "sikkim", name: "Sikkim", parentId: country._id },
    { type: "state", slug: "maharashtra", name: "Maharashtra", parentId: country._id, enabled: false },
  ]);
  const cities = await Location.create(
    Array.from({ length: cityCount }, (_, index) => ({ type: "city" as const, slug: `town-${String(index).padStart(3, "0")}`, name: `Town ${String(index).padStart(3, "0")}`, parentId: states[index % 3]._id })),
  );
  return { country, states, cities };
}

describe("H8.52 the places list", () => {
  it("lists cities first, then states, then countries, and every place is reachable by paging", async () => {
    await seed();
    const first = await loadPlacesScreen({ page: 1 });
    expect(first.total).toBe(74);
    expect(first.pageSize).toBe(PLACE_PAGE_SIZE);
    expect(first.pages).toBe(3);
    expect(first.rows.slice(0, 3).map((row) => row.type)).toEqual(["city", "city", "city"]);
    const names: string[] = [];
    const types: string[] = [];
    for (let page = 1; page <= first.pages; page++) {
      const data = await loadPlacesScreen({ page });
      names.push(...data.rows.map((row) => row.name));
      types.push(...data.rows.map((row) => row.type));
    }
    expect(new Set(names).size).toBe(74);
    expect(names).toContain("Sikkim");
    expect(names).toContain("India");
    expect(types.join(",")).toBe([...types].sort((a, b) => ({ city: 0, state: 1, country: 2 })[a]! - ({ city: 0, state: 1, country: 2 })[b]!).join(","));
  });

  it("a page past the end shows the last page, and the page size is capped", async () => {
    await seed();
    const far = await loadPlacesScreen({ page: 99 });
    expect(far.page).toBe(3);
    expect(far.rows.length).toBe(14);
    expect((await loadPlacesScreen({ pageSize: 5000 })).pageSize).toBe(100);
    expect(parsePlacesQuery({ page: "-4", size: "x", q: "  goa " })).toMatchObject({ page: 1, pageSize: PLACE_PAGE_SIZE, q: "goa" });
  });

  it("finds a place by any part of its name or slug, without regex surprises", async () => {
    await seed();
    expect((await loadPlacesScreen({ q: "sikk" })).rows.map((row) => row.name)).toEqual(["Sikkim"]);
    expect((await loadPlacesScreen({ q: "TOWN 01" })).total).toBe(10);
    expect((await loadPlacesScreen({ q: "town-01" })).total).toBe(10);
    expect((await loadPlacesScreen({ q: ".*" })).total).toBe(0);
    expect((await loadPlacesScreen({ q: "(" })).total).toBe(0);
  });

  it("marks hidden places, shows where a place is, and gives a thumbnail from its Home page tile", async () => {
    const { states, cities } = await seed(3);
    const media = await SiteMedia.create({ url: "/uploads/goa-card.png", objectKey: "k1", alt: "Beach", width: 800, height: 600, bytes: 9000, contentType: "image/png", tags: [], uploadedBy: "a@example.com" });
    await Location.updateOne({ _id: cities[0]._id }, { $set: { photo: { mediaId: media._id, focusX: 50, focusY: 50, alt: "Beach" } } });
    const data = await loadPlacesScreen({});
    const town = data.rows.find((row) => row.slug === "town-000");
    expect(town).toMatchObject({ where: "Goa", enabled: true, thumb: "/uploads/goa-card.png" });
    const hidden = (await loadPlacesScreen({ q: "maharashtra" })).rows[0];
    expect(hidden).toMatchObject({ type: "state", enabled: false, where: "India", thumb: "" });
    expect(states).toHaveLength(3);
  });
});

describe("H8.52 the place on the right", () => {
  it("is the first row by default, and the named place even when it is on another page or outside the search", async () => {
    const { cities, country } = await seed();
    const byDefault = await loadPlacesScreen({});
    expect(byDefault.chosen).toBe(false);
    expect(byDefault.detail?.id).toBe(byDefault.rows[0].id);
    const named = await loadPlacesScreen({ id: String(country._id), q: "town-00" });
    expect(named.chosen).toBe(true);
    expect(named.detail).toMatchObject({ name: "India", type: "country", countryCode: "IN", adCount: null, publicPath: "/countries/india/" });
    expect(named.detail?.childCount).toBe(3);
    const bad = await loadPlacesScreen({ id: "not-an-id" });
    expect(bad.chosen).toBe(false);
    expect((await loadPlacesScreen({ id: String(oid()) })).chosen).toBe(false);
    expect(cities.length).toBe(70);
  });

  it("counts a city's ads, lists its districts and localities, and a state has no page of its own", async () => {
    const { cities, states } = await seed(3);
    const city = cities[0];
    await Location.create([
      { type: "district", slug: "old-town", name: "Old Town", parentId: city._id },
      { type: "locality", slug: "market", name: "Market", parentId: city._id, enabled: false },
    ]);
    await Listing.create({ ownerId: oid(), categoryId: oid(), cityId: city._id, stateId: states[0]._id, title: "Ad", description: "A description that is long enough", slug: "an-ad", status: "active" });
    const detail = (await loadPlacesScreen({ id: String(city._id) })).detail;
    expect(detail).toMatchObject({ type: "city", where: "Goa", adCount: 1, publicPath: "/cities/town-000/" });
    expect(detail?.areas.map((area) => `${area.name}:${area.type}:${area.enabled}`)).toEqual(["Old Town:district:true", "Market:locality:false"]);
    const state = (await loadPlacesScreen({ id: String(states[0]._id) })).detail;
    expect(state).toMatchObject({ type: "state", adCount: 1, publicPath: "", areas: [] });
  });
});
