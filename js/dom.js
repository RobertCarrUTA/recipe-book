export function appendChildren(parent, children) {
  const items = Array.isArray(children) ? children : [children];
  items.filter(Boolean).forEach((child) => parent.appendChild(child));
  return parent;
}

export function listen(target, type, listener, options) {
  if (!target || typeof target.addEventListener !== "function") return null;
  target.addEventListener(type, listener, options);
  return target;
}

export function createElement(document, tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  if (options.name !== undefined) element.name = options.name;
  if (options.tabIndex !== undefined) element.tabIndex = options.tabIndex;
  if (options.textContent !== undefined) element.textContent = options.textContent ?? "";
  if (options.title !== undefined) element.title = options.title ?? "";
  if (options.type !== undefined) element.type = options.type;
  if (options.value !== undefined) element.value = options.value;

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => {
      if (value !== undefined && value !== null) element.setAttribute(name, value);
    });
  }

  if (options.dataset) {
    Object.entries(options.dataset).forEach(([name, value]) => {
      if (value !== undefined && value !== null) element.dataset[name] = String(value);
    });
  }

  if (options.children) appendChildren(element, options.children);

  return element;
}

export function createTextElement(document, tagName, text, options = {}) {
  const element = createElement(document, tagName, {
    ...options,
    textContent: text ?? "",
  });
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
