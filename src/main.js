import {
  MAX_FILE_BYTES,
  getStoredPostcard,
  normalizeMediaItems,
  persistState,
  preparePostcard,
  state,
  storageKey,
} from "./state/postcardState.js";
import {
  animateDigitalPostcard,
  renderDigitalPostcard,
} from "./components/digitalPostcard.js";
import {
  formatMediaType,
  renderMediaList,
} from "./components/mediaList.js";
import { renderMediaMap, teardownMediaMap } from "./components/mediaMap.js";
import {
  closeMediaModal,
  initModalBindings,
  openInstructionModal,
  openMediaModal,
  playInstructionLoadingAnimation,
} from "./components/modals.js";
import { lookupLocation } from "./utils/locationUtils.js";

const els = {
  senderTab: document.getElementById("senderTab"),
  receiverTab: document.getElementById("receiverTab"),
  senderView: document.getElementById("senderView"),
  receiverView: document.getElementById("receiverView"),
  senderTitle: document.getElementById("senderTitle"),
  senderLocation: document.getElementById("senderLocation"),
  authRadios: document.querySelectorAll("input[name='authLevel']"),
  passwordFields: document.getElementById("passwordFields"),
  senderPassword: document.getElementById("senderPassword"),
  senderHint: document.getElementById("senderHint"),
  senderForm: document.getElementById("senderForm"),
  mediaModalTrigger: document.getElementById("mediaTrigger"),
  mediaModal: document.getElementById("mediaModal"),
  mediaModalBackdrop: document.getElementById("mediaModalBackdrop"),
  mediaModalClose: document.getElementById("mediaModalClose"),
  mediaOptionImage: document.getElementById("mediaOptionImage"),
  mediaOptionVideo: document.getElementById("mediaOptionVideo"),
  mediaOptionLink: document.getElementById("mediaOptionLink"),
  mediaLinkForm: document.getElementById("mediaLinkForm"),
  mediaLinkInput: document.getElementById("mediaLinkInput"),
  mediaLinkCancel: document.getElementById("mediaLinkCancel"),
  mediaImageInput: document.getElementById("mediaImageInput"),
  mediaVideoInput: document.getElementById("mediaVideoInput"),
  mediaList: document.getElementById("mediaList"),
  mediaLocationRadios: document.querySelectorAll("input[name='mediaLocationChoice']"),
  mediaLocationRequirement: document.getElementById("mediaLocationRequirement"),
  mediaOptionsContainer: document.getElementById("mediaOptions"),
  senderFeedback: document.getElementById("senderFeedback"),
  receiverStatus: document.getElementById("receiverStatus"),
  receiverAuth: document.getElementById("receiverAuth"),
  receiverPassword: document.getElementById("receiverPassword"),
  hintText: document.getElementById("hintText"),
  receiverContent: document.getElementById("receiverContent"),
  receiverTitle: document.getElementById("receiverTitle"),
  receiverMeta: document.getElementById("receiverMeta"),
  carouselContainer: document.getElementById("carouselContainer"),
  carouselViewport: document.getElementById("carouselViewport"),
  mediaCarousel: document.getElementById("mediaCarousel"),
  carouselIndicators: document.getElementById("carouselIndicators"),
  prevMedia: document.getElementById("prevMedia"),
  nextMedia: document.getElementById("nextMedia"),
  downloadMedia: document.getElementById("downloadMedia"),
  expandMedia: document.getElementById("expandMedia"),
  mapPreviewToggle: document.getElementById("mapPreviewToggle"),
  mediaMapOverlay: document.getElementById("mediaMapOverlay"),
  year: document.getElementById("year"),
};

let isCarouselFullscreen = false;
let isMapExpanded = false;
let hasGeotaggedMedia = false;

const LOCATION_PREF_KEY = "homer.locationPreference";

function loadLocationPreference() {
  try {
    const raw = localStorage.getItem(LOCATION_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.extractLocationEnabled === "boolean") {
      return parsed.extractLocationEnabled;
    }
    return null;
  } catch (error) {
    console.warn("Unable to read location preference", error);
    return null;
  }
}

