import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateSlug } from "@/lib/urls";
import { cleanCell, parseCsv, readAreaTable, readCityTable, shapeProblem } from "@/server/locations/import-csv";
import { STATES } from "@/server/seed/data";

/** H16.1: reading the CSV text (no database), and the two committed data files. */

const file = (name: string) => readFileSync(path.join(process.cwd(), "data", "locations", name), "utf8");

describe("H16.1 CSV reader", () => {
  it("handles quotes, commas inside quotes, doubled quotes, CRLF, a byte-order mark and blank lines", () => {
    const rows = parseCsv('﻿name,state,slug\r\n"Bilaspur, HP",Himachal Pradesh,bilaspur-hp\r\n\r\n"Say ""hi""",Goa,say-hi\r\n');
    expect(rows).toEqual([
      ["name", "state", "slug"],
      ["Bilaspur, HP", "Himachal Pradesh", "bilaspur-hp"],
      ['Say "hi"', "Goa", "say-hi"],
    ]);
  });

  it("reads city rows by column name, in any column order, with the line number of each row", () => {
    const table = readCityTable("slug,state,name,population,isDistrictHq,source\nrajkot,Gujarat,Rajkot,\"1,286,995\",yes,https://example.test/a\nbhuj,Gujarat,Bhuj,,no,\n");
    expect(table).toEqual({
      ok: true,
      rows: [
        { line: 2, name: "Rajkot", state: "Gujarat", slug: "rajkot", isDistrictHq: true, population: 1286995, source: "https://example.test/a" },
        { line: 3, name: "Bhuj", state: "Gujarat", slug: "bhuj", isDistrictHq: false, population: null, source: "" },
      ],
    });
  });

  it("says which column is missing, and refuses an empty or oversized file", () => {
    expect(readCityTable("name,slug\nA,a\n")).toEqual({ ok: false, message: expect.stringContaining("Missing: state") });
    expect(readAreaTable("city,name\nsurat,Adajan\n")).toEqual({ ok: false, message: expect.stringContaining("Missing: slug") });
    expect(readCityTable("")).toEqual({ ok: false, message: "The file is empty." });
    expect(readCityTable("name,state,slug\n" + "a,b,c\n".repeat(5001))).toEqual({ ok: false, message: expect.stringContaining("more than 5,000 rows") });
  });

  it("cleans a cell: control characters and runs of spaces become one space", () => {
    expect(cleanCell("  Navi\u0000  Mumbai\t ")).toBe("Navi Mumbai");
  });

  it("finds the usual row problems: empty name, long name, markup, empty or bad web address, a reserved word", () => {
    const check = (name: string, slug: string) => shapeProblem({ name, slug }, (value) => validateSlug(value));
    expect(check("", "a")).toMatch(/name is empty/);
    expect(check("x".repeat(81), "a")).toMatch(/longer than 80/);
    expect(check("<b>Pune</b>", "pune")).toMatch(/not allowed/);
    expect(check("Pune", "")).toMatch(/web address is empty/);
    expect(check("Pune", "Pune City!")).toMatch(/cannot be used/);
    expect(check("Search", "search")).toMatch(/reserved/);
    expect(check("Pune", "pune")).toBe("");
  });
});

describe("H16.1 data files", () => {
  const states = new Set(STATES.map(([, name]) => name));

  it("india-cities.csv: every row has a known state, a valid unique slug, a source address, and a real whole-number population or none", () => {
    const table = readCityTable(file("india-cities.csv"));
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    expect(table.rows.length).toBeGreaterThanOrEqual(700);
    expect(table.rows.length).toBeLessThanOrEqual(1000);
    const slugs = new Set<string>();
    for (const row of table.rows) {
      expect(shapeProblem(row, (value) => validateSlug(value)), `line ${row.line}`).toBe("");
      expect(states.has(row.state), `line ${row.line}: ${row.state}`).toBe(true);
      expect(slugs.has(row.slug), `line ${row.line}: repeated slug ${row.slug}`).toBe(false);
      slugs.add(row.slug);
      expect(row.source, `line ${row.line}: a source address`).toMatch(/^https:\/\/\S+/);
      if (row.population !== null) expect(row.population).toBeGreaterThanOrEqual(1000);
    }
    const covered = new Set(table.rows.map((row) => row.state));
    expect([...states].filter((name) => !covered.has(name)), "every state or territory has at least one city").toEqual([]);
    expect(table.rows.filter((row) => row.isDistrictHq).length).toBeGreaterThanOrEqual(500);
  });

  it("india-cities.csv: the cities already on the site keep their spelling and address", () => {
    const table = readCityTable(file("india-cities.csv"));
    if (!table.ok) throw new Error(table.message);
    const by = new Map(table.rows.map((row) => [row.slug, row]));
    for (const slug of ["mumbai", "delhi", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "gurgaon", "mysuru", "thiruvananthapuram"]) expect(by.has(slug), slug).toBe(true);
    expect(by.get("mumbai")?.state).toBe("Maharashtra");
  });

  it("renamed cities appear once, under the new official name: no Maharashtra city is called Aurangabad or Osmanabad, and the Aurangabad of Bihar stays", () => {
    const table = readCityTable(file("india-cities.csv"));
    if (!table.ok) throw new Error(table.message);
    const maharashtra = table.rows.filter((row) => row.state === "Maharashtra").map((row) => row.name);
    expect(maharashtra).not.toContain("Aurangabad");
    expect(maharashtra).not.toContain("Osmanabad");
    expect(maharashtra).toEqual(expect.arrayContaining(["Chhatrapati Sambhajinagar", "Dharashiv", "Ahilyanagar"]));
    expect(table.rows.find((row) => row.state === "Bihar" && row.name === "Aurangabad")).toBeTruthy();
    const slugs = table.rows.map((row) => row.slug);
    expect(slugs).toContain("chhatrapati-sambhajinagar");
    expect(slugs).toContain("dharashiv");
    expect(slugs).not.toContain("osmanabad");
  });

  it("india-areas.csv: every area names a city of india-cities.csv, with a valid slug, unique inside its city", () => {
    const cities = readCityTable(file("india-cities.csv"));
    const areas = readAreaTable(file("india-areas.csv"));
    if (!cities.ok || !areas.ok) throw new Error("A data file could not be read");
    const citySlugs = new Set(cities.rows.map((row) => row.slug));
    const seen = new Set<string>();
    const perCity = new Map<string, number>();
    for (const row of areas.rows) {
      expect(shapeProblem(row, (value) => validateSlug(value)), `line ${row.line}`).toBe("");
      expect(citySlugs.has(row.city), `line ${row.line}: the city key ${row.city} is not in india-cities.csv`).toBe(true);
      const id = `${row.city}|${row.slug}`;
      expect(seen.has(id), `line ${row.line}: repeated area ${id}`).toBe(false);
      seen.add(id);
      perCity.set(row.city, (perCity.get(row.city) ?? 0) + 1);
    }
    expect(perCity.size).toBeGreaterThanOrEqual(15);
    for (const [city, count] of perCity) {
      expect(count, `${city} has 10 to 40 areas`).toBeGreaterThanOrEqual(10);
      expect(count, `${city} has 10 to 40 areas`).toBeLessThanOrEqual(40);
    }
  });
});
