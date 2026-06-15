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
    name: "loads recipe data and renders all recipe cards",
    async run(page) {
      await openApp(page, { debug: true });
      const recipeCount = await page.evaluate(() => window.recipeBookDebug.getState().recipes.length);

      assert.ok(recipeCount > 0, "debug state should expose loaded recipes");
      assert.equal(await page.locator(".recipe").count(), recipeCount, "rendered card count should match loaded data");
      assert.equal(await page.locator("#recipeSearchMeta").innerText(), `Showing ${recipeCount} of ${recipeCount}`);
    },
  },
  {
    name: "search and filter controls update recipe visibility",
    async run(page) {
      await openApp(page);
      const totalCount = await page.locator(".recipe").count();

      await page.fill("#recipeSearch", "chili");
      await page.waitForTimeout(250);

      const chiliCount = await visibleRecipeCount(page);
      assert.ok(chiliCount > 0, "search should keep at least one recipe visible");
      assert.ok(chiliCount < totalCount, "search should reduce visible recipe count");

      await page.locator("#toggleFilters").click();
      await page.locator('.recipe-filters input[data-filter="status"][value="tried"]').check();
      await page.waitForTimeout(50);

      const filteredCount = await visibleRecipeCount(page);
      assert.ok(filteredCount <= chiliCount, "tag filters should narrow or preserve the current search result");

      await page.locator("#clearFilters").click();
      await page.fill("#recipeSearch", "");
      await page.waitForTimeout(250);
      assert.equal(await visibleRecipeCount(page), totalCount, "clearing search and filters should restore all recipes");
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
      await page.locator("#groceryList li").first().click();
      await expectText(page, "#grocerySummary", /1 checked/);

      await page.locator("#clearGroceryList").click();
      assert.equal(await page.locator("#grocerySummary").innerText(), "No recipes selected");
      assert.equal(await page.locator("#groceryList li").count(), 0);
    },
  },
  {
    name: "cooking mode opens, advances, and closes",
    async run(page) {
      await openApp(page, { debug: true });
      const recipeIndex = await page.evaluate(() =>
        window.recipeBookDebug.getState().recipes.findIndex((recipe) => recipe.instructions.length > 1)
      );

      assert.ok(recipeIndex >= 0, "test data should include a multi-step recipe");
      const recipe = page.locator(`.recipe[data-recipe-index="${recipeIndex}"]`);
      await recipe.locator(".accordion-header").click();
      await recipe.locator(".cooking-mode-button").click();
      await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });

      assert.match(await page.locator("#cookingStepCount").innerText(), /^Step 1 of \d+$/i);

      await page.locator("#nextCookingStep").click();
      assert.match(await page.locator("#cookingStepCount").innerText(), /^Step 2 of \d+$/i);

      await page.locator("#closeCookingMode").click();
      await page.waitForFunction(() => document.querySelector("#cookingMode")?.hidden === true);
    },
  },
  {
    name: "mobile view tabs switch between recipes and grocery panels",
    viewport: { width: 390, height: 844 },
    async run(page) {
      await openApp(page);

      await assertVisible(page, "#recipesPanel", true);
      await assertVisible(page, "#groceryPanel", false);

      await page.locator('.mobile-view-tab[data-view="grocery"]').click();
      await assertVisible(page, "#recipesPanel", false);
      await assertVisible(page, "#groceryPanel", true);

      await page.locator('.mobile-view-tab[data-view="recipes"]').click();
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

async function assertVisible(page, selector, expected) {
  const actual = await page.locator(selector).isVisible();
  assert.equal(actual, expected, `${selector} visibility should be ${expected}`);
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
