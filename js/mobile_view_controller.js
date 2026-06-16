export function createMobileViewController({ document, getUiState, saveState, window }) {
  const mobileQuery = window && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 979px)")
    : null;

  function isMobileViewport() {
    return mobileQuery ? mobileQuery.matches : true;
  }

  function isInteractiveTarget(target) {
    return Boolean(
      target &&
        target.closest &&
        target.closest("a, button, input, select, textarea, summary, [contenteditable='true']")
    );
  }

  function setMobileView(view, options = {}) {
    const nextView = view === "grocery" ? "grocery" : "recipes";
    document.body.classList.toggle("app-mode-grocery", nextView === "grocery");
    document.body.classList.toggle("app-mode-recipes", nextView === "recipes");

    document.querySelectorAll(".mobile-view-tab").forEach((button) => {
      const isActive = button.dataset.view === nextView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    getUiState().mobileView = nextView;
    if (!options.skipSave) saveState();
  }

  function attachSwipeNavigation() {
    const surface = document.querySelector(".app-layout");
    if (!surface) return;

    const minDistance = 72;
    const maxVerticalDrift = 80;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    surface.addEventListener(
      "touchstart",
      (event) => {
        if (!isMobileViewport() || document.body.classList.contains("is-cooking-mode")) return;
        if (event.touches.length !== 1 || isInteractiveTarget(event.target)) return;

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
        setMobileView(deltaX < 0 ? "grocery" : "recipes");
      },
      { passive: true }
    );

    surface.addEventListener("touchcancel", () => {
      tracking = false;
    });
  }

  function attach() {
    document.querySelectorAll(".mobile-view-tab").forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
      button.addEventListener("click", () => setMobileView(button.dataset.view));
    });
    attachSwipeNavigation();
  }

  return { attach, setMobileView };
}
