import fs from 'node:fs/promises';
const version = process.argv[2];
if (!/^\d{8}-[1-9]\d*$/.test(version || '')) throw new Error('Pass an explicit YYYYMMDD-N app version.');
await fs.writeFile(new URL('../app-version.json', import.meta.url), `${JSON.stringify({version}, null, 2)}\n`);
console.log(`Set build version to ${version}. Rebuild, verify, and stage the generated release before publishing.`);
