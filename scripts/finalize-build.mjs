import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../dist/',import.meta.url));
await fs.copyFile(`${output}index.html`,`${output}404.html`);
console.log('Static production shell and fallback generated.');
