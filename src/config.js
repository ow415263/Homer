const globalConfig = typeof window !== "undefined" ? (window.HOMER_CONFIG || {}) : {};

const GOOGLE_MAPS_API_KEY = globalConfig.googleMapsApiKey || "YOUR_GOOGLE_MAPS_API_KEY";
const GOOGLE_MAPS_MAP_ID = globalConfig.googleMapsMapId || "";

export {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
};
