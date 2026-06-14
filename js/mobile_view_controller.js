export function createMobileViewController({ document, getUiState, saveState }) {
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

  function attach() {
    document.querySelectorAll(".mobile-view-tab").forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
      button.addEventListener("click", () => setMobileView(button.dataset.view));
    });
  }

  return { attach, setMobileView };
}
