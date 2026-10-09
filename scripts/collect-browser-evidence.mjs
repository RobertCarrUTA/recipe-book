import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Materialize Playwright's inline attachments without deleting other evidence.
// These are inspected captures, not automatically approved visual goldens.
const root = process.cwd();
const report = JSON.parse(
  await fs.readFile(path.join(root, "test-results/e2e-results.json"), "utf8"),
);
const output = path.join(root, "test-results/design-evidence");
await fs.mkdir(output, { recursive: true });
const records = [];
const images = [];
async function visit(suite) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests || []) {
      const result = test.results.at(-1);
      records.push({
        title: spec.title,
        project: test.projectName,
        status: result?.status,
        duration: result?.duration,
      });
      const match = spec.title.match(/^(\d+x\d+) (light|dark):/);
      if (!match || result?.status !== "passed") continue;
      for (const attachment of result.attachments || []) {
        if (attachment.contentType !== "image/png" || !attachment.body)
          continue;
        const filename = `${test.projectName}-${match[1]}-${match[2]}-${attachment.name}.png`;
        await fs.writeFile(
          path.join(output, filename),
          Buffer.from(attachment.body, "base64"),
        );
        images.push(filename);
      }
    }
  for (const child of suite.suites || []) await visit(child);
}
for (const suite of report.suites) await visit(suite);
const assets = {};
for (const name of [
  "index.html",
  ...(await fs.readdir(path.join(root, "dist/assets"))).map(
    (name) => `assets/${name}`,
  ),
])
  assets[name] = createHash("sha256")
    .update(await fs.readFile(path.join(root, "dist", name)))
    .digest("hex");
const evidence = {
  stats: report.stats,
  sourceHead: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceDirty: !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  note: "Working implementation evidence. Re-run at exact release head for final signoff; captures are not pre-approved visual baselines.",
  assets,
  records,
  images,
};
await fs.writeFile(
  path.join(output, "report.json"),
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  `Collected ${images.length} captures from ${records.length} cases into ${output}.`,
);
