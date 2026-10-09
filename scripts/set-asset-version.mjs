import fs from "node:fs/promises";

import {
  formatServiceWorkerShellUrls,
  getStaticShellAssetPaths,
} from "./static-app-assets.mjs";

const requestedVersion = process.argv[2];
const defaultVersion = new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-1";
const assetVersion = requestedVersion || defaultVersion;

if (!/^[a-zA-Z0-9._-]+$/.test(assetVersion)) {
  throw new Error("Asset version may only contain letters, numbers, dots, underscores, and hyphens.");
}

const indexUrl = new URL("../index.html", import.meta.url);
const fallbackUrl = new URL("../404.html", import.meta.url);
const serviceWorkerUrl = new URL("../sw.js", import.meta.url);
const indexHtml = await fs.readFile(indexUrl, "utf8");
if (process.argv.includes("--build") || indexHtml.includes('name="recipe-book-release"')) {
  if (!/^\d{8}-[1-9]\d*$/.test(assetVersion)) throw new Error("Built releases use YYYYMMDD-N versions.");
  await fs.writeFile(new URL("../app-version.json", import.meta.url), `${JSON.stringify({ version: assetVersion }, null, 2)}\n`);
  console.log(`Set build version to ${assetVersion}. Rebuild, verify, and stage the generated release before publishing.`);
  process.exit(0);
}
const serviceWorkerJs = await fs.readFile(serviceWorkerUrl, "utf8");

function replaceRequiredVersion(source, pattern, label) {
  let replaced = false;
  const next = source.replace(pattern, (match, prefix, suffix) => {
    replaced = true;
    return `${prefix}${assetVersion}${suffix}`;
  });

  if (!replaced) {
    throw new Error(`No ${label} version reference was found.`);
  }

  return next;
}

function replaceRequiredBlock(source, pattern, replacement, label) {
  let replaced = false;
  const next = source.replace(pattern, () => {
    replaced = true;
    return replacement;
  });

  if (!replaced) {
    throw new Error(`No ${label} block was found.`);
  }

  return next;
}

const nextHtml = replaceRequiredVersion(
  replaceRequiredVersion(indexHtml, /(href="css\/styles\.css\?v=)[^"]+(")/, "CSS asset"),
  /(src="js\/app\.js\?v=)[^"]+(")/,
  "JavaScript asset"
);
const nextServiceWorkerJs = replaceRequiredBlock(
  replaceRequiredVersion(
    serviceWorkerJs,
    /(const CACHE_VERSION = ")[^"]+(";)/,
    "service worker cache"
  ),
  /const\s+SHELL_URLS\s*=\s*\[[\s\S]*?\];/,
  formatServiceWorkerShellUrls(await getStaticShellAssetPaths()),
  "service worker shell URL"
);

await fs.writeFile(indexUrl, nextHtml);
await fs.writeFile(fallbackUrl, nextHtml);
await fs.writeFile(serviceWorkerUrl, nextServiceWorkerJs);
console.log(`Set asset, fallback shell, and service worker cache version to ${assetVersion}`);
