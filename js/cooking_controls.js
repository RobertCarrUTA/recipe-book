import { containTabFocus } from "./dom.js";

export function attachCookingModeControls({ document, renderer, window }) {
  const cookingMode = document.getElementById("cookingMode");
  const closeButton = document.getElementById("closeCookingMode");
  const headerToggle = document.getElementById("toggleCookingHeader");
  const previousButton = document.getElementById("previousCookingStep");
  const nextButton = document.getElementById("nextCookingStep");
  const ingredientsToggle = document.getElementById("toggleCookingIngredients");

  if (closeButton) closeButton.addEventListener("click", renderer.closeCookingMode);
  if (headerToggle) headerToggle.addEventListener("click", renderer.toggleCookingHeader);
  if (ingredientsToggle) ingredientsToggle.addEventListener("click", renderer.toggleCookingIngredients);
  if (previousButton) previousButton.addEventListener("click", renderer.goToPreviousCookingStep);
  if (nextButton) {
    nextButton.addEventListener("click", () => {
      renderer.goToNextCookingStep({ finishOnLast: true });
    });
  }

  attachCookingStepSwipe({ document, renderer });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || !renderer.isCookingModeOpen()) return;

    if (event.key === "Tab") {
      containTabFocus(event, cookingMode);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      renderer.closeCookingMode();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      renderer.goToNextCookingStep();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      renderer.goToPreviousCookingStep();
    }
  });

  window.addEventListener("resize", renderer.handleCookingResize);
}

function attachCookingStepSwipe({ document, renderer }) {
  const stepPanel = document.querySelector(".cooking-step-panel");
  if (!stepPanel) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isTrackingSwipe = false;

  stepPanel.addEventListener(
    "touchstart",
    (event) => {
      if (!renderer.isCookingModeOpen() || event.touches.length !== 1) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      isTrackingSwipe = true;
    },
    { passive: true }
  );

  stepPanel.addEventListener(
    "touchend",
    (event) => {
      if (!isTrackingSwipe || !renderer.isCookingModeOpen() || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const elapsed = Date.now() - startTime;
      isTrackingSwipe = false;

      if (elapsed > 900 || absX < 56 || absX < absY * 1.35) return;
      if (deltaX < 0) {
        renderer.goToNextCookingStep();
        return;
      }

      renderer.goToPreviousCookingStep();
    },
    { passive: true }
  );

  stepPanel.addEventListener("touchcancel", () => {
    isTrackingSwipe = false;
  });
}
