import { GOOGLE_MAPS_API_KEY } from "../config.js";

let googleMapsPromise = null;
let scriptTag = null;

function resetLoader() {
  googleMapsPromise = null;
  if (scriptTag) {
    scriptTag.remove();
    scriptTag = null;
  }
}

function loadGoogleMapsApi() {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.startsWith("YOUR_GOOGLE_MAPS_API_KEY")) {
    return Promise.reject(new Error("Google Maps API key missing. Update window.HOMER_CONFIG.googleMapsApiKey."));
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    scriptTag = document.createElement("script");
    scriptTag.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    scriptTag.async = true;
    scriptTag.defer = true;
    scriptTag.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        resetLoader();
        reject(new Error("Google Maps loaded without maps namespace."));
      }
    };
    scriptTag.onerror = () => {
      resetLoader();
      reject(new Error("Failed to load Google Maps script."));
    };
    document.head.appendChild(scriptTag);
  });

  return googleMapsPromise;
}

export {
  loadGoogleMapsApi,
};
