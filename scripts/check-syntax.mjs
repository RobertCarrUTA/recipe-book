import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const checkDirs = ["js", "scripts", "tests"];
const checkFiles = ["sw.js"];

async function collectJavaScriptFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(absolutePath));
    } else if (/\.(?:js|mjs)$/i.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

const files = (
  await Promise.all(checkDirs.map((dir) => collectJavaScriptFiles(path.join(rootDir, dir))))
).flat().concat(checkFiles.map((file) => path.join(rootDir, file)));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checked ${files.length} JavaScript files.`);
