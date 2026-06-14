export function createWakeLockController({ document, logger, navigator, saveState, window, getUiState }) {
  let screenWakeLock = null;
  let wantsScreenWakeLock = false;

  function getKeepScreenAwakeToggles() {
    return Array.from(document.querySelectorAll("#keepScreenAwake, #cookingKeepScreenAwake")).filter(Boolean);
  }

  function getKeepScreenAwakeToggle() {
    return getKeepScreenAwakeToggles()[0] || null;
  }

  function syncKeepScreenAwakeToggles(checked) {
    getKeepScreenAwakeToggles().forEach((toggle) => {
      toggle.checked = checked;
    });
    getUiState().keepScreenAwake = checked;
  }

  function isScreenWakeLockSupported() {
    return Boolean(navigator && "wakeLock" in navigator && navigator.wakeLock && navigator.wakeLock.request);
  }

  async function requestScreenWakeLock() {
    if (!isScreenWakeLockSupported() || screenWakeLock || document.visibilityState !== "visible") return;

    try {
      screenWakeLock = await navigator.wakeLock.request("screen");
      screenWakeLock.addEventListener("release", () => {
        screenWakeLock = null;
        if (wantsScreenWakeLock && document.visibilityState === "visible") {
          window.setTimeout(requestScreenWakeLock, 0);
        }
      });
    } catch (error) {
      wantsScreenWakeLock = false;
      syncKeepScreenAwakeToggles(false);
      saveState();
      logger.warn("Screen wake lock request failed", error);
    }
  }

  async function releaseScreenWakeLock() {
    if (!screenWakeLock) return;

    const lockToRelease = screenWakeLock;
    screenWakeLock = null;
    try {
      await lockToRelease.release();
    } catch (error) {
      logger.debug("Screen wake lock was already released", error);
    }
  }

  function syncScreenWakeLock() {
    const keepAwakeToggle = getKeepScreenAwakeToggle();
    wantsScreenWakeLock = Boolean(keepAwakeToggle && keepAwakeToggle.checked);
    getUiState().keepScreenAwake = wantsScreenWakeLock;

    if (wantsScreenWakeLock && document.visibilityState === "visible") {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  }

  function attach() {
    const keepAwakeToggle = getKeepScreenAwakeToggle();
    if (!keepAwakeToggle) return;

    if (!isScreenWakeLockSupported()) {
      syncKeepScreenAwakeToggles(false);
      getKeepScreenAwakeToggles().forEach((toggle) => {
        toggle.disabled = true;
        toggle.title = "Screen wake lock is not supported in this browser.";
      });
      saveState();
      return;
    }

    syncKeepScreenAwakeToggles(keepAwakeToggle.checked);
    getKeepScreenAwakeToggles().forEach((toggle) => {
      toggle.addEventListener("change", () => {
        syncKeepScreenAwakeToggles(toggle.checked);
        syncScreenWakeLock();
        saveState();
      });
    });

    document.addEventListener("visibilitychange", syncScreenWakeLock);
    syncScreenWakeLock();
  }

  return { attach, releaseScreenWakeLock, syncScreenWakeLock };
}
