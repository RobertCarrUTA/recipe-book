// Generated with the complete production asset graph by finalize-build.mjs.
const RELEASE = /*__RELEASE_CONFIG__*/null;
const SCOPE = self.registration.scope;
const PREFIX = `rb-release-v1-${encodeURIComponent(SCOPE)}-`;
const SHELL = `${PREFIX}shell-${RELEASE.release}`;
const DATA = `${PREFIX}recipes-schema1`;
const INDEX = new URL('index.html', SCOPE).href;
const RECIPE_URL = new URL('data/recipes.json', SCOPE).href;
const ASSETS = new Map(RELEASE.shell.map((entry) => [new URL(entry.path, SCOPE).href, entry]));
const clientReleases = new Map();

async function digest(response) {
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}
async function validRecipes(response) {
  if (!response?.ok || response.redirected || !response.headers.get('content-type')?.toLowerCase().includes('json')) return false;
  try {
    const data = await response.clone().json();
    const ids = new Set();
    return Array.isArray(data) && data.length > 0 && data.every((recipe) => {
      if (!recipe || typeof recipe.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id) ||
        typeof recipe.title !== 'string' || !recipe.title.trim() || ids.has(recipe.id)) return false;
      if (!['ingredients', 'instructions'].every((field) => Array.isArray(recipe[field]) && recipe[field].length > 0 &&
        recipe[field].every((value) => typeof value === 'string' && value.trim()))) return false;
      ids.add(recipe.id); return true;
    });
  } catch { return false; }
}
async function recoverLegacyNavigation() {
  // Legacy workers updated index.html network-first but kept their original ./ copy.
  for (const name of await caches.keys()) {
    if (!/^recipe-book-shell-\d{8}-\d+$/.test(name)) continue;
    const cache = await caches.open(name);
    const original = await cache.match(SCOPE);
    const current = await cache.match(INDEX);
    if (!original || !current) continue;
    const oldText = await original.clone().text();
    const newText = await current.clone().text();
    if (oldText.includes('js/app.js') && newText.includes('name="recipe-book-release"')) await cache.put(INDEX, original);
  }
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
    await recoverLegacyNavigation();
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
  return await cache.match(RECIPE_URL) || new Response('Recipes unavailable offline.', { status: 503 });
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
