import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {test} from './test_helpers.mjs';

for (const kind of ['installed', 'supplementary']) {
  test(`notice generation rejects an empty ${kind} license before emitting attribution`, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-book-notices-'));
    try {
      await fs.mkdir(path.join(directory, 'scripts'));
      await fs.copyFile(new URL('../scripts/generate-notices.mjs', import.meta.url), path.join(directory, 'scripts/generate-notices.mjs'));
      await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({dependencies: {'fixture-runtime': '1.0.0'}}));
      const installed = path.join(directory, 'node_modules/fixture-runtime');
      await fs.mkdir(installed, {recursive: true});
      await fs.writeFile(path.join(installed, 'package.json'), JSON.stringify({name: 'fixture-runtime', version: '1.0.0', license: 'MIT'}));
      const license = kind === 'installed' ? path.join(installed, 'LICENSE') : path.join(directory, 'vendor/licenses/fixture-runtime-1.0.0.LICENSE');
      await fs.mkdir(path.dirname(license), {recursive: true});
      await fs.writeFile(license, ' \n\t');
      assert.throws(() => execFileSync(process.execPath, [path.join(directory, 'scripts/generate-notices.mjs')], {stdio: 'pipe'}), /Empty license notice|No license notice/);
      await assert.rejects(fs.stat(path.join(directory, 'public/THIRD_PARTY_NOTICES.txt')), {code: 'ENOENT'});
    } finally { await fs.rm(directory, {recursive: true, force: true}); }
  });
}

test('supplementary scroll-bar notice retains the upstream copyright and full MIT grant', async () => {
  const text = await fs.readFile(new URL('../vendor/licenses/react-remove-scroll-bar-2.3.8.LICENSE', import.meta.url), 'utf8');
  assert.match(text, /Copyright \(c\) 2025 Anton Korzunov/);
  assert.match(text, /Permission is hereby granted, free of charge/);
  assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.match(text, /The above copyright notice and this permission notice shall be included/);
});
