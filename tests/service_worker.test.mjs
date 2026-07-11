import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

import { test } from "./test_helpers.mjs";

const serviceWorkerSource = await fs.readFile(new URL("../sw.js", import.meta.url), "utf8");
const cacheVersion = serviceWorkerSource.match(/const CACHE_VERSION = "([^"]+)";/)?.[1];
const shellCacheName = `recipe-book-shell-${cacheVersion}`;
const dataCacheName = `recipe-book-data-${cacheVersion}`;
const scopeUrl = "https://example.test/recipes/";

function requestUrl(request) {
  if (request instanceof Request) return request.url;
  return new URL(String(request), scopeUrl).href;
}

function createServiceWorkerHarness(fetchImpl) {
  const cacheStores = new Map();
  const listeners = new Map();
  const deletedCaches = [];

  function createCache(name) {
    if (!cacheStores.has(name)) cacheStores.set(name, new Map());
    const entries = cacheStores.get(name);

    return {
      async add(request) {
        const response = await fetchImpl(request);
        if (!response.ok) throw new Error(`Unable to cache ${requestUrl(request)}`);
        await this.put(request, response);
      },
      async addAll(requests) {
        const fetched = await Promise.all(requests.map(async (request) => {
          const response = await fetchImpl(request);
          if (!response.ok) throw new Error(`Unable to cache ${requestUrl(request)}`);
          return [request, response];
        }));
        await Promise.all(fetched.map(([request, response]) => this.put(request, response)));
      },
      async match(request, options = {}) {
        const target = new URL(requestUrl(request));
        for (const [url, response] of entries) {
          const candidate = new URL(url);
          const matches = options.ignoreSearch
            ? candidate.origin === target.origin && candidate.pathname === target.pathname
            : candidate.href === target.href;
          if (matches) return response.clone();
        }
        return undefined;
      },
      async put(request, response) {
        entries.set(requestUrl(request), response.clone());
      },
    };
  }

  const caches = {
    async delete(name) {
      deletedCaches.push(name);
      return cacheStores.delete(name);
    },
    async keys() {
      return Array.from(cacheStores.keys());
    },
    async open(name) {
      return createCache(name);
    },
  };
  const self = {
    clients: { async claim() {} },
    location: { href: `${scopeUrl}sw.js` },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    async skipWaiting() {},
  };
  const context = vm.createContext({
    caches,
    console,
    fetch: fetchImpl,
    Request,
    Response,
    self,
    URL,
  });
  vm.runInContext(serviceWorkerSource, context, { filename: "sw.js" });

  return { cacheStores, caches, context, deletedCaches, listeners };
}

function createRecipeResponse(title = "Chili") {
  return new Response(JSON.stringify([{ id: "chili", title }]), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

test("service worker keeps cached shell assets when the network returns an error response", async () => {
  const harness = createServiceWorkerHarness(async () => new Response("Unavailable", { status: 503 }));
  const cache = await harness.caches.open(shellCacheName);
  const request = new Request(`${scopeUrl}js/app.js?v=current`);
  await cache.put(`${scopeUrl}js/app.js`, new Response("cached app", { status: 200 }));

  const response = await harness.context.handleShellAsset(request);

  assert.equal(await response.text(), "cached app");
});

test("service worker never replaces validated recipe data with malformed content", async () => {
  const harness = createServiceWorkerHarness(async () => new Response("<h1>Error</h1>", {
    headers: { "content-type": "text/html" },
    status: 200,
  }));
  const cache = await harness.caches.open(dataCacheName);
  await cache.put(`${scopeUrl}data/recipes.json`, createRecipeResponse("Cached Chili"));

  const response = await harness.context.handleRecipeData(
    new Request(`${scopeUrl}data/recipes.json?_=123`, { cache: "no-store" })
  );

  assert.deepEqual(await response.json(), [{ id: "chili", title: "Cached Chili" }]);
  assert.deepEqual(
    await (await cache.match(`${scopeUrl}data/recipes.json`)).json(),
    [{ id: "chili", title: "Cached Chili" }]
  );
});

test("service worker caches a validated recipe response", async () => {
  const harness = createServiceWorkerHarness(async () => createRecipeResponse("Fresh Chili"));
  const request = new Request(`${scopeUrl}data/recipes.json?_=456`, { cache: "no-store" });

  const response = await harness.context.handleRecipeData(request);
  const cache = await harness.caches.open(dataCacheName);

  assert.deepEqual(await response.json(), [{ id: "chili", title: "Fresh Chili" }]);
  assert.deepEqual(
    await (await cache.match(`${scopeUrl}data/recipes.json`)).json(),
    [{ id: "chili", title: "Fresh Chili" }]
  );
});

test("service worker installation rejects and removes incomplete candidate caches", async () => {
  const harness = createServiceWorkerHarness(async (request) => {
    const url = requestUrl(request);
    if (url.endsWith("/js/app.js")) return new Response("Unavailable", { status: 503 });
    if (url.endsWith("/data/recipes.json")) return createRecipeResponse();
    return new Response("asset", { status: 200 });
  });
  let installPromise;

  harness.listeners.get("install")({
    waitUntil(promise) {
      installPromise = promise;
    },
  });

  await assert.rejects(installPromise, /Unable to cache/);
  assert.deepEqual(harness.deletedCaches.sort(), [dataCacheName, shellCacheName].sort());
  assert.equal(harness.cacheStores.has(shellCacheName), false);
  assert.equal(harness.cacheStores.has(dataCacheName), false);
});
