import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const canonicalText = (value) => value.replace(/\r\n?/g, '\n');
export async function canonicalizeTextOutputs(directory) {
  for (const file of await listFiles(directory)) {
    if (!/\.(?:html|js|mjs|css|json|webmanifest|svg|md|txt)$/.test(file) && file !== 'NOTICE') continue;
    const filename = path.join(directory, file);
    const value = await fs.readFile(filename, 'utf8');
    const canonical = canonicalText(value);
    if (canonical !== value) await fs.writeFile(filename, canonical);
  }
}
export async function readWorkerTemplate() {
  const template = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/release-worker-template.js'), 'utf8'));
  const recovery = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/legacy-cache-recovery.js'), 'utf8'));
  const validation = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/recipe-cache-validation.js'), 'utf8')).replace('export function ', 'function ');
  return template.replace('/*__LEGACY_RECOVERY__*/', recovery).replace('/*__RECIPE_VALIDATION__*/', validation);
}
export async function addRecoveryBootstrap(html, base) {
  const recovery = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/legacy-cache-recovery.js'), 'utf8'));
  const bootstrap = canonicalText(await fs.readFile(path.join(rootDir, 'scripts/legacy-upgrade-bootstrap.js'), 'utf8')).replace('/*__APP_BASE__*/null', JSON.stringify(base));
  const script = `${recovery}\n${bootstrap}`;
  const hash = createHash('sha256').update(script).digest('base64');
  let policyFound = false;
  let result = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(">)/, (_, start, policy, end) => {
    policyFound = true;
    if (/script-src\s/.test(policy) && !/script-src 'self'(?:;|$)/.test(policy)) throw new Error('Recovery bootstrap requires a self-only source script policy.');
    const next = /script-src\s/.test(policy) ? policy.replace("script-src 'self'", `script-src 'self' 'sha256-${hash}'`) : `${policy};script-src 'self' 'sha256-${hash}'`;
    return `${start}${next}${end}<script id="recipe-book-bootstrap">${script}</script>`;
  });
  if (!policyFound) throw new Error('Recovery bootstrap requires the production CSP meta tag.');
  let entries = 0;
  result = result.replace(/<script\b([^>]*\btype="module"[^>]*)>/g, (_, attributes) => { entries++; return `<script data-recipe-book-entry${attributes}>`; });
  if (entries !== 1) throw new Error('Expected exactly one application entry module.');
  return result;
}
export function normalizeBase(value = '/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(value)) throw new Error('Base must be / or an absolute directory path ending in /.');
  return value;
}
export async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Build output must not contain symbolic links: ${name}`);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), `${name}/`));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
export async function fileRecords(directory, files) {
  return Promise.all(files.map(async (file) => {
    const bytes = await fs.readFile(path.join(directory, file));
    return { path: file, sha256: sha256(bytes), bytes: bytes.length };
  }));
}
export function isEntrypoint(metaUrl) {
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl));
}
