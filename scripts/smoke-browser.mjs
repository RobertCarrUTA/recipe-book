import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findBrowserExecutable } from "./browser-executable.mjs";
import { resolveSmokePrerequisiteFailure } from "./smoke-prerequisites.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const configuredPort = process.env.RECIPE_BOOK_SMOKE_PORT;
const requestedPort = configuredPort === undefined || configuredPort === "" ? 0 : Number(configuredPort);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error("RECIPE_BOOK_SMOKE_PORT must be an integer from 0 through 65535.");
}
let url = "http://127.0.0.1/";
const githubPagesProjectPath = "/recipe-book";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function createStaticServer() {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", url);
      const pathname = requestUrl.pathname === githubPagesProjectPath
        ? `${githubPagesProjectPath}/`
        : requestUrl.pathname;
      const projectPath = pathname.startsWith(`${githubPagesProjectPath}/`)
        ? pathname.slice(githubPagesProjectPath.length) || "/"
        : pathname;
      const requestPath = decodeURIComponent(projectPath === "/" ? "/index.html" : projectPath);
      const absolutePath = path.resolve(rootDir, requestPath.replace(/^\/+/, ""));
      const relativePath = path.relative(rootDir, absolutePath);

      if (relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const bytes = await fs.readFile(absolutePath);
      response.writeHead(200, {
        "content-type": mimeTypes.get(path.extname(absolutePath).toLowerCase()) || "application/octet-stream",
      });
      response.end(bytes);
    } catch (error) {
      if (error && error.code === "ENOENT" && acceptsHtml(request)) {
        try {
          const fallbackBytes = await fs.readFile(path.join(rootDir, "404.html"));
          response.writeHead(404, { "content-type": mimeTypes.get(".html") });
          response.end(fallbackBytes);
          return;
        } catch (fallbackError) {
          // Fall through to the generic server error below.
        }
      }

      response.writeHead(error && error.code === "ENOENT" ? 404 : 500, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end(error && error.code === "ENOENT" ? "Not Found" : "Server Error");
    }
  });
}

function acceptsHtml(request) {
  const acceptHeader = request.headers.accept || "";
  return /\btext\/html\b/i.test(acceptHeader);
}

async function openApp(page, options = {}) {
  const appUrl = new URL(url);
  if (options.path) appUrl.pathname = `/${String(options.path).replace(/^\/+/, "")}`;
  if (options.debug) appUrl.searchParams.set("debug", "1");
  if (options.hash) appUrl.hash = options.hash;

  await page.goto(appUrl.href, { waitUntil: "networkidle" });
  await page.waitForSelector(".recipe", { timeout: 10000 });
}

async function visibleRecipeCount(page) {
  return page.locator(".recipe:visible").count();
}

function isExpectedConsoleMessage(message, expectedPatterns = []) {
  return expectedPatterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(message) : message.includes(String(pattern))
  );
}

async function runBrowserCheck(browser, check) {
  const context = await browser.newContext({
    acceptDownloads: true,
    hasTouch: Boolean(check.hasTouch),
    viewport: check.viewport || { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    function formatUnhandledRejectionReason(reason) {
      if (reason && typeof reason === "object") {
        if (reason.stack) return reason.stack;
        if (reason.message) return reason.message;

        try {
          const json = JSON.stringify(reason);
          if (json && json !== "{}") return json;
        } catch (error) {
          // Fall through to the generic object label.
        }

        return Object.prototype.toString.call(reason);
      }

      return String(reason);
    }

    window.addEventListener("unhandledrejection", (event) => {
      console.error(`Unhandled rejection detail: ${formatUnhandledRejectionReason(event.reason)}`);
    });
  });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message || String(error)));

  try {
    await check.run(page);
    const unexpectedConsoleMessages = consoleMessages.filter(
      (message) => !isExpectedConsoleMessage(message, check.expectedConsoleMessages)
    );

    if (pageErrors.length || unexpectedConsoleMessages.length) {
      throw new Error(`Browser errors: ${[...pageErrors, ...unexpectedConsoleMessages].join("; ")}`);
    }

    console.log(`ok - ${check.name}`);
  } catch (error) {
    console.error(`not ok - ${check.name}`);
    throw error;
  } finally {
    await context.close();
  }
}

