import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const visited = new Set();
const notices = [];
async function readNotice(filename) {
  const text = await fs.readFile(filename, "utf8");
  if (!text.trim()) throw new Error(`Empty license notice: ${filename}`);
  return text;
}
async function collect(name, from) {
  const require = createRequire(path.join(from, "package.json"));
  let directory;
  for (const candidate of require.resolve.paths(name) || []) {
    const location = path.join(candidate, name);
    try {
      await fs.access(path.join(location, "package.json"));
      directory = location;
      break;
    } catch {
      /* Try Node's next module directory. */
    }
  }
  if (!directory) throw new Error(`Cannot locate runtime dependency ${name}`);
  const pkg = JSON.parse(
    await fs.readFile(path.join(directory, "package.json"), "utf8"),
  );
  const identity = `${pkg.name}@${pkg.version}`;
  if (visited.has(identity)) return;
  visited.add(identity);
  const files = (await fs.readdir(directory))
    .filter((file) => /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(file))
    .sort();
  const texts = await Promise.all(
    files.map(
      async (file) =>
        `${file}\n${await readNotice(path.join(directory, file))}`,
    ),
  );
  if (!files.length) {
    const vendored = path.join(
      root,
      "vendor",
      "licenses",
      `${pkg.name}-${pkg.version}.LICENSE`,
    );
    try {
      texts.push(await readNotice(vendored));
    } catch {
      throw new Error(
        `No license notice found for distributed dependency ${identity}`,
      );
    }
  }
  notices.push(
    `${identity}\nDeclared license: ${pkg.license}\n\n${texts.join("\n\n")}`,
  );
  for (const dependency of Object.keys(pkg.dependencies || {}).sort())
    await collect(dependency, directory);
}
for (const name of Object.keys(manifest.dependencies || {}).sort())
  await collect(name, root);
await fs.mkdir(path.join(root, "public"), { recursive: true });
await fs.writeFile(
  path.join(root, "public", "THIRD_PARTY_NOTICES.txt"),
  `Recipe Book — distributed third-party software notices\n\nThese dependencies retain their original licenses. The project license does not replace them.\nFull installed notices, including Lucide's Feather-derived MIT notice, follow.\n\n${notices.join("\n\n" + "=".repeat(72) + "\n\n")}\n`,
);
console.log(`Preserved complete notices for ${visited.size} runtime packages.`);
