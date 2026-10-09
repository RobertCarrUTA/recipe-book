import fs from 'node:fs/promises';
import path from 'node:path';
import {rootDir,isEntrypoint} from './build-contract.mjs';
import {verifyBuild} from './verify-build.mjs';

function safeArtifact(file){return /^(?:assets\/[A-Za-z0-9_.-]+|data\/recipes\.json|icons\/icon\.svg|index\.html|404\.html|sw\.js|theme-init\.js|manifest\.webmanifest|build-info\.json|LICENSE\.md|NOTICE|THIRD_PARTY_NOTICES\.txt|\.nojekyll)$/.test(file);}
export async function stagePagesRelease({source=path.join(rootDir,'dist'),destination=rootDir}={}){
  const manifest=await verifyBuild(source);
  if(manifest.base!=='/recipe-book/')throw new Error('Pages release must be built for /recipe-book/.');
  const info=JSON.parse(await fs.readFile(path.join(source,'build-info.json'),'utf8'));
  if(info.dirty)throw new Error('Commit source changes before staging a production release.');
  let previous;
  try{previous=JSON.parse(await fs.readFile(path.join(destination,'release-manifest.json'),'utf8'));}catch{}
  const files=[...manifest.artifacts.map(entry=>entry.path),'release-manifest.json'];
  if(manifest.artifacts.some(entry=>!safeArtifact(entry.path)))throw new Error('Unexpected artifact path. Review the staging allowlist.');
  const obsolete=(previous?.artifacts||[]).map(entry=>entry.path).filter(file=>file.startsWith('assets/')&&!files.includes(file));
  if(obsolete.some(file=>!safeArtifact(file)))throw new Error('Unsafe previous artifact path.');
  for(const file of files){await fs.mkdir(path.dirname(path.join(destination,file)),{recursive:true});await fs.copyFile(path.join(source,file),path.join(destination,file));}
  for(const file of obsolete)await fs.rm(path.join(destination,file),{force:true});
  return manifest;
}
if(isEntrypoint(import.meta.url)){
  if(!process.argv.includes('--stage'))throw new Error('Pass --stage only after complete UI and offline parity review. This replaces tracked root release artifacts.');
  const manifest=await stagePagesRelease();console.log(`Copied reviewed Pages artifacts from source ${manifest.sourceCommit} into the working tree. Nothing was committed, pushed, or deployed.`);
}
