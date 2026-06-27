export function createMobileViewController({ document, getUiState, onViewChange, saveState, window }) {
  const viewOrder = ["recipes", "grocery"];
  const mobileQuery = window && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 979px)")
    : null;

  function isMobileViewport() {
    return mobileQuery ? mobileQuery.matches : true;
  }

  function isSwipeBlockedTarget(target) {
    return Boolean(
      target &&
        target.closest &&
        target.closest(
          [
            "a",
            "input",
            "select",
            "textarea",
            "summary",
            "dialog",
            "[contenteditable='true']",
            ".recipe-search",
            ".recipe-actions",
            ".meal-plan-add-form",
            ".meal-plan-bar",
            ".meal-plan-item-actions",
            ".grocery-shopping-bar",
            ".grocery-item-remove",
            ".grocery-item-source-toggle",
            ".grocery-source-link",
            ".grocery-source-single-link",
            ".mobile-view-tabs",
          ].join(", ")
        )
    );
  }

  function normalizeView(view) {
    return viewOrder.includes(view) ? view : "recipes";
  }

  function setMobileView(view, options = {}) {
    const nextView = normalizeView(view);
    const previousView = normalizeView(getUiState().mobileView);
    viewOrder.forEach((viewName) => {
      document.body.classList.toggle(`app-mode-${viewName}`, nextView === viewName);
    });

    document.querySelectorAll(".mobile-view-tab").forEach((button) => {
      const isActive = button.dataset.view === nextView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    getUiState().mobileView = nextView;
    if (!options.skipSave) saveState();
    if (typeof onViewChange === "function") {
      onViewChange({
        previousView,
        trigger: options.trigger || "set",
        view: nextView,
      });
    }
  }

  function attachSwipeNavigation() {
    const surface = document.querySelector(".app-layout");
    if (!surface) return;

    const minDistance = 72;
    const maxVerticalDrift = 80;
    let startX = 0;
    let startY = 0;
    let suppressNextClick = false;
    let tracking = false;

    surface.addEventListener(
      "touchstart",
      (event) => {
        if (!isMobileViewport() || document.body.classList.contains("is-cooking-mode")) return;
        if (event.touches.length !== 1 || isSwipeBlockedTarget(event.target)) return;

        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      },
      { passive: true }
    );

    surface.addEventListener(
      "touchend",
      (event) => {
        if (!tracking || event.changedTouches.length !== 1) return;
        tracking = false;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX < minDistance || absY > maxVerticalDrift || absX < absY * 1.35) return;
        suppressNextClick = true;
        window.setTimeout(() => {
          suppressNextClick = false;
        }, 350);
        const currentIndex = viewOrder.indexOf(normalizeView(getUiState().mobileView));
        const nextIndex = deltaX < 0
          ? Math.min(viewOrder.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
        setMobileView(viewOrder[nextIndex], { trigger: "swipe" });
      },
      { passive: true }
    );

    surface.addEventListener(
      "click",
      (event) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    surface.addEventListener("touchcancel", () => {
      tracking = false;
    });
  }

  function attach() {
    document.querySelectorAll(".mobile-view-tab").forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
      button.addEventListener("click", () => setMobileView(button.dataset.view, { trigger: "tab" }));
    });
    attachSwipeNavigation();
  }

  return { attach, setMobileView };
}
