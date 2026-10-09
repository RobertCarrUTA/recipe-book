import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppStore, type AppStore } from "./store";
import { normalizeRecipes } from "./domain";
import { storageKeys } from "../js/storage.js";

const soup = {
  id: "bean-soup",
  title: "Bean Soup",
  ingredients: ["1 cup beans"],
  instructions: ["Simmer the beans."],
  groceryIngredients: [{ item: "beans", quantity: 1, unit: "cup" }],
};
const rice = {
  id: "rice-bowl",
  title: "Rice Bowl",
  ingredients: ["1 cup rice"],
  instructions: ["Cook the rice."],
  groceryIngredients: [{ item: "rice", quantity: 1, unit: "cup" }],
};
const recipes = normalizeRecipes([soup, rice]);
let stores: AppStore[] = [];
const visibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const response = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as Response;
function storeAt(url = "/") {
  history.replaceState({}, "", url);
  const store = createAppStore();
  stores.push(store);
  return store;
}
function saved() {
  const raw = localStorage.getItem(storageKeys.snapshot);
  return raw ? JSON.parse(raw).data : null;
}
function durable(store: AppStore) {
  const { runtime, mealPlan, ui } = store.getSnapshot();
  return structuredClone({ runtime, mealPlan, ui });
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState({}, "", "/");
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  for (const store of stores) store.dispose();
  stores = [];
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("durable state lifecycle", () => {
  it.each(["hidden", "pagehide"])(
    "flushes the latest dirty edits on %s before the debounce runs",
    (event) => {
      const store = storeAt();
      const original = localStorage.getItem(storageKeys.snapshot);
      store.setUi({ recipeSearch: "beans", theme: "dark" });
      store.mutate((draft) => {
        draft.mealPlan.days.monday = ["bean-soup"];
      });
      expect(localStorage.getItem(storageKeys.snapshot)).toBe(original);
      if (event === "hidden") visibility("hidden");
      else window.dispatchEvent(new Event("pagehide"));
      expect(saved().ui.recipeSearch).toBe("beans");
      expect(saved().ui.theme).toBe("dark");
      expect(saved().mealPlan.days.monday).toEqual(["bean-soup"]);
      const raw = localStorage.getItem(storageKeys.snapshot);
      vi.advanceTimersByTime(1000);
      expect(localStorage.getItem(storageKeys.snapshot)).toBe(raw);
    },
  );

  it("does not flush on a visible notification, but still saves when debounce expires", () => {
    const store = storeAt();
    const original = localStorage.getItem(storageKeys.snapshot);
    store.setUi({ recipeSearch: "rice" });
    visibility("visible");
    expect(localStorage.getItem(storageKeys.snapshot)).toBe(original);
    vi.advanceTimersByTime(180);
    expect(saved().ui.recipeSearch).toBe("rice");
  });

  it("flushes on disposal and removes lifecycle listeners", () => {
    const store = storeAt();
    store.setUi({ recipeSearch: "last edit" });
    store.dispose();
    expect(saved().ui.recipeSearch).toBe("last edit");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    visibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(1000);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps dirty data available and retries it after a failed hidden flush", () => {
    const store = storeAt();
    store.setUi({ recipeSearch: "unsaved beans" });
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota reached", "QuotaExceededError");
      });
    visibility("hidden");
    expect(store.getSnapshot().persistenceError).toMatch(/could not be saved/);
    expect(store.getSnapshot().ui.recipeSearch).toBe("unsaved beans");
    write.mockRestore();
    window.dispatchEvent(new Event("pagehide"));
    expect(saved().ui.recipeSearch).toBe("unsaved beans");
    expect(store.getSnapshot().persistenceError).toBe("");
  });
});