const browserChecks = [
  {
    name: "loads recipe data and renders the initial recipe stream",
    async run(page) {
      await openApp(page, { debug: true });
      const recipeCount = await page.evaluate(() => window.recipeBookDebug.getState().recipes.length);
      const renderedCount = await page.locator(".recipe").count();

      assert.ok(recipeCount > 0, "debug state should expose loaded recipes");
      assert.ok(renderedCount > 0, "at least one recipe card should render initially");
      assert.ok(renderedCount <= recipeCount, "rendered card count should not exceed loaded data");
      assert.equal(await page.locator("#recipeSearchMeta").innerText(), `${recipeCount} recipes`);

      const firstRecipe = page.locator(".recipe").first();
      const firstHeader = page.locator(".recipe .accordion-header").first();
      const firstTitle = firstRecipe.locator(".recipe-title");
      assert.equal(await firstRecipe.evaluate((element) => element.tagName), "ARTICLE");
      assert.equal(await firstRecipe.locator(".recipe-heading").evaluate((element) => element.tagName), "H3");
      assert.equal(await firstHeader.evaluate((element) => element.tagName), "BUTTON");
      assert.ok(await firstHeader.getAttribute("aria-controls"), "recipe headers should control their content panel");
      assert.equal(await firstHeader.getAttribute("aria-labelledby"), await firstTitle.getAttribute("id"));
      assert.equal(await page.locator(".skip-link").getAttribute("href"), "#mainContent");
      assert.equal(await page.locator("#mainContent").getAttribute("tabindex"), "-1");
      assert.equal(await page.locator(".quick-controls").getAttribute("role"), "group");
      assert.equal(await page.locator(".state-tools").getAttribute("role"), "group");
      assert.equal(await page.locator(".filter-group[role='group']").count(), 4);
    },
  },
  {
    name: "reloads the complete app and recipe data while offline",
    expectedConsoleMessages: [/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/],
    async run(page) {
      await openApp(page, { debug: true });
      const offlineReady = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator) || !("caches" in window)) return false;
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
          });
        }
        const cacheNames = await caches.keys();
        return cacheNames.some((name) => name.startsWith("recipe-book-shell-")) &&
          cacheNames.some((name) => name.startsWith("recipe-book-data-"));
      });
      assert.equal(offlineReady, true, "the service worker should finish caching before offline reload");

      await page.context().setOffline(true);
      try {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector(".recipe", { timeout: 10000 });
        assert.ok(await page.locator(".recipe").count(), "cached recipes should render offline");
        await expectLocatorText(page.locator("#offlineStatus"), /^Offline$/);
      } finally {
        await page.context().setOffline(false);
      }
    },
  },
  {
    name: "recipe path deep links open matching recipes and ignore unsafe paths",
    expectedConsoleMessages: [/Failed to load resource: the server responded with a status of 404/],
    async run(page) {
      await page.addInitScript(() => {
        window.__recipeBookAlerted = false;
        window.__recipeBookCopiedText = "";
        window.alert = () => {
          window.__recipeBookAlerted = true;
        };
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            async writeText(text) {
              window.__recipeBookCopiedText = text;
            },
          },
        });
      });

      await openApp(page, { path: "recipe-book/%3Cscript%3Ealert(1)%3C%2Fscript%3E" });
      assert.equal(await page.evaluate(() => window.__recipeBookAlerted), false);
      assert.equal(await page.locator(".recipe .accordion-header[aria-expanded='true']").count(), 0);

      await openApp(page, { path: "recipe-book/a5-wagyu-burger" });
      assert.equal(new URL(page.url()).pathname, "/recipe-book/a5-wagyu-burger");
      await assertRecipeDeepLinkOpen(page, "a5-wagyu-burger");
      await page
        .locator('.recipe[data-recipe-id="a5-wagyu-burger"] .recipe-export-button')
        .filter({ hasText: /^Copy link$/ })
        .click();
      assert.equal(
        await page.evaluate(() => window.__recipeBookCopiedText),
        new URL("/recipe-book/a5-wagyu-burger", page.url()).href
      );

      await openApp(page, { path: "recipe-book/chicken-fried-steak" });
      assert.equal(new URL(page.url()).pathname, "/recipe-book/chicken-fried-steak");
      await assertRecipeDeepLinkOpen(page, "chicken-fried-steak");
    },
  },
  {
    name: "search and filter controls update recipe visibility",
    async run(page) {
      await openApp(page, { debug: true });
      const totalCount = await page.evaluate(() => window.recipeBookDebug.getState().recipes.length);
      const recipeTypeSelect = page.getByRole("combobox", { name: "Recipe type", exact: true });
      const recipeTypePicker = await recipeTypeSelect.evaluate((select) => ({
        disabled: select.disabled,
        multiple: select.multiple,
        sizeAttribute: select.getAttribute("size"),
        tagName: select.tagName,
        values: Array.from(select.options, (option) => option.value),
      }));
      const lastRecipeTypeValue = recipeTypePicker.values.filter(Boolean).at(-1);

      assert.equal(recipeTypePicker.tagName, "SELECT");
      assert.equal(recipeTypePicker.disabled, false);
      assert.equal(recipeTypePicker.multiple, false);
      assert.equal(recipeTypePicker.sizeAttribute, null);
      assert.ok(recipeTypePicker.values.length > 10, "the native picker should expose the full collection list");
      assert.equal(
        await page.locator("#recipeCollection option:checked").innerText(),
        "All recipe types"
      );

      await recipeTypeSelect.selectOption(lastRecipeTypeValue);
      assert.equal(await recipeTypeSelect.inputValue(), lastRecipeTypeValue);
      await page.waitForFunction(
        (collectionId) => {
          const state = window.recipeBookDebug.getState();
          const expectedCount = state.recipes.filter((recipe) => recipe.collections.includes(collectionId)).length;
          return document.querySelector("#recipeSearchMeta")?.textContent === `${expectedCount} matches of ${state.recipes.length}`;
        },
        lastRecipeTypeValue
      );
      await recipeTypeSelect.selectOption("");

      const pizzaRecipeIds = await page.evaluate(() =>
        window.recipeBookDebug
          .getState()
          .recipes
          .filter((recipe) => recipe.collections.includes("pizza"))
          .map((recipe) => recipe.id)
      );

      assert.ok(pizzaRecipeIds.length > 0, "recipe data should include a Pizza collection");
      assert.equal(
        await page.locator('#recipeCollection option[value="pizza"]').innerText(),
        "Pizza"
      );

      await page.selectOption("#recipeCollection", "pizza");
      await page.waitForFunction(
        (expectedCount) => document.querySelector("#recipeSearchMeta")?.textContent === `${expectedCount} matches of ${window.recipeBookDebug.getState().recipes.length}`,
        pizzaRecipeIds.length
      );
      const visiblePizzaIds = await page.locator(".recipe:visible").evaluateAll((elements) =>
        elements.map((element) => element.dataset.recipeId)
      );
      assert.ok(visiblePizzaIds.length > 0, "the Pizza collection should render recipe cards");
      assert.ok(
        visiblePizzaIds.every((recipeId) => pizzaRecipeIds.includes(recipeId)),
        "every rendered Pizza result should belong to that collection"
      );

      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector(".recipe", { timeout: 10000 });
      assert.equal(await page.locator("#recipeCollection").inputValue(), "pizza");
      assert.equal(
        await page.locator("#recipeSearchMeta").innerText(),
        `${pizzaRecipeIds.length} matches of ${totalCount}`
      );
      assert.ok(await visibleRecipeCount(page), "persisted Pizza browsing should render results");

      await page.selectOption("#recipeCollection", "");
      await page.waitForFunction(
        (expectedCount) => document.querySelector("#recipeSearchMeta")?.textContent === `${expectedCount} recipes`,
        totalCount
      );

      await assertVisible(page, "#clearRecipeSearch", false);
      await page.fill("#recipeSearch", "chili");
      await assertVisible(page, "#clearRecipeSearch", true);
      await page.locator("#clearRecipeSearch").click();
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#recipeSearch").inputValue(), "");
      await assertVisible(page, "#clearRecipeSearch", false);

      await page.fill("#recipeSearch", "chili");
      await page.waitForTimeout(250);

      const chiliCount = await visibleRecipeCount(page);
      assert.ok(chiliCount > 0, "search should keep at least one recipe visible");
      assert.ok(chiliCount < totalCount, "search should reduce visible recipe count");
      assert.equal(
        await page.locator("#recipeSearchMeta").evaluate((element) => element.classList.contains("is-filtered")),
        true,
        "filtered recipe count should have a visible state"
      );
      assert.match(
        await page.locator("#recipeSearchMeta").innerText(),
        new RegExp(`^\\d+ matches of ${totalCount}$`)
      );

      await page.locator("#toggleFilters").click();
      await page.locator('.recipe-filters input[data-filter="status"][value="tried"]').check();
      await page.waitForTimeout(50);

      const filteredCount = await visibleRecipeCount(page);
      assert.ok(filteredCount <= chiliCount, "tag filters should narrow or preserve the current search result");

      await page.locator("#clearFilters").click();
      await page.fill("#recipeSearch", "");
      await page.waitForTimeout(250);
      const restoredCount = await visibleRecipeCount(page);
      assert.ok(restoredCount > 0, "clearing search and filters should restore rendered recipes");
      assert.ok(restoredCount <= totalCount, "incremental rendering should not exceed the loaded recipe count");

      await page.fill("#recipeSearch", "zzzzzzzz-not-a-recipe");
      await page.waitForTimeout(250);
      assert.equal(await visibleRecipeCount(page), 0, "unmatched search should hide all recipes");
      await assertVisible(page, "#recipeNoResults", true);

      await page.locator("#clearRecipeDiscoveryFilters").click();
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#recipeSearch").inputValue(), "");
      assert.equal(
        await page.locator("#recipeSearchMeta").evaluate((element) => element.classList.contains("is-filtered")),
        false,
        "clearing discovery filters should restore the neutral count state"
      );
      await assertVisible(page, "#recipeNoResults", false);
      assert.ok(await visibleRecipeCount(page), "no-results clear action should restore rendered recipes");
    },
  },
  {
    name: "recipe browse controls fit the desktop breakpoint",
    viewport: { width: 1024, height: 900 },
    async run(page) {
      await openApp(page);
      await page.selectOption("#recipeCollection", "pizza");
      await page.selectOption("#recipeSort", "fastest");
      await assertNoHorizontalOverflow(page, [
        ".app-shell",
        ".recipe-search",
        ".recipe-controls-panel",
        ".recipe-search-field",
        ".recipe-browse-controls",
        ".recipe-collection-control",
        ".recipe-sort-control",
      ]);

      const controlWidths = await page.evaluate(() => ({
        collection: document.querySelector(".recipe-collection-control")?.getBoundingClientRect().width || 0,
        search: document.querySelector(".recipe-search-field")?.getBoundingClientRect().width || 0,
        sort: document.querySelector(".recipe-sort-control")?.getBoundingClientRect().width || 0,
      }));
      const recipeTypeLayout = await getLabeledSelectLayout(
        page,
        ".recipe-collection-control",
        "#recipeCollection"
      );
      const sortLayout = await getLabeledSelectLayout(page, ".recipe-sort-control", "#recipeSort");

      assert.ok(controlWidths.search >= 180, "search should remain usable at the desktop breakpoint");
      assert.ok(controlWidths.collection >= 175, "Recipe type should remain usable at the desktop breakpoint");
      assert.ok(controlWidths.sort >= 140, "Sort should remain usable at the desktop breakpoint");
      assert.ok(recipeTypeLayout.labelBottom <= recipeTypeLayout.selectTop + 1, "Recipe type label should sit above its field");
      assert.ok(sortLayout.labelBottom <= sortLayout.selectTop + 1, "Sort label should sit above its field");
      assert.ok(recipeTypeLayout.selectWidth >= recipeTypeLayout.controlWidth - 1, "Recipe type field should use its full control width");
      assert.ok(sortLayout.selectWidth >= sortLayout.controlWidth - 1, "Sort field should use its full control width");
      await assertSelectOptionTextFits(page, "#recipeCollection");
      await assertSelectOptionTextFits(page, "#recipeSort");
      await assertSelectOptionsReadable(page, "#recipeCollection");
      await assertSelectOptionsReadable(page, "#recipeSort");
    },
  },
  {
    name: "recipe export downloads formatted text and JSON",
    async run(page) {
      await openApp(page, { debug: true });
      const target = await page.evaluate(() => {
        const recipes = window.recipeBookDebug.getState().recipes;
        const index = recipes.findIndex((recipe) => recipe.ingredients.length && recipe.instructions.length);
        const recipe = recipes[index >= 0 ? index : 0];
        return {
          id: recipe.id,
          index: index >= 0 ? index : 0,
          title: recipe.title,
        };
      });

      await page.fill("#recipeSearch", target.title);
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await assertVisible(page, `.recipe[data-recipe-index="${target.index}"] .recipe-export-actions`, true);

      const textDownloadPromise = page.waitForEvent("download");
      await recipe.locator(".recipe-export-button").filter({ hasText: /^Text file$/ }).click();
      const textDownload = await textDownloadPromise;
      const textPath = await textDownload.path();
      const text = await fs.readFile(textPath, "utf8");
      assert.equal(textDownload.suggestedFilename(), `${target.id}.txt`);
      assert.match(text, new RegExp(`^${escapeRegExp(target.title)}\\n`));
      assert.match(text, /\nIngredients\n- /);
      assert.match(text, /\nInstructions\n1\. /);

      const jsonDownloadPromise = page.waitForEvent("download");
      await recipe.locator(".recipe-export-button").filter({ hasText: /^JSON file$/ }).click();
      const jsonDownload = await jsonDownloadPromise;
      const jsonPath = await jsonDownload.path();
      const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
      assert.equal(jsonDownload.suggestedFilename(), `${target.id}.json`);
      assert.equal(json.id, target.id);
      assert.equal(json.title, target.title);
    },
  },
  {
    name: "mobile recipe export copies formatted text",
    hasTouch: true,
    viewport: { width: 381, height: 844 },
    async run(page) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            async writeText(text) {
              window.__recipeBookCopiedText = text;
            },
          },
        });
      });
      await openApp(page, { debug: true });
      const target = await page.evaluate(() => {
        const recipes = window.recipeBookDebug.getState().recipes;
        const index = recipes.findIndex((recipe) => recipe.ingredients.length && recipe.instructions.length);
        const recipe = recipes[index >= 0 ? index : 0];
        return {
          index: index >= 0 ? index : 0,
          title: recipe.title,
        };
      });

      await page.fill("#recipeSearch", target.title);
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await assertVisible(page, `.recipe[data-recipe-index="${target.index}"] .recipe-export-copy-button`, true);
      await recipe.locator(".recipe-export-copy-button").click();

      const copiedText = await page.evaluate(() => window.__recipeBookCopiedText || "");
      assert.match(copiedText, new RegExp(`^${escapeRegExp(target.title)}\\n`));
      assert.match(copiedText, /\nIngredients\n- /);
      assert.match(copiedText, /\nInstructions\n1\. /);
      await expectLocatorText(recipe.locator(".recipe-export-status"), /^Copied\.$/);
    },
  },
  {
    name: "favorite and selected sorts update when recipe state changes",
    async run(page) {
      await openApp(page, { debug: true });
      const targets = await page.evaluate(() => {
        const recipes = window.recipeBookDebug.getState().recipes;
        return {
          favorite: {
            index: Math.min(5, recipes.length - 1),
            title: recipes[Math.min(5, recipes.length - 1)].title,
          },
          selected: {
            index: Math.min(6, recipes.length - 1),
            title: recipes[Math.min(6, recipes.length - 1)].title,
          },
        };
      });

      await page.selectOption("#recipeSort", "favorites-first");
      const favoriteRecipe = page.locator(`.recipe[data-recipe-index="${targets.favorite.index}"]`);
      await favoriteRecipe.waitFor({ timeout: 5000 });
      await favoriteRecipe.locator(".accordion-header").click();
      await favoriteRecipe.locator(".favorite-recipe-button").click();
      await expectLocatorText(
        page.locator(".recipe .recipe-title").first(),
        new RegExp(`^${escapeRegExp(targets.favorite.title)}$`)
      );

      await page.selectOption("#recipeSort", "selected-first");
      const selectedRecipe = page.locator(`.recipe[data-recipe-index="${targets.selected.index}"]`);
      await selectedRecipe.waitFor({ timeout: 5000 });
      await selectedRecipe.locator(".accordion-header").click();
      await selectedRecipe.locator(".recipe-add-toggle").click();
      await expectLocatorText(
        page.locator(".recipe .recipe-title").first(),
        new RegExp(`^${escapeRegExp(targets.selected.title)}$`)
      );
    },
  },
  {
    name: "weekly meal planner schedules recipes and builds grocery list",
    async run(page) {
      await openApp(page, { debug: true });
      const target = await page.evaluate(() => {
        const recipes = window.recipeBookDebug.getState().recipes;
        const index = recipes.findIndex((recipe) => recipe.title === "Dutch Oven Chicken Pot Pie");
        const fallbackIndex = index >= 0 ? index : 0;
        return {
          id: recipes[fallbackIndex].id,
          index: fallbackIndex,
          recipeCount: recipes.length,
          title: recipes[fallbackIndex].title,
        };
      });

      await page.fill("#recipeSearch", target.title);
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await recipe.locator(".recipe-plan-select").selectOption("monday");

      await expectText(page, "#mealPlanSummary", /^1 meal - 1 day$/);
      await expectLocatorText(recipe.locator(".recipe-planned-badge"), /Planned Mon/i);
      await assertVisible(page, "#mealPlanPanel", false);
      await page.locator("#openMealPlan").click();
      await assertVisible(page, "#mealPlanPanel", true);
      assert.equal(await page.locator("#mealPlanPanel").getAttribute("role"), "dialog");
      assert.equal(await page.locator("#mealPlanPanel").getAttribute("aria-modal"), "true");
      assert.equal(await page.locator("#recipesPanel").evaluate((element) => element.inert), true);
      assert.equal(await page.locator(".skip-link").evaluate((element) => element.inert), true);
      const mealPlanFocusables = page.locator(
        "#mealPlanPanel button:not(:disabled), #mealPlanPanel input:not(:disabled), #mealPlanPanel select:not(:disabled)"
      );
      await mealPlanFocusables.last().focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#buildGroceryListFromMealPlan").evaluate((element) => document.activeElement === element),
        true,
        "meal-plan Tab focus should wrap to its first enabled control"
      );
      const mealPlanOptionCounts = await page.locator(".meal-plan-add-form select").evaluateAll((selects) =>
        selects.map((select) => select.options.length)
      );
      assert.deepEqual(
        mealPlanOptionCounts,
        Array(7).fill(target.recipeCount + 1),
        "each meal-plan add select should include the placeholder and every recipe"
      );
      const plannedItem = page
        .locator('.meal-plan-day[data-day="monday"] .meal-plan-item')
        .filter({ hasText: target.title });
      await plannedItem.waitFor({ timeout: 5000 });
      const plannedCookButton = plannedItem.getByRole("button", { name: `Cook ${target.title}`, exact: true });
      await plannedCookButton.click();
      await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.hidden === true);
      await assertVisible(page, "#mealPlanPanel", true);
      assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("is-meal-plan-open")), true);
      assert.equal(await page.locator(".skip-link").evaluate((element) => element.inert), true);
      assert.equal(
        await plannedCookButton.evaluate((element) => document.activeElement === element),
        true,
        "closing cooking mode should return to the still-open meal plan"
      );

      await page.locator("#buildGroceryListFromMealPlan").click();
      await expectText(page, "#grocerySummary", /from 1 recipe/);
      const selectedRecipeIds = await page.evaluate(() =>
        Object.keys(window.recipeBookDebug.getState().runtime.selectedRecipeIds)
      );
      assert.deepEqual(selectedRecipeIds, [target.id]);

      await page.locator("#openMealPlan").click();
      await assertVisible(page, "#mealPlanPanel", true);
      await page.locator("#clearMealPlan").click();
      await expectText(page, "#mealPlanSummary", /^No meals planned$/);
      await assertVisible(page, "#mobileMealPlanBadge", false);
    },
  },
  {
    name: "desktop grocery controls can be collapsed and restored",
    async run(page) {
      await openApp(page);

      await assertVisible(page, "#groceryPanel", true);
      await assertVisible(page, "#toggleGroceryControls", true);
      await assertVisible(page, "#groceryControlsPanel", true);
      const expandedBarHeight = await page.locator(".grocery-shopping-bar").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );

      await page.locator("#toggleGroceryControls").click();
      await assertVisible(page, "#groceryPanel", true);
      await assertVisible(page, "#groceryControlsPanel", false);
      assert.equal(await page.locator("#toggleGroceryControls").getAttribute("aria-expanded"), "false");
      await expectLocatorText(page.locator("#toggleGroceryControls"), /^Show$/);
      const collapsedBarHeight = await page.locator(".grocery-shopping-bar").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      assert.ok(collapsedBarHeight < expandedBarHeight, "collapsed desktop grocery controls should free vertical space");

      await page.locator("#toggleGroceryControls").click();
      await assertVisible(page, "#groceryPanel", true);
      await assertVisible(page, "#groceryControlsPanel", true);
      assert.equal(await page.locator("#toggleGroceryControls").getAttribute("aria-expanded"), "true");
      await expectLocatorText(page.locator("#toggleGroceryControls"), /^Hide$/);
    },
  },
  {
    name: "adding and checking grocery items updates summary state",
    async run(page) {
      await openApp(page);

      await page.locator(".recipe .accordion-header").first().click();
      const firstAddToggle = page.locator(".recipe .recipe-add-toggle").first();
      await firstAddToggle.locator("input").check();
      await expectLocatorText(firstAddToggle, /Added to grocery list/);
      await page.waitForSelector("#groceryList li", { timeout: 5000 });

      await expectText(page, "#grocerySummary", /from 1 recipe/);
      assert.match(
        await page.locator(".grocery-progress").getAttribute("aria-valuetext"),
        /^0 of \d+ grocery items checked$/
      );
      const firstGroceryItem = page.locator("#groceryList li").first();
      const firstGroceryCheckbox = firstGroceryItem.locator('input[type="checkbox"]');
      assert.ok(await firstGroceryCheckbox.getAttribute("aria-label"), "grocery checkboxes should have names");
      assert.equal(await firstGroceryItem.getAttribute("tabindex"), null);
      const firstSearchLink = firstGroceryItem.locator(".grocery-item-search-link");
      await firstSearchLink.waitFor({ timeout: 5000 });
      assert.equal(await firstSearchLink.innerText(), "Search");
      assert.match(await firstSearchLink.getAttribute("href"), /^https:\/\/www\.google\.com\/search\?q=.+/);
      assert.equal(await firstSearchLink.getAttribute("target"), "_blank");
      assert.equal(await firstSearchLink.getAttribute("rel"), "noopener noreferrer");
      assert.equal(await firstSearchLink.getAttribute("referrerpolicy"), "no-referrer");
      await firstSearchLink.evaluate((link) => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      assert.match(
        await page.locator(".grocery-progress").getAttribute("aria-valuetext"),
        /^0 of \d+ grocery items checked$/,
        "searching a grocery item should not toggle its checked state"
      );
      await firstGroceryItem.evaluate((element) => {
        element.dataset.renderToken = "kept";
      });
      await firstGroceryItem.click();
      assert.equal(
        await page.locator("#groceryList li").first().evaluate((element) => element.dataset.renderToken),
        "kept",
        "checking visible grocery items should not rebuild the row"
      );
      await expectText(page, "#grocerySummary", /1 checked/);
      assert.match(
        await page.locator(".grocery-progress").getAttribute("aria-valuetext"),
        /^1 of \d+ grocery items checked$/
      );

      await page.locator("#clearGroceryList").click();
      await assertVisible(page, "#confirmClearGroceryDialog", true);
      await page.locator("#cancelClearGroceryList").click();
      await assertVisible(page, "#confirmClearGroceryDialog", false);
      assert.ok(await page.locator("#groceryList li").count(), "canceling delete should keep grocery items");

      await page.locator("#clearGroceryList").click();
      await page.locator("#confirmClearGroceryList").click();
      await assertVisible(page, "#confirmClearGroceryDialog", false);
      assert.equal(await page.locator("#grocerySummary").innerText(), "No items yet");
      assert.equal(await page.locator("#groceryList li").count(), 0);
    },
  },
  {
    name: "manual grocery items support sections, hide checked, and clear checked",
    async run(page) {
      await openApp(page);

      assert.equal(await page.locator('#manualGroceryForm button[type="submit"]').isDisabled(), true);
      await page.fill("#manualGroceryInput", "Paper towels");
      assert.equal(await page.locator('#manualGroceryForm button[type="submit"]').isDisabled(), false);
      await page.locator("#manualGroceryForm").evaluate((form) => form.requestSubmit());
      await page.locator("#groceryList li").filter({ hasText: "Paper towels" }).waitFor({ timeout: 5000 });
      assert.equal(await page.locator('#manualGroceryForm button[type="submit"]').isDisabled(), true);
      await expectText(page, "#grocerySummary", /1 item - 1 left/);

      await page.locator("#groupToggle").check();
      await page.waitForSelector(".grocery-group-header:has-text('Manual Items')", { timeout: 5000 });

      const manualSection = page.locator(".grocery-group").filter({ hasText: "Manual Items" }).first();
      await manualSection.locator(".grocery-group-header").click();
      assert.equal(await manualSection.locator("ul").first().evaluate((el) => el.hidden), true);
      assert.equal(await manualSection.locator("ul").first().isVisible(), false);

      await manualSection.locator(".grocery-group-header").click();
      await manualSection.locator("li").filter({ hasText: "Paper towels" }).click();
      await expectText(page, "#grocerySummary", /1 checked/);

      await page.locator("#hideCheckedGroceryItems").check();
      await expectText(page, "#groceryList", /Everything visible is checked|Everything in Manual Items is checked/);

      await page.locator("#clearCheckedGroceryItems").click();
      assert.equal(await page.locator("#grocerySummary").innerText(), "No items yet");
      assert.equal(await page.locator("#groceryList li").count(), 0);
    },
  },
  {
    name: "grocery delete confirmation can be dismissed",
    async run(page) {
      await openApp(page);

      await page.fill("#manualGroceryInput", "Paper towels");
      await page.locator("#manualGroceryForm").evaluate((form) => form.requestSubmit());
      await page.locator("#groceryList li").filter({ hasText: "Paper towels" }).waitFor({ timeout: 5000 });

      await page.locator("#clearGroceryList").click();
      await assertVisible(page, "#confirmClearGroceryDialog", true);
      await page.locator("#skipClearGroceryConfirmation").check();
      await page.locator("#confirmClearGroceryList").click();
      await assertVisible(page, "#confirmClearGroceryDialog", false);
      assert.equal(await page.locator("#grocerySummary").innerText(), "No items yet");

      await page.fill("#manualGroceryInput", "Dish soap");
      await page.locator("#manualGroceryForm").evaluate((form) => form.requestSubmit());
      await page.locator("#groceryList li").filter({ hasText: "Dish soap" }).waitFor({ timeout: 5000 });

      await page.locator("#clearGroceryList").click();
      await expectText(page, "#grocerySummary", /^No items yet$/);
      await assertVisible(page, "#confirmClearGroceryDialog", false);
    },
  },
  {
    name: "checked grocery sections show section-specific empty text",
    async run(page) {
      await openApp(page);

      await page.locator("#addAllRecipesToGroceryList").click();
      await page.locator("#groupToggle").check();

      const firstSection = page.locator(".grocery-group").first();
      const sectionName = (await firstSection.locator(".grocery-group-title").evaluate((element) => element.textContent)).trim();
      const itemCount = await firstSection.locator("li:not(.grocery-group-empty)").count();

      for (let index = 0; index < itemCount; index += 1) {
        await firstSection.locator("li:not(.grocery-group-empty)").nth(index).click();
      }

      await page.locator("#hideCheckedGroceryItems").check();
      await firstSection.locator(".grocery-group-empty").waitFor({ timeout: 5000 });
      assert.equal(
        await firstSection.locator(".grocery-group-empty").innerText(),
        `Everything in ${sectionName} is checked.`
      );
    },
  },
  {
    name: "grocery source expansion shows recipe-specific quantities",
    async run(page) {
      await openApp(page);

      await page.locator("#addAllRecipesToGroceryList").click();
      const yeastItem = page.locator("#groceryList li").filter({ hasText: /^active dry yeast - / }).first();
      await yeastItem.waitFor({ timeout: 5000 });
      await expectLocatorText(yeastItem.locator(".grocery-item-source-toggle"), /From \d+ recipes/);
      await yeastItem.locator(".grocery-item-source-toggle").click();
      await expectLocatorText(
        yeastItem.locator(".grocery-item-source-list"),
        /Cinnamon Rolls[\s\S]*(Homemade Beignets with French Hot Chocolate|Homemade Honey Buns)/
      );
      await yeastItem.locator('input[type="checkbox"]').check();
      await assertVisible(page, "#groceryList li:has-text('active dry yeast') .grocery-item-source-list", true);
      await expectLocatorText(
        page.locator("#groceryList li").filter({ hasText: /^active dry yeast - / }).first().locator(".grocery-item-source-list"),
        /Cinnamon Rolls[\s\S]*(Homemade Beignets with French Hot Chocolate|Homemade Honey Buns)/
      );

      const potatoItem = page.locator("#groceryList li").filter({ hasText: /^potato - / }).first();
      await potatoItem.waitFor({ timeout: 5000 });
      await potatoItem.locator(".grocery-item-source-toggle").click();
      await expectLocatorText(potatoItem.locator(".grocery-item-source-list"), /Dutch Oven Chicken Pot Pie[\s\S]*1 potato/);

      await page.fill("#recipeSearch", "zzzzzzzz-not-a-recipe");
      await page.waitForTimeout(250);
      assert.equal(await visibleRecipeCount(page), 0, "setup search should hide every recipe before source navigation");
      await potatoItem.locator(".grocery-source-link").filter({ hasText: "Dutch Oven Chicken Pot Pie" }).click();
      assert.equal(await page.locator("#recipeSearch").inputValue(), "");
      const potPieRecipe = page.locator(".recipe").filter({ hasText: "Dutch Oven Chicken Pot Pie" }).first();
      await potPieRecipe.waitFor({ timeout: 5000 });
      assert.equal(await potPieRecipe.locator(".accordion-header").getAttribute("aria-expanded"), "true");
      await waitForRecipeAlignedBelowSearch(page, "Dutch Oven Chicken Pot Pie");
      assert.equal(
        await potPieRecipe.evaluate((element) => element.classList.contains("recipe-reveal-highlight")),
        true,
        "source navigation should visibly highlight the target recipe"
      );
    },
  },
  {
    name: "single-source grocery labels open their recipe",
    async run(page) {
      await openApp(page, { debug: true });
      const targets = await page.evaluate(() => {
        const recipes = window.recipeBookDebug.getState().recipes;
        return ["Dutch Baby Pancake", "Best-Ever Chocolate Chip Cookies"].map((title) => {
          const index = recipes.findIndex((recipe) => recipe.title === title);
          return { index, title };
        });
      });

      assert.deepEqual(
        targets.map((target) => target.index >= 0),
        [true, true],
        "test data should include recipes for a small grocery list"
      );

      for (const target of targets) {
        await page.fill("#recipeSearch", target.title);
        await page.waitForTimeout(250);
        const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
        await recipe.waitFor({ timeout: 5000 });
        await recipe.locator(".accordion-header").click();
        await recipe.locator(".recipe-add-toggle input").check();
      }

      const milkItem = page.locator("#groceryList li").filter({ hasText: /^whole milk - / }).first();
      await milkItem.waitFor({ timeout: 5000 });
      await expectLocatorText(milkItem.locator(".grocery-source-single-link"), /From Dutch Baby Pancake/);

      await page.fill("#recipeSearch", "zzzzzzzz-not-a-recipe");
      await page.waitForTimeout(250);
      assert.equal(await visibleRecipeCount(page), 0, "setup search should hide every recipe before source navigation");
      await milkItem.locator(".grocery-source-single-link").click();
      assert.equal(await page.locator("#recipeSearch").inputValue(), "");

      const dutchBabyRecipe = page.locator(".recipe").filter({ hasText: "Dutch Baby Pancake" }).first();
      await dutchBabyRecipe.waitFor({ timeout: 5000 });
      assert.equal(await dutchBabyRecipe.locator(".accordion-header").getAttribute("aria-expanded"), "true");
    },
  },
  {
    name: "recipe grocery quantity controls scale grocery totals",
    async run(page) {
      await openApp(page, { debug: true });
      const recipeIndex = await page.evaluate(() =>
        window.recipeBookDebug
          .getState()
          .recipes.findIndex((recipe) => recipe.title === "Dutch Oven Chicken Pot Pie")
      );

      assert.ok(recipeIndex >= 0, "test data should include Dutch Oven Chicken Pot Pie");
      await page.fill("#recipeSearch", "Dutch Oven Chicken Pot Pie");
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${recipeIndex}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await recipe.locator(".recipe-add-toggle input").check();

      await recipe.locator(".recipe-scale-input").fill("2");
      await recipe.locator(".recipe-scale-input").press("Enter");

      await expectLocatorText(recipe.locator(".recipe-selected-badge"), /in list x2/i);
      const potatoItem = page.locator("#groceryList li").filter({ hasText: /^potato - 2 potatoes/ }).first();
      await potatoItem.waitFor({ timeout: 5000 });
      await expectLocatorText(potatoItem, /From Dutch Oven Chicken Pot Pie x2/);
    },
  },
  {
    name: "cooking mode opens, advances, and closes",
    async run(page) {
      await openApp(page, { debug: true });
      const target = await page.evaluate(() =>
        window.recipeBookDebug
          .getState()
          .recipes
          .map((recipe, index) => ({
            index,
            ingredientCount: recipe.ingredients.length,
            title: recipe.title,
            stepCount: recipe.instructions.length,
          }))
          .find((recipe) => recipe.stepCount > 1 && recipe.ingredientCount > 0)
      );

      assert.ok(target, "test data should include a multi-step recipe with ingredients");
      await page.fill("#recipeSearch", target.title);
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      const cookButton = recipe.locator(".cooking-mode-button");
      await cookButton.click();
      await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });

      assert.equal(await page.locator("#cookingMode").getAttribute("role"), "dialog");
      assert.equal(await page.locator("#cookingMode").getAttribute("aria-modal"), "true");
      assert.equal(await page.locator(".app-shell").evaluate((element) => element.inert), true);
      assert.equal(await page.locator(".app-shell").getAttribute("aria-hidden"), "true");
      assert.equal(await page.locator(".skip-link").evaluate((element) => element.inert), true);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#toggleCookingHeader").evaluate((element) => document.activeElement === element),
        true,
        "cooking-mode Tab focus should wrap to its first control"
      );
      assert.match(await page.locator("#cookingStepCount").innerText(), /^Step 1 of \d+$/i);
      assert.match(await page.locator(".cooking-progress").getAttribute("aria-valuetext"), /^Step 1 of \d+, \d+% complete$/i);
      assert.equal(await page.locator("#toggleCookingHeader").getAttribute("aria-expanded"), "true");
      await assertVisible(page, "#cookingHeaderStep", false);
      await page.locator("#cookingIngredients li").first().evaluate((element) => {
        element.dataset.renderToken = "kept";
      });
      const expandedHeaderHeight = await page.locator("#cookingHeader").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );

      await page.locator("#toggleCookingHeader").click();
      assert.equal(await page.locator("#toggleCookingHeader").getAttribute("aria-expanded"), "false");
      await assertVisible(page, "#cookingHeaderKicker", false);
      await assertVisible(page, "#cookingHeaderStep", true);
      assert.match(await page.locator("#cookingHeaderStep").innerText(), /^Step 1 of \d+$/i);
      const collapsedHeaderHeight = await page.locator("#cookingHeader").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      assert.ok(collapsedHeaderHeight < expandedHeaderHeight, "collapsed cooking header should free vertical space");

      await page.locator("#nextCookingStep").click();
      assert.match(await page.locator("#cookingStepCount").innerText(), /^Step 2 of \d+$/i);
      assert.match(await page.locator("#cookingHeaderStep").innerText(), /^Step 2 of \d+$/i);
      assert.match(await page.locator(".cooking-progress").getAttribute("aria-valuetext"), /^Step 2 of \d+, \d+% complete$/i);
      assert.equal(
        await page.locator("#cookingIngredients li").first().evaluate((element) => element.dataset.renderToken),
        "kept",
        "step navigation should not rebuild the unchanged ingredient list"
      );

      await page.locator("#toggleCookingHeader").click();
      assert.equal(await page.locator("#toggleCookingHeader").getAttribute("aria-expanded"), "true");
      await assertVisible(page, "#cookingHeaderKicker", true);

      await page.locator("#closeCookingMode").click();
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.hidden === true);
      assert.equal(await page.locator(".app-shell").evaluate((element) => element.inert), false);
      assert.equal(await page.locator(".app-shell").getAttribute("aria-hidden"), null);
      assert.equal(await page.locator(".skip-link").evaluate((element) => element.inert), false);
      assert.equal(
        await cookButton.evaluate((element) => document.activeElement === element),
        true,
        "closing cooking mode should restore focus to the opener"
      );
    },
  },
  {
    name: "mobile cooking header collapse keeps long recipe titles contained",
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    async run(page) {
      await openApp(page, { debug: true });
      const recipeIndex = await page.evaluate(() =>
        window.recipeBookDebug
          .getState()
          .recipes.findIndex((recipe) => recipe.title === "Baklava Croissant Bread Pudding")
      );

      assert.ok(recipeIndex >= 0, "test data should include Baklava Croissant Bread Pudding");
      await page.fill("#recipeSearch", "Baklava Croissant Bread Pudding");
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${recipeIndex}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await recipe.locator(".cooking-mode-button").click();
      await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });

      const expandedHeaderHeight = await page.locator("#cookingHeader").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );

      await page.locator("#toggleCookingHeader").click();
      await assertVisible(page, "#cookingHeaderStep", true);
      const collapsedHeaderHeight = await page.locator("#cookingHeader").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      assert.ok(collapsedHeaderHeight < expandedHeaderHeight, "collapsed cooking header should be shorter");

      const collapsedTitleStyles = await page.locator("#cookingTitle").evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          fontSize: Number.parseFloat(styles.fontSize),
          overflow: styles.overflow,
          textOverflow: styles.textOverflow,
          whiteSpace: styles.whiteSpace,
        };
      });
      assert.ok(collapsedTitleStyles.fontSize <= 17, "collapsed mobile title should stay compact");
      assert.equal(collapsedTitleStyles.overflow, "hidden");
      assert.equal(collapsedTitleStyles.textOverflow, "ellipsis");
      assert.equal(collapsedTitleStyles.whiteSpace, "nowrap");

      const overflowReport = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const selectors = [
          "#cookingHeader",
          "#cookingTitle",
          ".cooking-progress",
          "#cookingIngredientsPanel",
          ".cooking-step-panel",
          ".cooking-footer",
        ];

        return selectors
          .map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { right: rect.right, selector };
          })
          .filter((item) => item && item.right > viewportWidth + 1);
      });

      assert.deepEqual(overflowReport, []);
    },
  },
  {
    name: "mobile view tabs and swipes switch directly between recipes and grocery",
    hasTouch: true,
    viewport: { width: 381, height: 844 },
    async run(page) {
      await openApp(page);

      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", false);
      await assertNoHorizontalOverflow(page, [
        ".app-shell",
        ".recipe-search",
        ".recipe-browse-controls",
        ".recipe-collection-control",
        ".recipe-sort-control",
        "#recipeContainer",
        ".mobile-view-tabs",
      ]);
      const mobileRecipeTypeLayout = await getLabeledSelectLayout(
        page,
        ".recipe-collection-control",
        "#recipeCollection"
      );
      const mobileSortLayout = await getLabeledSelectLayout(page, ".recipe-sort-control", "#recipeSort");

      assert.ok(
        mobileRecipeTypeLayout.selectWidth >= mobileRecipeTypeLayout.controlWidth - 1,
        "Recipe type should use its full mobile control width"
      );
      assert.ok(
        mobileSortLayout.selectWidth >= mobileSortLayout.controlWidth - 1,
        "Sort should use its full mobile control width"
      );
      assert.ok(
        mobileRecipeTypeLayout.labelBottom <= mobileRecipeTypeLayout.selectTop + 1,
        "Recipe type label should sit above its mobile field"
      );
      assert.ok(
        mobileSortLayout.labelBottom <= mobileSortLayout.selectTop + 1,
        "Sort label should sit above its mobile field"
      );
      await assertSelectOptionTextFits(page, "#recipeCollection");
      await assertSelectOptionTextFits(page, "#recipeSort");
      assert.equal(
        await page.locator(".recipe-search").evaluate((element) => getComputedStyle(element).position),
        "sticky"
      );
      const expandedRecipeSearchHeight = await page.locator(".recipe-search").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );

      await page.locator("#toggleRecipeControls").click();
      await assertVisible(page, "#recipeControlsPanel", false);
      assert.equal(await page.locator("#toggleRecipeControls").getAttribute("aria-expanded"), "false");
      const compactRecipeSearchHeight = await page.locator(".recipe-search").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      assert.ok(
        compactRecipeSearchHeight < expandedRecipeSearchHeight,
        "collapsed recipe controls should reduce sticky header height"
      );

      await page.locator("#toggleRecipeControls").click();
      await assertVisible(page, "#recipeControlsPanel", true);
      assert.equal(await page.locator("#toggleRecipeControls").getAttribute("aria-expanded"), "true");

      await page.locator("#openMealPlan").click();
      assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("is-meal-plan-open")), true);
      assert.equal(await page.locator("#recipesPanel").getAttribute("aria-hidden"), "true");
      await assertVisible(page, "#mealPlanPanel", true);
      await assertVisible(page, "#groceryPanel", false);
      await assertNoHorizontalOverflow(page, [
        ".meal-plan-bar",
        "#mealPlanBoard",
        ".mobile-view-tabs",
      ]);
      assert.equal(
        await page.locator(".meal-plan-bar").evaluate((element) => getComputedStyle(element).position),
        "sticky"
      );

      await page.locator("#closeMealPlanPanel").click();
      assert.equal(await page.locator("body").evaluate((element) => element.classList.contains("is-meal-plan-open")), false);
      assert.equal(await page.locator("#recipesPanel").getAttribute("aria-hidden"), null);
      await assertVisible(page, "#mealPlanPanel", false);

      await page.locator('.mobile-view-tab[data-view="grocery"]').click();
      await assertVisible(page, "#recipesPanel", false);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", true);
      await assertNoHorizontalOverflow(page, [
        ".grocery-shopping-bar",
        "#groceryList",
        ".mobile-view-tabs",
      ]);
      assert.equal(
        await page.locator(".grocery-shopping-bar").evaluate((element) => getComputedStyle(element).position),
        "sticky"
      );
      const expandedBarHeight = await page.locator(".grocery-shopping-bar").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );

      await page.locator("#toggleGroceryControls").click();
      await assertVisible(page, "#groceryControlsPanel", false);
      assert.equal(await page.locator("#toggleGroceryControls").getAttribute("aria-expanded"), "false");
      const compactBarHeight = await page.locator(".grocery-shopping-bar").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      assert.ok(compactBarHeight < expandedBarHeight, "collapsed grocery controls should reduce sticky header height");

      await page.locator("#toggleGroceryControls").click();
      await assertVisible(page, "#groceryControlsPanel", true);
      assert.equal(await page.locator("#toggleGroceryControls").getAttribute("aria-expanded"), "true");

      await page.locator("#addAllRecipesToGroceryList").click();
      const firstGroceryItemMinHeight = await page.locator("#groceryList li").first().evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).minHeight)
      );
      assert.ok(firstGroceryItemMinHeight >= 60, "mobile grocery rows should keep a comfortable tap target");
      await assertNoHorizontalOverflow(page, ["#groceryList"]);

      const mobilePotatoItem = page.locator("#groceryList li").filter({ hasText: /^potato - / }).first();
      await scrollLocatorToViewportCenter(mobilePotatoItem);
      await mobilePotatoItem.locator(".grocery-item-source-toggle").click();
      const mobilePotPieSource = mobilePotatoItem
        .locator(".grocery-source-link")
        .filter({ hasText: "Dutch Oven Chicken Pot Pie" });
      await scrollLocatorToViewportCenter(mobilePotPieSource);
      const groceryScrollBeforeSource = await page.evaluate(() => window.scrollY);
      await clickLocatorInPlace(mobilePotPieSource);
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#groceryPanel", false);
      const mobilePotPieRecipe = page.locator(".recipe").filter({ hasText: "Dutch Oven Chicken Pot Pie" }).first();
      await mobilePotPieRecipe.waitFor({ timeout: 5000 });
      assert.equal(await mobilePotPieRecipe.locator(".accordion-header").getAttribute("aria-expanded"), "true");
      await waitForRecipeAlignedBelowSearch(page, "Dutch Oven Chicken Pot Pie");

      await page.goBack();
      await assertVisible(page, "#recipesPanel", false);
      await assertVisible(page, "#groceryPanel", true);
      await page.waitForFunction(
        (expectedScrollY) => Math.abs(window.scrollY - expectedScrollY) <= 8,
        groceryScrollBeforeSource
      );

      await page.locator('.mobile-view-tab[data-view="recipes"]').click();
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", false);

      await swipeApp(page, { endX: 40, selector: ".recipe .accordion-header", startX: 340, y: 420 });
      await assertVisible(page, "#recipesPanel", false);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", true);

      await swipeApp(page, { endX: 340, selector: "#groceryList li", startX: 40, y: 420 });
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", false);

      await swipeApp(page, { endX: 40, selector: "#recipeSearch", startX: 340, y: 120 });
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", false);
    },
  },
];

