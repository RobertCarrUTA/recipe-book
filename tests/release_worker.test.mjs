import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {sha256} from '../scripts/build-contract.mjs';
import {test} from './test_helpers.mjs';

const template=await fs.readFile(new URL('../scripts/release-worker-template.js',import.meta.url),'utf8');
const scope='https://example.test/recipe-book/';
const prefix=`rb-release-v1-${encodeURIComponent(scope)}-`;
const release='a'.repeat(24);
const config={release,document:'complete shell',shell:[{path:'index.html',sha256:sha256('complete shell')},{path:'assets/app-hash.js',sha256:sha256('complete app')}]};
const recipe={id:'chili',title:'Chili',ingredients:['Beans'],instructions:['Simmer.']};
const recipes=()=>new Response(JSON.stringify([recipe]),{headers:{'content-type':'application/json'}});
function harness(fetcher=async url=>String(url).endsWith('recipes.json')?recipes():new Response(String(url).endsWith('.js')?'complete app':'complete shell')){
  const stores=new Map(),listeners=new Map(),deleted=[];
  const caches={async keys(){return [...stores.keys()];},async delete(name){deleted.push(name);return stores.delete(name);},async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return{async put(url,response){map.set(typeof url==='string'?url:url.url,response.clone());},async match(url){return map.get(typeof url==='string'?url:url.url)?.clone();}};}};
  const clients=[];let claimed=0,skipped=0;
  const self={registration:{scope},clients:{async claim(){claimed++;},async matchAll(){return clients;}},addEventListener(type,listener){listeners.set(type,listener);},async skipWaiting(){skipped++;}};
  const context=vm.createContext({self,caches,fetch:fetcher,Response,Request,URL,crypto:webcrypto,Uint8Array,console});
  vm.runInContext(template.replace('/*__RELEASE_CONFIG__*/null',JSON.stringify(config)),context);
  return{context,caches,stores,deleted,listeners,clients,registration:self.registration,get claimed(){return claimed;},get skipped(){return skipped;}};
}
test('release worker precaches the complete verified shell without activating itself',async()=>{
  const h=harness(async url=>{assert.ok(!String(url).endsWith('.html'),'Canonical HTML must come from the worker, not a transformed navigation response.');return String(url).endsWith('recipes.json')?recipes():new Response('complete app');});await h.context.installRelease();
  assert.equal(h.skipped,0);assert.equal(h.claimed,0);
  const shell=await h.caches.open(`${prefix}shell-${release}`);
  assert.equal(await(await shell.match(`${scope}assets/app-hash.js`)).text(),'complete app');
  assert.equal(await(await shell.match(`${scope}index.html`)).text(),'complete shell');
});
test('a wrong successful response rejects the entire release without deleting other caches',async()=>{
  const h=harness(async()=>new Response('incorrect body'));
  await h.caches.open('unrelated-app');await h.caches.open('rb-release-v1-other-scope-shell-a');
  await assert.rejects(h.context.installRelease(),/Incomplete release/);
  assert.deepEqual(h.deleted,[`${prefix}shell-${release}`]);
  assert.equal(h.stores.has('unrelated-app'),true);
});
test('a failed legacy upgrade restores only its matching pristine cached navigation',async()=>{
  const h=harness(async()=>new Response('missing',{status:503}));
  const legacy=await h.caches.open('recipe-book-shell-20261008-4');
  await legacy.put(scope,new Response('<script src="./js/app.js"></script>'));
  await legacy.put(`${scope}index.html`,new Response('<meta name="recipe-book-release" content="new">'));
  const unrelated=await h.caches.open('recipe-book-shell-20261007-1');
  await unrelated.put('https://example.test/other/',new Response('other'));
  await assert.rejects(h.context.installRelease());
  assert.match(await(await legacy.match(`${scope}index.html`)).text(),/js\/app.js/);
  assert.equal(await(await unrelated.match('https://example.test/other/')).text(),'other');
});
test('recipe requests keep the validated collection across invalid network responses',async()=>{
  const h=harness(async()=>new Response('<html>error</html>',{headers:{'content-type':'text/html'}}));
  const cache=await h.caches.open(`${prefix}recipes-schema1`);await cache.put(`${scope}data/recipes.json`,recipes());
  const response=await h.context.recipeResponse(new Request(`${scope}data/recipes.json?load=1`));
  assert.equal((await response.json())[0].id,'chili');
  assert.equal((await(await cache.match(`${scope}data/recipes.json`)).json())[0].id,'chili');
});
test('recipe validation rejects duplicate IDs and malformed content',async()=>{
  const h=harness();
  assert.equal(await h.context.validRecipes(new Response('[{"id":"chili","title":"Chili"},{"id":"chili","title":"Duplicate"}]',{headers:{'content-type':'application/json'}})),false);
  assert.equal(await h.context.validRecipes(new Response('[]',{headers:{'content-type':'application/json'}})),false);
  assert.equal(await h.context.validRecipes(new Response('[{"id":"chili","title":"Chili"}]',{headers:{'content-type':'application/json'}})),false);
});
test('old tabs retain their release assets and unknown clients prevent cleanup',async()=>{
  const h=harness();const old='b'.repeat(24),unused='c'.repeat(24);
  for(const name of [`${prefix}shell-${release}`,`${prefix}shell-${old}`,`${prefix}shell-${unused}`,'unrelated-cache'])await h.caches.open(name);
  h.clients.push({id:'old-tab'},{id:'new-tab'});
  await h.context.cleanupUnusedShells();assert.deepEqual(h.deleted,[]);
  vm.runInContext(`clientReleases.set('old-tab','${old}');clientReleases.set('new-tab','${release}');`,h.context);
  await h.context.cleanupUnusedShells();assert.deepEqual(h.deleted,[`${prefix}shell-${unused}`]);
  const oldCache=await h.caches.open(`${prefix}shell-${old}`);await oldCache.put(`${scope}assets/old-only.js`,new Response('old chunk'));
  assert.equal(await(await h.context.shellResponse(new Request(`${scope}assets/old-only.js`),'old-tab')).text(),'old chunk');
});
test('shell requests cannot replace cached release bytes with network content',async()=>{
  let fetches=0;const h=harness(async()=>{fetches++;return new Response('new incompatible app');});
  const cache=await h.caches.open(`${prefix}shell-${release}`);await cache.put(`${scope}assets/app-hash.js`,new Response('old complete app'));
  assert.equal(await(await h.context.shellResponse(new Request(`${scope}assets/app-hash.js?x=1`),'tab')).text(),'old complete app');assert.equal(fetches,0);
});

test('the active worker never prunes a newer installing or waiting release',async()=>{
  for(const phase of ['installing','waiting']){
    const h=harness();const next='d'.repeat(24);
    h.registration[phase]={state:phase};
    await h.caches.open(`${prefix}shell-${next}`);
    h.clients.push({id:'tab'});vm.runInContext(`clientReleases.set('tab','${release}');`,h.context);
    await h.context.cleanupUnusedShells();assert.deepEqual(h.deleted,[]);
  }
});
