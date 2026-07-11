import {
  createPersistentStateBackup,
  normalizePersistentStateBackup,
  safeJsonParse,
} from "./storage.js";
import { downloadTextFile } from "./download.js";
import { createStatusMessageController } from "./status_message_controller.js";

function getBackupFileName(date = new Date()) {
  const dateStamp = date.toISOString().slice(0, 10);
  return `recipe-book-backup-${dateStamp}.json`;
}

export function createBackupController({
  document,
  getState,
  importAvailable: initialImportAvailable = true,
  logger = console,
  onRestore,
  setStatus: reportExternalStatus,
  urlApi = globalThis.URL,
  window = globalThis.window,
} = {}) {
  const byId = (id) => document.getElementById(id);
  const fallbackStatus = createStatusMessageController({ document, window });
  const defaultUnavailableReason = "Backup import is unavailable until recipes finish loading.";
  let importAvailable = Boolean(initialImportAvailable);
  let importUnavailableReason = defaultUnavailableReason;

  function setStatus(message, options = {}) {
    if (typeof reportExternalStatus === "function") {
      reportExternalStatus(message, options);
      return;
    }

    fallbackStatus.set(message, options);
  }

  function syncImportAvailability() {
    const importButton = byId("importStateBackup");
    const importInput = byId("stateBackupInput");

    if (importButton) {
      importButton.disabled = !importAvailable;
      importButton.title = importAvailable ? "" : importUnavailableReason;
    }
    if (importInput) importInput.disabled = !importAvailable;
  }

  function setImportAvailable(available, reason = defaultUnavailableReason) {
    importAvailable = Boolean(available);
    importUnavailableReason = importAvailable ? "" : String(reason || defaultUnavailableReason);
    syncImportAvailability();
  }

  function exportBackup() {
    try {
      const backup = createPersistentStateBackup(getState());
      downloadTextFile(
        {
          fileName: getBackupFileName(),
          mimeType: "application/json",
          text: `${JSON.stringify(backup, null, 2)}\n`,
        },
        { document, urlApi, window }
      );
      setStatus("Backup exported.");
      return true;
    } catch (error) {
      logger.warn("Backup export failed", error);
      setStatus("Backup could not be exported.", { kind: "error", sticky: true });
      return false;
    }
  }

  async function importBackup(file) {
    if (!file) return false;
    if (!importAvailable) {
      setStatus(importUnavailableReason, { kind: "error", sticky: true });
      return false;
    }

    try {
      const parsed = safeJsonParse(await file.text(), null);
      const restoredState = normalizePersistentStateBackup(parsed);
      const restoreResult = onRestore(restoredState);
      const result = restoreResult && typeof restoreResult.then === "function"
        ? await restoreResult
        : restoreResult;

      if (result && result.applied === false) {
        const message = result.reason === "recipes-not-ready"
          ? "Backup could not be applied because recipes are not ready."
          : "Backup could not be applied.";
        setStatus(message, { kind: "error", sticky: true });
        return false;
      }
      if (result && result.persisted === false) {
        setStatus(
          "Backup applied for this session but could not be saved. Export a backup before refreshing.",
          { kind: "error", sticky: true }
        );
        return false;
      }

      setStatus("Backup restored.");
      return true;
    } catch (error) {
      logger.warn("Backup import failed", error);
      setStatus("Backup could not be restored.", { kind: "error", sticky: true });
      return false;
    }
  }

  function attach() {
    const exportButton = byId("exportStateBackup");
    const importButton = byId("importStateBackup");
    const importInput = byId("stateBackupInput");

    if (exportButton) exportButton.addEventListener("click", exportBackup);
    if (importButton && importInput) {
      importButton.addEventListener("click", () => {
        if (importAvailable) importInput.click();
      });
      importInput.addEventListener("change", () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = "";
        importBackup(file);
      });
    }
    syncImportAvailability();
  }

  return { attach, exportBackup, importBackup, setImportAvailable };
}
