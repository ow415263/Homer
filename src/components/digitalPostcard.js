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

export {
  getFrame,
  renderDigitalPostcard,
};
