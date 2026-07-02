const DEFAULT_SAVE_DEBOUNCE_MS = 180;
const DEFAULT_IDLE_TIMEOUT_MS = 700;

export function createAppStatePersistenceController({
  document = globalThis.document,
  window = globalThis.window,
  persist,
  debounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
} = {}) {
  let pendingIdleSaveHandle = null;
  let pendingSaveTimer = null;

  function persistNow() {
    if (typeof persist === "function") persist();
  }

  function clearPendingSave() {
    if (pendingSaveTimer !== null && window && typeof window.clearTimeout === "function") {
      window.clearTimeout(pendingSaveTimer);
    }
    pendingSaveTimer = null;

    if (
      pendingIdleSaveHandle !== null &&
      window &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(pendingIdleSaveHandle);
    }
    pendingIdleSaveHandle = null;
  }

  function flush() {
    if (pendingSaveTimer === null && pendingIdleSaveHandle === null) return;
    clearPendingSave();
    persistNow();
  }

  function save(options = {}) {
    clearPendingSave();

    if (options.immediate || !window || typeof window.setTimeout !== "function") {
      persistNow();
      return;
    }

    pendingSaveTimer = window.setTimeout(() => {
      pendingSaveTimer = null;

      if (typeof window.requestIdleCallback === "function") {
        pendingIdleSaveHandle = window.requestIdleCallback(
          () => {
            pendingIdleSaveHandle = null;
            persistNow();
          },
          { timeout: idleTimeoutMs }
        );
        return;
      }

      persistNow();
    }, debounceMs);
  }

  function attachFlushHandlers() {
    if (window && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", flush);
    }

    if (document && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
    }
  }

  return {
    attachFlushHandlers,
    clearPendingSave,
    flush,
    save,
  };
}
