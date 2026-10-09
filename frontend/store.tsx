import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AppState,
  DurableState,
  Recipe,
  View,
  UiState,
  DayKey,
} from "./types";
import * as domain from "./domain";

export const appBase = import.meta.env.BASE_URL;
const validViews = new Set<View>(["recipes", "plan", "grocery", "settings"]);
const safeView = (value: unknown): View =>
  validViews.has(value as View) ? (value as View) : "recipes";
function route() {
  const url = new URL(location.href);
  const hashIds = new URLSearchParams(url.hash.slice(1)).getAll("recipe");
  const hashId = hashIds.length === 1 ? hashIds[0] : null;
  let path = "";
  try {
    path = decodeURIComponent(url.pathname.slice(appBase.length)).replace(
      /^\/+|\/+$/g,
      "",
    );
  } catch {
    /* Invalid encoded paths have no recipe ID. */
  }
  const candidate = hashId || path;
  const recipeId =
    candidate.length <= 160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)
      ? candidate
      : null;
  return { view: safeView(url.searchParams.get("view")), recipeId };
}

export function createAppStore() {
  const saved = domain.restoreState();
  const initialRoute = route();
  let state: AppState = {
    ...saved,
    recipes: [],
    loadState: "loading",
    loadError: "",
    view: initialRoute.recipeId
      ? "recipes"
      : new URL(location.href).searchParams.has("view")
        ? initialRoute.view
        : safeView(saved.ui.activeView || saved.ui.mobileView),
    recipeId: initialRoute.recipeId,
    cooking: null,
    message: "",
    persistenceError: "",
    offline: !navigator.onLine,
  };
  if (!domain.getPersistentStateStatus().writable)
    state.persistenceError =
      "Saved data could not be safely opened. Changes stay in this tab until storage is available. Export a backup before refreshing.";
  if (
    !state.recipeId &&
    state.view !== "recipes" &&
    !new URL(location.href).searchParams.has("view")
  ) {
    const url = new URL(appBase, location.origin);
    url.searchParams.set("view", state.view);
    history.replaceState({ recipeBook: true }, "", url);
  }
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let disposed = false;
  let loadController: AbortController | null = null;
  let returnFocus: HTMLElement | null = null;
  let returnScroll = 0;
  const emit = () => listeners.forEach((listener) => listener());
  const patch = (next: Partial<AppState>) => {
    state = { ...state, ...next };
    emit();
  };
  function flush() {
    clearTimeout(saveTimer);
    if (!dirty) return true;
    const saved = domain.persistState(state);
    if (saved) dirty = false;
    patch({
      persistenceError: saved
        ? ""
        : "Your changes are available in this tab, but could not be saved. Export a backup before refreshing.",
    });
    return saved;
  }
  function schedule() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 180);
  }
  function mutate(action: (draft: DurableState) => void) {
    const draft: DurableState = {
      runtime: structuredClone(state.runtime),
      mealPlan: structuredClone(state.mealPlan),
      ui: structuredClone(state.ui),
    };
    action(draft);
    patch(draft);
    schedule();
  }
  function setUi(next: Partial<UiState>) {
    patch({ ui: { ...state.ui, ...next } });
    schedule();
  }
  function replaceState(next: DurableState) {
    clearTimeout(saveTimer);
    dirty = false;
    patch({ ...next, persistenceError: "" });
  }
  function notify(message: string) {
    clearTimeout(messageTimer);
    patch({ message });
    messageTimer = setTimeout(() => patch({ message: "" }), 5000);
  }
  function navigate(view: View) {
    const url = new URL(appBase, location.origin);
    if (view !== "recipes") url.searchParams.set("view", view);
    history.pushState({ recipeBook: true }, "", url);
    patch({ view, recipeId: null });
    rememberView(view);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    );
  }
  function rememberView(view: View) {
    setUi({
      activeView: view,
      ...(["recipes", "grocery"].includes(view) ? { mobileView: view } : {}),
    });
  }
  function openRecipe(id: string, fromSource = false) {
    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    returnScroll = window.scrollY;
    if (fromSource)
      setUi({
        recipeSearch: "",
        filters: {},
        showFavoriteRecipesOnly: false,
        showSelectedRecipesOnly: false,
      });
    history.pushState(
      { recipeBook: true, detail: true },
      "",
      new URL(`${appBase}${encodeURIComponent(id)}`, location.origin),
    );
    patch({ recipeId: id });
  }
  function closeRecipe() {
    if (history.state?.detail) history.back();
    else {
      const url = new URL(appBase, location.origin);
      if (state.view !== "recipes") url.searchParams.set("view", state.view);
      history.replaceState({ recipeBook: true }, "", url);
      patch({ recipeId: null });
    }
    requestAnimationFrame(() => {
      window.scrollTo({ top: returnScroll });
      returnFocus?.focus({ preventScroll: true });
    });
  }
  function cook(recipe: Recipe) {
    clearTimeout(messageTimer);
    patch({ cooking: { recipeId: recipe.id, step: 0 }, message: "" });
  }
  function setCooking(cooking: AppState["cooking"]) {
    patch({ cooking });
  }
  function setSelected(recipe: Recipe, selected: boolean) {
    mutate((draft) =>
      domain.setRecipeSelected(
        draft.runtime,
        state.recipes,
        recipe,
        state.recipes.indexOf(recipe),
        selected,
      ),
    );
    notify(
      selected
        ? `${recipe.title} added to groceries.`
        : `${recipe.title} removed from groceries.`,
    );
  }
  function setFavorite(recipe: Recipe, favorite: boolean) {
    mutate((draft) =>
      domain.setRecipeFavorite(
        draft.runtime,
        recipe,
        state.recipes.indexOf(recipe),
        favorite,
      ),
    );
  }
  function setMultiplier(recipe: Recipe, multiplier: number) {
    mutate((draft) =>
      domain.setRecipeMultiplier(
        draft.runtime,
        state.recipes,
        recipe,
        state.recipes.indexOf(recipe),
        multiplier,
      ),
    );
  }
  function planAdd(day: DayKey, id: string) {
    mutate((draft) => domain.addRecipeToMealPlan(draft.mealPlan, day, id));
    notify(`Added to ${day[0].toUpperCase() + day.slice(1)}.`);
  }
  function planRemove(day: DayKey, id: string) {
    mutate((draft) => domain.removeRecipeFromMealPlan(draft.mealPlan, day, id));
  }
  async function loadRecipes() {
    if (disposed) return;
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const obsolete = () =>
      disposed || loadController !== controller || controller.signal.aborted;
    patch({ loadState: "loading", loadError: "" });
    try {
      const response = await fetch(
        `${appBase}data/recipes.json?load=${Date.now()}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (obsolete()) return;
      if (!response.ok)
        throw new Error(`Recipe request failed (${response.status}).`);
      const raw = await response.json();
      if (obsolete()) return;
      const recipes = domain.normalizeRecipes(raw);
      const runtime = structuredClone(state.runtime);
      const mealPlan = structuredClone(state.mealPlan);
      domain.pruneRecipeRuntimeState(runtime, recipes);
      domain.pruneMealPlanForRecipes(mealPlan, recipes);
      domain.recompute(runtime, recipes);
      let ui = state.ui;
      const selectedCollections = ui.filters.collection;
      if (selectedCollections?.length) {
        const available = new Set(
          recipes.flatMap((recipe) => recipe.collections),
        );
        const retained = selectedCollections.filter((id) => available.has(id));
        if (retained.length !== selectedCollections.length) {
          const filters = { ...ui.filters };
          if (retained.length) filters.collection = retained;
          else delete filters.collection;
          ui = { ...ui, filters };
        }
      }
      const collectionsChanged = ui !== state.ui;
      patch({ recipes, runtime, mealPlan, ui, loadState: "ready" });
      if (collectionsChanged) schedule();
      if (
        state.recipeId &&
        !recipes.some((recipe) => recipe.id === state.recipeId)
      ) {
        notify(
          "That recipe could not be found. Your collection is still available.",
        );
        closeRecipe();
      }
    } catch (error) {
      if (obsolete()) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      patch({
        loadState: "error",
        loadError:
          error instanceof Error
            ? error.message
            : "Recipes could not be loaded.",
      });
    }
  }
  const onPop = () => {
    const next = route();
    if (
      next.recipeId &&
      state.loadState === "ready" &&
      !state.recipes.some((recipe) => recipe.id === next.recipeId)
    ) {
      const url = new URL(appBase, location.origin);
      if (next.view !== "recipes") url.searchParams.set("view", next.view);
      history.replaceState({ recipeBook: true }, "", url);
      patch({ ...next, recipeId: null });
      rememberView(next.view);
      notify(
        "That recipe could not be found. Your collection is still available.",
      );
      return;
    }
    patch({ ...next });
    if (!next.recipeId) rememberView(next.view);
  };
  const onNetwork = () => patch({ offline: !navigator.onLine });
  const onHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === "offline_recipebook_state_snapshot" ||
      event.key === "offline_recipebook_storage_version"
    )
      patch({
        persistenceError:
          "Your recipe book changed in another tab. Export any unsaved changes, then reload to use the latest saved state.",
      });
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("online", onNetwork);
  window.addEventListener("offline", onNetwork);
  window.addEventListener("pagehide", flush);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onHidden);
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mutate,
    setUi,
    replaceState,
    notify,
    navigate,
    openRecipe,
    closeRecipe,
    cook,
    setCooking,
    setSelected,
    setFavorite,
    setMultiplier,
    planAdd,
    planRemove,
    loadRecipes,
    flush,
    patch,
    dispose() {
      disposed = true;
      loadController?.abort();
      flush();
      clearTimeout(messageTimer);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("online", onNetwork);
      window.removeEventListener("offline", onNetwork);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onHidden);
      listeners.clear();
    },
  };
}
export type AppStore = ReturnType<typeof createAppStore>;
const StoreContext = createContext<AppStore | null>(null);
export function AppProvider({
  store,
  children,
}: {
  store: AppStore;
  children: ReactNode;
}) {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
export function useApp() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("AppProvider is required");
  return {
    ...store,
    state: useSyncExternalStore(store.subscribe, store.getSnapshot),
  };
}
