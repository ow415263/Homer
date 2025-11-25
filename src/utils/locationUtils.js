const STAMPS_PER_CREDIT = 5;

const defaultTravelLocations = [
  { city: "Toronto, Canada", lat: 43.6532, lng: -79.3832, count: 4 },
  { city: "Lisbon, Portugal", lat: 38.7223, lng: -9.1393, count: 2 },
  { city: "Mexico City, Mexico", lat: 19.4326, lng: -99.1332, count: 3 },
  { city: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, count: 1 },
];

const locationCatalog = [
  { aliases: ["toronto", "ontario", "canada"], city: "Toronto, Canada", lat: 43.6532, lng: -79.3832 },
  { aliases: ["lisbon", "portugal", "lisboa"], city: "Lisbon, Portugal", lat: 38.7223, lng: -9.1393 },
  { aliases: ["mexico city", "cdmx", "mexico"], city: "Mexico City, Mexico", lat: 19.4326, lng: -99.1332 },
  { aliases: ["tokyo", "japan"], city: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  { aliases: ["new york", "nyc", "usa", "united states"], city: "New York, USA", lat: 40.7128, lng: -74.006 },
  { aliases: ["paris", "france"], city: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { aliases: ["sydney", "australia"], city: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
];

function normalizeLocation(raw = "") {
  return raw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, "");
}

function lookupLocation(raw) {
  const normalized = normalizeLocation(raw);
  if (!normalized) return null;
  return locationCatalog.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias)),
  ) || null;
}

function latLngToPercent(lat, lng) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return {
    x: Math.min(98, Math.max(2, Number.isFinite(x) ? x : 50)),
    y: Math.min(98, Math.max(2, Number.isFinite(y) ? y : 50)),
  };
}

function pickRandomLocation() {
  if (!locationCatalog.length) {
    return null;
  }
  const index = Math.floor(Math.random() * locationCatalog.length);
  return locationCatalog[index];
}

export {
  STAMPS_PER_CREDIT,
  defaultTravelLocations,
  latLngToPercent,
  locationCatalog,
  lookupLocation,
  normalizeLocation,
  pickRandomLocation,
};
