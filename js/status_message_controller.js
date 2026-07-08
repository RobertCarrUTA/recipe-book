export function createStatusMessageController(options = {}) {
  const document = options.document || globalThis.document;
  const window = options.window || globalThis;
  const statusId = options.statusId || "stateBackupStatus";
  const timeoutMs = options.timeoutMs ?? 3600;
  let timer = null;

  function clearTimer() {
    if (!timer) return;
    if (window && typeof window.clearTimeout === "function") {
      window.clearTimeout(timer);
    }
    timer = null;
  }

  function set(message, statusOptions = {}) {
    const status = document && document.getElementById(statusId);
    if (!status) return;

    clearTimer();
    status.textContent = message || "";
    status.hidden = !message;
    status.classList.toggle("is-error", statusOptions.kind === "error");

    if (message && !statusOptions.sticky && window && typeof window.setTimeout === "function") {
      timer = window.setTimeout(() => {
        status.textContent = "";
        status.hidden = true;
        status.classList.remove("is-error");
        timer = null;
      }, timeoutMs);
    }
  }

  return {
    clear: () => set(""),
    set,
  };
}