async function expectText(page, selector, pattern) {
  await page.waitForFunction(
    ({ selector, source, flags }) => new RegExp(source, flags).test(document.querySelector(selector)?.textContent || ""),
    { selector, source: pattern.source, flags: pattern.flags }
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function expectLocatorText(locator, pattern) {
  const timeoutMs = 5000;
  const retryDelayMs = 50;
  const deadline = Date.now() + timeoutMs;
  let lastText = "";

  await locator.waitFor({ timeout: timeoutMs });

  while (Date.now() < deadline) {
    lastText = await locator.innerText();
    if (new RegExp(pattern.source, pattern.flags).test(lastText)) return;
    await new Promise((resolve) => {
      setTimeout(resolve, retryDelayMs);
    });
  }

  assert.match(lastText, pattern);
}

async function assertVisible(page, selector, expected) {
  const actual = await page.locator(selector).isVisible();
  assert.equal(actual, expected, `${selector} visibility should be ${expected}`);
}

async function assertRecipeDeepLinkOpen(page, recipeId) {
  await page.waitForFunction(
    (targetRecipeId) => {
      const recipe = Array.from(document.querySelectorAll(".recipe[data-recipe-id]"))
        .find((element) => element.dataset.recipeId === targetRecipeId);
      const header = recipe?.querySelector(".accordion-header");
      const content = recipe?.querySelector(".accordion-content");
      return header?.getAttribute("aria-expanded") === "true" &&
        content?.classList.contains("open");
    },
    recipeId,
    { timeout: 10000 }
  );
}

async function assertNoHorizontalOverflow(page, selectors) {
  const overflowReport = await page.evaluate((items) => {
    const viewportWidth = window.innerWidth;

    return items
      .map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          selector,
        };
      })
      .filter((item) => item && (item.left < -1 || item.right > viewportWidth + 1));
  }, selectors);

  assert.deepEqual(overflowReport, []);
}

