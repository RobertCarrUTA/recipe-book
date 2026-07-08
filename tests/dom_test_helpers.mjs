function normalizeClassNames(value) {
  return String(value || "").split(/\s+/).filter(Boolean);
}

function toDatasetKey(attributeName) {
  return attributeName
    .slice("data-".length)
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function getElementAttribute(element, name) {
  if (!element) return undefined;
  if (name === "class") return element.className;
  if (name === "id") return element.id;
  if (name.startsWith("data-")) return element.dataset?.[toDatasetKey(name)];
  if (Object.hasOwn(element.attributes || {}, name)) return element.attributes[name];
  return element[name];
}

function matchesSimpleSelector(element, selector) {
  if (!element || element.isDocumentFragment) return false;

  const notSelectors = Array.from(selector.matchAll(/:not\(([^)]*)\)/g), (match) => match[1]);
  const positiveSelector = selector.replace(/:not\([^)]*\)/g, "");

  if (notSelectors.some((notSelector) => matchesSimpleSelector(element, notSelector))) return false;

  const tagMatch = positiveSelector.match(/^[a-zA-Z][\w-]*/);
  if (tagMatch && element.tagName !== tagMatch[0].toUpperCase()) return false;

  const idMatches = Array.from(positiveSelector.matchAll(/#([\w-]+)/g), (match) => match[1]);
  if (idMatches.some((id) => element.id !== id)) return false;

  const classMatches = Array.from(positiveSelector.matchAll(/\.([\w-]+)/g), (match) => match[1]);
  if (classMatches.some((className) => !element.classList.contains(className))) return false;

  const attributeMatches = Array.from(
    positiveSelector.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g),
    (match) => ({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4],
    })
  );

  return attributeMatches.every(({ name, value }) => {
    const actual = getElementAttribute(element, name);
    if (actual === undefined || actual === null) return false;
    return value === undefined || String(actual) === String(value);
  });
}

