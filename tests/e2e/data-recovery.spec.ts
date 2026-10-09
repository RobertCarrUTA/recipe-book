import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Run against the built app using the runner's baseURL (including a subdirectory).
// These fixtures independently describe the documented v7 storage / v1 backup
// contracts. Expected results never call app serializers or domain helpers.
const snapshotKey = "offline_recipebook_state_snapshot";
const versionKey = "offline_recipebook_storage_version";
const steak = { id: "chicken-fried-steak", title: "Chicken Fried Steak" };
const burger = { id: "a5-wagyu-burger", title: "A5 Wagyu Burger" };
type Data = {
  selectedRecipeIds: Record<string, boolean>;
  favoriteRecipeIds: Record<string, boolean>;
  recipeMultipliersById: Record<string, number>;
  groceryCheckedByKey: Record<string, boolean>;
  manualGroceryItemsById: Record<
    string,
    { id: string; name: string; note?: string }
  >;
  mealPlan: { days: Record<string, string[]> };
  ui: Record<string, unknown>;
};
type Backup = { app: string; schemaVersion: number; data: Data };

function data(overrides: Partial<Data> = {}): Data {
  return {
    selectedRecipeIds: {},
    favoriteRecipeIds: {},
    recipeMultipliersById: {},
    groceryCheckedByKey: {},
    manualGroceryItemsById: {},
    mealPlan: {
      days: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    },
    ui: {
      recipeSearch: "",
      recipeSort: "default",
      filters: {},
      groupItems: true,
    },
    ...overrides,
  };
}
function backup(value: Data): Backup {
  return { app: "robert-recipe-book", schemaVersion: 1, data: value };
}
function snapshot(value: Data): string {
  return JSON.stringify({
    storageVersion: 7,
    revision: "e2e-seed",
    data: value,
  });
}
async function seedRaw(page: Page, raw: string) {
  await page.addInitScript(
    ({ raw, snapshotKey, versionKey }) => {
      // A reload must read the app's actual result, rather than reseeding the test.
      if (sessionStorage.getItem("e2e-data-seeded")) return;
      localStorage.setItem(versionKey, "7");
      localStorage.setItem(snapshotKey, raw);
      sessionStorage.setItem("e2e-data-seeded", "1");
    },
    { raw, snapshotKey, versionKey },
  );
}
async function seed(page: Page, value: Data) {
  await seedRaw(page, snapshot(value));
}
async function readRaw(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), snapshotKey);
}
async function settings(page: Page, frozen = false) {
  const button = page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Settings", exact: true });
  if (frozen) await button.dispatchEvent("click");
  else await button.click();
  await expect(
    page.getByRole("heading", { name: "Settings & data", exact: true }),
  ).toBeVisible();
}
async function downloadBackup(page: Page, frozen = false): Promise<Backup> {
  const downloaded = page.waitForEvent("download");
  const button = page.getByRole("button", {
    name: "Export backup",
    exact: true,
  });
  if (frozen) await button.dispatchEvent("click");
  else await button.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/^recipe-book-backup-.*\.json$/);
  const path = await file.path();
  expect(path).not.toBeNull();
  const parsed = JSON.parse(await readFile(path!, "utf8")) as Backup;
  expect(parsed.app).toBe("robert-recipe-book");
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.data).toBeTruthy();
  return parsed;
}
async function chooseBackup(page: Page, contents: unknown) {
  await page
    .getByLabel("Import recipe book backup", { exact: true })
    .setInputFiles({
      name: "portable-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(contents)),
    });
}
async function openSteak(page: Page) {
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page.getByRole("link", { name: steak.title, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: steak.title, exact: true }),
  ).toBeVisible();
}
function startupWarning(page: Page) {
  return page
    .getByRole("alert")
    .filter({ hasText: /saved data|storage|could not.*sav/i });
}
async function denySnapshotWrites(page: Page) {
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key)
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, snapshotKey);
}
async function freezeAfterLoad(page: Page) {
  await page.clock.install();
  await page.goto("./");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}

test.use({ viewport: { width: 390, height: 844 } });