function saveLocationPreference(enabled) {
  try {
    localStorage.setItem(LOCATION_PREF_KEY, JSON.stringify({ extractLocationEnabled: Boolean(enabled) }));
  } catch (error) {
    console.warn("Unable to persist location preference", error);
  }
}

function setMediaOptionsDisabled(disabled) {
  const buttons = [els.mediaOptionImage, els.mediaOptionVideo, els.mediaOptionLink];
  buttons.forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
  });
  if (els.mediaOptionsContainer) {
    els.mediaOptionsContainer.classList.toggle("is-disabled", disabled);
    els.mediaOptionsContainer.setAttribute("aria-disabled", String(disabled));
  }
}

function syncLocationExtractionUI() {
  const decided = state.locationPreferenceDecided === true;
  const enabled = Boolean(state.extractLocationEnabled);
  if (els.mediaLocationRadios && els.mediaLocationRadios.length) {
    els.mediaLocationRadios.forEach((radio) => {
      if (radio.value === "share") {
        radio.checked = decided && enabled;
      } else if (radio.value === "skip") {
        radio.checked = decided && !enabled;
      } else {
        radio.checked = false;
      }
    });
  }
  setMediaOptionsDisabled(!decided);
  if (els.mediaLocationRequirement) {
    els.mediaLocationRequirement.classList.toggle("is-visible", !decided);
  }
}

function setLocationExtractionPreference(enabled) {
  state.extractLocationEnabled = Boolean(enabled);
  state.locationPreferenceDecided = true;
  syncLocationExtractionUI();
  saveLocationPreference(state.extractLocationEnabled);
}

function shouldExtractMediaLocations() {
  return Boolean(state.locationPreferenceDecided && state.extractLocationEnabled);
}

function getManualLocationCandidate() {
  const typed = (els.senderLocation?.value || "").trim();
  if (typed) return typed;
  return (state.location || "").trim();
}

function guessLocationFromText(text = "") {
  if (!text) return null;
  const match = lookupLocation(text);
  return match?.city ?? null;
}

function normalizeExifTimestamp(rawValue) {
  if (!rawValue) return null;
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return rawValue.toISOString();
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})\s+/, "$1-$2-$3T");
    const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function formatCoordinateLabel(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Shared memory";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function finalizeMetadata({ location, lat, lng, source = "manual", capturedAt }) {
  const metadata = {
    source,
    capturedAt: capturedAt || new Date().toISOString(),
  };
  if (location) {
    metadata.location = location;
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    metadata.lat = lat;
    metadata.lng = lng;
  } else if (metadata.location) {
    const match = lookupLocation(metadata.location);
    if (match) {
      metadata.lat = match.lat;
      metadata.lng = match.lng;
      metadata.location = match.city;
    }
  }
  return metadata;
}

