import { normalizeMediaItems } from "../state/postcardState.js";

const selectors = {
  frame: "#digitalPostcardContent",
};

function getFrame() {
  return document.querySelector(selectors.frame);
}

function renderDigitalPostcard(postcard) {
  // Static placeholder retained for beta testing; no dynamic rendering needed.
  return postcard ? normalizeMediaItems(postcard.media) : [];
}

function animateDigitalPostcard() {
  if (typeof window.gsap === "undefined") {
    return;
  }
  const container = getFrame();
  if (!container) {
    return;
  }
  const image = container.querySelector("img");
  if (!image) {
    return;
  }

  const layerTop = image.cloneNode(true);
  const layerBottom = image.cloneNode(true);
  layerTop.setAttribute("aria-hidden", "true");
  layerBottom.setAttribute("aria-hidden", "true");

  container.appendChild(layerTop);
  container.appendChild(layerBottom);

  window.gsap.set(container, { position: "relative", willChange: "transform" });
  window.gsap.set(image, { opacity: 0, scale: 1.06, willChange: "transform,opacity" });
  window.gsap.set([layerTop, layerBottom], {
    position: "absolute",
    inset: 0,
    objectFit: "cover",
    opacity: 0,
    filter: "blur(18px)",
    willChange: "transform,opacity,filter",
    transformOrigin: "50% 50%",
    pointerEvents: "none",
    zIndex: 1,
  });

  const cleanup = () => {
    layerTop.remove();
    layerBottom.remove();
    window.gsap.set([container, image], { clearProps: "position,willChange,opacity,scale,filter" });
  };

  const tl = window.gsap.timeline({ onComplete: cleanup });
  tl.to(layerTop, {
    opacity: 0.35,
    y: -32,
    filter: "blur(10px)",
    duration: 0.5,
    ease: "power2.out",
  });
  tl.to(layerBottom, {
    opacity: 0.28,
    y: 32,
    filter: "blur(12px)",
    duration: 0.5,
    ease: "power2.out",
  }, 0.08);
  tl.to(layerTop, {
    opacity: 0,
    y: -64,
    filter: "blur(26px)",
    duration: 0.45,
    ease: "power3.in",
  }, 0.48);
  tl.to(layerBottom, {
    opacity: 0,
    y: 64,
    filter: "blur(26px)",
    duration: 0.45,
    ease: "power3.in",
  }, 0.56);
  tl.to(image, {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    duration: 0.7,
    ease: "power3.out",
  }, 0.22);
}

export {
  animateDigitalPostcard,
  getFrame,
  renderDigitalPostcard,
};
