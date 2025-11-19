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
import {
  closeMediaModal,
  initModalBindings,
  openInstructionModal,
  openMediaModal,
  playInstructionLoadingAnimation,
} from "./components/modals.js";

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
  prevMedia: document.getElementById("prevMedia"),
  nextMedia: document.getElementById("nextMedia"),
  downloadMedia: document.getElementById("downloadMedia"),
  expandMedia: document.getElementById("expandMedia"),
  year: document.getElementById("year"),
};

let isCarouselFullscreen = false;

function setActiveView(view) {
  const senderActive = view === "sender";
  els.senderTab.classList.toggle("is-active", senderActive);
  els.receiverTab.classList.toggle("is-active", !senderActive);
  els.senderTab.setAttribute("aria-selected", String(senderActive));
  els.receiverTab.setAttribute("aria-selected", String(!senderActive));
  els.senderView.classList.toggle("is-hidden", !senderActive);
  els.receiverView.classList.toggle("is-hidden", senderActive);
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
      if (els.receiverStatus) {
        els.receiverStatus.textContent = "Unable to enter full screen.";
      }
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
  isCarouselFullscreen = false;
  const available = !!els.expandMedia && !els.expandMedia.classList.contains("is-hidden");
  updateExpandButtonState(false, available);
  if (els.receiverStatus) {
    els.receiverStatus.textContent = "Full screen mode is not available.";
  }
  document.removeEventListener("keydown", handleCarouselFullscreenKeydown);
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

function handleMediaLinkSubmit(event) {
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
  state.media.push({ type: "link", url });
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
      state.media.push({
        type,
        dataUrl,
        name: file.name,
        mime: file.type,
      });
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
    els.receiverStatus.textContent = "No postcard embedded yet. Configure one on the sender tab.";
    els.receiverAuth.classList.add("is-hidden");
    els.receiverContent.classList.add("is-hidden");
    state.receiverMedia = [];
    state.currentSlide = 0;
    els.prevMedia.disabled = true;
    els.nextMedia.disabled = true;
    els.downloadMedia.disabled = true;
    updateExpandButtonState(false, false);
    exitCarouselFullscreen();
    return;
  }

  els.receiverStatus.textContent = postcard.authLevel === "password"
    ? "This postcard is protected. Enter the password to unlock."
    : "Tap next to explore the shared memories.";

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
  } else {
    els.receiverAuth.classList.add("is-hidden");
    presentReceiverContent(postcard);
  }
}

function presentReceiverContent(postcard) {
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
}

function updateCarousel() {
  const slides = els.mediaCarousel.children;
  if (!slides.length) return;
  const offset = state.currentSlide * -100;
  els.mediaCarousel.style.transform = `translateX(${offset}%)`;
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
      els.receiverStatus.textContent = "Download unavailable for this item.";
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

function handlePasswordSubmit(event) {
  event.preventDefault();
  const postcard = getStoredPostcard();
  if (!postcard) return;
  const userPassword = els.receiverPassword.value.trim();
  if (userPassword !== postcard.password) {
    els.receiverStatus.textContent = "Incorrect password. Try again.";
    return;
  }
  els.receiverStatus.textContent = "Unlocked! Enjoy the memories.";
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
      }
      renderReceiverExperience();
    }
  });
}

function init() {
  els.year.textContent = new Date().getFullYear();
  const stored = getStoredPostcard();
  if (stored) {
    state.media = normalizeMediaItems(stored.media);
    state.title = stored.title ?? "";
    state.location = stored.location ?? "";
    state.authLevel = stored.authLevel ?? "none";
    state.password = stored.password ?? "";
    state.hint = stored.hint ?? "";
    state.createdAt = stored.createdAt ?? "";
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
  renderSenderMediaList();
  renderReceiverExperience();
  bindEvents();
  requestAnimationFrame(() => {
    animateDigitalPostcard();
  });
}

document.addEventListener("DOMContentLoaded", init);
