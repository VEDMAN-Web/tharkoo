// A district that has the same name as its city (e.g. "Kolkata District" in Kolkata) duplicates the city page.
export function normalPlace(name: string) {
  return name.toLowerCase().replace(/\b(district|city|urban)\b/g, "").replace(/[^a-z]/g, "");
}

export function isCityAlias(cityName: string, districtName: string) {
  return normalPlace(cityName) !== "" && normalPlace(cityName) === normalPlace(districtName);
}
