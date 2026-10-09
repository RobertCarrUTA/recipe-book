import { useRef, useState } from "react";
import { Download, Upload, Palette, ShieldCheck, Sun } from "lucide-react";
import { useApp, appBase } from "../store";
import type { Theme, Runtime, MealPlan, UiState } from "../types";
import { Dialog } from "../components/Dialog";
import { downloadText } from "./RecipeDetail";
import {
  createPersistentStateBackup,
  parsePersistentStateBackup,
  commitRestoredPersistentState,
  normalizeUiState,
  MAX_BACKUP_BYTES,
} from "../../js/storage.js";
import {
  createRecipeRuntimeState,
  normalizeMealPlan,
  pruneRecipeRuntimeState,
  pruneMealPlanForRecipes,
  recompute,
} from "../domain";

type Imported = ReturnType<typeof parsePersistentStateBackup>;
export function Settings({
  theme,
  onThemeChange,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  const { state, notify, replaceState, setUi } = useApp();
  const [incoming, setIncoming] = useState<Imported | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const exportBackup = () => {
    try {
      const backup = createPersistentStateBackup({
        ...state,
        ui: { ...state.ui, theme },
      });
      downloadText(
        JSON.stringify(backup, null, 2),
        `recipe-book-backup-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
      );
      notify("Backup downloaded. Keep it somewhere safe.");
    } catch {
      notify("The backup could not be downloaded. Please try again.");
    }
  };
  async function readFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Backup is too large. Choose a file under 2 MB.");
      setIncoming(parsePersistentStateBackup(await file.text()));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "That file could not be read.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function restore() {
    if (!incoming) return;
    const runtime = createRecipeRuntimeState(incoming) as Runtime;
    const mealPlan = normalizeMealPlan(incoming.mealPlan) as MealPlan;
    const ui = normalizeUiState(incoming.ui) as UiState;
    pruneRecipeRuntimeState(runtime, state.recipes);
    pruneMealPlanForRecipes(mealPlan, state.recipes);
    recompute(runtime, state.recipes);
    if (!commitRestoredPersistentState({ ...runtime, mealPlan, ui })) {
      setIncoming(null);
      setError(
        "Backup could not be saved. Your existing data was kept. Check available storage, then try again.",
      );
      return;
    }
    replaceState({ runtime, mealPlan, ui });
    const importedTheme = ui.theme;
    if (
      importedTheme === "light" ||
      importedTheme === "dark" ||
      importedTheme === "system"
    )
      onThemeChange(importedTheme);
    setIncoming(null);
    notify("Backup restored. Your recipes and lists are ready.");
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Make yourself at home</p>
          <h1 tabIndex={-1}>Settings & data</h1>
          <p>A few preferences, and a safe copy of your kitchen.</p>
        </div>
      </header>
      <div className="settings-grid">
        <section className="settings-card">
          <Palette size={23} aria-hidden="true" />
          <h2>Appearance</h2>
          <p>
            Choose what feels comfortable. Device setting follows your system as
            it changes.
          </p>
          <label className="field">
            <span>Color theme</span>
            <select
              value={theme}
              onChange={(event) => onThemeChange(event.target.value as Theme)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </section>
        <section className="settings-card">
          <Sun size={23} aria-hidden="true" />
          <h2>In the kitchen</h2>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={state.ui.keepScreenAwake}
              disabled={!navigator.wakeLock}
              onChange={(event) =>
                setUi({ keepScreenAwake: event.target.checked })
              }
            />
            Keep the screen awake
          </label>
          <p>
            {navigator.wakeLock
              ? "When your browser allows it, the screen stays on while this tab is visible."
              : "This browser does not support keeping the screen awake. You can adjust your device’s screen timeout."}
          </p>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={!state.ui.skipClearGroceryConfirmation}
              onChange={(event) =>
                setUi({ skipClearGroceryConfirmation: !event.target.checked })
              }
            />
            Confirm before clearing groceries
          </label>
        </section>
        <section className="settings-card">
          <ShieldCheck size={23} aria-hidden="true" />
          <h2>Your data stays here</h2>
          <p>
            Your favorites, plan, grocery list, and preferences are saved in
            this browser. There are no accounts or cloud syncing. A backup keeps
            them portable if you change devices or clear browser data.
          </p>
          <div className="backup-actions">
            <button className="button primary" onClick={exportBackup}>
              <Download size={18} aria-hidden="true" />
              Export backup
            </button>
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || state.loadState !== "ready"}
            >
              <Upload size={18} aria-hidden="true" />
              {busy ? "Reading backup…" : "Import backup"}
            </button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              tabIndex={-1}
              aria-label="Import recipe book backup"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </div>
          {error && (
            <p className="status-banner error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="settings-card">
          <h2>Ready when you are</h2>
          <p>
            After a successful online visit, the installed recipe book can
            reopen without a connection. Browser storage can be cleared or
            evicted; a backup is your portable copy.
          </p>
          <p>
            Recipe quantities and method are preserved as authored. Grocery
            multipliers change your shopping list, while the recipe remains
            unchanged.
          </p>
          <p>
            <a
              href="https://github.com/RobertCarrUTA/recipe-book"
              target="_blank"
              rel="noopener noreferrer"
            >
              About this recipe book
            </a>
          </p>
          <p>
            <a href={`${appBase}LICENSE.md`}>Project license</a> ·{" "}
            <a href={`${appBase}THIRD_PARTY_NOTICES.txt`}>
              Third-party notices
            </a>
          </p>
        </section>
      </div>
      <Dialog
        open={Boolean(incoming)}
        onClose={() => setIncoming(null)}
        title="Restore this backup?"
        description="This replaces your current favorites, weekly plan, grocery list, and preferences. Export your current backup first if you want to keep a copy."
        footer={
          <>
            <button className="button" onClick={() => setIncoming(null)}>
              Cancel
            </button>
            <button className="button" onClick={exportBackup}>
              Export current data
            </button>
            <button className="button primary" onClick={restore}>
              Restore backup
            </button>
          </>
        }
      >
        <ul className="import-summary">
          <li>
            {Object.keys(incoming?.favoriteRecipeIds || {}).length} favorites
          </li>
          <li>
            {Object.keys(incoming?.selectedRecipeIds || {}).length} selected
            recipes
          </li>
          <li>
            {Object.keys(incoming?.manualGroceryItemsById || {}).length} manual
            groceries
          </li>
          <li>
            {Object.values(incoming?.mealPlan.days || {}).reduce(
              (sum: number, ids: unknown) =>
                sum + (Array.isArray(ids) ? ids.length : 0),
              0,
            )}{" "}
            planned meals
          </li>
        </ul>
      </Dialog>
    </>
  );
}