async function readExifLocationMetadata(file) {
  if (!file || !file.type?.startsWith("image/") || !window.exifr?.gps) {
    return null;
  }
  try {
    const gpsPromise = window.exifr.gps(file);
    const infoPromise = typeof window.exifr.parse === "function"
      ? window.exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate", "ImageDescription"] })
      : Promise.resolve(null);
    const [gps, info] = await Promise.all([gpsPromise, infoPromise]);
    if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) {
      return null;
    }
    const lat = Number(gps.latitude);
    const lng = Number(gps.longitude);
    const description = typeof info?.ImageDescription === "string" ? info.ImageDescription.trim() : "";
    const timestamp = normalizeExifTimestamp(info?.DateTimeOriginal || info?.CreateDate);
    return finalizeMetadata({
      lat,
      lng,
      location: description || formatCoordinateLabel(lat, lng),
      source: "exif",
      capturedAt: timestamp || new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Unable to parse EXIF metadata", error);
    return null;
  }
}

function inferMetadataFromHints({ file, hint }) {
  const candidates = [];
  if (file?.name) {
    candidates.push(file.name.replace(/[_.-]+/g, " "));
  }
  if (hint) {
    candidates.push(hint);
  }
  const manual = getManualLocationCandidate();
  if (manual) {
    candidates.push(manual);
  }
  const resolved = candidates.map((candidate) => guessLocationFromText(candidate)).find(Boolean);
  const label = resolved || manual;
  if (!label) return null;
  return finalizeMetadata({
    location: label,
    source: resolved ? "inferred" : "manual",
  });
}

async function maybeExtractLocationMetadata({ file, hint } = {}) {
  if (!shouldExtractMediaLocations()) return null;
  const exifMetadata = await readExifLocationMetadata(file);
  if (exifMetadata) {
    return exifMetadata;
  }
  return inferMetadataFromHints({ file, hint });
}

function setActiveView(view) {
  const senderActive = view === "sender";
  els.senderTab.classList.toggle("is-active", senderActive);
  els.receiverTab.classList.toggle("is-active", !senderActive);
  els.senderTab.setAttribute("aria-selected", String(senderActive));
  els.receiverTab.setAttribute("aria-selected", String(!senderActive));
  els.senderView.classList.toggle("is-hidden", !senderActive);
  els.receiverView.classList.toggle("is-hidden", senderActive);
}

function setReceiverStatus(message = "") {
  if (!els.receiverStatus) return;
  if (message) {
    els.receiverStatus.textContent = message;
    els.receiverStatus.classList.remove("is-hidden");
  } else {
    els.receiverStatus.textContent = "";
    els.receiverStatus.classList.add("is-hidden");
  }
}

function updateExpandButtonState(active, available) {
  if (!els.expandMedia) return;
  if (!available) {
    els.expandMedia.classList.add("is-hidden");
  } else {
    els.expandMedia.classList.remove("is-hidden");
  }
  els.expandMedia.setAttribute("aria-pressed", String(Boolean(active)));
  els.expandMedia.textContent = active ? "Exit full screen" : "Expand";
  els.expandMedia.setAttribute("aria-label", active ? "Exit full screen" : "Expand media");
}

function exitCarouselFullscreen() {
  if (document.fullscreenElement === els.carouselContainer) {
    document.exitFullscreen?.();
  }
}

function toggleCarouselFullscreen() {
  if (!els.carouselContainer || !document.fullscreenEnabled || typeof els.carouselContainer.requestFullscreen !== "function") {
    return;
  }
  if (document.fullscreenElement === els.carouselContainer) {
    document.exitFullscreen?.();
  } else if (!document.fullscreenElement) {
    els.carouselContainer.requestFullscreen().catch((error) => {
      console.error("Failed to enter full screen", error);
      setReceiverStatus("Unable to enter full screen.");
      const available = !!els.expandMedia && !els.expandMedia.classList.contains("is-hidden");
      updateExpandButtonState(false, available);
    });
  } else {
    document.exitFullscreen?.();
  }
}

function handleFullscreenChange() {
  if (!els.carouselContainer) return;
  const active = document.fullscreenElement === els.carouselContainer;
  isCarouselFullscreen = active;
  const available = !!els.expandMedia && !els.expandMedia.classList.contains("is-hidden");
  updateExpandButtonState(active, available);
  if (active) {
    document.addEventListener("keydown", handleCarouselFullscreenKeydown);
  } else {
    document.removeEventListener("keydown", handleCarouselFullscreenKeydown);
  }
}

function handleFullscreenError() {
  console.error("Fullscreen unavailable", new Error("fullscreenerror"));
  isCarouselFullscreen = false;
  setReceiverStatus("Unable to enter full screen on this device.");
  const available = !!els.expandMedia && !els.expandMedia.classList.contains("is-hidden");
  updateExpandButtonState(false, available);
  document.removeEventListener("keydown", handleCarouselFullscreenKeydown);
  exitCarouselFullscreen();
}

function handleCarouselFullscreenKeydown(event) {
  if (!isCarouselFullscreen) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    shiftCarousel(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    shiftCarousel(-1);
  }
}

function renderSenderMediaList() {
  renderMediaList({
    items: state.media,
    container: els.mediaList,
    onRemove: (index) => {
      state.media.splice(index, 1);
      renderSenderMediaList();
      els.senderFeedback.textContent = "Media removed.";
    },
  });
}

function showLinkForm() {
  if (!els.mediaLinkForm) return;
  els.mediaLinkForm.classList.remove("is-hidden");
  els.mediaLinkInput?.focus();
}

function hideLinkForm() {
  if (!els.mediaLinkForm) return;
  els.mediaLinkForm.classList.add("is-hidden");
  if (els.mediaLinkInput) {
    els.mediaLinkInput.value = "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Unsupported file encoding"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function handleMediaLinkSubmit(event) {
  event.preventDefault();
  if (!els.mediaLinkInput) return;
  const url = els.mediaLinkInput.value.trim();
  if (!url) {
    els.senderFeedback.textContent = "Enter a valid URL before adding it.";
    return;
  }
  try {
    new URL(url);
  } catch (error) {
    els.senderFeedback.textContent = "The media URL must be valid.";
    return;
  }
  const mediaItem = { type: "link", url };
  const extractedMetadata = await maybeExtractLocationMetadata({ hint: url });
  if (extractedMetadata) {
    mediaItem.metadata = extractedMetadata;
  }
  state.media.push(mediaItem);
  renderSenderMediaList();
  els.senderFeedback.textContent = "Link added.";
  closeMediaModal();
}

async function handleFileSelection(type, fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    return;
  }
  const maxMb = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
  const focusTarget = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : els.mediaModalTrigger;
  closeMediaModal({ restoreFocus: false });
  hideLinkForm();
  let added = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      els.senderFeedback.textContent = `Could not attach ${file.name}. Files must be under ${maxMb} MB.`;
      continue;
    }
    els.senderFeedback.textContent = "Processing file...";
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const mediaItem = {
        type,
        dataUrl,
        name: file.name,
        mime: file.type,
      };
      const extractedMetadata = await maybeExtractLocationMetadata({ file });
      if (extractedMetadata) {
        mediaItem.metadata = extractedMetadata;
      }
      state.media.push(mediaItem);
      added += 1;
    } catch (error) {
      console.error("Failed to read file", error);
      els.senderFeedback.textContent = `Unable to read ${file.name}. Try a different file.`;
    }
  }
  if (added > 0) {
    renderSenderMediaList();
    const label = formatMediaType(type);
    const response = added > 1 ? `${label}s added.` : `${label} added.`;
    els.senderFeedback.textContent = response;
  }
  if (focusTarget) {
    focusTarget.focus?.();
  }
}

function handleSenderSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const title = (formData.get("title") || "").trim();
  const location = (formData.get("location") || "").trim();
  const authLevel = formData.get("authLevel") || "none";
  const password = (formData.get("password") || "").trim();
  const hint = (formData.get("hint") || "").trim();

  if (!title) {
    els.senderFeedback.textContent = "Please enter a collection title.";
    return;
  }

  if (!state.media.length) {
    els.senderFeedback.textContent = "Attach at least one media item before embedding.";
    return;
  }

  if (authLevel === "password" && password.length < 4) {
    els.senderFeedback.textContent = "Password must be at least 4 characters.";
    return;
  }

  state.title = title;
  state.location = location;
  state.authLevel = authLevel;
  state.password = authLevel === "password" ? password : "";
  state.hint = authLevel === "password" ? hint : "";
  state.createdAt = new Date().toISOString();
  const saved = persistState();
  if (!saved) {
    els.senderFeedback.textContent = "Unable to save postcard. Remove large media and try again.";
    return;
  }

  els.senderFeedback.innerHTML = [
    "<p>Your postcard is encoded and ready to send.</p>",
    "<ul class=\"confirmation__list\">",
    "<li>Add postage to the physical card.</li>",
    "<li>Stick the NFC tag where it's easy to tap.</li>",
    "<li>Put the postcard in the mail.</li>",
    "</ul>",
  ].join("");
  const postcard = preparePostcard(saved) || saved;
  renderDigitalPostcard(postcard);
  renderReceiverExperience();
  playInstructionLoadingAnimation().then(() => {
    openInstructionModal();
  });
}

