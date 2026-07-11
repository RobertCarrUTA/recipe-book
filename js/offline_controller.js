const SERVICE_WORKER_URL = "./sw.js";

export function createOfflineController({
  document,
  logger = console,
  navigator = globalThis.navigator,
  window = globalThis.window,
} = {}) {
  const byId = (id) => document.getElementById(id);
  let refreshWorker = null;
  let refreshRequested = false;
  let reloadPending = false;

  function setOfflineStatus(message, state = "") {
    const status = byId("offlineStatus");
    if (!status) return;

    status.textContent = message || "";
    status.hidden = !message;
    status.dataset.state = state;
  }

  function showRefreshButton(worker) {
    const refreshButton = byId("refreshAppUpdate");
    refreshWorker = worker;
    setOfflineStatus("Update ready", "update");
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.hidden = false;
    }
  }

  function syncConnectionStatus() {
    const refreshButton = byId("refreshAppUpdate");
    if (refreshWorker) {
      if (refreshButton) refreshButton.hidden = false;
      return;
    }

    if (refreshButton) refreshButton.hidden = true;
    if (navigator && navigator.onLine === false) {
      setOfflineStatus("Offline", "offline");
    } else {
      setOfflineStatus("Offline ready", "ready");
    }
  }

  function attachRefreshButton() {
    const refreshButton = byId("refreshAppUpdate");
    if (!refreshButton) return;

    refreshButton.addEventListener("click", () => {
      refreshButton.disabled = true;
      refreshRequested = true;
      if (refreshWorker) {
        refreshWorker.postMessage({ type: "SKIP_WAITING" });
      } else if (window && window.location) {
        window.location.reload();
      }
    });
  }

  function observeWorker(worker) {
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showRefreshButton(worker);
      } else if (worker.state === "activated") {
        syncConnectionStatus();
      }
    });
  }

  function observeRegistration(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      showRefreshButton(registration.waiting);
    }

    observeWorker(registration.installing);

    registration.addEventListener("updatefound", () => {
      observeWorker(registration.installing);
    });
  }

  async function attach() {
    const refreshButton = byId("refreshAppUpdate");
    if (refreshButton) refreshButton.hidden = true;

    if (
      !navigator ||
      !navigator.serviceWorker ||
      !window ||
      !window.location ||
      window.location.protocol === "file:"
    ) {
      setOfflineStatus("", "");
      return;
    }

    attachRefreshButton();

    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
      observeRegistration(registration);
      if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === "function") {
        await navigator.serviceWorker.ready;
      }
      syncConnectionStatus();

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshRequested) {
          refreshWorker = null;
          syncConnectionStatus();
          return;
        }
        if (reloadPending) return;
        reloadPending = true;
        window.location.reload();
      });
      window.addEventListener("online", syncConnectionStatus);
      window.addEventListener("offline", syncConnectionStatus);
    } catch (error) {
      logger.warn("Service worker registration failed", error);
      setOfflineStatus("Offline unavailable", "error");
    }
  }

  return { attach };
}