async function getLabeledSelectLayout(page, controlSelector, selectSelector) {
  return page.evaluate(({ controlSelector, selectSelector }) => {
    const control = document.querySelector(controlSelector);
    const label = control?.querySelector("span");
    const select = document.querySelector(selectSelector);
    const controlRect = control?.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    const selectRect = select?.getBoundingClientRect();

    return {
      controlWidth: controlRect?.width || 0,
      labelBottom: labelRect?.bottom || 0,
      selectTop: selectRect?.top || 0,
      selectWidth: selectRect?.width || 0,
    };
  }, { controlSelector, selectSelector });
}

async function assertSelectOptionTextFits(page, selector) {
  const report = await page.locator(selector).evaluate((select) => {
    const styles = getComputedStyle(select);
    const probe = document.createElement("span");
    Object.assign(probe.style, {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
      left: "-10000px",
      letterSpacing: styles.letterSpacing,
      position: "fixed",
      visibility: "hidden",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(probe);

    const availableWidth =
      select.clientWidth -
      Number.parseFloat(styles.paddingLeft) -
      Number.parseFloat(styles.paddingRight);
    const clipped = Array.from(select.options, (option) => {
      probe.textContent = option.textContent.trim();
      return {
        text: probe.textContent,
        textWidth: probe.getBoundingClientRect().width,
      };
    }).filter(({ textWidth }) => textWidth > availableWidth + 1);

    probe.remove();
    return {
      availableWidth,
      clipped,
      selectWidth: select.getBoundingClientRect().width,
    };
  });

  assert.deepEqual(
    report.clipped,
    [],
    `${selector} option text should fit when selected: ${JSON.stringify(report)}`
  );
}

async function assertSelectOptionsReadable(page, selector) {
  const report = await page.locator(selector).evaluate((select) => {
    function parseColor(value) {
      const match = String(value || "").match(/^rgba?\(([^)]+)\)$/i);
      if (!match) return null;

      const values = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (values.length < 3 || values.slice(0, 3).some((channel) => !Number.isFinite(channel))) return null;
      return {
        alpha: Number.isFinite(values[3]) ? values[3] : 1,
        blue: values[2],
        green: values[1],
        red: values[0],
      };
    }

    function luminance(color) {
      const channels = [color.red, color.green, color.blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function readColors(element) {
      const styles = getComputedStyle(element);
      const foreground = parseColor(styles.color);
      const background = parseColor(styles.backgroundColor);
      let contrast = 0;

      if (foreground && background && foreground.alpha >= 0.99 && background.alpha >= 0.99) {
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        contrast = (lighter + 0.05) / (darker + 0.05);
      }

      return {
        backgroundAlpha: background?.alpha ?? 0,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        contrast,
        foregroundAlpha: foreground?.alpha ?? 0,
      };
    }

    return {
      options: Array.from(select.options, (option) => ({
        ...readColors(option),
        text: option.textContent.trim(),
      })),
      select: readColors(select),
    };
  });
  const unreadableOptions = report.options.filter(
    (option) =>
      option.backgroundAlpha < 0.99 ||
      option.foregroundAlpha < 0.99 ||
      option.contrast < 4.5
  );

  assert.ok(
    report.select.backgroundAlpha >= 0.99 &&
      report.select.foregroundAlpha >= 0.99 &&
      report.select.contrast >= 4.5,
    `${selector} should keep an opaque, readable selected value: ${JSON.stringify(report.select)}`
  );
  assert.deepEqual(
    unreadableOptions,
    [],
    `${selector} options should keep opaque, readable colors: ${JSON.stringify(unreadableOptions)}`
  );
}

async function waitForRecipeAlignedBelowSearch(page, recipeTitle, options = {}) {
  const tolerance = options.tolerance || 18;

  function getAlignmentReportScript(title) {
    const recipe = Array.from(document.querySelectorAll(".recipe"))
      .find((element) => (element.textContent || "").includes(title));
    const searchPanel = document.querySelector(".recipe-search");
    let expectedTop = 0;
    let searchPanelReport = null;

    if (searchPanel) {
      const styles = getComputedStyle(searchPanel);
      const rect = searchPanel.getBoundingClientRect();
      const stickyTop = Number.parseFloat(styles.top);
      searchPanelReport = {
        display: styles.display,
        height: rect.height,
        stickyTop: Number.isFinite(stickyTop) ? stickyTop : null,
        top: rect.top,
        visibility: styles.visibility,
      };

      if (styles.display !== "none" && styles.visibility !== "hidden" && rect.height) {
        expectedTop = Math.ceil((Number.isFinite(stickyTop) ? Math.max(0, stickyTop) : 0) + rect.height + 8);
      }
    }

    return {
      delta: recipe ? recipe.getBoundingClientRect().top - expectedTop : null,
      expectedTop,
      recipeTop: recipe ? recipe.getBoundingClientRect().top : null,
      scrollY: window.scrollY,
      searchPanel: searchPanelReport,
    };
  }

  try {
    await page.waitForFunction(
      ({ recipeTitle, tolerance }) => {
        const recipe = Array.from(document.querySelectorAll(".recipe"))
          .find((element) => (element.textContent || "").includes(recipeTitle));
        if (!recipe) return false;

        const searchPanel = document.querySelector(".recipe-search");
        let expectedTop = 0;

        if (searchPanel) {
          const styles = getComputedStyle(searchPanel);
          const rect = searchPanel.getBoundingClientRect();
          if (styles.display !== "none" && styles.visibility !== "hidden" && rect.height) {
            const stickyTop = Number.parseFloat(styles.top);
            expectedTop = Math.ceil((Number.isFinite(stickyTop) ? Math.max(0, stickyTop) : 0) + rect.height + 8);
          }
        }

        return Math.abs(recipe.getBoundingClientRect().top - expectedTop) <= tolerance;
      },
      { recipeTitle, tolerance },
      { timeout: 5000 }
    );
  } catch (error) {
    const report = await page.evaluate(getAlignmentReportScript, recipeTitle);
    throw new Error(`Recipe alignment failed for ${recipeTitle}: ${JSON.stringify(report)}`);
  }
}

async function scrollLocatorToViewportCenter(locator) {
  await locator.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
}

async function clickLocatorInPlace(locator) {
  await locator.waitFor({ timeout: 5000 });
  await locator.evaluate((element) => {
    const PointerEventCtor = window.PointerEvent || window.Event;
    element.dispatchEvent(
      new PointerEventCtor("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
      })
    );
    element.click();
  });
}

async function swipeApp(page, coordinates) {
  await page.evaluate(({ endX, selector, startX, y }) => {
    const surface = document.querySelector(".app-layout");
    const target = selector ? document.querySelector(selector) : surface;
    const startTouch = { clientX: startX, clientY: y };
    const endTouch = { clientX: endX, clientY: y };

    function dispatchTouch(type, touches, changedTouches) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        changedTouches: { value: changedTouches },
        touches: { value: touches },
      });
      (target || surface).dispatchEvent(event);
    }

    dispatchTouch("touchstart", [startTouch], [startTouch]);
    dispatchTouch("touchend", [], [endTouch]);
  }, coordinates);
}

async function run() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (error) {
    console.log(resolveSmokePrerequisiteFailure("Playwright is not available.").message);
    return;
  }

  const executablePath = await findBrowserExecutable({ playwright });
  if (!executablePath) {
    console.log(resolveSmokePrerequisiteFailure("no Chromium, Chrome, or Edge executable was found.").message);
    return;
  }

  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolve();
    };
    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(requestedPort, "127.0.0.1");
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Browser smoke server did not expose a TCP port.");
  }
  url = `http://127.0.0.1:${address.port}/`;
  let browser = null;

  try {
    browser = await playwright.chromium.launch({ executablePath, headless: true });
    for (const check of browserChecks) {
      await runBrowserCheck(browser, check);
    }

    console.log(`Browser smoke test passed (${browserChecks.length} checks).`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await run();
