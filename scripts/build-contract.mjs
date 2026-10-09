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
