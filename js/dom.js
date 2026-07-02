export function createTextElement(document, tagName, text, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  if (options.tabIndex !== undefined) element.tabIndex = options.tabIndex;
  element.textContent = text ?? "";
  return element;
}

export function createEmptyState(document, { body, className = "empty-state", title }) {
  const empty = document.createElement("div");
  empty.className = className;
  empty.appendChild(createTextElement(document, "strong", title));
  empty.appendChild(createTextElement(document, "span", body));
  return empty;
}

export function syncDisclosureToggle(toggle, expanded, options = {}) {
  if (!toggle) return;

  const isExpanded = Boolean(expanded);
  const text = isExpanded ? options.expandedText : options.collapsedText;
  const label = isExpanded ? options.expandedLabel : options.collapsedLabel;
  const title = isExpanded ? options.expandedTitle : options.collapsedTitle;

  toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  if (text !== undefined) toggle.textContent = text ?? "";
  if (label !== undefined) {
    if (label) toggle.setAttribute("aria-label", label);
    else toggle.removeAttribute("aria-label");
  }
  if (title !== undefined) toggle.title = title ?? "";
}
