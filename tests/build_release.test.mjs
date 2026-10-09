import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {finalizeBuild} from '../scripts/finalize-build.mjs';
import {verifyBuild} from '../scripts/verify-build.mjs';
import {stagePagesRelease} from '../scripts/stage-pages-release.mjs';
import {test} from './test_helpers.mjs';

async function fixture(run){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'recipe-book-build-test-'));
  try{
    const source=path.join(directory,'dist');await fs.mkdir(path.join(source,'assets'),{recursive:true});
    await fs.mkdir(path.join(source,'data'));
    await fs.writeFile(path.join(source,'index.html'),'<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; worker-src \'self\'"><script src="/recipe-book/assets/app-a.js"></script></head><body></body></html>');
    await fs.writeFile(path.join(source,'assets/app-a.js'),'console.log("built application")');
    await fs.writeFile(path.join(source,'data/recipes.json'),'[]');
    await run({directory,source});
  }finally{await fs.rm(directory,{recursive:true,force:true});}
}
const provenance={sourceCommit:'a'.repeat(40),base:'/recipe-book/',dirty:false};

test('build integrity rejects altered chunks and unrecorded output files',async()=>fixture(async({source})=>{
  const manifest=await finalizeBuild({directory:source,...provenance});
  assert.deepEqual(await verifyBuild(source),manifest);
  assert.ok(manifest.shell.some(entry=>entry.path==='assets/app-a.js'));
  assert.ok(!manifest.shell.some(entry=>entry.path==='data/recipes.json'));
  await fs.writeFile(path.join(source,'assets/app-b.js'),'unrecorded');
  await assert.rejects(verifyBuild(source),/Every output file/);
  await fs.rm(path.join(source,'assets/app-b.js'));
  await fs.appendFile(path.join(source,'assets/app-a.js'),'altered');
  await assert.rejects(verifyBuild(source),/Every output file/);
}));

test('Pages staging copies a verified clean release and removes only prior generated chunks',async()=>fixture(async({directory,source})=>{
  const manifest=await finalizeBuild({directory:source,...provenance});
  const destination=path.join(directory,'staged');await fs.mkdir(path.join(destination,'assets'),{recursive:true});
  await fs.writeFile(path.join(destination,'assets/old.js'),'old');
  await fs.writeFile(path.join(destination,'assets/unrelated.js'),'keep');
  await fs.writeFile(path.join(destination,'source.txt'),'source remains');
  await fs.writeFile(path.join(destination,'release-manifest.json'),JSON.stringify({artifacts:[{path:'assets/old.js'}]}));
  await stagePagesRelease({source,destination});
  assert.equal(await fs.readFile(path.join(destination,'source.txt'),'utf8'),'source remains');
  assert.equal(await fs.readFile(path.join(destination,'assets/unrelated.js'),'utf8'),'keep');
  await assert.rejects(fs.stat(path.join(destination,'assets/old.js')),error=>error.code==='ENOENT');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(destination,'release-manifest.json'),'utf8')),manifest);
}));

test('Pages staging rejects a dirty source build before replacing destination files',async()=>fixture(async({directory,source})=>{
  await finalizeBuild({directory:source,...provenance,dirty:true});
  const destination=path.join(directory,'staged');await fs.mkdir(destination);
  await fs.writeFile(path.join(destination,'index.html'),'original');
  await assert.rejects(stagePagesRelease({source,destination}),/Commit source changes/);
  assert.equal(await fs.readFile(path.join(destination,'index.html'),'utf8'),'original');
}));

test('LF and CRLF source checkouts produce identical release bytes and hashes',async()=>fixture(async({directory,source})=>{
  const index=path.join(source,'index.html');
  await fs.writeFile(index,(await fs.readFile(index,'utf8')).replaceAll('><','>\n<'));
  await fs.writeFile(path.join(source,'data/recipes.json'),'[\n]\n');
  const windows=path.join(directory,'windows');await fs.cp(source,windows,{recursive:true});
  for(const file of ['index.html','data/recipes.json']){
    const filename=path.join(windows,file);await fs.writeFile(filename,(await fs.readFile(filename,'utf8')).replaceAll('\n','\r\n'));
  }
  const unixManifest=await finalizeBuild({directory:source,...provenance});
  const windowsManifest=await finalizeBuild({directory:windows,...provenance});
  assert.deepEqual(windowsManifest,unixManifest);
  assert.deepEqual(await verifyBuild(windows),unixManifest);
}));
