const storageKey = "homer.postcard.payload";
const MAX_FILE_BYTES = 3 * 1024 * 1024; // ~3 MB keeps base64 within localStorage limits

const state = {
  media: [],
  authLevel: "none",
  password: "",
  hint: "",
  title: "",
  location: "",
  createdAt: "",
  currentSlide: 0,
  receiverMedia: [],
};

function normalizeMediaItems(media) {
  if (!Array.isArray(media)) return [];
  return media.reduce((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const type = item.type ?? (item.url ? "link" : null);
    if (!type) return acc;

    if (type === "link") {
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) return acc;
      acc.push({ type: "link", url });
      return acc;
    }

    if (type === "image" || type === "video") {
      const dataUrl = typeof item.dataUrl === "string" && item.dataUrl
        ? item.dataUrl
        : (typeof item.url === "string" ? item.url : "");
      if (!dataUrl) return acc;
      const normalized = {
        type,
        dataUrl,
      };
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (name) normalized.name = name;
      const mime = typeof item.mime === "string" ? item.mime : "";
      if (mime) normalized.mime = mime;
      acc.push(normalized);
      return acc;
    }

    return acc;
  }, []);
}

function preparePostcard(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    media: normalizeMediaItems(Array.isArray(raw.media) ? raw.media : []),
  };
}

function persistState() {
  state.media = normalizeMediaItems(state.media);
  const payload = {
    title: state.title,
    location: state.location,
    authLevel: state.authLevel,
    hint: state.hint,
    password: state.password,
    createdAt: state.createdAt,
    media: state.media,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.error("Failed to persist postcard", error);
    return null;
  }
}

function getStoredPostcard() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return preparePostcard(parsed);
  } catch (error) {
    console.error("Failed to parse stored postcard", error);
    return null;
  }
}

export {
  MAX_FILE_BYTES,
  getStoredPostcard,
  normalizeMediaItems,
  persistState,
  preparePostcard,
  state,
  storageKey,
};
