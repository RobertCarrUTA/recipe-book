import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider, createAppStore, type AppStore } from "../store";
import { Recipes } from "./Recipes";

const soup = {
  id: "bean-soup",
  title: "Bean Soup",
  collections: ["soups-stews", "health-conscious"],
  ingredients: ["Beans"],
  instructions: ["Simmer."],
  groceryIngredients: [{ item: "beans", quantity: 1, unit: "cup" }],
  tags: { difficulty: "easy" },
};
let stores: AppStore[] = [];
beforeEach(() => {
  localStorage.clear();
  history.replaceState({}, "", "/");
});
afterEach(() => {
  cleanup();
  stores.forEach((store) => store.dispose());
  stores = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("restores a saved editorial collection and clears its help when the catalog removes it", async () => {
  const previous = createAppStore();
  previous.setUi({
    filters: { collection: ["health-conscious"], difficulty: ["easy"] },
  });
  previous.dispose();
  const store = createAppStore();
  stores.push(store);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [soup] })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...soup, collections: ["soups-stews"] }],
    });
  vi.stubGlobal("fetch", fetch);
  render(
    <AppProvider store={store}>
      <Recipes />
    </AppProvider>,
  );
  await act(async () => {
    await store.loadRecipes();
  });
  expect(
    screen.getByText(/Unlabelled recipes have not been assessed/),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Bean Soup" })).toBeTruthy();
  expect(store.getSnapshot().ui.filters.collection).toEqual([
    "health-conscious",
  ]);
  await act(async () => {
    await store.loadRecipes();
  });
  expect(
    screen.queryByText(/Unlabelled recipes have not been assessed/),
  ).toBeNull();
  expect(screen.getByRole("link", { name: "Bean Soup" })).toBeTruthy();
  expect(store.getSnapshot().ui.filters).toEqual({ difficulty: ["easy"] });
});
