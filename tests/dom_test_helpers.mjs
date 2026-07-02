export function createFakeElement(options = {}) {
  const listeners = new Map();
  const classes = new Set(options.classes || []);
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
    parentElement: null,
    removed: false,
    style: {},
    tagName: String(options.tagName || "div").toUpperCase(),
    textContent: options.textContent || "",
    title: options.title || "",
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
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    click() {
      element.dispatchEvent(createFakeEvent("click", { target: element }));
    },
    dispatchEvent(event) {
      event.target = event.target || element;
      (listeners.get(event.type) || []).forEach((listener) => listener(event));
      return !event.defaultPrevented;
    },
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
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
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
  };

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
  const document = createFakeEventTarget({
    body: createFakeElement({ id: "body", tagName: "body" }),
    createdElements,
    visibilityState,
    createElement(tagName) {
      const element = createFakeElement({ tagName });
      createdElements.push(element);
      return element;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      return queryResults[selector] || [];
    },
  });

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
