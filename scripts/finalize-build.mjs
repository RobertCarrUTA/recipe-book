import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rootDir, sha256, normalizeBase, listFiles, fileRecords, isEntrypoint, canonicalText, canonicalizeTextOutputs } from './build-contract.mjs';

export async function finalizeBuild({ directory = path.join(rootDir, 'dist'), base = process.env.RECIPE_BOOK_BASE || '/', sourceCommit, dirty } = {}) {
  base = normalizeBase(base);
  sourceCommit ||= execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('A full source commit is required.');
  dirty ??= Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8' }).trim());
  const { version } = JSON.parse(await fs.readFile(path.join(rootDir, 'app-version.json'), 'utf8'));
  if (!/^\d{8}-[1-9]\d*$/.test(version)) throw new Error('Invalid app version.');
  await canonicalizeTextOutputs(directory);
  const original = await fs.readFile(path.join(directory, 'index.html'), 'utf8');
  if (original.includes('name="recipe-book-release"')) throw new Error('Output already finalized; rebuild before finalizing.');
  const inputs = await fileRecords(directory, await listFiles(directory));
  const contentHash = sha256(JSON.stringify(inputs));
  const template = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/release-worker-template.js'), 'utf8'));
  const workerHash = sha256(template);
  const release = sha256(JSON.stringify({ contentHash, sourceCommit, version, base, dirty, workerHash })).slice(0, 24);
  const index = original.replace('</head>', `<meta name="recipe-book-release" content="${release}"><meta name="recipe-book-commit" content="${sourceCommit}"></head>`);
  await fs.writeFile(path.join(directory, 'index.html'), index);
  await fs.writeFile(path.join(directory, '404.html'), index);
  await fs.writeFile(path.join(directory, '.nojekyll'), '');
  await fs.writeFile(path.join(directory, 'build-info.json'), `${JSON.stringify({ schemaVersion: 1, sourceCommit, dirty, version, base, release, contentHash, workerHash }, null, 2)}\n`);
  const files = await listFiles(directory);
  const shell = await fileRecords(directory, files.filter((file) => file !== 'data/recipes.json'));
  const config = { schemaVersion: 1, release, version, sourceCommit, base, shell };
  await fs.writeFile(path.join(directory, 'sw.js'), template.replace('/*__RELEASE_CONFIG__*/null', JSON.stringify({ ...config, document: index })));
  const artifacts = await fileRecords(directory, await listFiles(directory));
  const manifest = { ...config, artifacts, artifactHash: sha256(JSON.stringify(artifacts)) };
  await fs.writeFile(path.join(directory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
if (isEntrypoint(import.meta.url)) {
  const manifest = await finalizeBuild();
  console.log(`Complete static release ${manifest.release}: ${manifest.shell.length} shell files; source ${manifest.sourceCommit}.`);
}
