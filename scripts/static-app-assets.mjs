import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = fileURLToPath(new URL("..", import.meta.url));

const defaultAppEntryPath = "js/app.js";

function toProjectPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.?\//, "");
}

export function referencePath(reference) {
  const withoutHash = String(reference || "").split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  return toProjectPath(withoutQuery);
}

function isLocalReference(reference) {
  return !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(reference);
}

function extractAttributeValues(html, tagName, attributeName) {
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${escapedAttributeName}="([^"]+)"[^>]*>`, "gi");
  return Array.from(html.matchAll(pattern), (match) => match[1]);
}

export function getLocalIndexReferences(indexHtml) {
  return [
    ...extractAttributeValues(indexHtml, "link", "href"),
    ...extractAttributeValues(indexHtml, "script", "src"),
  ].filter(isLocalReference);
}

export async function readProjectFile(relativePath) {
  return fs.readFile(path.join(rootDir, referencePath(relativePath)), "utf8");
}

export async function assertProjectFileExists(relativePath) {
  const projectPath = referencePath(relativePath);
  const absolutePath = path.join(rootDir, projectPath);
  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`${projectPath} should be a file`);
  }
}

export async function collectStaticModuleGraph(entryPath, seen = new Set()) {
  const normalizedEntryPath = referencePath(entryPath);
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

async function collectManifestIconPaths(manifestPath) {
  const manifest = JSON.parse(await readProjectFile(manifestPath));
  return (manifest.icons || [])
    .map((icon) => referencePath(icon?.src))
    .filter(Boolean);
}

function getShellAssetRank(assetPath, appEntryPath) {
  if (assetPath === "index.html") return 0;
  if (assetPath.endsWith(".webmanifest")) return 1;
  if (assetPath.startsWith("icons/")) return 2;
  if (assetPath.startsWith("css/")) return 3;
  if (assetPath === appEntryPath) return 4;
  if (assetPath.startsWith("js/")) return 5;
  return 6;
}

function sortShellAssetPaths(paths, appEntryPath) {
  return [...paths].sort((left, right) => {
    const rankDelta = getShellAssetRank(left, appEntryPath) - getShellAssetRank(right, appEntryPath);
    return rankDelta || left.localeCompare(right);
  });
}

export async function getStaticShellAssetPaths({
  appEntryPath = defaultAppEntryPath,
  indexPath = "index.html",
} = {}) {
  const indexHtml = await readProjectFile(indexPath);
  const localReferences = getLocalIndexReferences(indexHtml).map(referencePath);
  const manifestPaths = localReferences.filter((assetPath) => assetPath.endsWith(".webmanifest"));
  const manifestIconPaths = (
    await Promise.all(manifestPaths.map((manifestPath) => collectManifestIconPaths(manifestPath)))
  ).flat();
  const appModulePaths = Array.from(await collectStaticModuleGraph(appEntryPath));

  return sortShellAssetPaths(
    new Set([
      referencePath(indexPath),
      ...localReferences,
      ...manifestIconPaths,
      ...appModulePaths,
    ]),
    referencePath(appEntryPath)
  );
}

export function formatServiceWorkerShellUrls(assetPaths) {
  const shellUrls = ["./", ...assetPaths.map((assetPath) => `./${referencePath(assetPath)}`)];
  return `const SHELL_URLS = [\n${shellUrls.map((url) => `  "${url}",`).join("\n")}\n];`;
}