function renderReceiverExperience() {
  const postcard = getStoredPostcard();
  renderDigitalPostcard(postcard);
  if (!postcard) {
    setReceiverStatus("No postcard embedded yet. Configure one on the sender tab.");
    els.receiverAuth.classList.add("is-hidden");
    els.receiverContent.classList.add("is-hidden");
    state.receiverMedia = [];
    state.currentSlide = 0;
    els.prevMedia.disabled = true;
    els.nextMedia.disabled = true;
    els.downloadMedia.disabled = true;
    updateExpandButtonState(false, false);
    exitCarouselFullscreen();
    setMapExpanded(false);
    updateMapToggleAvailability(false);
    teardownMediaMap();
    return;
  }

  if (postcard.authLevel === "password") {
    setReceiverStatus("This postcard is protected. Enter the password to unlock.");
  } else {
    setReceiverStatus("");
  }

  if (postcard.authLevel === "password") {
    els.receiverAuth.classList.remove("is-hidden");
    els.hintText.textContent = postcard.hint ? `Hint: ${postcard.hint}` : "";
    els.receiverContent.classList.add("is-hidden");
    els.receiverPassword.value = "";
    state.receiverMedia = [];
    state.currentSlide = 0;
    els.prevMedia.disabled = true;
    els.nextMedia.disabled = true;
    els.downloadMedia.disabled = true;
    updateExpandButtonState(false, false);
    exitCarouselFullscreen();
    setMapExpanded(false);
    updateMapToggleAvailability(false);
    teardownMediaMap();
  } else {
    els.receiverAuth.classList.add("is-hidden");
    presentReceiverContent(postcard);
  }
}

function presentReceiverContent(postcard) {
  setReceiverStatus("");
  els.receiverContent.classList.remove("is-hidden");
  els.receiverTitle.textContent = postcard.title || "Untitled collection";
  const date = postcard.createdAt
    ? new Date(postcard.createdAt).toLocaleString()
    : "";
  const metaParts = [date, postcard.location].filter(Boolean);
  els.receiverMeta.textContent = metaParts.join(" · ");
  state.currentSlide = 0;
  state.receiverMedia = normalizeMediaItems(postcard.media);
  buildCarousel(state.receiverMedia);
  updateCarousel();
  setMapExpanded(false);
  updateReceiverMap();
}

function buildCarousel(mediaItems) {
  els.mediaCarousel.innerHTML = "";
  if (!mediaItems?.length) {
    const empty = document.createElement("div");
    empty.className = "carousel__item";
    empty.innerHTML = "<p>No media attached yet.</p>";
    els.mediaCarousel.appendChild(empty);
    els.prevMedia.disabled = true;
    els.nextMedia.disabled = true;
    els.downloadMedia.disabled = true;
    updateExpandButtonState(false, false);
    exitCarouselFullscreen();
    renderCarouselIndicators();
    updateIndicatorState();
    updateMapToggleAvailability(false);
    setMapExpanded(false);
    teardownMediaMap();
    return;
  }

  let hasVisualMedia = false;
  mediaItems.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.className = "carousel__item";
    slide.dataset.index = String(index);

    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.dataUrl || item.url || "";
      img.alt = item.name || "Shared image";
      slide.appendChild(img);
      hasVisualMedia = true;
    } else if (item.type === "video") {
      const video = document.createElement("video");
      video.src = item.dataUrl || item.url || "";
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      slide.appendChild(video);
      hasVisualMedia = true;
    } else {
      const link = document.createElement("a");
      const href = item.url || item.dataUrl || "";
      if (href) {
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = href;
      } else {
        link.textContent = "Link unavailable";
        link.setAttribute("aria-disabled", "true");
      }
      slide.appendChild(link);
    }
    els.mediaCarousel.appendChild(slide);
  });

  els.prevMedia.disabled = mediaItems.length <= 1;
  els.nextMedia.disabled = mediaItems.length <= 1;
  els.downloadMedia.disabled = false;
  const active = document.fullscreenElement === els.carouselContainer && hasVisualMedia;
  if (!hasVisualMedia) {
    exitCarouselFullscreen();
  }
  isCarouselFullscreen = active;
  updateExpandButtonState(active, hasVisualMedia);
  renderCarouselIndicators();
  updateIndicatorState();
}