describe("recipe request lifecycle", () => {
  it("restores valid saved collections and removes only collections missing from a successful load", async () => {
    const previous = storeAt();
    previous.setUi({
      filters: {
        collection: ["health-conscious", "soups-stews"],
        difficulty: ["easy"],
      },
      recipeSearch: "beans",
    });
    previous.dispose();
    const store = storeAt();
    const available = {
      ...soup,
      collections: ["health-conscious", "soups-stews"],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response([available]))
        .mockResolvedValueOnce(
          response([{ ...soup, collections: ["soups-stews"] }]),
        )
        .mockResolvedValueOnce(
          response([{ ...soup, collections: ["main-dishes"] }]),
        ),
    );
    await store.loadRecipes();
    expect(store.getSnapshot().ui.filters).toEqual({
      collection: ["health-conscious", "soups-stews"],
      difficulty: ["easy"],
    });
    await store.loadRecipes();
    expect(store.getSnapshot().ui.filters).toEqual({
      collection: ["soups-stews"],
      difficulty: ["easy"],
    });
    await store.loadRecipes();
    expect(store.getSnapshot().ui.filters).toEqual({ difficulty: ["easy"] });
    expect(store.getSnapshot().ui.recipeSearch).toBe("beans");
    store.flush();
    expect(saved().ui.filters).toEqual({ difficulty: ["easy"] });
  });

  it("retains collection filters after a failed or obsolete catalog load", async () => {
    const body = deferred<unknown>();
    const store = storeAt();
    store.setUi({
      filters: { collection: ["health-conscious"], rating: ["great"] },
    });
    const filters = structuredClone(store.getSnapshot().ui.filters);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Offline"))
        .mockResolvedValueOnce({ ok: true, json: () => body.promise })
        .mockResolvedValueOnce(
          response([{ ...soup, collections: ["health-conscious"] }]),
        ),
    );
    await store.loadRecipes();
    expect(store.getSnapshot().ui.filters).toEqual(filters);
    const obsolete = store.loadRecipes();
    await Promise.resolve();
    await store.loadRecipes();
    body.resolve([soup]);
    await obsolete;
    expect(store.getSnapshot().ui.filters).toEqual(filters);
  });

  it.each(["network", "status", "json", "schema"])(
    "retains saved choices and the current catalog after a %s failure",
    async (kind) => {
      const store = storeAt();
      store.patch({ recipes, loadState: "ready" });
      store.setSelected(recipes[0], true);
      store.setFavorite(recipes[1], true);
      store.setMultiplier(recipes[0], 2);
      store.planAdd("tuesday", "bean-soup");
      store.setUi({ recipeSearch: "beans" });
      store.flush();
      const before = durable(store),
        persisted = localStorage.getItem(storageKeys.snapshot);
      const fetch = vi.fn();
      if (kind === "network")
        fetch.mockRejectedValue(new TypeError("Network unavailable"));
      if (kind === "status")
        fetch.mockResolvedValue({ ok: false, status: 503 });
      if (kind === "json")
        fetch.mockResolvedValue({
          ok: true,
          json: async () => {
            throw new SyntaxError("Malformed JSON");
          },
        });
      if (kind === "schema") fetch.mockResolvedValue(response([null]));
      vi.stubGlobal("fetch", fetch);
      await store.loadRecipes();
      expect(store.getSnapshot().loadState).toBe("error");
      expect(store.getSnapshot().recipes).toEqual(recipes);
      expect(durable(store)).toEqual(before);
      expect(localStorage.getItem(storageKeys.snapshot)).toBe(persisted);
    },
  );

  it("uses fresh requests and aborts the obsolete request without showing an error", async () => {
    const first = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(response([soup, rice]));
    vi.stubGlobal("fetch", fetch);
    const store = storeAt();
    const oldLoad = store.loadRecipes();
    const oldSignal = fetch.mock.calls[0][1].signal as AbortSignal;
    vi.advanceTimersByTime(10);
    const latestLoad = store.loadRecipes();
    expect(oldSignal.aborted).toBe(true);
    first.reject(new DOMException("Aborted", "AbortError"));
    await Promise.all([oldLoad, latestLoad]);
    expect(fetch.mock.calls[0][0]).toMatch(/^\/data\/recipes\.json\?load=\d+$/);
    expect(fetch.mock.calls[1][0]).not.toBe(fetch.mock.calls[0][0]);
    expect(fetch.mock.calls[1][1].cache).toBe("no-store");
    expect(store.getSnapshot().loadState).toBe("ready");
    expect(store.getSnapshot().loadError).toBe("");
  });

  it("ignores obsolete JSON that finishes after a newer catalog and user edits", async () => {
    const body = deferred<unknown>();
    const readBody = vi.fn(() => body.promise);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: readBody })
      .mockResolvedValueOnce(response([soup, rice]));
    vi.stubGlobal("fetch", fetch);
    const store = storeAt();
    const oldLoad = store.loadRecipes();
    await Promise.resolve();
    expect(readBody).toHaveBeenCalledOnce();
    await store.loadRecipes();
    store.setSelected(store.getSnapshot().recipes[1], true);
    store.planAdd("friday", "rice-bowl");
    const before = durable(store);
    body.resolve([soup]);
    await oldLoad;
    expect(store.getSnapshot().recipes.map((recipe) => recipe.id)).toEqual([
      "bean-soup",
      "rice-bowl",
    ]);
    expect(durable(store)).toEqual(before);
    expect(store.getSnapshot().loadState).toBe("ready");
  });

  it("ignores a stale parse failure after a newer successful catalog", async () => {
    const body = deferred<unknown>();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => body.promise })
      .mockResolvedValueOnce(response([soup]));
    vi.stubGlobal("fetch", fetch);
    const store = storeAt();
    const oldLoad = store.loadRecipes();
    await Promise.resolve();
    await store.loadRecipes();
    body.reject(new SyntaxError("Old truncated response"));
    await oldLoad;
    expect(store.getSnapshot().loadState).toBe("ready");
    expect(store.getSnapshot().loadError).toBe("");
  });

  it("aborts pending work on dispose and ignores its late non-abort failure", async () => {
    const request = deferred<Response>();
    const fetch = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) => request.promise,
    );
    vi.stubGlobal("fetch", fetch);
    const store = storeAt();
    const loading = store.loadRecipes();
    store.dispose();
    expect((fetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    const before = store.getSnapshot();
    request.reject(new TypeError("Late network failure"));
    await loading;
    expect(store.getSnapshot()).toBe(before);
  });
});