test("favorite and grocery selection survive an immediate reload", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Add ${steak.title} to groceries`,
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toHaveValue(steak.title);
  await expect(
    page.getByRole("button", {
      name: `Unfavorite ${steak.title}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: `Remove ${steak.title} from groceries`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("immediate backup includes the latest search and favorite before queued saves", async ({
  page,
}) => {
  await freezeAfterLoad(page);
  // Frozen timers make this a real before-debounce assertion. DOM events still
  // exercise the UI, and avoid actionability waits that require animation frames.
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .dispatchEvent("click");
  await settings(page, true);
  const exported = await downloadBackup(page, true);
  expect(exported.data.ui.recipeSearch).toBe(steak.title);
  expect(exported.data.favoriteRecipeIds).toEqual({ [steak.id]: true });
});

test("confirmed import replaces dirty state and remains intact after pending saves and reload", async ({
  page,
}) => {
  await seed(page, data({ favoriteRecipeIds: { [steak.id]: true } }));
  await freezeAfterLoad(page);
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", {
      name: `Add ${steak.title} to groceries`,
      exact: true,
    })
    .dispatchEvent("click");
  await settings(page, true);
  const imported = data({
    selectedRecipeIds: { [burger.id]: true },
    favoriteRecipeIds: { [burger.id]: true },
    recipeMultipliersById: { [burger.id]: 2.5 },
    manualGroceryItemsById: {
      pantry: { id: "pantry", name: "Pantry salt", note: "small box" },
    },
    groceryCheckedByKey: { "manual:pantry": true },
    mealPlan: {
      days: {
        monday: [burger.id],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    },
    ui: {
      recipeSearch: burger.title,
      recipeSort: "favorites-first",
      filters: {},
      theme: "dark",
    },
  });
  await chooseBackup(page, backup(imported));
  const confirm = page.getByRole("dialog", {
    name: "Restore this backup?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm
    .getByRole("button", { name: "Restore backup", exact: true })
    .dispatchEvent("click");
  await expect(confirm).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Backup restored." }),
  ).toBeVisible();
  await page.clock.runFor(1000);
  await page.clock.resume();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings & data", exact: true }),
  ).toBeVisible();
  const exported = await downloadBackup(page);
  expect(exported.data).toMatchObject(imported);
  expect(exported.data.selectedRecipeIds).toEqual({ [burger.id]: true });
  expect(exported.data.favoriteRecipeIds).toEqual({ [burger.id]: true });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Recipes", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toHaveValue(burger.title);
  await expect(
    page.getByRole("button", {
      name: `Unfavorite ${burger.title}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const [name, invalid] of [
  ["missing data", { app: "robert-recipe-book", schemaVersion: 1 }],
  [
    "invalid selected recipes",
    {
      app: "robert-recipe-book",
      schemaVersion: 1,
      data: { selectedRecipeIds: [] },
    },
  ],
] as const) {
  test(`rejects a backup with ${name} without clearing saved state`, async ({
    page,
  }) => {
    await seed(page, data({ favoriteRecipeIds: { [steak.id]: true } }));
    await page.goto("./?view=settings");
    await expect(
      page.getByRole("button", { name: "Import backup", exact: true }),
    ).toBeEnabled();
    const before = await readRaw(page);
    await chooseBackup(page, invalid);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await readRaw(page)).toBe(before);
    expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
      [steak.id]: true,
    });
  });
}

test("rejects an oversized backup before offering replacement", async ({
  page,
}) => {
  await seed(page, data({ favoriteRecipeIds: { [steak.id]: true } }));
  await page.goto("./?view=settings");
  await expect(
    page.getByRole("button", { name: "Import backup", exact: true }),
  ).toBeEnabled();
  const before = await readRaw(page);
  await page
    .getByLabel("Import recipe book backup", { exact: true })
    .setInputFiles({
      name: "too-large.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1, " "),
    });
  await expect(page.getByRole("alert")).toContainText(/too large|under 2 MB/i);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await readRaw(page)).toBe(before);
});

test("quota failure during import retains both the visible and durable prior data", async ({
  page,
}) => {
  await seed(
    page,
    data({
      favoriteRecipeIds: { [steak.id]: true },
      selectedRecipeIds: { [steak.id]: true },
    }),
  );
  await page.goto("./?view=settings");
  await expect(
    page.getByRole("button", { name: "Import backup", exact: true }),
  ).toBeEnabled();
  const before = await readRaw(page);
  await denySnapshotWrites(page);
  await chooseBackup(
    page,
    backup(data({ favoriteRecipeIds: { [burger.id]: true } })),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    /could not be saved.*existing data was kept/i,
  );
  expect(await readRaw(page)).toBe(before);
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [steak.id]: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeVisible();
  const exported = await downloadBackup(page);
  expect(exported.data.favoriteRecipeIds).toEqual({ [steak.id]: true });
  expect(exported.data.selectedRecipeIds).toEqual({ [steak.id]: true });
});

test("ordinary quota failure warns and can export unsaved changes without overwriting saved state", async ({
  page,
}) => {
  await seed(page, data({ favoriteRecipeIds: { [burger.id]: true } }));
  await page.goto("./");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  const before = await readRaw(page);
  await denySnapshotWrites(page);
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .click();
  await expect(startupWarning(page)).toBeVisible();
  expect(await readRaw(page)).toBe(before);
  await settings(page);
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [burger.id]: true,
    [steak.id]: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeVisible();
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [burger.id]: true,
  });
});

for (const [name, raw] of [
  ["corrupt", "{broken"],
  [
    "future-version",
    JSON.stringify({ storageVersion: 999, revision: "future", data: {} }),
  ],
] as const) {
  test(`${name} saved data warns at startup and is never overwritten`, async ({
    page,
  }) => {
    await seedRaw(page, raw);
    await page.goto("./");
    await expect(
      page.getByRole("searchbox", { name: "Search recipes" }),
    ).toBeVisible();
    await expect(startupWarning(page)).toBeVisible();
    expect(await readRaw(page)).toBe(raw);
    await page
      .getByRole("searchbox", { name: "Search recipes" })
      .fill(steak.title);
    await page
      .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
      .click();
    await settings(page);
    expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
      [steak.id]: true,
    });
    await page.reload();
    await expect(startupWarning(page)).toBeVisible();
    expect(await readRaw(page)).toBe(raw);
  });
}

test("denied storage warns immediately while allowing editing and backup export", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  await expect(startupWarning(page)).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Unfavorite ${steak.title}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await settings(page);
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [steak.id]: true,
  });
});

test("recovered reads cannot turn failed startup defaults into an overwrite", async ({
  page,
}) => {
  const original = snapshot(data({ favoriteRecipeIds: { [burger.id]: true } }));
  await seedRaw(page, original);
  await page.addInitScript((key) => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (
        this === localStorage &&
        name === key &&
        !sessionStorage.getItem("e2e-reads-recovered")
      ) {
        throw new DOMException("Temporarily unavailable", "SecurityError");
      }
      return get.call(this, name);
    };
  }, snapshotKey);
  await page.goto("./");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  await expect(startupWarning(page)).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("e2e-reads-recovered", "1"));
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .click();
  await settings(page);
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [steak.id]: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeVisible();
  expect(await readRaw(page)).toBe(original);
  expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
    [burger.id]: true,
  });
});

for (const outage of ["failed", "loading"] as const) {
  test(`backup remains downloadable while the catalog is ${outage}`, async ({
    page,
  }) => {
    await seed(page, data({ favoriteRecipeIds: { [steak.id]: true } }));
    if (outage === "failed") {
      await page.route("**/data/recipes.json?*", (route) =>
        route.fulfill({ status: 503, body: "Unavailable" }),
      );
    } else {
      await page.route("**/data/recipes.json?*", () => {});
    }
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name:
          outage === "failed"
            ? "Your recipes couldn’t load"
            : "Opening your recipe book",
        exact: true,
      }),
    ).toBeVisible();
    await settings(page);
    await expect(
      page.getByRole("button", { name: "Import backup", exact: true }),
    ).toBeDisabled();
    expect((await downloadBackup(page)).data.favoriteRecipeIds).toEqual({
      [steak.id]: true,
    });
  });
}

test("View grocery list finishes on the grocery screen after closing recipe detail", async ({
  page,
}) => {
  await page.goto("./");
  await openSteak(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add to groceries", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View grocery list", exact: true })
    .click();
  // Let a wrongly queued history.back traversal settle; an intermediate grocery
  // frame must not pass this regression.
  await page.waitForTimeout(250);
  await expect(
    page.getByRole("heading", { name: "Your grocery list", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("view")).toBe("grocery");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const dismissal of ["Close dialog", "browser Back"] as const) {
  test(`${dismissal} returns a grocery source to the persisted grocery screen`, async ({
    page,
  }) => {
    await seed(
      page,
      data({
        selectedRecipeIds: { [steak.id]: true },
        ui: { activeView: "grocery", mobileView: "grocery" },
      }),
    );
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "Your grocery list", exact: true }),
    ).toBeVisible();
    const source = page
      .locator("details")
      .filter({
        has: page.getByRole("button", {
          name: steak.title,
          exact: true,
          includeHidden: true,
        }),
      })
      .first();
    await source.locator("summary").click();
    await source
      .getByRole("button", { name: steak.title, exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: steak.title, exact: true }),
    ).toBeVisible();
    if (dismissal === "browser Back") await page.goBack();
    else
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Your grocery list", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("view")).toBe("grocery");
  });
}

for (const action of ["Copy link", "Copy recipe", "Copy list"] as const) {
  test(`${action} uses the copy fallback when the Clipboard API denies access`, async ({
    page,
  }) => {
    await seed(
      page,
      data({
        manualGroceryItemsById: {
          pantry: { id: "pantry", name: "Pantry salt" },
        },
      }),
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Denied", "NotAllowedError");
          },
        },
      });
      document.execCommand = (command) => {
        if (command !== "copy") return false;
        const text = document.querySelector("textarea")?.value || "";
        document.documentElement.dataset.e2eCopiedText = text;
        return true;
      };
    });
    await page.goto(action === "Copy list" ? "./?view=grocery" : "./");
    if (action !== "Copy list") await openSteak(page);
    else {
      const options = page.getByRole("button", { name: /List options/ });
      if ((await options.getAttribute("aria-expanded")) === "false")
        await options.click();
    }
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /copied\./i }),
    ).toBeVisible();
    const copied = await page
      .locator("html")
      .getAttribute("data-e2e-copied-text");
    expect(copied).toBeTruthy();
    if (action === "Copy link")
      expect(new URL(copied!).pathname).toMatch(new RegExp(`/${steak.id}$`));
    else
      expect(copied).toContain(
        action === "Copy recipe" ? steak.title : "Pantry salt",
      );
  });
}

test("a stale tab warns and cannot overwrite another tab’s saved favorite", async ({
  page,
  context,
}) => {
  await seed(page, data());
  await page.goto("./");
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  const stale = await context.newPage();
  await stale.goto(page.url());
  await expect(
    stale.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(steak.title);
  await page
    .getByRole("button", { name: `Favorite ${steak.title}`, exact: true })
    .click();
  await expect(stale.getByRole("alert")).toContainText(
    /changed in another tab/i,
  );
  await expect
    .poll(async () => JSON.parse((await readRaw(page))!).data.favoriteRecipeIds)
    .toEqual({ [steak.id]: true });
  await stale
    .getByRole("searchbox", { name: "Search recipes" })
    .fill(burger.title);
  await stale
    .getByRole("button", { name: `Favorite ${burger.title}`, exact: true })
    .click();
  await settings(stale);
  expect((await downloadBackup(stale)).data.favoriteRecipeIds).toEqual({
    [burger.id]: true,
  });
  await stale.reload();
  await expect(
    stale.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeVisible();
  expect((await downloadBackup(stale)).data.favoriteRecipeIds).toEqual({
    [steak.id]: true,
  });
});