function renderCarouselIndicators() {
  if (!els.carouselIndicators) return;
  const total = state.receiverMedia.length;
  els.carouselIndicators.innerHTML = "";
  if (total <= 1) {
    els.carouselIndicators.classList.add("is-hidden");
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < total; index += 1) {
    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = "carousel__indicator";
    indicator.setAttribute("aria-label", `Go to media ${index + 1}`);
    if (index === state.currentSlide) {
      indicator.classList.add("is-active");
    }
    indicator.addEventListener("click", () => {
      state.currentSlide = index;
      updateCarousel();
    });
    fragment.appendChild(indicator);
  }
  els.carouselIndicators.appendChild(fragment);
  els.carouselIndicators.classList.remove("is-hidden");
}

function updateIndicatorState() {
  if (!els.carouselIndicators || !els.carouselIndicators.children.length) return;
  Array.from(els.carouselIndicators.children).forEach((indicator, index) => {
    indicator.classList.toggle("is-active", index === state.currentSlide);
  });
}

function updateCarousel() {
  const slides = els.mediaCarousel.children;
  if (!slides.length) return;
  const offset = state.currentSlide * -100;
  els.mediaCarousel.style.transform = `translateX(${offset}%)`;
  updateIndicatorState();
}

function shiftCarousel(delta) {
  if (!state.receiverMedia.length) return;
  const maxIndex = state.receiverMedia.length - 1;
  const nextIndex = Math.max(0, Math.min(maxIndex, state.currentSlide + delta));
  state.currentSlide = nextIndex;
  updateCarousel();
}

