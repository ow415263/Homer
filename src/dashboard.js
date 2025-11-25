import { getStoredPostcard } from "./state/postcardState.js";
import {
  STAMPS_PER_CREDIT,
  defaultTravelLocations,
  latLngToPercent,
  lookupLocation,
} from "./utils/locationUtils.js";

const els = {
  name: document.getElementById("dashboardName"),
  handle: document.getElementById("dashboardHandle"),
  avatar: document.getElementById("dashboardAvatar"),
  sent: document.getElementById("cardsSentCount"),
  received: document.getElementById("cardsReceivedCount"),
  mapPins: document.getElementById("mapPins"),
  mapSummary: document.getElementById("mapSummary"),
  mapCount: document.getElementById("mapCount"),
  stampGrid: document.getElementById("stampGrid"),
  stampStatus: document.getElementById("stampStatus"),
  creditStatus: document.getElementById("creditStatus"),
  year: document.getElementById("year"),
};

const defaultDashboardData = {
  profile: {
    name: "Homer Creator",
    handle: "@homer.user",
  },
  stats: {
    sent: 0,
    received: 0,
  },
};

function initialsFromName(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "HC";
}


function deriveTravelLocations(postcard) {
  const base = defaultTravelLocations.map((loc) => ({ ...loc }));
  const potential = [];

  if (postcard?.location) {
    potential.push(postcard.location);
  }

  if (Array.isArray(postcard?.media)) {
    postcard.media.forEach((item) => {
      if (item?.location) potential.push(item.location);
      if (item?.metadata?.location) potential.push(item.metadata.location);
      if (item?.metadata?.city) potential.push(item.metadata.city);
    });
  }

  potential.forEach((raw) => {
    const match = lookupLocation(raw);
    if (!match) return;
    const existing = base.find((loc) => loc.city === match.city);
    if (existing) {
      existing.count += 1;
    } else {
      base.push({ city: match.city, lat: match.lat, lng: match.lng, count: 1 });
    }
  });

  return base
    .map((loc) => ({ ...loc, coords: latLngToPercent(loc.lat, loc.lng) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function deriveTravelData(postcard, stats) {
  const locations = deriveTravelLocations(postcard || {});
  const totalCards = Math.max((stats?.sent ?? 0) + (stats?.received ?? 0), 0);
  const progress = totalCards % STAMPS_PER_CREDIT;
  return {
    locations,
    total: totalCards,
    stamps: {
}

function renderTravel(travel) {
  const travelData = travel ?? { locations: defaultTravelLocations, stamps: { required: STAMPS_PER_CREDIT, filled: 0, credits: 0, remaining: STAMPS_PER_CREDIT, total: 0 } };
  const locations = Array.isArray(travelData.locations) && travelData.locations.length
    ? travelData.locations
    : defaultTravelLocations;
  if (els.mapPins) {
    els.mapPins.innerHTML = locations.map((loc, index) => {
      const coords = loc.coords ?? latLngToPercent(loc.lat, loc.lng);
      const countLabel = `${loc.count} card${loc.count === 1 ? "" : "s"}`;
      return [
        `<div class=\"dashboard__map-pin\" style=\"--x:${coords.x}%; --y:${coords.y}%;\" role=\"listitem\" aria-label=\"${loc.city}: ${countLabel}\">`,
        '<span class="dashboard__map-pin-dot" aria-hidden="true"></span>',
        '<span class="dashboard__map-pin-label">',
        `<strong>${loc.city}</strong>`,
        `<span>${countLabel}</span>`,
        "</span>",
        "</div>",
      ].join("");
    }).join("");
  }
  if (els.mapCount) {
    const pinCount = locations.length;
    els.mapCount.textContent = `${pinCount} pin${pinCount === 1 ? "" : "s"}`;
  }
  if (els.mapSummary) {
    let summary = "Tracking global moments";
    if (locations.length >= 2) {
      summary = `${locations[0].city} → ${locations[1].city}`;
    } else if (locations.length === 1) {
      summary = `Most cards from ${locations[0].city}`;
    }
    els.mapSummary.textContent = summary;
  }

  const stamps = travelData.stamps ?? { required: STAMPS_PER_CREDIT, filled: 0, credits: 0, remaining: STAMPS_PER_CREDIT, total: 0 };
  const filledCount = Math.max(0, Math.min(stamps.filled, stamps.required));
  if (els.stampGrid) {
    els.stampGrid.innerHTML = Array.from({ length: stamps.required }, (_, index) => {
      const isFilled = index < filledCount;
      const classes = ["dashboard__stamp-token"];
      if (isFilled) classes.push("is-filled");
      return `<div class=\"${classes.join(" ")}\" role=\"listitem\" aria-label=\"Stamp ${index + 1} ${isFilled ? "earned" : "locked"}\">${index + 1}</div>`;
    }).join("");
  }
  if (els.stampStatus) {
    els.stampStatus.textContent = `${filledCount} / ${stamps.required} stamps unlocked`;
  }
  if (els.creditStatus) {
    let message = "Send your first card to unlock stamp rewards";
    if (stamps.credits > 0) {
      message = `${stamps.credits} travel credit${stamps.credits === 1 ? "" : "s"} ready to redeem`;
    } else if (stamps.total > 0) {
      const remaining = stamps.required - filledCount;
      message = `${remaining} more card${remaining === 1 ? "" : "s"} unlocks a free credit`;
    }
    els.creditStatus.textContent = message;
  }
}

function initDashboard() {
  if (els.year) {
    els.year.textContent = new Date().getFullYear();
  }
  const postcard = getStoredPostcard();
  const { stats } = deriveUsage(postcard);
  const travel = deriveTravelData(postcard, stats);
  renderDashboard({ profile: defaultDashboardData.profile, stats, travel });
}

document.addEventListener("DOMContentLoaded", initDashboard);
