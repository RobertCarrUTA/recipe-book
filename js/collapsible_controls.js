import { syncDisclosureToggle } from "./dom.js";

export function isMediaQueryActive(window, mediaQuery) {
  return typeof window.matchMedia !== "function" || window.matchMedia(mediaQuery).matches;
}

export function listenToMediaQueryChanges(window, mediaQuery, listener) {
  if (typeof window.matchMedia !== "function") return null;

  const media = window.matchMedia(mediaQuery);
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return media;
  }

  if (typeof media.addListener === "function") {
    media.addListener(listener);
    return media;
  }

  return null;
}

export function syncCollapsibleControlsPanel(document, options) {
  const panel = document.getElementById(options.panelId);
  const toggle = document.getElementById(options.toggleId);
  const container = panel && options.containerSelector
    ? panel.closest(options.containerSelector)
    : null;
  const collapsed = Boolean(options.collapsed);

  if (panel) panel.hidden = collapsed;
  if (container) container.classList.toggle(options.collapsedClass, collapsed);
  syncDisclosureToggle(toggle, !collapsed, {
    collapsedLabel: options.collapsedLabel,
    collapsedText: options.collapsedText || "Show",
    collapsedTitle: options.collapsedLabel,
    expandedLabel: options.expandedLabel,
    expandedText: options.expandedText || "Hide",
    expandedTitle: options.expandedLabel,
  });
}
