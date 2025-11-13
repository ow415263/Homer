function formatMediaType(type) {
  if (!type) return "Media";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function describeMedia(item) {
  if (!item) return "Media item";
  switch (item.type) {
    case "image":
    case "video":
      if (item.name) return item.name;
      if (item.mime) return item.mime;
      if (item.url) return item.url;
      return `${formatMediaType(item.type)} attachment`;
    case "link":
      return item.url ?? "Link";
    default:
      if (item.url) return item.url;
      return "Media item";
  }
}

function renderMediaList({ items = [], container, emptyMessage = "No media added yet.", emptyClass = "helper-text", onRemove }) {
  if (!container) return;

  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("li");
    empty.textContent = emptyMessage;
    empty.className = emptyClass;
    container.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "media-list__item";

    const details = document.createElement("div");

    const typeBadge = document.createElement("div");
    typeBadge.className = "media-type";
    typeBadge.textContent = formatMediaType(item.type);
    details.appendChild(typeBadge);

    const descriptor = document.createElement("div");
    descriptor.className = "media-descriptor";
    descriptor.textContent = describeMedia(item);
    details.appendChild(descriptor);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove media ${index + 1}`);
    removeButton.addEventListener("click", () => {
      onRemove?.(index);
    });

    li.appendChild(details);
    li.appendChild(removeButton);

    container.appendChild(li);
  });
}

export {
  formatMediaType,
  renderMediaList,
};