function matchesSelector(element, selector) {
  const parts = String(selector || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return false;

  function matchesPart(current, partIndex) {
    if (!matchesSimpleSelector(current, parts[partIndex])) return false;
    if (partIndex === 0) return true;

    let ancestor = current.parentElement;
    while (ancestor) {
      if (matchesPart(ancestor, partIndex - 1)) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  return matchesPart(element, parts.length - 1);
}

function querySelectorAllWithin(root, selector, { includeRoot = false } = {}) {
  const selectors = String(selector || "").split(",").map((item) => item.trim()).filter(Boolean);
  const matches = [];

  function visit(element, shouldTest) {
    if (shouldTest && selectors.some((item) => matchesSelector(element, item))) {
      matches.push(element);
    }
    (element.children || []).forEach((child) => visit(child, true));
  }

  visit(root, includeRoot);
  return matches;
}

export function createFakeElement(options = {}) {
  const listeners = new Map();
  const classes = new Set([
    ...normalizeClassNames(options.className),
    ...(options.classes || []),
  ]);
  const attributes = { ...(options.attributes || {}) };
  const element = {
    attributes,
    children: [],
    checked: Boolean(options.checked),
    dataset: { ...(options.dataset || {}) },
    disabled: Boolean(options.disabled),
    files: options.files || null,
    hidden: Boolean(options.hidden),
    href: options.href || "",
    id: options.id || "",
    isDocumentFragment: Boolean(options.isDocumentFragment),
    parentElement: null,
    removed: false,
    style: {},
    tagName: options.isDocumentFragment ? "#document-fragment" : String(options.tagName || "div").toUpperCase(),
    textContent: options.textContent || "",
    title: options.title || "",
    type: options.type || "",
    value: options.value || "",
    classList: {
      add(...names) {
        names.forEach((name) => classes.add(name));
      },
      contains(name) {
        return classes.has(name);
      },
      remove(...names) {
        names.forEach((name) => classes.delete(name));
      },
      toggle(name, force) {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) classes.add(name);
        else classes.delete(name);
        return next;
      },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    appendChild(child) {
      if (child?.isDocumentFragment) {
        [...child.children].forEach((fragmentChild) => element.appendChild(fragmentChild));
        child.children = [];
        return child;
      }

      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      }
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    click() {
      element.dispatchEvent(createFakeEvent("click", { target: element }));
    },
    closest(selector) {
      let current = element;
      while (current) {
        if (matchesSelector(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    contains(candidate) {
      if (candidate === element) return true;
      return querySelectorAllWithin(element, "*").includes(candidate);
    },
    dispatchEvent(event) {
      event.target = event.target || element;
      (listeners.get(event.type) || []).forEach((listener) => listener(event));
      return !event.defaultPrevented;
    },
    focus(options) {
      element.focused = true;
      element.focusOptions = options;
    },
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
    },
    getBoundingClientRect() {
      return options.rect || { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 };
    },
    insertBefore(child, referenceChild) {
      if (child?.isDocumentFragment) {
        const fragmentChildren = [...child.children];
        const referenceIndex = element.children.indexOf(referenceChild);
        const startIndex = referenceIndex === -1 ? element.children.length : referenceIndex;
        child.children = [];
        fragmentChildren.forEach((fragmentChild, index) => {
          if (fragmentChild.parentElement) {
            fragmentChild.parentElement.children =
              fragmentChild.parentElement.children.filter((item) => item !== fragmentChild);
          }
          fragmentChild.parentElement = element;
          element.children.splice(startIndex + index, 0, fragmentChild);
        });
        return child;
      }

      const referenceIndex = element.children.indexOf(referenceChild);
      const insertIndex = referenceIndex === -1 ? element.children.length : referenceIndex;
      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      }
      child.parentElement = element;
      element.children.splice(insertIndex, 0, child);
      return child;
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      return querySelectorAllWithin(element, selector);
    },
    remove() {
      element.removed = true;
      if (!element.parentElement) return;
      element.parentElement.children = element.parentElement.children.filter((child) => child !== element);
      element.parentElement = null;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    replaceChildren(...children) {
      element.children.forEach((child) => {
        child.parentElement = null;
      });
      element.children = [];
      children.forEach((child) => element.appendChild(child));
    },
    scrollIntoView(options) {
      element.scrollIntoViewOptions = options;
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
  };

  Object.defineProperty(element, "className", {
    get() {
      return Array.from(classes).join(" ");
    },
    set(value) {
      classes.clear();
      normalizeClassNames(value).forEach((name) => classes.add(name));
    },
  });

  Object.defineProperty(element, "parentNode", {
    get() {
      return element.parentElement;
    },
  });

  return element;
}

export function createFakeEvent(type, options = {}) {
  return {
    defaultPrevented: false,
    target: options.target || null,
    type,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
  };
}

export function createFakeEventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      event.target = event.target || this;
      (listeners.get(event.type) || []).forEach((listener) => listener(event));
    },
  };
}

export function createFakeDocument({ elements = {}, queryResults = {}, visibilityState = "visible" } = {}) {
  const createdElements = [];
  const rootElements = () => [document.body, ...Object.values(elements), ...createdElements];
  const document = createFakeEventTarget({
    body: createFakeElement({ id: "body", tagName: "body" }),
    createdElements,
    visibilityState,
    createElement(tagName) {
      const element = createFakeElement({ tagName });
      createdElements.push(element);
      return element;
    },
    createDocumentFragment() {
      return createFakeElement({ isDocumentFragment: true });
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      if (queryResults[selector]) return queryResults[selector];

      const matches = new Set();
      rootElements().forEach((element) => {
        querySelectorAllWithin(element, selector, { includeRoot: true })
          .forEach((match) => matches.add(match));
      });
      return Array.from(matches);
    },
  });

  document.body.ownerDocument = document;

  return document;
}

export function createFakeWindow(options = {}) {
  const timers = [];
  const location = options.location || { protocol: "http:", reload() {} };
  const window = createFakeEventTarget({
    location,
    timers,
    clearTimeout(id) {
      const timer = timers.find((item) => item.id === id);
      if (timer) timer.cleared = true;
    },
    setTimeout(callback, delay = 0) {
      const timer = { callback, cleared: false, delay, id: timers.length + 1 };
      timers.push(timer);
      return timer.id;
    },
  });

  return window;
}
