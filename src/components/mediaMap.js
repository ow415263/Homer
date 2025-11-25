import { GOOGLE_MAPS_MAP_ID } from "../config.js";
import { loadGoogleMapsApi } from "../utils/mapsLoader.js";

let mapInstance = null;
let infoWindow = null;
let activeMarkers = [];
let currentContainer = null;

const defaultMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#f8fafc" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function clearMarkers() {
  activeMarkers.forEach((marker) => marker.setMap(null));
  activeMarkers = [];
  if (infoWindow) {
    infoWindow.close();
  }
}

async function ensureMap(container) {
  if (!container) {
    throw new Error("Missing map container.");
  }
  const googleMaps = await loadGoogleMapsApi();
  if (!googleMaps) {
    throw new Error("Google Maps SDK unavailable.");
  }
  if (!mapInstance || currentContainer !== container) {
    mapInstance = new googleMaps.Map(container, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      mapId: GOOGLE_MAPS_MAP_ID || undefined,
      styles: GOOGLE_MAPS_MAP_ID ? undefined : defaultMapStyles,
      backgroundColor: "#0b1220",
    });
    infoWindow = new googleMaps.InfoWindow();
    currentContainer = container;
  }
  return googleMaps;
}

function buildInfoWindowContent({ label, description, previewUrl, capturedAt }) {
  const date = capturedAt ? new Date(capturedAt).toLocaleString() : "";
  const normalizedLabel = label || "Shared memory";
  return [
    '<div class="media-map__info">',
    `<p class="media-map__info-label"><strong>${normalizedLabel}</strong></p>`,
    description ? `<p class="media-map__info-sub">${description}${date ? ` · ${date}` : ""}</p>` : date ? `<p class="media-map__info-sub">${date}</p>` : "",
    previewUrl ? `<img src="${previewUrl}" alt="${normalizedLabel}" loading="lazy" />` : "",
    "</div>",
  ].join("");
}

async function renderMediaMap({ container, items = [] }) {
  const googleMaps = await ensureMap(container);
  clearMarkers();

  if (!items.length) {
    return { count: 0 };
  }

  const bounds = new googleMaps.LatLngBounds();
  activeMarkers = items.map((item) => {
    const marker = new googleMaps.Marker({
      position: { lat: item.lat, lng: item.lng },
      map: mapInstance,
      title: item.label || "Shared memory",
    });
    marker.addListener("click", () => {
      infoWindow.setContent(buildInfoWindowContent(item));
      infoWindow.open({ anchor: marker, map: mapInstance, shouldFocus: false });
    });
    bounds.extend(marker.getPosition());
    return marker;
  });

  if (items.length === 1) {
    mapInstance.setZoom(6);
    mapInstance.setCenter({ lat: items[0].lat, lng: items[0].lng });
  } else {
    mapInstance.fitBounds(bounds, 48);
  }

  return { count: items.length };
}

function teardownMediaMap() {
  clearMarkers();
  if (mapInstance) {
    mapInstance = null;
    infoWindow = null;
    currentContainer = null;
  }
}

export {
  renderMediaMap,
  teardownMediaMap,
};
