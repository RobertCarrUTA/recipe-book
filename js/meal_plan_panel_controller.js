import { containTabFocus, listen, setElementInert } from "./dom.js";

const BACKGROUND_SELECTORS = [
  ".skip-link",
  ".app-header",
  "#recipesPanel",
  "#groceryPanel",
  ".mobile-view-tabs",
];

export function createMealPlanPanelController({
  document,
  onBuildGroceryList,
  onClearMealPlan,
}) {
  let returnFocus = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function getElement(selector) {
    if (selector.startsWith("#")) return byId(selector.slice(1));
    return typeof document.querySelector === "function" ? document.querySelector(selector) : null;
  }

  function setBackgroundInert(inert) {
    BACKGROUND_SELECTORS.forEach((selector) => setElementInert(getElement(selector), inert));
  }

  function isFocusableElement(element) {
    return Boolean(element && typeof element.focus === "function");
  }

  function getReturnFocusTarget() {
    if (isFocusableElement(document.activeElement)) return document.activeElement;
    return byId("openMealPlan");
  }

  function documentContains(element) {
    return typeof document.contains === "function" ? document.contains(element) : Boolean(element);
  }

  function focusElement(element) {
    if (isFocusableElement(element)) element.focus();
  }

  function isOpen() {
    return document.body.classList.contains("is-meal-plan-open");
  }

  function isCoveredByCookingMode() {
    const cookingMode = byId("cookingMode");
    return Boolean(cookingMode && !cookingMode.hidden);
  }

  function open() {
    if (isOpen()) return;
    if (!byId("mealPlanPanel")) return;

    returnFocus = getReturnFocusTarget();
    setBackgroundInert(true);
    document.body.classList.add("is-meal-plan-open");
    focusElement(byId("closeMealPlanPanel"));
  }

  function close(options = {}) {
    if (!isOpen()) return;

    document.body.classList.remove("is-meal-plan-open");
    setBackgroundInert(false);

    if (options.restoreFocus === false) {
      returnFocus = null;
      return;
    }

    const focusTarget = returnFocus && documentContains(returnFocus)
      ? returnFocus
      : byId("openMealPlan");
    returnFocus = null;
    focusElement(focusTarget);
  }

  function attach() {
    listen(byId("openMealPlan"), "click", open);
    listen(byId("buildGroceryListFromMealPlan"), "click", onBuildGroceryList);
    listen(byId("clearMealPlan"), "click", onClearMealPlan);
    listen(byId("closeMealPlanPanel"), "click", () => close());

    listen(document, "keydown", (event) => {
      if (event.defaultPrevented || !isOpen() || isCoveredByCookingMode()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "Tab") containTabFocus(event, byId("mealPlanPanel"));
    });
  }

  return { attach, close, isOpen, open };
}
