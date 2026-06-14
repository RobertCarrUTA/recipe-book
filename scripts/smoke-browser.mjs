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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(".recipe", { timeout: 10000 });
    await page.fill("#recipeSearch", "chili");
    await page.waitForTimeout(250);
    await page.locator(".recipe:visible .accordion-header").first().click();
    await page.locator(".recipe:visible .recipe-add-toggle input").first().check();
    await page.locator("#groupToggle").check();
    await page.locator(".recipe:visible .cooking-mode-button").first().click();
    await page.waitForSelector("#cookingMode:not([hidden])", { timeout: 5000 });
    await page.locator("#nextCookingStep").click();
    await page.locator("#closeCookingMode").click();
    await page.locator("#clearGroceryList").click();

    const summary = await page.locator("#grocerySummary").innerText();
    if (summary !== "No recipes selected") {
      throw new Error(`Expected cleared grocery summary, got "${summary}"`);
    }
    if (pageErrors.length || consoleMessages.length) {
      throw new Error(`Browser errors: ${[...pageErrors, ...consoleMessages].join("; ")}`);
    }

    console.log("Browser smoke test passed.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await run();
