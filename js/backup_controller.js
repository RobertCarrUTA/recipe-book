import {
  createPersistentStateBackup,
  normalizePersistentStateBackup,
  safeJsonParse,
} from "./storage.js";

const STATUS_TIMEOUT_MS = 3600;

function getBackupFileName(date = new Date()) {
  const dateStamp = date.toISOString().slice(0, 10);
  return `recipe-book-backup-${dateStamp}.json`;
}

export function createBackupController({
  document,
  getState,
  logger = console,
  onRestore,
  urlApi = globalThis.URL,
  window = globalThis.window,
} = {}) {
  const byId = (id) => document.getElementById(id);
  let statusTimer = null;

  function setStatus(message, options = {}) {
    const status = byId("stateBackupStatus");
    if (!status) return;

    if (statusTimer && window && typeof window.clearTimeout === "function") {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }

    status.textContent = message || "";
    status.hidden = !message;
    status.classList.toggle("is-error", options.kind === "error");

    if (message && !options.sticky && window && typeof window.setTimeout === "function") {
      statusTimer = window.setTimeout(() => {
        status.textContent = "";
        status.hidden = true;
        status.classList.remove("is-error");
      }, STATUS_TIMEOUT_MS);
    }
  }

  function exportBackup() {
    const link = document.createElement("a");
    const backup = createPersistentStateBackup(getState());
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
      type: "application/json",
    });
    const objectUrl = urlApi.createObjectURL(blob);

    link.href = objectUrl;
    link.download = getBackupFileName();
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (window && typeof window.setTimeout === "function") {
      window.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 0);
    } else {
      urlApi.revokeObjectURL(objectUrl);
    }
    setStatus("Backup exported.");
  }

  async function importBackup(file) {
    if (!file) return;

    try {
      const parsed = safeJsonParse(await file.text(), null);
      const restoredState = normalizePersistentStateBackup(parsed);

      onRestore(restoredState);
      setStatus("Backup restored.");
    } catch (error) {
      logger.warn("Backup import failed", error);
      setStatus("Backup could not be restored.", { kind: "error", sticky: true });
    }
  }

  function attach() {
    const exportButton = byId("exportStateBackup");
    const importButton = byId("importStateBackup");
    const importInput = byId("stateBackupInput");

    if (exportButton) exportButton.addEventListener("click", exportBackup);
    if (importButton && importInput) {
      importButton.addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = "";
        importBackup(file);
      });
    }
  }

  return { attach, exportBackup, importBackup };
}
