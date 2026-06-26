import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

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
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

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

      await page.fill("#recipeSearch", "chili");
      await page.waitForTimeout(250);

      const chiliCount = await visibleRecipeCount(page);
      assert.ok(chiliCount > 0, "search should keep at least one recipe visible");
      assert.ok(chiliCount < totalCount, "search should reduce visible recipe count");
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
      await assertVisible(page, "#recipeNoResults", false);
      assert.ok(await visibleRecipeCount(page), "no-results clear action should restore rendered recipes");
    },
  },
  {
    name: "adding and checking grocery items updates summary state",
    async run(page) {
      await openApp(page);

      await page.locator(".recipe .accordion-header").first().click();
      await page.locator(".recipe .recipe-add-toggle input").first().check();
      await page.waitForSelector("#groceryList li", { timeout: 5000 });

      await expectText(page, "#grocerySummary", /from 1 recipe/);
      assert.match(
        await page.locator(".grocery-progress").getAttribute("aria-valuetext"),
        /^0 of \d+ grocery items checked$/
      );
      await page.locator("#groceryList li").first().click();
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
      const potatoItem = page.locator("#groceryList li").filter({ hasText: /^potato - / }).first();
      await potatoItem.waitFor({ timeout: 5000 });
      await potatoItem.locator(".grocery-item-source-toggle").click();
      await expectLocatorText(potatoItem.locator(".grocery-item-source-list"), /Dutch Oven Chicken Pot Pie[\s\S]*1 potato/);
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
          .map((recipe, index) => ({ index, title: recipe.title, stepCount: recipe.instructions.length }))
          .find((recipe) => recipe.stepCount > 1)
      );

      assert.ok(target, "test data should include a multi-step recipe");
      await page.fill("#recipeSearch", target.title);
      await page.waitForTimeout(250);
      const recipe = page.locator(`.recipe[data-recipe-index="${target.index}"]`);
      await recipe.waitFor({ timeout: 5000 });
      await recipe.locator(".accordion-header").click();
      await recipe.locator(".cooking-mode-button").click();
      await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });

      assert.match(await page.locator("#cookingStepCount").innerText(), /^Step 1 of \d+$/i);
      assert.match(await page.locator(".cooking-progress").getAttribute("aria-valuetext"), /^Step 1 of \d+, \d+% complete$/i);
      assert.equal(await page.locator("#toggleCookingHeader").getAttribute("aria-expanded"), "true");
      await assertVisible(page, "#cookingHeaderStep", false);
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

      await page.locator("#toggleCookingHeader").click();
      assert.equal(await page.locator("#toggleCookingHeader").getAttribute("aria-expanded"), "true");
      await assertVisible(page, "#cookingHeaderKicker", true);

      await page.locator("#closeCookingMode").click();
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.hidden === true);
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
    name: "mobile view tabs and swipes switch between recipes and grocery panels",
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    async run(page) {
      await openApp(page);

      await assertVisible(page, "#recipesPanel", true);
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

      await page.locator('.mobile-view-tab[data-view="grocery"]').click();
      await assertVisible(page, "#recipesPanel", false);
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

      await page.locator('.mobile-view-tab[data-view="recipes"]').click();
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#groceryPanel", false);

      await swipeApp(page, { endX: 40, selector: ".recipe .accordion-header", startX: 340, y: 420 });
      await assertVisible(page, "#recipesPanel", false);
      await assertVisible(page, "#groceryPanel", true);

      await swipeApp(page, { endX: 340, selector: "#groceryList li", startX: 40, y: 420 });
      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#groceryPanel", false);

      await swipeApp(page, { endX: 40, selector: "#recipeSearch", startX: 340, y: 120 });
      await assertVisible(page, "#recipesPanel", true);
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
    console.log("Skipping browser smoke test: Playwright is not available.");
    return;
  }

  const executablePath = await findBrowserExecutable();
  if (!executablePath) {
    console.log("Skipping browser smoke test: no Chrome or Edge executable was found.");
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
