import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runRegisteredTests } from "../tests/test_helpers.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const testsDir = path.join(rootDir, "tests");

async function collectTestFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTestFiles(absolutePath));
    } else if (/\.test\.mjs$/i.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

const testFiles = await collectTestFiles(testsDir);
for (const file of testFiles) {
  await import(pathToFileURL(file).href);
}

await runRegisteredTests();
