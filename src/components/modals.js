const CLOSE_KEYS = new Set(["Escape", "Esc"]);

const modalSelectors = {
  mediaModal: "#mediaModal",
  instructionModal: "#instructionModal",
  mediaBackdrop: "#mediaModalBackdrop",
  instructionBackdrop: "#instructionModalBackdrop",
  mediaClose: "#mediaModalClose",
  instructionClose: "#instructionModalClose",
  instructionDismiss: "#instructionModalDismiss",
  mediaOptionImage: "#mediaOptionImage",
  mediaOptionVideo: "#mediaOptionVideo",
  mediaOptionLink: "#mediaOptionLink",
  loadingOverlay: "#loadingOverlay",
  loadingContent: "#loadingOverlayContent",
  loadingSpinner: "#loadingSpinner",
  loadingText: "#loadingOverlayText",
};

const modalState = {
  mediaReturnFocus: null,
  instructionReturnFocus: null,
  activeMediaKeyListener: null,
  activeInstructionKeyListener: null,
  mediaTrapCleanup: null,
  instructionTrapCleanup: null,
  loadingTimeline: null,
};

function getModalElement(selector) {
  return document.querySelector(selector);
}

function toggleBodyModalState() {
  const mediaModal = getModalElement(modalSelectors.mediaModal);
  const instructionModal = getModalElement(modalSelectors.instructionModal);
  const loadingOverlay = document.querySelector("#loadingOverlay");
  const anyOpen = [mediaModal, instructionModal, loadingOverlay].some((element) => element && !element.classList.contains("is-hidden"));
  document.body.classList.toggle("modal-open", anyOpen);
}

