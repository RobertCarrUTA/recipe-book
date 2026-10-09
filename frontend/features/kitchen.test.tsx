import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, createAppStore, type AppStore } from "../store";
import {
  addManualGroceryItem,
  normalizeRecipes,
  setRecipeSelected,
  setRecipeMultiplier,
} from "../domain";
import { Groceries } from "./Groceries";
import { Planner } from "./Planner";
import { Cooking } from "./Cooking";
import { useWakeLock } from "./useWakeLock";

const recipes = normalizeRecipes([
  {
    id: "bean-soup",
    title: "Bean Soup",
    collections: ["soups-stews"],
    ingredients: ["1 cup beans", "1 onion"],
    instructions: ["Chop the onion.", "Simmer the beans.", "Serve."],
    groceryIngredients: [
      { item: "beans", quantity: 1, unit: "cup" },
      { item: "onion", quantity: 1, unit: "each" },
    ],
    tags: { difficulty: "easy" },
    totalTime: "30 minutes",
    servings: "2",
  },
  {
    id: "rice-bowl",
    title: "Rice Bowl",
    collections: ["main-dishes"],
    ingredients: ["2 cups rice"],
    instructions: ["Cook the rice."],
    groceryIngredients: [{ item: "rice", quantity: 2, unit: "cup" }],
    tags: { difficulty: "easy" },
  },
]);
let stores: AppStore[] = [];
beforeEach(() => {
  localStorage.clear();
  history.replaceState({}, "", "/");
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  Object.defineProperty(navigator, "wakeLock", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  for (const store of stores) store.dispose();
  stores = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(
  feature: "grocery" | "plan" | "cooking",
  prepare?: (store: AppStore) => void,
) {
  const store = createAppStore();
  stores.push(store);
  store.patch({ recipes, loadState: "ready" });
  if (feature === "grocery") store.setUi({ groceryControlsCollapsed: false });
  prepare?.(store);
  const component =
    feature === "grocery" ? (
      <Groceries />
    ) : feature === "plan" ? (
      <Planner />
    ) : (
      <Cooking />
    );
  const view = render(<AppProvider store={store}>{component}</AppProvider>);
  return { store, user: userEvent.setup(), ...view };
}
function selectSoup(store: AppStore, multiplier = 1) {
  store.mutate((draft) => {
    setRecipeSelected(draft.runtime, recipes, recipes[0], 0, true);
    setRecipeMultiplier(draft.runtime, recipes, recipes[0], 0, multiplier);
  });
}

describe("Groceries", () => {
  it("adds and removes manual items without interpreting markup", async () => {
    const { user, store } = setup("grocery");
    const field = screen.getByRole("textbox", { name: "Add grocery item" });
    await user.type(field, "<img src=x>");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("<img src=x>")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(
      Object.values(store.getSnapshot().runtime.manualGroceryItemsById),
    ).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Remove <img src=x>" }),
    );
    expect(screen.getByRole("heading", { name: "A fresh list" })).toBeTruthy();
  });
  it("shows real source amounts and opens the source recipe with source navigation", async () => {
    const { user, store } = setup("grocery", (store) => selectSoup(store, 2));
    expect(screen.getByLabelText("Check onion, 2 each")).toBeTruthy();
    const source = screen.getAllByText("From 1 recipe")[0];
    await user.click(source);
    const link = screen.getAllByRole("button", { name: "Bean Soup" })[0];
    await user.click(link);
    expect(store.getSnapshot().recipeId).toBe("bean-soup");
    expect(store.getSnapshot().ui.recipeSearch).toBe("");
    expect(screen.getAllByText(/x2/).length).toBeGreaterThan(0);
  });
  it("preserves the legacy clear-checked distinction between manual and recipe items", async () => {
    const { user, store } = setup("grocery", (store) => {
      selectSoup(store);
      store.mutate((draft) => {
        addManualGroceryItem(draft.runtime, "Paper towels", { id: "paper" });
      });
    });
    await user.click(screen.getByRole("checkbox", { name: /Check onion/ }));
    await user.click(
      screen.getByRole("checkbox", { name: "Check Paper towels" }),
    );
    await user.click(screen.getByRole("button", { name: "Clear checked" }));
    expect(
      screen.queryByRole("checkbox", { name: "Check Paper towels" }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("checkbox", {
          name: /Check onion/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(store.getSnapshot().runtime.selectedRecipeIds["bean-soup"]).toBe(
      true,
    );
  });
  it("hides completed items, announces a finished list, and restores them", async () => {
    const { user } = setup("grocery", (store) =>
      store.mutate((draft) => {
        addManualGroceryItem(draft.runtime, "Coffee", { id: "coffee" });
      }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Hide checked" }));
    await user.click(screen.getByRole("checkbox", { name: "Check Coffee" }));
    expect(
      screen.getByRole("heading", { name: "Everything is checked" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Show checked items" }),
    );
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Check Coffee",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });
  it("requires confirmation before deleting selected recipes and manual items", async () => {
    const { user, store } = setup("grocery", (store) => selectSoup(store));
    await user.click(screen.getByRole("button", { name: "Delete all" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(store.getSnapshot().runtime.selectedRecipeIds["bean-soup"]).toBe(
      true,
    );
    await user.click(screen.getByRole("button", { name: "Delete all" }));
    dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Don’t ask again" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Delete all" }),
    );
    expect(store.getSnapshot().runtime.selectedRecipeIds).toEqual({});
    expect(store.getSnapshot().ui.skipClearGroceryConfirmation).toBe(true);
  });
  it("persists group collapse and encodes the grocery search suffix", async () => {
    const { user, store } = setup("grocery", (store) =>
      store.mutate((draft) => {
        addManualGroceryItem(draft.runtime, "Coffee & tea", { id: "coffee" });
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Group by section" }),
    );
    const group = screen.getByRole("button", { name: /Manual Items/ });
    await user.click(group);
    expect(store.getSnapshot().ui.collapsedGroceryGroups["Manual Items"]).toBe(
      true,
    );
    await user.click(group);
    await user.type(screen.getByLabelText(/Search suffix/), "near me");
    const url = new URL(
      screen
        .getByRole("link", { name: /Search for Coffee & tea/ })
        .getAttribute("href")!,
    );
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("q")).toBe("Coffee & tea near me");
  });
});

describe("Planner", () => {
  it("adds different days, prevents same-day duplicates, and builds repeat quantities while preserving manual items", async () => {
    const { user, store } = setup("plan", (store) =>
      store.mutate((draft) => {
        addManualGroceryItem(draft.runtime, "Coffee", { id: "coffee" });
      }),
    );
    const days = screen.getAllByRole("combobox");
    await user.selectOptions(days[0], "bean-soup");
    await user.selectOptions(days[2], "bean-soup");
    expect(
      (
        within(days[0]).getByRole("option", {
          name: "Bean Soup — already planned",
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Build grocery list" }),
    );
    expect(store.getSnapshot().runtime.recipeMultipliersById["bean-soup"]).toBe(
      2,
    );
    expect(store.getSnapshot().runtime.manualGroceryItemsById.coffee.name).toBe(
      "Coffee",
    );
    expect(store.getSnapshot().view).toBe("grocery");
  });
  it("confirms replacing an existing grocery recipe selection", async () => {
    const { user, store } = setup("plan", (store) => {
      selectSoup(store);
      store.planAdd("monday", "rice-bowl");
    });
    await user.click(
      screen.getByRole("button", { name: "Build grocery list" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(store.getSnapshot().runtime.selectedRecipeIds["bean-soup"]).toBe(
      true,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Build grocery list" }),
    );
    expect(store.getSnapshot().runtime.selectedRecipeIds).toEqual({
      "rice-bowl": true,
    });
  });
  it("removes one assignment and confirms clearing the rest without changing groceries", async () => {
    const { user, store } = setup("plan", (store) => {
      selectSoup(store);
      store.planAdd("monday", "bean-soup");
      store.planAdd("tuesday", "rice-bowl");
    });
    await user.click(
      screen.getByRole("button", { name: "Remove Bean Soup from Monday" }),
    );
    expect(store.getSnapshot().mealPlan.days.monday).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Clear plan" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear plan",
      }),
    );
    expect(store.getSnapshot().mealPlan.days.tuesday).toEqual([]);
    expect(store.getSnapshot().runtime.selectedRecipeIds["bean-soup"]).toBe(
      true,
    );
  });
});

describe("Cooking", () => {
  it("advances with arrows, bounds the final step, and closes on Finish", async () => {
    const { user, store } = setup("cooking", (store) => store.cook(recipes[0]));
    expect(screen.getByText("Chop the onion.")).toBeTruthy();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Simmer the beans.")).toBeTruthy();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(store.getSnapshot().cooking?.step).toBe(2);
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(store.getSnapshot().cooking).toBeNull();
  });
  it("leaves arrow navigation alone while using an input and closes with Escape", async () => {
    const { user, store } = setup("cooking", (store) => store.cook(recipes[0]));
    const toggle = screen.getByRole("checkbox", { name: "Keep screen awake" });
    toggle.removeAttribute("disabled");
    toggle.focus();
    await user.keyboard("{ArrowRight}");
    expect(store.getSnapshot().cooking?.step).toBe(0);
    await user.keyboard("{Escape}");
    expect(store.getSnapshot().cooking).toBeNull();
  });
  it("collapses ingredients on mobile and handles horizontal step swipes", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { user, store } = setup("cooking", (store) => store.cook(recipes[0]));
    expect(screen.getByText("1 cup beans").closest("[hidden]")).not.toBeNull();
    await user.click(
      screen.getByRole("button", { name: /Ingredients 2 items/ }),
    );
    expect(screen.getByText("1 cup beans").closest("[hidden]")).toBeNull();
    const step = screen.getByText("Chop the onion.").parentElement!;
    fireEvent.touchStart(step, {
      touches: [{ clientX: 250, clientY: 200 }],
      changedTouches: [{ clientX: 250, clientY: 200 }],
    });
    fireEvent.touchEnd(step, {
      touches: [],
      changedTouches: [{ clientX: 70, clientY: 205 }],
    });
    expect(store.getSnapshot().cooking?.step).toBe(1);
  });
});

describe("screen wake lock lifecycle", () => {
  it("releases a request that resolves after being disabled", async () => {
    let resolve!: (lock: WakeLockSentinel) => void;
    const release = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: vi.fn(
          () =>
            new Promise<WakeLockSentinel>((r) => {
              resolve = r;
            }),
        ),
      },
      configurable: true,
    });
    const fail = vi.fn();
    function Test({ enabled }: { enabled: boolean }) {
      useWakeLock(enabled, fail);
      return null;
    }
    const { rerender } = render(<Test enabled />);
    rerender(<Test enabled={false} />);
    await act(async () =>
      resolve({
        release,
        addEventListener: vi.fn(),
      } as unknown as WakeLockSentinel),
    );
    expect(release).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });
  it("reports a denied request without an unhandled rejection", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: vi.fn().mockRejectedValue(new Error("Denied")) },
      configurable: true,
    });
    const fail = vi.fn();
    function Test() {
      useWakeLock(true, fail);
      return null;
    }
    render(<Test />);
    await waitFor(() => expect(fail).toHaveBeenCalledOnce());
  });
});
