import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {rootDir,sha256,listFiles,fileRecords,normalizeBase,isEntrypoint} from './build-contract.mjs';

export async function verifyBuild(directory=path.join(rootDir,'dist')) {
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'release-manifest.json'),'utf8'));
  normalizeBase(manifest.base);
  assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
  const files=(await listFiles(directory)).filter(file=>file!=='release-manifest.json');
  const actual=await fileRecords(directory,files);
  assert.deepEqual(actual,manifest.artifacts,'Every output file must match the recorded release.');
  assert.equal(sha256(JSON.stringify(actual)),manifest.artifactHash);
  const shell=actual.filter(entry=>!['sw.js','data/recipes.json'].includes(entry.path));
  assert.deepEqual(shell,manifest.shell,'Precache must include every shell asset and chunk.');
  const index=await fs.readFile(path.join(directory,'index.html'),'utf8');
  assert.equal(await fs.readFile(path.join(directory,'404.html'),'utf8'),index,'Static fallback must be the same complete shell.');
  assert.ok(index.includes(`name="recipe-book-release" content="${manifest.release}"`));
  assert.ok(index.includes(`name="recipe-book-commit" content="${manifest.sourceCommit}"`));
  assert.ok(index.includes("worker-src 'self'"),'Worker must fit the production CSP.');
  const bootstrap = index.match(/<script id="recipe-book-bootstrap">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap,'Transport-independent recovery bootstrap must be present.');
  const scriptPolicy = index.match(/script-src ([^;"\n]+)/)?.[1];
  assert.equal(scriptPolicy, `'self' 'sha256-${Buffer.from(sha256(bootstrap),'hex').toString('base64')}'`, 'Only self and the exact recovery script hash may authorize scripts.');
  assert.equal((index.match(/data-recipe-book-entry/g)||[]).length,2,'Only the entry marker and its bootstrap guard should be present.');
  assert.ok(!index.includes('http://')&&!index.includes('https://'),'Startup assets must be self-hosted.');
  for(const [,url]of index.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(url.startsWith('#'))continue;
    assert.ok(url.startsWith(manifest.base),`Asset must use deployment base: ${url}`);
    assert.ok(files.includes(url.slice(manifest.base.length).split('?')[0]),`Referenced asset missing: ${url}`);
  }
  const worker=await fs.readFile(path.join(directory,'sw.js'),'utf8');
  const config=JSON.parse(worker.match(/const RELEASE = (.*);/)?.[1]||'null');
  assert.deepEqual(config,{schemaVersion:1,release:manifest.release,version:manifest.version,sourceCommit:manifest.sourceCommit,base:manifest.base,shell:manifest.shell,document:index});
  const info=JSON.parse(await fs.readFile(path.join(directory,'build-info.json'),'utf8'));
  assert.equal(info.sourceCommit,manifest.sourceCommit);assert.equal(info.release,manifest.release);assert.equal(info.base,manifest.base);assert.equal(info.version,manifest.version);
  assert.equal(info.workerHash,sha256(worker.replace(/^const RELEASE = .*;$/m,'const RELEASE = /*__RELEASE_CONFIG__*/null;')),'Worker template must match its recorded hash.');
  assert.equal(info.release,sha256(JSON.stringify({contentHash:info.contentHash,sourceCommit:info.sourceCommit,version:info.version,base:info.base,dirty:info.dirty,workerHash:info.workerHash})).slice(0,24));
  const inputFiles=files.filter(file=>!['404.html','.nojekyll','build-info.json','sw.js'].includes(file));
  const inputs=await fileRecords(directory,inputFiles);
  const original=index.replace(/<meta name="recipe-book-(?:release|commit)" content="[a-f0-9]+">/g,'');
  const originalBytes=Buffer.from(original);
  inputs.find(entry=>entry.path==='index.html').sha256=sha256(originalBytes);
  inputs.find(entry=>entry.path==='index.html').bytes=originalBytes.length;
  assert.equal(sha256(JSON.stringify(inputs)),info.contentHash,'Source content hash must be reproducible.');
  return manifest;
}
if(isEntrypoint(import.meta.url)){const result=await verifyBuild();console.log(`Verified ${result.artifacts.length} production files, complete precache, CSP and base ${result.base}.`);}