function trapFocus(container, fallback) {
  if (!container) return null;
  const focusable = container.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (!focusable.length) {
    fallback?.focus?.();
    return null;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const handleFocus = (event) => {
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown", handleFocus);
  return () => {
    container.removeEventListener("keydown", handleFocus);
  };
}

function openMediaModal() {
  const modal = getModalElement(modalSelectors.mediaModal);
  if (!modal) return;
  modalState.mediaReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.classList.remove("is-hidden");
  toggleBodyModalState();
  const keyHandler = (event) => {
    if (CLOSE_KEYS.has(event.key)) {
      event.preventDefault();
      closeMediaModal();
    }
  };
  document.addEventListener("keydown", keyHandler);
  modalState.activeMediaKeyListener = keyHandler;
  requestAnimationFrame(() => {
    const firstFocus = getModalElement(modalSelectors.mediaOptionImage)
      || getModalElement(modalSelectors.mediaOptionVideo)
      || getModalElement(modalSelectors.mediaOptionLink)
      || getModalElement(modalSelectors.mediaClose);
    modalState.mediaTrapCleanup = trapFocus(modal, firstFocus);
    firstFocus?.focus();
  });
}

function closeMediaModal(options = {}) {
  const modal = getModalElement(modalSelectors.mediaModal);
  if (!modal) return;
  const { restoreFocus = true } = options;
  modal.classList.add("is-hidden");
  toggleBodyModalState();
  if (modalState.activeMediaKeyListener) {
    document.removeEventListener("keydown", modalState.activeMediaKeyListener);
    modalState.activeMediaKeyListener = null;
  }
  if (modalState.mediaTrapCleanup) {
    modalState.mediaTrapCleanup();
    modalState.mediaTrapCleanup = null;
  }
  if (restoreFocus && modalState.mediaReturnFocus) {
    modalState.mediaReturnFocus.focus?.();
  }
  modalState.mediaReturnFocus = null;
}

function openInstructionModal() {
  const modal = getModalElement(modalSelectors.instructionModal);
  if (!modal) return;
  modalState.instructionReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.classList.remove("is-hidden");
  toggleBodyModalState();
  const keyHandler = (event) => {
    if (CLOSE_KEYS.has(event.key)) {
      event.preventDefault();
      closeInstructionModal();
    }
  };
  document.addEventListener("keydown", keyHandler);
  modalState.activeInstructionKeyListener = keyHandler;
  requestAnimationFrame(() => {
    const firstFocus = getModalElement(modalSelectors.instructionDismiss) || getModalElement(modalSelectors.instructionClose);
    modalState.instructionTrapCleanup = trapFocus(modal, firstFocus);
    firstFocus?.focus();
  });
}

function closeInstructionModal(options = {}) {
  const modal = getModalElement(modalSelectors.instructionModal);
  if (!modal) return;
  const { restoreFocus = true } = options;
  modal.classList.add("is-hidden");
  toggleBodyModalState();
  if (modalState.activeInstructionKeyListener) {
    document.removeEventListener("keydown", modalState.activeInstructionKeyListener);
    modalState.activeInstructionKeyListener = null;
  }
  if (modalState.instructionTrapCleanup) {
    modalState.instructionTrapCleanup();
    modalState.instructionTrapCleanup = null;
  }
  if (restoreFocus && modalState.instructionReturnFocus) {
    modalState.instructionReturnFocus.focus?.();
  }
  modalState.instructionReturnFocus = null;
}

function playInstructionLoadingAnimation() {
  return new Promise((resolve) => {
    const overlay = getModalElement(modalSelectors.loadingOverlay);
    if (!overlay || typeof window.gsap === "undefined") {
      resolve();
      return;
    }

    const content = getModalElement(modalSelectors.loadingContent);
    const spinner = getModalElement(modalSelectors.loadingSpinner);
    const text = getModalElement(modalSelectors.loadingText);

    const cleanup = () => {
      overlay.classList.add("is-hidden");
      overlay.setAttribute("aria-hidden", "true");
      if (modalState.loadingTimeline) {
        modalState.loadingTimeline.kill();
        modalState.loadingTimeline = null;
      }
      if (window.gsap) {
        const nodes = [overlay, content, spinner, text].filter(Boolean);
        window.gsap.set(nodes, { clearProps: "all" });
      }
      toggleBodyModalState();
      resolve();
    };

    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");
    toggleBodyModalState();

    if (!content || !spinner || !text) {
      window.setTimeout(cleanup, 500);
      return;
    }

    if (modalState.loadingTimeline) {
      modalState.loadingTimeline.kill();
    }

    const tl = window.gsap.timeline({ defaults: { ease: "power2.out" } });
    modalState.loadingTimeline = tl;

    tl.set(overlay, { opacity: 0 })
      .set(content, { opacity: 0, y: 18 })
      .set(spinner, { rotation: 0, scale: 0.6 })
      .set(text, { opacity: 0, y: 14 })
      .to(overlay, { opacity: 1, duration: 0.35, ease: "power1.out" })
      .to(content, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, "-=0.2")
      .to(spinner, { scale: 1, duration: 0.4, ease: "back.out(1.7)" }, "-=0.2")
      .to(spinner, {
        rotation: 1080,
        duration: 1.45,
        ease: "sine.inOut",
      }, "-=0.1")
      .to(text, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, "-=1")
      .to({}, { duration: 0.35 })
      .add(() => {
        window.gsap.to([content, overlay], {
          opacity: 0,
          duration: 0.35,
          ease: "power1.inOut",
          delay: 0.35,
          onComplete: cleanup,
        });
      });
  });
}

function initModalBindings({
  onMediaOpen,
  onMediaClosed,
  onInstructionClosed,
  onInstructionDismissed,
} = {}) {
  const mediaModal = getModalElement(modalSelectors.mediaModal);
  const mediaClose = getModalElement(modalSelectors.mediaClose);
  const mediaBackdrop = getModalElement(modalSelectors.mediaBackdrop);
  const instructionModal = getModalElement(modalSelectors.instructionModal);
  const instructionClose = getModalElement(modalSelectors.instructionClose);
  const instructionDismiss = getModalElement(modalSelectors.instructionDismiss);
  const instructionBackdrop = getModalElement(modalSelectors.instructionBackdrop);

  if (mediaModal && onMediaOpen) {
    onMediaOpen(openMediaModal);
  }
  const handleMediaClose = () => {
    closeMediaModal();
    onMediaClosed?.();
  };
  if (mediaClose) {
    mediaClose.addEventListener("click", handleMediaClose);
  }
  if (mediaBackdrop) {
    mediaBackdrop.addEventListener("click", handleMediaClose);
  }

  if (instructionModal) {
    const handleInstructionClose = () => {
      closeInstructionModal();
      onInstructionClosed?.();
    };
    if (instructionClose) {
      instructionClose.addEventListener("click", handleInstructionClose);
    }
    if (instructionDismiss) {
      instructionDismiss.addEventListener("click", () => {
        closeInstructionModal();
        onInstructionDismissed?.();
      });
    }
    if (instructionBackdrop) {
      instructionBackdrop.addEventListener("click", handleInstructionClose);
    }
  }

}

export {
  closeInstructionModal,
  closeMediaModal,
  initModalBindings,
  openInstructionModal,
  openMediaModal,
  playInstructionLoadingAnimation,
  toggleBodyModalState,
};
