# Deployment

The production application is a static site. It needs HTTPS, correct content types, predictable cache behavior, and an atomic set of files; it does not need Node.js, server-side rendering, a database, environment variables, or runtime secrets.

## Publishable Files

The simplest host can serve the repository root. A narrower production artifact only needs:

```text
index.html
404.html
css/
js/
data/recipes.json
icons/
manifest.webmanifest
sw.js
LICENSE.md
NOTICE
```

Recipe source files, tests, and development scripts are not requested by the browser. They may remain available when the repository itself is the published source, but never expose `.git/`, `node_modules/`, editor state, local backups, or test artifacts from a production web root.

All deployed recipe data is public. Personal grocery, meal-plan, favorite, and preference state stays in each user's browser and is not uploaded by the app.

## Origin and Path Requirements

- Serve production over HTTPS. Service workers require a secure context outside `localhost`.
- Serve every app file from the same origin.
- Preserve the application directory: `sw.js` is registered relative to the page and controls that directory scope.
- Relative URLs in the HTML, manifest, modules, repository, and worker support deployment at `/` or a subdirectory such as `/recipes/`.
- Serve the directory URL as `index.html`.
- For clean recipe links such as `/recipe-book/a5-wagyu-burger`, route missing page navigations to the app shell. On GitHub Pages, `404.html` mirrors `index.html` for that fallback.
- Return real `404` responses for missing JavaScript, CSS, JSON, and icon files instead of rewriting them to HTML.

For subdirectory hosting, validate the manifest start URL, worker scope, recipe request, and offline reload from the final public URL rather than only from local root hosting.

## MIME Types

At minimum, configure:

| Files | Content type |
| --- | --- |
| `.html` | `text/html; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.json` | `application/json; charset=utf-8` |
| `.webmanifest` | `application/manifest+json; charset=utf-8` |
| `.svg` | `image/svg+xml` |

ES modules fail when a host returns JavaScript as HTML or a generic download. Enable Brotli or gzip for HTML, CSS, JavaScript, JSON, SVG, and the web manifest.

## HTTP Cache Policy

The app has two cache layers:

1. the host and browser HTTP cache;
2. versioned Cache Storage managed by `sw.js`.

Use revalidation-oriented host headers so those layers do not serve a mixed revision:

| Resource | Recommended policy | Reason |
| --- | --- | --- |
| `index.html` and directory response | `Cache-Control: no-cache` | The page must discover current asset versions. |
| `sw.js` | `Cache-Control: no-cache` | Browsers must revalidate the worker script for updates. |
| `js/*.js` | `Cache-Control: no-cache` | Imported module URLs are not content-hashed. |
| `css/*.css` | `Cache-Control: no-cache` | The source filename is stable even though the entry reference has a version query. |
| `data/recipes.json` | `Cache-Control: no-cache` | Recipe data should revalidate; the app also requests it with `no-store` and a per-load query key. |
| manifest and icons | Short cache with revalidation | Install metadata and icons can change between releases. |

`no-cache` allows conditional requests and `304 Not Modified`; it does not mean “do not store.” Avoid a long immutable lifetime for stable module filenames unless deployment introduces content-hashed filenames throughout the import graph.

The service worker uses network-first handling. A successful shell response or validated recipe response updates Cache Storage, and a network failure uses the last complete shell or validated recipe response. Cache Storage is a resilience layer, not permanent storage; browsers can evict it.

## Security Headers

The app has no server-side input or credentials, but production should still constrain browser capabilities. A suitable starting point is:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=()
```

Set `Strict-Transport-Security` only after the domain and its required subdomains are permanently HTTPS. `frame-ancestors` must be an HTTP header; a CSP meta element cannot enforce it.

Test recipe downloads, backup import/export, source links, clipboard behavior, Screen Wake Lock, the manifest, and the service worker after changing CSP or permissions policy. If the hosting platform adds inline scripts or styles, remove those additions or account for them deliberately rather than weakening the policy broadly.

## Asset and Service-Worker Versions

`npm run set-asset-version -- YYYYMMDD-N` synchronizes:

- the version query on `css/styles.css` in `index.html`;
- the version query on `js/app.js` in `index.html`;
- the matching GitHub Pages fallback shell in `404.html`;
- `CACHE_VERSION` in `sw.js`;
- the generated service-worker shell asset list.

Use a new version for every deployed HTML, CSS, JavaScript, or service-worker change. Recipe-only changes do not need a version bump because recipe requests are network-first, use a per-load cache key, and replace the canonical cached recipe response after success.

Deploy `index.html`, the complete module graph, CSS, and `sw.js` together. A partial upload can leave the page requesting a module that does not exist or a worker caching files from two revisions.

## Release Procedure

From a clean checkout of the release revision:

1. Install exactly the locked tools:

   ```bash
   npm ci
   ```

2. Confirm authored recipe changes are reflected in the generated bundle:

   ```bash
   npm run check:recipes
   ```

3. Confirm the current asset version is present when the app shell changed.
4. Run the strict local gate:

   ```bash
   npm run verify:full
   ```

5. Publish the complete revision atomically or to a versioned directory that becomes active in one switch.
6. Perform the post-deploy checks below from a clean browser context.

Do not set `RECIPE_BOOK_ALLOW_SMOKE_SKIP=1` in the normal release gate. A release without browser verification should be an explicit exception with its missing coverage recorded.

## Post-Deploy Checks

Verify the public URL, not just the host's preview URL:

- `index.html`, CSS, the app module, imported modules, the manifest, icon, worker, and recipe JSON return `200` with correct content types.
- The recipe count loads without console errors or schema warnings.
- A clean recipe URL such as `/recipe-book/a5-wagyu-burger` opens that recipe directly.
- Search, a recipe expansion, grocery selection, and Cooking Mode work.
- Recipe and backup downloads are permitted by the host policy.
- `sw.js` registers with the expected scope.
- After one successful online load, an offline reload shows the cached app and recipe data.
- When replacing an older release, the app offers Refresh and reloads under the new worker.
- A hard refresh receives the current HTML and recipe bundle rather than a stale CDN response.
- There is no horizontal overflow at representative desktop and phone widths.

The automated smoke suite covers core Chromium interactions, but it does not replace a production-origin offline and update check. Service-worker behavior depends on final scope, headers, and CDN caching.

## Rollback

Keep the previous complete static revision available. To roll back:

1. publish the previous known-good files as one unit;
2. assign a new asset/cache version if any content differs from the currently deployed revision;
3. purge or revalidate CDN HTML and worker entries;
4. repeat the worker update, online, and offline checks.

Do not restore only `index.html` or only `sw.js`. Browser `localStorage` survives a static rollback, so the older app must still understand the current storage version. If a release changes persisted state incompatibly, its rollback plan must include backward-compatible migrations before deployment.

## Host Observability

There is no application health endpoint or remote telemetry. Use static-host monitoring for:

- availability and TLS validity;
- elevated `404` or `5xx` responses for app assets;
- unexpected MIME types;
- CDN age or cache headers on HTML, worker, modules, and recipe JSON;
- deployment and rollback audit history.

Keep monitoring free of personal grocery or recipe-selection data. The application does not send that state to the host.
