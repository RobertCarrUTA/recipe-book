// Generated with the complete production asset graph by finalize-build.mjs.
const RELEASE = {"schemaVersion":1,"release":"195518e6ee331c5c71aaf36b","version":"20261008-10","sourceCommit":"e0ad7858b9232f38fb2ae6541cc3b3ea85f48447","base":"/recipe-book/","shell":[{"path":".nojekyll","sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","bytes":0},{"path":"404.html","sha256":"35fec93a323d7505b8740a2f5f43216cfbf31471ce64bbe5f1011ed1387f7225","bytes":4652},{"path":"LICENSE.md","sha256":"78b30f44a035ec081789803bf3b7898246cceffc221abc745775519544435d14","bytes":3318},{"path":"NOTICE","sha256":"e7bf0a894ad6f79e80ebbdfeb59a360b8187d1c98ecb5bdb573e7c7a750ff9a0","bytes":220},{"path":"THIRD_PARTY_NOTICES.txt","sha256":"6311d41c75e35c73245ce42c0f34364e05b012e6d2bcff8f7165f3c096cd8df3","bytes":36767},{"path":"assets/index-CYOP0CIw.css","sha256":"ef63542eb98ae989e89925c4f82bacf609bf8512e2f4b64b914811a72d98feed","bytes":35064},{"path":"assets/index-hhH3zPzp.js","sha256":"d797ec05c356ed74cb902ffe2a40f6f57e91374fcc33b89e329610825761eb68","bytes":399291},{"path":"build-info.json","sha256":"c914861aa9a81f4cf5ca7713bb6753de41898d116b327d0ab6758b15be300b67","bytes":370},{"path":"icons/icon.svg","sha256":"2ff2773100281118066692f42dc61317b28ed3bdc4390276b306235221d118fd","bytes":903},{"path":"index.html","sha256":"35fec93a323d7505b8740a2f5f43216cfbf31471ce64bbe5f1011ed1387f7225","bytes":4652},{"path":"manifest.webmanifest","sha256":"fb23d1a7a30649f51075926fae951a959f1a3332403f67359cb87125b79563b9","bytes":497},{"path":"theme-init.js","sha256":"72ddbbc16371e886435e87f28947ebbd1b25b39a31f83ed4712ecfe767afd195","bytes":583}],"document":"<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta\n      name=\"viewport\"\n      content=\"width=device-width,initial-scale=1,viewport-fit=cover\"\n    />\n    <title>Recipe Book — Robert's kitchen</title>\n    <meta\n      name=\"description\"\n      content=\"Your recipes, weekly plan, and grocery list. An everyday companion for your kitchen.\"\n    />\n    <meta name=\"theme-color\" content=\"#f8f6f0\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <meta name=\"referrer\" content=\"no-referrer\" />\n    <meta\n      http-equiv=\"Content-Security-Policy\"\n      content=\"default-src 'self';base-uri 'none';object-src 'none';script-src 'self' 'sha256-l8IY3ajuNAOisVboyGLQ+Yc8lXipCHvTFmdQaL1Chj0=';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'self';manifest-src 'self';worker-src 'self';form-action 'self'\"\n    /><script id=\"recipe-book-bootstrap\">async function recoverLegacyNavigation(scope) {\n  const index = new URL('index.html', scope).href;\n  let restored = false;\n  for (const name of await caches.keys()) {\n    if (!/^recipe-book-shell-\\d{8}-\\d+$/.test(name)) continue;\n    const cache = await caches.open(name);\n    const original = await cache.match(scope);\n    const current = await cache.match(index);\n    if (!original || !current) continue;\n    const oldText = await original.text();\n    const newText = await current.text();\n    const legacyEntry = /<script\\b[^>]*\\bsrc=[\"'](?:\\.\\/)?js\\/app\\.js(?:\\?[^\"']*)?[\"']/i;\n    if (!legacyEntry.test(oldText) || oldText.includes('name=\"recipe-book-release\"') || !newText.includes('name=\"recipe-book-release\"')) continue;\n    const notice = '<section id=\"recipe-book-upgrade-recovery\" role=\"alert\"><h2>Previous offline version</h2><p>The update could not finish. Reconnect and reload to complete it. If you used the newer app, this older version cannot show or save those newer changes. Your saved data is retained; keep this browser\\'s site data.</p></section>';\n    const recovered = oldText.replace(/<body\\b[^>]*>/i, (body) => body + notice);\n    if (recovered === oldText) continue;\n    await cache.put(index, new Response(recovered, {headers: {'Content-Type': 'text/html; charset=utf-8'}}));\n    restored = true;\n  }\n  return restored;\n}\n\n(() => {\n  if (!('caches' in globalThis) || !navigator.serviceWorker?.controller) return;\n  const scope = new URL(\"/recipe-book/\", location.origin).href;\n  const recovery = navigator.serviceWorker.getRegistration(scope)\n    .then((registration) => registration?.scope === scope ? recoverLegacyNavigation(scope) : false)\n    .catch(() => false);\n  // Only an unavailable entry module can trigger this recovery reload. No new\n  // application state exists yet, and later dynamic imports never match it.\n  window.addEventListener('error', (event) => {\n    if (!event.target?.hasAttribute?.('data-recipe-book-entry')) return;\n    void recovery.then((restored) => {\n      if (restored && !navigator.onLine) { location.reload(); return; }\n      const root = document.getElementById('root');\n      if (!root || root.childNodes.length) return;\n      const panel = document.createElement('section');\n      panel.setAttribute('role', 'alert');\n      const title = document.createElement('h1'); title.textContent = 'The update could not finish loading';\n      const detail = document.createElement('p');\n      detail.textContent = restored\n        ? 'Your previous offline version is available. Reconnect and reload to finish the update. Keep this browser’s site data to retain your saved changes.'\n        : 'Reconnect and reload to try again. Keep this browser’s site data to retain your saved changes.';\n      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reload';\n      retry.addEventListener('click', () => location.reload());\n      panel.append(title, detail, retry); root.append(panel);\n    });\n  }, true);\n})();\n</script>\n    <script src=\"/recipe-book/theme-init.js\"></script>\n    <link rel=\"icon\" type=\"image/svg+xml\" href=\"/recipe-book/icons/icon.svg\" />\n    <link rel=\"manifest\" href=\"/recipe-book/manifest.webmanifest\" />\n    <script data-recipe-book-entry type=\"module\" crossorigin src=\"/recipe-book/assets/index-hhH3zPzp.js\"></script>\n    <link rel=\"stylesheet\" crossorigin href=\"/recipe-book/assets/index-CYOP0CIw.css\">\n  <meta name=\"recipe-book-release\" content=\"195518e6ee331c5c71aaf36b\"><meta name=\"recipe-book-commit\" content=\"e0ad7858b9232f38fb2ae6541cc3b3ea85f48447\"></head>\n  <body>\n    <div id=\"root\"></div>\n    <noscript\n      >Recipe Book needs JavaScript to search recipes and save your grocery\n      list.</noscript\n    >\n  </body>\n</html>\n"};
const SCOPE = self.registration.scope;
const PREFIX = `rb-release-v1-${encodeURIComponent(SCOPE)}-`;
const SHELL = `${PREFIX}shell-${RELEASE.release}`;
const DATA = `${PREFIX}recipes-schema1`;
const INDEX = new URL('index.html', SCOPE).href;
const RECIPE_URL = new URL('data/recipes.json', SCOPE).href;
const ASSETS = new Map(RELEASE.shell.map((entry) => [new URL(entry.path, SCOPE).href, entry]));
const clientReleases = new Map();
// Wire-data validation is deliberately separate from the tolerant UI normalizer:
// malformed recognized fields must never replace a last-known-good collection.
function validRecipeCollection(data) {
  const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const text = (value) => typeof value === 'string' && Boolean(value.trim());
  const optional = (value, validate) => value == null || validate(value);
  const strings = (value) => Array.isArray(value) && value.every(text);
  const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const stringFields = (value, fields) => fields.every((field) => optional(value[field], (entry) => typeof entry === 'string'));
  const quantity = (value) => {
    if (value == null || value === '') return true;
    if (number(value)) return true;
    if (object(value)) return number(value.min) && number(value.max) && value.max >= value.min;
    if (typeof value !== 'string') return false;
    const fractions = {'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4','⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅚':'5/6','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
    let normalized = value;
    for (const [symbol, replacement] of Object.entries(fractions)) normalized = normalized.replaceAll(symbol, ` ${replacement}`);
    normalized = normalized.trim().replace(/\s+/g, ' ').replace(/-\s*to\s+/gi, '-');
    const scalar = (entry) => {
      if (/^\d+(?:\.\d+)?$/.test(entry)) return Number(entry);
      const match = entry.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      return match && Number(match[3]) > 0 ? Number(match[1] || 0) + Number(match[2]) / Number(match[3]) : NaN;
    };
    const parts = normalized.split(/\s*(?:-|to)\s*/i);
    const values = parts.map(scalar);
    return values.length >= 1 && values.length <= 2 && values.every(number) && (values.length === 1 || values[1] >= values[0]);
  };
  const grocery = (entry) => object(entry)
    && ['item','name','canonical','display'].some((key) => text(entry[key]))
    && stringFields(entry, ['item','name','canonical','display','unit','units','note','marker','original','text'])
    && quantity(entry.quantity) && quantity(entry.amount)
    && optional(entry.notes, strings) && optional(entry.optional, (value) => typeof value === 'boolean');
  const ids = new Set();
  return Array.isArray(data) && data.length > 0 && data.every((recipe) => {
    if (!object(recipe) || !text(recipe.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id) || ids.has(recipe.id) || !text(recipe.title)) return false;
    if (!['ingredients','instructions'].every((field) => strings(recipe[field]) && recipe[field].length > 0)) return false;
    if (!Array.isArray(recipe.groceryIngredients) || !recipe.groceryIngredients.length || !recipe.groceryIngredients.every(grocery)) return false;
    if (!stringFields(recipe, ['author','description','category','prepTime','cookTime','additionalTime','totalTime','servings','yield','link'])) return false;
    if (!['collections','equipment','notes','personalNotes'].every((field) => optional(recipe[field], strings))) return false;
    if (!optional(recipe.link, (link) => { if (!link.trim()) return true; try {return ['http:','https:'].includes(new URL(link).protocol);} catch {return false;} })) return false;
    if (!optional(recipe.nutrition, (value) => object(value) && Object.values(value).every((entry) => optional(entry, (part) => typeof part === 'string')))) return false;
    if (!optional(recipe.rating, (value) => object(value) && optional(value.value, (rating) => rating === '' || number(rating) && rating <= 5) && optional(value.count, (count) => count === '' || number(count) && Number.isSafeInteger(count)))) return false;
    if (!optional(recipe.tags, (tags) => object(tags)
      && optional(tags.status, (value) => value === '' || ['tried','not-tried'].includes(value))
      && optional(tags.rating, (value) => value === '' || ['great','good','okay'].includes(value))
      && optional(tags.difficulty, (value) => value === '' || ['easy','medium','hard'].includes(value))
      && optional(tags.equipment, strings))) return false;
    ids.add(recipe.id); return true;
  });
}

async function recoverLegacyNavigation(scope) {
  const index = new URL('index.html', scope).href;
  let restored = false;
  for (const name of await caches.keys()) {
    if (!/^recipe-book-shell-\d{8}-\d+$/.test(name)) continue;
    const cache = await caches.open(name);
    const original = await cache.match(scope);
    const current = await cache.match(index);
    if (!original || !current) continue;
    const oldText = await original.text();
    const newText = await current.text();
    const legacyEntry = /<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js(?:\?[^"']*)?["']/i;
    if (!legacyEntry.test(oldText) || oldText.includes('name="recipe-book-release"') || !newText.includes('name="recipe-book-release"')) continue;
    const notice = '<section id="recipe-book-upgrade-recovery" role="alert"><h2>Previous offline version</h2><p>The update could not finish. Reconnect and reload to complete it. If you used the newer app, this older version cannot show or save those newer changes. Your saved data is retained; keep this browser\'s site data.</p></section>';
    const recovered = oldText.replace(/<body\b[^>]*>/i, (body) => body + notice);
    if (recovered === oldText) continue;
    await cache.put(index, new Response(recovered, {headers: {'Content-Type': 'text/html; charset=utf-8'}}));
    restored = true;
  }
  return restored;
}


async function digest(response) {
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}
async function validRecipes(response) {
  if (!response?.ok || response.redirected || !response.headers.get('content-type')?.toLowerCase().includes('json')) return false;
  try {
    return validRecipeCollection(await response.clone().json());
  } catch { return false; }
}
async function installRelease() {
  try {
    const responses = await Promise.all(Array.from(ASSETS, async ([url, entry]) => {
      // The worker carries its canonical HTML, so navigation proxies cannot bind
      // modified HTML or a different deployment's HTML to this release's chunks.
      const response = ['index.html', '404.html'].includes(entry.path)
        ? new Response(RELEASE.document, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : await fetch(url, { cache: 'reload', redirect: 'error' });
      if (!response.ok || response.redirected || await digest(response) !== entry.sha256) throw new Error(`Incomplete release: ${entry.path}`);
      return [url, response];
    }));
    let recipeResponse;
    try { recipeResponse = await fetch(RECIPE_URL, { cache: 'no-store' }); } catch { /* A previous validated collection may be available. */ }
    const data = await caches.open(DATA);
    if (!(await validRecipes(recipeResponse)) && !(await validRecipes(await data.match(RECIPE_URL)))) throw new Error('No validated recipe collection is available.');
    const cache = await caches.open(SHELL);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
    if (await validRecipes(recipeResponse)) await data.put(RECIPE_URL, recipeResponse);
  } catch (error) {
    console.error('Recipe Book offline installation failed:', error);
    await caches.delete(SHELL);
    await recoverLegacyNavigation(SCOPE);
    throw error;
  }
}
async function cleanupUnusedShells() {
  // An active older worker must never prune the complete waiting release.
  if (self.registration.installing || self.registration.waiting) return;
  const clients = await self.clients.matchAll({ type: 'window' });
  if (clients.some((client) => !clientReleases.has(client.id))) return;
  const required = new Set([SHELL, ...clients.map((client) => `${PREFIX}shell-${clientReleases.get(client.id)}`)]);
  for (const name of await caches.keys()) {
    if (self.registration.installing || self.registration.waiting) return;
    if (name.startsWith(`${PREFIX}shell-`) && !required.has(name)) await caches.delete(name);
  }
}
async function recipeResponse(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (await validRecipes(response)) { await cache.put(RECIPE_URL, response.clone()); return response; }
  } catch { /* Use only the last validated collection. */ }
  const cached = await cache.match(RECIPE_URL);
  return await validRecipes(cached) ? cached : new Response('Recipes unavailable offline.', { status: 503 });
}
async function shellResponse(request, clientId) {
  const url = new URL(request.url); url.search = ''; url.hash = '';
  const preferred = clientReleases.get(clientId);
  const names = [preferred ? `${PREFIX}shell-${preferred}` : SHELL, SHELL, ...await caches.keys()];
  for (const name of new Set(names)) {
    if (!name.startsWith(`${PREFIX}shell-`)) continue;
    const cached = await (await caches.open(name)).match(url.href);
    if (cached) return cached;
  }
  return new Response('This release is unavailable. Reconnect and refresh.', { status: 503 });
}
self.addEventListener('install', (event) => event.waitUntil(installRelease()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING' && event.source?.id) event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'CLIENT_RELEASE' && event.source?.id && /^[a-f0-9]{24}$/.test(event.data.release)) {
    clientReleases.set(event.source.id, event.data.release);
    event.waitUntil(cleanupUnusedShells());
  }
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== new URL(SCOPE).origin || !url.pathname.startsWith(new URL(SCOPE).pathname)) return;
  if (url.pathname === new URL(RECIPE_URL).pathname) event.respondWith(recipeResponse(request));
  else if (request.mode === 'navigate') event.respondWith((async () => await (await caches.open(SHELL)).match(INDEX) || Response.error())());
  else if (ASSETS.has(`${url.origin}${url.pathname}`) || url.pathname.startsWith(new URL('assets/', SCOPE).pathname)) event.respondWith(shellResponse(request, event.clientId));
});
