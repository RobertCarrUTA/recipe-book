import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./test_helpers.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

async function readProjectFile(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

async function assertProjectFileExists(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fs.stat(absolutePath);
  assert.equal(stats.isFile(), true, `${relativePath} should be a file`);
}

function extractAttributeValues(html, tagName, attributeName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}="([^"]+)"[^>]*>`, "gi");
  return Array.from(html.matchAll(pattern), (match) => match[1]);
}

function extractAllAttributeValues(html, attributeName) {
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escapedAttributeName}="([^"]*)"`, "gi");
  return Array.from(html.matchAll(pattern), (match) => match[1]);
}

function isLocalReference(reference) {
  return !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(reference);
}

function referencePath(reference) {
  const withoutHash = String(reference).split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  return withoutQuery.replace(/^\.?\//, "");
}

function getLocalIndexReferences(indexHtml) {
  return [
    ...extractAttributeValues(indexHtml, "link", "href"),
    ...extractAttributeValues(indexHtml, "script", "src"),
  ].filter(isLocalReference);
}

function getDuplicateValues(values) {
  return Array.from(new Set(values.filter((value, index) => values.indexOf(value) !== index))).sort();
}

function getAssetVersion(indexHtml) {
  const versionedReferences = getLocalIndexReferences(indexHtml).filter((reference) =>
    /^(?:css\/styles\.css|js\/app\.js)\?v=/.test(reference)
  );
  const versions = versionedReferences.map((reference) => new URL(reference, "https://example.test/").searchParams.get("v"));

  assert.deepEqual(
    versionedReferences.map(referencePath).sort(),
    ["css/styles.css", "js/app.js"],
    "index.html should version the stylesheet and app module"
  );
  assert.equal(new Set(versions).size, 1, "CSS and app module should use the same asset version");
  assert.match(versions[0], /^\d{8}-\d+$/, "asset version should use the documented YYYYMMDD-N format");

  return versions[0];
}

function extractServiceWorkerShellUrls(serviceWorkerJs) {
  const match = serviceWorkerJs.match(/const\s+SHELL_URLS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, "sw.js should define a SHELL_URLS array");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (item) => item[1]);
}

function getIdReferenceTokens(values) {
  return values.flatMap((value) => String(value || "").trim().split(/\s+/).filter(Boolean));
}

function extractStaticElementIdLookups(source) {
  return Array.from(
    source.matchAll(/\b(?:getElementById|byId|onControlChange|onId)\(\s*"([^"]+)"\s*\)/g),
    (match) => match[1]
  );
}

async function collectStaticModuleGraph(entryPath, seen = new Set()) {
  const normalizedEntryPath = entryPath.replaceAll("\\", "/");
  if (seen.has(normalizedEntryPath)) return seen;

  seen.add(normalizedEntryPath);

  const source = await readProjectFile(normalizedEntryPath);
  const importSpecifiers = Array.from(
    source.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g),
    (match) => match[1]
  );

  for (const specifier of importSpecifiers) {
    const resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(normalizedEntryPath), specifier));
    await collectStaticModuleGraph(resolvedPath, seen);
  }

  return seen;
}

test("index.html local shell references are versioned and point to files", async () => {
  const indexHtml = await readProjectFile("index.html");
  const localReferences = getLocalIndexReferences(indexHtml);

  assert.ok(localReferences.length > 0, "index.html should reference local shell assets");
  for (const reference of localReferences) {
    await assertProjectFileExists(referencePath(reference));
  }

  const unversionedCodeReferences = localReferences.filter((reference) =>
    /^(?:css\/|js\/).+\.(?:css|js)(?:$|[?#])/.test(reference) && !/\?v=/.test(reference)
  );
  assert.deepEqual(unversionedCodeReferences, [], "local CSS and JS references should include an asset version");

  const manifest = JSON.parse(await readProjectFile("manifest.webmanifest"));
  for (const icon of manifest.icons || []) {
    await assertProjectFileExists(referencePath(icon.src));
  }

  getAssetVersion(indexHtml);
});

test("index.html static DOM references stay wired", async () => {
  const indexHtml = await readProjectFile("index.html");
  const ids = extractAllAttributeValues(indexHtml, "id").filter(Boolean);
  const idSet = new Set(ids);

  assert.deepEqual(getDuplicateValues(ids), [], "index.html should not contain duplicate ids");

  const labelAndAriaReferences = getIdReferenceTokens([
    ...extractAllAttributeValues(indexHtml, "aria-controls"),
    ...extractAllAttributeValues(indexHtml, "aria-describedby"),
    ...extractAllAttributeValues(indexHtml, "aria-labelledby"),
    ...extractAllAttributeValues(indexHtml, "for"),
  ]);
  const missingLabelAndAriaReferences = labelAndAriaReferences
    .filter((id) => !idSet.has(id))
    .sort();
  assert.deepEqual(
    missingLabelAndAriaReferences,
    [],
    "label and ARIA id references should point to existing elements"
  );

  const missingHashLinks = extractAllAttributeValues(indexHtml, "href")
    .filter((href) => href.startsWith("#") && href.length > 1)
    .map((href) => href.slice(1))
    .filter((id) => !idSet.has(id))
    .sort();
  assert.deepEqual(missingHashLinks, [], "in-page hash links should point to existing elements");
});

test("static controller element lookups exist in index.html", async () => {
  const indexHtml = await readProjectFile("index.html");
  const idSet = new Set(extractAllAttributeValues(indexHtml, "id").filter(Boolean));
  const appModulePaths = await collectStaticModuleGraph("js/app.js");
  const missingLookups = [];

  for (const modulePath of appModulePaths) {
    const source = await readProjectFile(modulePath);
    extractStaticElementIdLookups(source).forEach((id) => {
      if (!idSet.has(id)) missingLookups.push(`${id} (${modulePath})`);
    });
  }

  assert.deepEqual(
    missingLookups.sort(),
    [],
    "static getElementById/byId lookups should point to elements in index.html"
  );
});

test("service worker shell cache tracks current static app assets", async () => {
  const indexHtml = await readProjectFile("index.html");
  const serviceWorkerJs = await readProjectFile("sw.js");
  const shellUrls = extractServiceWorkerShellUrls(serviceWorkerJs);
  const shellPaths = new Set(shellUrls.map(referencePath).filter(Boolean));
  const appModulePaths = await collectStaticModuleGraph("js/app.js");
  const requiredShellPaths = new Set([
    "css/styles.css",
    "icons/icon.svg",
    "index.html",
    "js/app.js",
    "manifest.webmanifest",
    ...appModulePaths,
  ]);

  assert.ok(shellUrls.includes("./"), "service worker should pre-cache the app root");
  for (const shellPath of shellPaths) {
    await assertProjectFileExists(shellPath);
  }

  const missingShellPaths = Array.from(requiredShellPaths)
    .filter((assetPath) => !shellPaths.has(assetPath))
    .sort();
  assert.deepEqual(missingShellPaths, [], "service worker shell cache should include every app shell asset");

  const cacheVersionMatch = serviceWorkerJs.match(/const\s+CACHE_VERSION\s*=\s*"([^"]+)";/);
  assert.ok(cacheVersionMatch, "sw.js should define CACHE_VERSION");
  assert.equal(
    cacheVersionMatch[1],
    getAssetVersion(indexHtml),
    "service worker cache version should match the current CSS/JS asset version"
  );
});
