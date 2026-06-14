import fs from "node:fs/promises";

const requestedVersion = process.argv[2];
const defaultVersion = new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-1";
const assetVersion = requestedVersion || defaultVersion;

if (!/^[a-zA-Z0-9._-]+$/.test(assetVersion)) {
  throw new Error("Asset version may only contain letters, numbers, dots, underscores, and hyphens.");
}

const indexUrl = new URL("../index.html", import.meta.url);
const indexHtml = await fs.readFile(indexUrl, "utf8");

const nextHtml = indexHtml
  .replace(/(href="css\/styles\.css\?v=)[^"]+(")/, `$1${assetVersion}$2`)
  .replace(/(src="js\/app\.js\?v=)[^"]+(")/, `$1${assetVersion}$2`);

if (nextHtml === indexHtml) {
  throw new Error("No asset version references were updated in index.html.");
}

await fs.writeFile(indexUrl, nextHtml);
console.log(`Set asset version to ${assetVersion}`);
