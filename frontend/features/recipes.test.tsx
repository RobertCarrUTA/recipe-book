import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, createAppStore, type AppStore } from "../store";
import { normalizeRecipes } from "../domain";
import { Recipes } from "./Recipes";
import { RecipeDetail } from "./RecipeDetail";
import { createPersistentStateBackup, storageKeys } from "../../js/storage.js";
let store: AppStore;
const recipes = normalizeRecipes([
  {
    id: "bean-soup",
    title: "Bean Soup",
    collections: ["soups-stews"],
    ingredients: ["Beans"],
    groceryIngredients: [{ item: "beans", quantity: 1, unit: "cup" }],
    instructions: ["Simmer."],
    notes: ["Crème fraîche"],
    tags: { difficulty: "easy", equipment: ["stovetop"] },
    totalTime: "20 minutes",
  },
  {
    id: "rice-bowl",
    title: "Rice Bowl",
    collections: ["main-dishes"],
    ingredients: ["Rice"],
    groceryIngredients: [{ item: "rice", quantity: 2, unit: "cup" }],
    instructions: ["Cook."],
    tags: { difficulty: "medium", equipment: ["rice-cooker"] },
    totalTime: "40 minutes",
  },
]);
beforeEach(() => {
  localStorage.clear();
  history.replaceState({}, "", "/");
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  store = createAppStore();
  store.patch({ recipes, loadState: "ready" });
});
afterEach(() => {
  cleanup();
  store.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount() {
  return render(
    <AppProvider store={store}>
      <Recipes />
      <RecipeDetail />
    </AppProvider>,
  );
}
it("searches normalized authored notes and supports no-result recovery", async () => {
  const user = userEvent.setup();
  mount();
  const search = screen.getByRole("searchbox", { name: "Search recipes" });
  await user.type(search, "creme fraiche");
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
  expect(screen.getByRole("link", { name: "Bean Soup" })).toBeTruthy();
  await user.clear(search);
  await user.type(search, "no such recipe");
  await screen.findByRole("heading", { name: "No recipes found" });
  await user.click(screen.getByRole("button", { name: "Show all recipes" }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
});
it("updates favorites and selected filters from authoritative state", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "Favorite Rice Bowl" }));
  await user.click(screen.getByRole("button", { name: "Favorites" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Rice Bowl" })).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Unfavorite Rice Bowl" }),
  );
  await screen.findByRole("heading", { name: "No recipes found" });
});
it("includes the latest typed query in an immediate backup before delayed persistence", async () => {
  const user = userEvent.setup();
  mount();
  await user.type(
    screen.getByRole("searchbox", { name: "Search recipes" }),
    "bean",
  );
  expect(
    createPersistentStateBackup(store.getSnapshot()).data.ui.recipeSearch,
  ).toBe("bean");
});
it("opens detail and navigates directly to groceries without queuing history.back", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("link", { name: "Bean Soup" }));
  await user.click(screen.getByRole("button", { name: "Add to groceries" }));
  const back = vi.spyOn(history, "back");
  await user.click(screen.getByRole("button", { name: /View grocery list/ }));
  expect(back).not.toHaveBeenCalled();
  expect(store.getSnapshot().view).toBe("grocery");
  expect(store.getSnapshot().recipeId).toBeNull();
  expect(new URL(location.href).searchParams.get("view")).toBe("grocery");
});
it("keeps authored ingredient prose unchanged when scaling groceries", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("link", { name: "Bean Soup" }));
  await user.click(screen.getByRole("button", { name: "Add to groceries" }));
  await user.click(
    screen.getByRole("button", { name: "Increase grocery quantity" }),
  );
  expect(store.getSnapshot().runtime.recipeMultipliersById["bean-soup"]).toBe(
    1.25,
  );
  expect(screen.getByText("Beans", { exact: true })).toBeTruthy();
  expect(recipes[0].ingredients).toEqual(["Beans"]);
});
it("canonicalizes a restored grocery view so source Back can return to the list", () => {
  store.dispose();
  localStorage.setItem(storageKeys.mobileView, "grocery");
  localStorage.removeItem(storageKeys.snapshot);
  store = createAppStore();
  expect(store.getSnapshot().view).toBe("grocery");
  expect(new URL(location.href).searchParams.get("view")).toBe("grocery");
});
it("shows initial persistence problems without waiting for a destructive interaction", () => {
  store.dispose();
  localStorage.setItem(storageKeys.snapshot, "broken");
  store = createAppStore();
  expect(store.getSnapshot().persistenceError).toMatch(
    /could not be safely opened/,
  );
});
it("ignores malformed URL escapes without crashing", () => {
  store.dispose();
  history.replaceState({}, "", "/%zz");
  store = createAppStore();
  expect(store.getSnapshot().recipeId).toBeNull();
});
it("does not turn cross-tab theme changes into data conflicts", () => {
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "offline_recipebook_theme_v1",
        newValue: "dark",
      }),
    ),
  );
  expect(store.getSnapshot().persistenceError).toBe("");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: storageKeys.snapshot,
        newValue: "changed",
      }),
    ),
  );
  expect(store.getSnapshot().persistenceError).toMatch(/another tab/);
});
