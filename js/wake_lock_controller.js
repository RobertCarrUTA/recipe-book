export function createWakeLockController({ document, logger, navigator, saveState, window, getUiState }) {
  let pendingWakeLockRequest = null;
  let requestGeneration = 0;
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

  async function releaseLock(lock) {
    if (!lock || typeof lock.release !== "function") return;

    try {
      await lock.release();
    } catch (error) {
      logger.debug("Screen wake lock was already released", error);
    }
  }

  async function requestScreenWakeLock() {
    if (
      !isScreenWakeLockSupported() ||
      !wantsScreenWakeLock ||
      screenWakeLock ||
      pendingWakeLockRequest ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const generation = ++requestGeneration;
    try {
      const request = navigator.wakeLock.request("screen");
      pendingWakeLockRequest = request;
      const lock = await request;
      if (pendingWakeLockRequest === request) pendingWakeLockRequest = null;

      if (
        generation !== requestGeneration ||
        !wantsScreenWakeLock ||
        document.visibilityState !== "visible"
      ) {
        await releaseLock(lock);
        if (wantsScreenWakeLock && document.visibilityState === "visible") requestScreenWakeLock();
        return;
      }

      screenWakeLock = lock;
      lock.addEventListener("release", () => {
        if (screenWakeLock !== lock) return;
        screenWakeLock = null;
        if (wantsScreenWakeLock && document.visibilityState === "visible") {
          window.setTimeout(requestScreenWakeLock, 0);
        }
      });
    } catch (error) {
      pendingWakeLockRequest = null;
      if (generation !== requestGeneration || !wantsScreenWakeLock) return;

      wantsScreenWakeLock = false;
      syncKeepScreenAwakeToggles(false);
      saveState();
      logger.warn("Screen wake lock request failed", error);
    }
  }

  async function releaseScreenWakeLock() {
    requestGeneration += 1;
    if (!screenWakeLock) return;

    const lockToRelease = screenWakeLock;
    screenWakeLock = null;
    await releaseLock(lockToRelease);
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

  function applyPreference(checked) {
    const nextValue = Boolean(checked) && isScreenWakeLockSupported();
    syncKeepScreenAwakeToggles(nextValue);
    syncScreenWakeLock();
    return nextValue;
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

    applyPreference(keepAwakeToggle.checked);
    getKeepScreenAwakeToggles().forEach((toggle) => {
      toggle.addEventListener("change", () => {
        applyPreference(toggle.checked);
        saveState();
      });
    });

    document.addEventListener("visibilitychange", syncScreenWakeLock);
    syncScreenWakeLock();
  }

  return { applyPreference, attach, releaseScreenWakeLock, syncScreenWakeLock };
}
