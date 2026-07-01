import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { resolveSmokePrerequisiteFailure } from "./smoke-prerequisites.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const port = Number(process.env.RECIPE_BOOK_SMOKE_PORT || 8787);
const url = `http://127.0.0.1:${port}/`;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

async function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      // Try the next browser candidate.
    }
  }

  return null;
}

function createStaticServer() {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", url);
      const requestPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
      const absolutePath = path.resolve(rootDir, requestPath.replace(/^\/+/, ""));

      if (!absolutePath.startsWith(rootDir)) {
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
      response.writeHead(error && error.code === "ENOENT" ? 404 : 500, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end(error && error.code === "ENOENT" ? "Not Found" : "Server Error");
    }
  });
}

async function openApp(page, options = {}) {
  await page.goto(options.debug ? `${url}?debug=1` : url, { waitUntil: "networkidle" });
  await page.waitForSelector(".recipe", { timeout: 10000 });
}

async function visibleRecipeCount(page) {
  return page.locator(".recipe:visible").count();
}

async function runBrowserCheck(browser, check) {
  const context = await browser.newContext({
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

    if (pageErrors.length || consoleMessages.length) {
      throw new Error(`Browser errors: ${[...pageErrors, ...consoleMessages].join("; ")}`);
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

      const firstHeader = page.locator(".recipe .accordion-header").first();
      assert.equal(await firstHeader.evaluate((element) => element.tagName), "BUTTON");
      assert.ok(await firstHeader.getAttribute("aria-controls"), "recipe headers should control their content panel");
    },
  },
  {
    name: "search and filter controls update recipe visibility",
    async run(page) {
      await openApp(page, { debug: true });
      const totalCount = await page.evaluate(() => window.recipeBookDebug.getState().recipes.length);

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
      const mealPlanOptionCounts = await page.locator(".meal-plan-add-form select").evaluateAll((selects) =>
        selects.map((select) => select.options.length)
      );
      assert.deepEqual(
        mealPlanOptionCounts,
        Array(7).fill(target.recipeCount + 1),
        "each meal-plan add select should include the placeholder and every recipe"
      );
      await page
        .locator('.meal-plan-day[data-day="monday"] .meal-plan-item')
        .filter({ hasText: target.title })
        .waitFor({ timeout: 5000 });

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
    viewport: { width: 390, height: 844 },
    async run(page) {
      await openApp(page);

      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#mealPlanPanel", false);
      await assertVisible(page, "#groceryPanel", false);
      await assertNoHorizontalOverflow(page, [
        ".app-shell",
        ".recipe-search",
        "#recipeContainer",
        ".mobile-view-tabs",
      ]);
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
  await locator.waitFor({ timeout: 5000 });
  const text = await locator.innerText();
  assert.match(text, pattern);
}

async function assertVisible(page, selector, expected) {
  const actual = await page.locator(selector).isVisible();
  assert.equal(actual, expected, `${selector} visibility should be ${expected}`);
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

  const executablePath = await findBrowserExecutable();
  if (!executablePath) {
    console.log(resolveSmokePrerequisiteFailure("no Chrome or Edge executable was found.").message);
    return;
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

  const browser = await playwright.chromium.launch({ executablePath, headless: true });

  try {
    for (const check of browserChecks) {
      await runBrowserCheck(browser, check);
    }

    console.log(`Browser smoke test passed (${browserChecks.length} checks).`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await run();
