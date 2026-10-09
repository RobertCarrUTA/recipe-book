import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {rootDir,fileRecords,isEntrypoint} from './build-contract.mjs';
import {finalizeBuild} from './finalize-build.mjs';

// Regenerate current source using only the explicit provenance fields from the
// tracked release. Everything else, including every byte of every asset, must match.
export async function checkStagedRelease(directory=rootDir){
const manifest=JSON.parse(await fs.readFile(path.join(directory,'release-manifest.json'),'utf8'));
const info=JSON.parse(await fs.readFile(path.join(directory,'build-info.json'),'utf8'));
if(info.dirty)throw new Error('Tracked release must have clean source provenance.');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'recipe-book-repro-'));
try{
  await import('./prepare-public.mjs');
  await build({configFile:path.join(rootDir,'vite.config.ts'),base:info.base,build:{outDir:temporary,emptyOutDir:true}});
  const rebuilt=await finalizeBuild({directory:temporary,base:info.base,sourceCommit:info.sourceCommit,dirty:false});
  assert.deepEqual(rebuilt,manifest,'Tracked release does not reproduce from current source.');
  assert.deepEqual(await fileRecords(directory,manifest.artifacts.map(entry=>entry.path)),manifest.artifacts,'Tracked artifact bytes differ.');
  console.log(`Tracked release reproduces exactly: ${manifest.artifactHash}. Source stamp ${info.sourceCommit}.`);
  return manifest;
}finally{await fs.rm(temporary,{recursive:true,force:true});}
}
if(isEntrypoint(import.meta.url))await checkStagedRelease();
