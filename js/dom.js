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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[tabindex]",
].join(", ");

function isUnavailableFocusTarget(element, container) {
  if (!element || element.disabled || element.type === "hidden") return true;
  if (element.getAttribute?.("aria-disabled") === "true") return true;

  const tabIndexAttribute = element.getAttribute?.("tabindex");
  if (tabIndexAttribute != null && Number(tabIndexAttribute) < 0) return true;

  let current = element;
  while (current) {
    if (
      current.hidden ||
      current.inert ||
      current.getAttribute?.("aria-hidden") === "true"
    ) {
      return true;
    }
    if (current === container) break;
    current = current.parentElement;
  }

  return typeof element.getClientRects === "function" && element.getClientRects().length === 0;
}

export function containTabFocus(event, container) {
  if (!event || event.defaultPrevented || event.key !== "Tab" || !container) return false;

  const focusableElements = Array.from(container.querySelectorAll?.(FOCUSABLE_SELECTOR) || [])
    .filter((element) => !isUnavailableFocusTarget(element, container));

  if (!focusableElements.length) {
    event.preventDefault();
    container.focus?.();
    return true;
  }

  const ownerDocument = container.ownerDocument || (typeof document !== "undefined" ? document : null);
  const activeElement = ownerDocument?.activeElement;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const focusIsOutside = !activeElement || activeElement === container || !container.contains?.(activeElement);
  const shouldWrapBackward = event.shiftKey && (focusIsOutside || activeElement === firstElement);
  const shouldWrapForward = !event.shiftKey && (focusIsOutside || activeElement === lastElement);

  if (!shouldWrapBackward && !shouldWrapForward) return false;

  event.preventDefault();
  (shouldWrapBackward ? lastElement : firstElement).focus();
  return true;
}

export function createElement(document, tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (Array.isArray(options.classList)) element.classList.add(...options.classList.filter(Boolean));
  if (options.checked !== undefined) element.checked = Boolean(options.checked);
  if (options.disabled !== undefined) element.disabled = Boolean(options.disabled);
  if (options.hidden !== undefined) element.hidden = Boolean(options.hidden);
  if (options.href !== undefined) element.href = options.href ?? "";
  if (options.htmlFor !== undefined) element.htmlFor = options.htmlFor ?? "";
  if (options.id) element.id = options.id;
  if (options.inputMode !== undefined) element.inputMode = options.inputMode ?? "";
  if (options.max !== undefined) element.max = String(options.max);
  if (options.min !== undefined) element.min = String(options.min);
  if (options.name !== undefined) element.name = options.name;
  if (options.rel !== undefined) element.rel = options.rel ?? "";
  if (options.step !== undefined) element.step = String(options.step);
  if (options.tabIndex !== undefined) element.tabIndex = options.tabIndex;
  if (options.target !== undefined) element.target = options.target ?? "";
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

  if (options.listeners) {
    Object.entries(options.listeners).forEach(([type, listenerOrListeners]) => {
      const listeners = Array.isArray(listenerOrListeners) ? listenerOrListeners : [listenerOrListeners];
      listeners.filter(Boolean).forEach((listener) => listen(element, type, listener));
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

export function setElementInert(element, inert) {
  if (!element) return;

  if ("inert" in element) {
    element.inert = Boolean(inert);
  }

  if (inert) {
    element.setAttribute("aria-hidden", "true");
  } else {
    element.removeAttribute("aria-hidden");
  }
}