describe("recipe deep links", () => {
  it.each([
    "/bean-soup",
    "/bean%2Dsoup/",
    "/#recipe=bean%2Dsoup",
    "/rice-bowl#recipe=bean-soup",
  ])("resolves safe loaded recipe link %s", async (url) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([soup, rice])));
    const store = storeAt(url);
    await store.loadRecipes();
    expect(store.getSnapshot().recipeId).toBe("bean-soup");
    expect(store.getSnapshot().view).toBe("recipes");
  });

  it.each([
    "/#recipe=Bean-Soup",
    "/#recipe=..%2Fdata%2Frecipes.json",
    "/#recipe=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "/#recipe=%E0%A4%A",
    "/%E0%A4%A",
    "/..%2Fdata%2Frecipes.json",
    "/%3Cscript%3E",
    `/#recipe=${"a".repeat(161)}`,
    "/#recipe=bean-soup&recipe=rice-bowl",
    "/#recipe=bean-soup&recipe=bean-soup",
  ])("ignores unsafe, malformed or ambiguous recipe link %s", (url) => {
    expect(storeAt(url).getSnapshot().recipeId).toBeNull();
  });

  it("clears unknown loaded recipe links and keeps the collection usable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([soup])));
    const store = storeAt("/missing-recipe");
    await store.loadRecipes();
    expect(store.getSnapshot().recipeId).toBeNull();
    expect(store.getSnapshot().loadState).toBe("ready");
    expect(store.getSnapshot().recipes).toHaveLength(1);
    expect(store.getSnapshot().message).toMatch(/could not be found/);
    expect(location.pathname).toBe("/");
  });

  it("validates stale IDs encountered by browser history after recipes have loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([soup])));
    const store = storeAt();
    await store.loadRecipes();
    history.replaceState({}, "", "/missing-recipe");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(store.getSnapshot().recipeId).toBeNull();
    expect(store.getSnapshot().recipes).toHaveLength(1);
    expect(store.getSnapshot().message).toMatch(/could not be found/);
  });

  it("keeps known history routes and returns to the saved grocery view", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([soup])));
    const store = storeAt();
    await store.loadRecipes();
    history.replaceState({}, "", "/bean-soup");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(store.getSnapshot().recipeId).toBe("bean-soup");
    expect(store.getSnapshot().message).toBe("");
    history.replaceState({}, "", "/?view=grocery");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(store.getSnapshot().recipeId).toBeNull();
    expect(store.getSnapshot().view).toBe("grocery");
    expect(location.search).toBe("?view=grocery");
  });
});
