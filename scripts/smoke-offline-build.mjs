import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {build} from 'vite';
import * as playwright from 'playwright';
import {expect} from '@playwright/test';
import {rootDir} from './build-contract.mjs';
import {finalizeBuild} from './finalize-build.mjs';
import {verifyBuild} from './verify-build.mjs';
import {startBuildServer} from './serve-build.mjs';
import {findBrowserExecutable} from './browser-executable.mjs';
import {stagePagesRelease} from './stage-pages-release.mjs';
import {checkStagedRelease} from './check-staged-release.mjs';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'recipe-book-offline-'));
const results=[];
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:rootDir,encoding:'utf8'}).trim();
const browser=await playwright.chromium.launch({headless:true,executablePath:await findBrowserExecutable({playwright})||undefined});
async function production(name,base){
  const directory=path.join(temporary,name);
  await build({configFile:path.join(rootDir,'vite.config.ts'),base,logLevel:'silent',build:{outDir:directory,emptyOutDir:true}});
  await fs.appendFile(path.join(directory,'index.html'),`<!-- lifecycle fixture ${name} -->`);
  if(name.endsWith('-a'))await fs.writeFile(path.join(directory,'assets/old-only.js'),'/* previous release lazy chunk */');
  const manifest=await finalizeBuild({directory,base,sourceCommit,dirty:true});await verifyBuild(directory);
  return{directory,manifest};
}
async function legacy(ref){
  const directory=path.join(temporary,`legacy-${ref}`);
  const files=execFileSync('git',['ls-tree','-r','--name-only',ref],{cwd:rootDir,encoding:'utf8'}).trim().split('\n').filter(file=>/^(?:index\.html|404\.html|sw\.js|manifest\.webmanifest|css\/|js\/|icons\/|data\/recipes\.json$)/.test(file));
  for(const file of files){await fs.mkdir(path.dirname(path.join(directory,file)),{recursive:true});await fs.writeFile(path.join(directory,file),execFileSync('git',['show',`${ref}:${file}`],{cwd:rootDir,maxBuffer:20*1024*1024}));}
  return directory;
}
async function register(page,url){
  await page.evaluate(async(base)=>{await navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'});await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Worker did not finish installation within 15 seconds.')),15000))]);},url);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
}
async function report(page){await page.evaluate(()=>navigator.serviceWorker.controller?.postMessage({type:'CLIENT_RELEASE',release:document.querySelector('meta[name="recipe-book-release"]')?.content}));}
async function requestUpdate(page){await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});}
async function waiting(page){await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),{timeout:15000}).toBe(true);}
async function installationSettled(page){await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;}),{timeout:15000}).toBe(true);}
async function activate(page){await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();if(!registration.waiting)throw new Error(`Expected waiting worker; active=${registration.active?.state}, installing=${registration.installing?.state}, controller=${navigator.serviceWorker.controller?.state}`);const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));registration.waiting.postMessage({type:'SKIP_WAITING'});await changed;});}
async function cacheNames(page){return page.evaluate(()=>caches.keys());}
async function run(name,fn){console.log(`checking - ${name}`);await fn();results.push({name,result:'passed'});console.log(`ok - ${name}`);}
try{
  await import('./prepare-public.mjs');
  const root=await production('root','/');
  const a=await production('subpath-a','/recipe-book/');
  const b=await production('subpath-b','/recipe-book/');
  await run('reviewed Pages artifacts reproduce exactly without changing the source checkout',async()=>{
    const directory=path.join(temporary,'production-release');const destination=path.join(temporary,'staged-release');
    await build({configFile:path.join(rootDir,'vite.config.ts'),base:'/recipe-book/',logLevel:'silent',build:{outDir:directory,emptyOutDir:true}});
    await finalizeBuild({directory,base:'/recipe-book/',sourceCommit,dirty:false});
    await stagePagesRelease({source:directory,destination});await checkStagedRelease(destination);
  });
  for(const release of [root,a])await run(`production direct navigation, back, refresh and offline at ${release.manifest.base}`,async()=>{
    const served=await startBuildServer({directory:release.directory,base:release.manifest.base,pages404:true});const context=await browser.newContext();const page=await context.newPage();
    try{
      const initial=await page.goto(`${served.url}chicken-fried-steak`);assert.equal(initial.status(),404);await page.waitForSelector('.recipe-card');
      await register(page,served.url);await report(page);
      const count=await page.evaluate(async()=>{const name=(await caches.keys()).find(name=>name.endsWith(document.querySelector('meta[name="recipe-book-release"]').content));return(await(await caches.open(name)).keys()).length;});assert.equal(count,release.manifest.shell.length);
      await page.goto(served.url);await page.waitForSelector('.recipe-card');
      await page.locator('.recipe-card h2 a').first().click();await page.goBack();await page.waitForSelector('.recipe-card');
      await context.setOffline(true);await page.goto(`${served.url}chicken-fried-steak`);await page.waitForSelector('.recipe-card');await page.reload();await page.waitForSelector('.recipe-card');
      assert.equal(await page.locator('meta[name="recipe-book-commit"]').getAttribute('content'),sourceCommit);
    }finally{await context.close();await served.close();}
  });
  await run('waiting update is explicit; old tabs and unrelated caches survive; recipes fall back after malformed response',async()=>{
    let directory=a.directory;let badRecipes=false;
    const served=await startBuildServer({base:'/recipe-book/',resolveDirectory:()=>directory,intercept:async(req,res,url)=>{if(badRecipes&&url.pathname.endsWith('data/recipes.json')){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>invalid recipes</html>');return true;}return false;}});
    const context=await browser.newContext();const first=await context.newPage();const second=await context.newPage();
    try{
      await first.goto(served.url);await first.waitForSelector('.recipe-card');await register(first,served.url);await report(first);
      await second.goto(served.url);await second.waitForSelector('.recipe-card');await report(second);
      await first.evaluate(async()=>{const cache=await caches.open('unrelated-application');await cache.put('/other/sentinel',new Response('keep'));});
      directory=b.directory;await requestUpdate(first);await waiting(first);
      await report(first);await report(second);
      await expect.poll(()=>first.evaluate(async(release)=>{const name=(await caches.keys()).find(name=>name.endsWith(release));return name?(await(await caches.open(name)).keys()).length:0;},b.manifest.release),{timeout:15000}).toBe(b.manifest.shell.length);
      assert.equal(await first.locator('meta[name="recipe-book-release"]').getAttribute('content'),a.manifest.release);
      await activate(first);await first.reload();await first.waitForSelector('.recipe-card');await report(first);await report(second);
      assert.equal(await second.locator('meta[name="recipe-book-release"]').getAttribute('content'),a.manifest.release);
      assert.match(await second.evaluate(async(url)=>await(await fetch(`${url}assets/old-only.js`)).text(),served.url),/previous release/);
      assert.ok((await cacheNames(first)).some(name=>name.endsWith(a.manifest.release)));assert.ok((await cacheNames(first)).includes('unrelated-application'));
      badRecipes=true;const restored=await first.evaluate(async(url)=>await(await fetch(`${url}data/recipes.json?bad=1`)).json(),served.url);assert.ok(restored.length>0);
      await second.close();await report(first);await expect.poll(()=>first.evaluate(async(old)=>!(await caches.keys()).some(name=>name.endsWith(old)),a.manifest.release),{timeout:15000}).toBe(true);
      await context.setOffline(true);await first.reload();await first.waitForSelector('.recipe-card');
    }finally{await context.close();await served.close();}
  });
  await run('interrupted current-release installation preserves the complete active release',async()=>{
    let directory=a.directory;let fail=false;
    const served=await startBuildServer({base:'/recipe-book/',resolveDirectory:()=>directory,intercept:async(req,res,url)=>{if(fail&&url.pathname.endsWith('build-info.json')){res.writeHead(503);res.end('interrupted');return true;}return false;}});
    const context=await browser.newContext();const page=await context.newPage();
    try{
      await page.goto(served.url);await page.waitForSelector('.recipe-card');await register(page,served.url);await report(page);directory=b.directory;fail=true;
      await requestUpdate(page);await installationSettled(page);
      assert.ok(!(await cacheNames(page)).some(name=>name.endsWith(b.manifest.release)));
      await context.setOffline(true);await page.reload();await page.waitForSelector('.recipe-card');assert.equal(await page.locator('meta[name="recipe-book-release"]').getAttribute('content'),a.manifest.release);
    }finally{await context.close();await served.close();}
  });
  for(const ref of ['3117d47','aec6001'])await run(`actual legacy ${ref} interrupted install recovery and upgrade`,async()=>{
    let directory=await legacy(ref);let fail=false;
    const served=await startBuildServer({base:'/recipe-book/',resolveDirectory:()=>directory,intercept:async(req,res,url)=>{if(fail&&url.pathname.endsWith('build-info.json')){res.writeHead(503);res.end('interrupted');return true;}return false;}});
    const context=await browser.newContext();const page=await context.newPage();
    try{
      await page.goto(served.url);await page.waitForSelector('.recipe');await register(page,served.url);
      directory=b.directory;fail=true;await page.reload();await page.waitForSelector('.recipe-card');
      await requestUpdate(page);await installationSettled(page);
      await context.setOffline(true);await page.reload();await page.waitForSelector('.recipe');
      await context.setOffline(false);fail=false;await requestUpdate(page);await waiting(page);await activate(page);await page.reload();await page.waitForSelector('.recipe-card');await report(page);
      await context.setOffline(true);await page.reload();await page.waitForSelector('.recipe-card');
    }finally{await context.close();await served.close();}
  });
}finally{
  const version=browser.version();await browser.close();await fs.rm(temporary,{recursive:true,force:true});
  await fs.mkdir(path.join(rootDir,'test-results'),{recursive:true});await fs.writeFile(path.join(rootDir,'test-results/offline-lifecycle.json'),JSON.stringify({sourceCommit,browser:version,fixtureCommits:['3117d47','aec6001'],results},null,2));
}
console.log(`Passed ${results.length} production lifecycle scenarios.`);