function downloadCurrentMedia() {
  if (!state.receiverMedia.length) return;
  const current = state.receiverMedia[state.currentSlide] ?? state.receiverMedia[0];
  if (!current) return;
  if (current.type === "image" || current.type === "video") {
    const href = current.dataUrl || current.url;
    if (!href) {
      setReceiverStatus("Download unavailable for this item.");
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = current.name || `${current.type}-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  if (current.type === "link" && current.url) {
    window.open(current.url, "_blank", "noopener");
    return;
  }

  const fallback = current.dataUrl || current.url;
  if (fallback) {
    window.open(fallback, "_blank", "noopener");
  }
}

function updateMapToggleAvailability(hasMarkers) {
  hasGeotaggedMedia = hasMarkers;
  if (!els.mapPreviewToggle) return;
  els.mapPreviewToggle.classList.toggle("is-hidden", !hasMarkers);
  if (!hasMarkers) {
    setMapExpanded(false);
  }
  els.mapPreviewToggle.setAttribute("aria-pressed", String(isMapExpanded && hasMarkers));
}

function collectGeotaggedMedia(mediaItems = state.receiverMedia) {
  return mediaItems
    .map((item) => {
      if (!item) return null;
      const metadata = item.metadata || {};
      let lat = Number(metadata.lat);
      let lng = Number(metadata.lng);
      let label = metadata.location || item.location || null;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const fallbackLabel = metadata.location || item.location || "";
        if (fallbackLabel) {
          const match = lookupLocation(fallbackLabel);
          if (match) {
            lat = match.lat;
            lng = match.lng;
            label = match.city;
          }
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const previewUrl = item.type === "image" ? (item.dataUrl || item.url || "") : null;
      const descriptionParts = [formatMediaType(item.type)];
      if (metadata.source) {
        descriptionParts.push(`via ${metadata.source}`);
      }

      return {
        lat,
        lng,
        label: label || formatCoordinateLabel(lat, lng),
        description: descriptionParts.join(" · "),
        previewUrl,
        capturedAt: metadata.capturedAt,
      };
    })
    .filter(Boolean);
}

async function updateReceiverMap() {
  if (!els.mediaMapOverlay) return;
  const markers = collectGeotaggedMedia();
  updateMapToggleAvailability(markers.length > 0);
  if (!markers.length) {
    teardownMediaMap();
    return;
  }
  try {
    await renderMediaMap({ container: els.mediaMapOverlay, items: markers });
  } catch (error) {
    console.error("Unable to render Google Maps", error);
  }
}

function setMapExpanded(expanded) {
  const nextState = Boolean(expanded && hasGeotaggedMedia);
  isMapExpanded = nextState;
  if (els.carouselContainer) {
    els.carouselContainer.classList.toggle("carousel--map-expanded", nextState);
  }
  if (els.mapPreviewToggle) {
    els.mapPreviewToggle.setAttribute("aria-pressed", String(nextState));
  }
}

function handlePasswordSubmit(event) {
  event.preventDefault();
  const postcard = getStoredPostcard();
  if (!postcard) return;
  const userPassword = els.receiverPassword.value.trim();
  if (userPassword !== postcard.password) {
    setReceiverStatus("Incorrect password. Try again.");
    return;
  }
  setReceiverStatus("");
  els.receiverAuth.classList.add("is-hidden");
  presentReceiverContent(postcard);
}

function bindEvents() {
  initModalBindings({
    onMediaClosed: hideLinkForm,
  });
  if (els.senderTab) {
    els.senderTab.addEventListener("click", () => setActiveView("sender"));
  }
  if (els.receiverTab) {
    els.receiverTab.addEventListener("click", () => {
      setActiveView("receiver");
      renderReceiverExperience();
    });
  }

  if (els.mediaModalTrigger) {
    const openMedia = () => {
      hideLinkForm();
      openMediaModal();
      syncLocationExtractionUI();
    };
    els.mediaModalTrigger.addEventListener("click", openMedia);
    els.mediaModalTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMedia();
      }
    });
  }
  if (els.mediaOptionImage && els.mediaImageInput) {
    els.mediaOptionImage.addEventListener("click", () => {
      els.mediaImageInput.value = "";
      els.mediaImageInput.click();
    });
    els.mediaImageInput.addEventListener("change", (event) => {
      void handleFileSelection("image", event.target.files);
      event.target.value = "";
    });
  }
  if (els.mediaOptionVideo && els.mediaVideoInput) {
    els.mediaOptionVideo.addEventListener("click", () => {
      els.mediaVideoInput.value = "";
      els.mediaVideoInput.click();
    });
    els.mediaVideoInput.addEventListener("change", (event) => {
      void handleFileSelection("video", event.target.files);
      event.target.value = "";
    });
  }
  if (els.mediaOptionLink) {
    els.mediaOptionLink.addEventListener("click", showLinkForm);
  }
  if (els.mediaLinkForm) {
    els.mediaLinkForm.addEventListener("submit", handleMediaLinkSubmit);
  }
  if (els.mediaLinkCancel) {
    els.mediaLinkCancel.addEventListener("click", () => {
      hideLinkForm();
      const focusTarget = els.mediaOptionLink || els.mediaOptionImage || els.mediaModalClose;
      focusTarget?.focus();
    });
  }

  if (els.mapPreviewToggle) {
    els.mapPreviewToggle.addEventListener("click", () => {
      if (!hasGeotaggedMedia || isMapExpanded) {
        return;
      }
      setMapExpanded(true);
      void updateReceiverMap();
    });
  }

  if (els.mediaCarousel) {
    els.mediaCarousel.addEventListener("click", () => {
      if (isMapExpanded) {
        setMapExpanded(false);
      }
    });
  }

  if (els.mediaLocationRadios && els.mediaLocationRadios.length) {
    els.mediaLocationRadios.forEach((radio) => {
      radio.addEventListener("change", (event) => {
        const enabled = event.target.value === "share";
        setLocationExtractionPreference(enabled);
        if (els.mediaLocationRequirement) {
          els.mediaLocationRequirement.textContent = enabled
            ? "Location labels will be added to upcoming uploads."
            : "Uploads will stay location-free until you enable labels again.";
        }
      });
    });
  }

  if (els.senderForm) {
    els.senderForm.addEventListener("submit", handleSenderSubmit);
  }
  if (els.receiverAuth) {
    els.receiverAuth.addEventListener("submit", handlePasswordSubmit);
  }
  if (els.prevMedia) {
    els.prevMedia.addEventListener("click", () => shiftCarousel(-1));
  }
  if (els.nextMedia) {
    els.nextMedia.addEventListener("click", () => shiftCarousel(1));
  }
  if (els.downloadMedia) {
    els.downloadMedia.addEventListener("click", downloadCurrentMedia);
  }

  els.authRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const { value } = event.target;
      const requiresPassword = value === "password";
      els.passwordFields.classList.toggle("is-hidden", !requiresPassword);
      state.authLevel = value;
      if (!requiresPassword) {
        state.password = "";
        state.hint = "";
        if (els.senderPassword) {
          els.senderPassword.value = "";
        }
        if (els.senderHint) {
          els.senderHint.value = "";
        }
      }
    });
  });

  if (els.expandMedia && document.fullscreenEnabled && els.carouselContainer && typeof els.carouselContainer.requestFullscreen === "function") {
    els.expandMedia.addEventListener("click", toggleCarouselFullscreen);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("fullscreenerror", handleFullscreenError);
  } else if (els.expandMedia) {
    updateExpandButtonState(false, false);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) {
      const updated = getStoredPostcard();
      if (updated) {
        state.title = updated.title ?? "";
        state.location = updated.location ?? "";
        state.authLevel = updated.authLevel ?? "none";
        state.password = updated.password ?? "";
        state.hint = updated.hint ?? "";
        state.createdAt = updated.createdAt ?? "";
        if (typeof updated.extractLocationEnabled === "boolean") {
          state.extractLocationEnabled = updated.extractLocationEnabled;
          state.locationPreferenceDecided = Boolean(updated.locationPreferenceDecided ?? true);
        } else {
          state.extractLocationEnabled = null;
          state.locationPreferenceDecided = Boolean(updated.locationPreferenceDecided);
        }
        state.media = normalizeMediaItems(updated.media);
        renderSenderMediaList();
        if (els.senderTitle) {
          els.senderTitle.value = state.title;
        }
        if (els.senderLocation) {
          els.senderLocation.value = state.location;
        }
        if (els.senderPassword) {
          els.senderPassword.value = state.password;
        }
        if (els.senderHint) {
          els.senderHint.value = state.hint;
        }
        els.authRadios.forEach((radio) => {
          radio.checked = radio.value === state.authLevel;
        });
        els.passwordFields.classList.toggle("is-hidden", state.authLevel !== "password");
        syncLocationExtractionUI();
      }
      renderReceiverExperience();
    }
  });
}

function init() {
  els.year.textContent = new Date().getFullYear();
  const stored = getStoredPostcard();
  let postcardPreference = { decided: false, enabled: null };
  if (stored) {
    state.media = normalizeMediaItems(stored.media);
    state.title = stored.title ?? "";
    state.location = stored.location ?? "";
    state.authLevel = stored.authLevel ?? "none";
    state.password = stored.password ?? "";
    state.hint = stored.hint ?? "";
    state.createdAt = stored.createdAt ?? "";
    postcardPreference = {
      decided: Boolean(stored.locationPreferenceDecided),
      enabled: typeof stored.extractLocationEnabled === "boolean" ? stored.extractLocationEnabled : null,
    };
  }
  const storedPreference = loadLocationPreference();
  if (typeof storedPreference === "boolean") {
    state.extractLocationEnabled = storedPreference;
    state.locationPreferenceDecided = true;
  } else if (postcardPreference.decided) {
    state.extractLocationEnabled = postcardPreference.enabled;
    state.locationPreferenceDecided = true;
  } else {
    state.extractLocationEnabled = null;
    state.locationPreferenceDecided = false;
  }
  if (els.senderTitle) {
    els.senderTitle.value = state.title;
  }
  if (els.senderLocation) {
    els.senderLocation.value = state.location;
  }
  if (els.senderPassword) {
    els.senderPassword.value = state.password;
  }
  if (els.senderHint) {
    els.senderHint.value = state.hint;
  }
  els.authRadios.forEach((radio) => {
    radio.checked = radio.value === state.authLevel;
  });
  els.passwordFields.classList.toggle("is-hidden", state.authLevel !== "password");
  syncLocationExtractionUI();
  renderSenderMediaList();
  renderReceiverExperience();
  bindEvents();
  requestAnimationFrame(() => {
    animateDigitalPostcard();
  });
}

document.addEventListener("DOMContentLoaded", init);
