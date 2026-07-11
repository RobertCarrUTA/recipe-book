# Architecture

Robert's Recipe Book is a static browser application built from native HTML, CSS, ES modules, JSON, and a service worker. Node.js is development tooling only; production hosting does not run application code on a server.

## Design Goals

- Keep the deployed artifact understandable without a framework runtime or bundler.
- Keep recipe authoring separate from generated browser data.
- Put domain behavior in modules that can be tested without a browser.
- Keep browser APIs and DOM event wiring at explicit boundaries.
- Preserve useful behavior when optional browser APIs are unavailable.
- Store personal state locally and make it portable through backups.

The app is deliberately not an account system, collaborative database, remote recipe API, or cloud-sync service.

## Data Flow

```text
Authoring                                      Browser

data/recipes/*.json
        |
        | scripts/build-recipes.mjs
        v
data/recipes.json --fetch--> recipe repository --normalize--> appState.recipes
                                                              |
                           restored localStorage --------------+--> models
                                                              |      |
                                                              |      v
                                                              +--> renderers --> DOM
                                                              |
                                                              +--> persistence --> localStorage

index.html + CSS + module graph <--> service worker caches <--> network
```

Recipe source files and the generated runtime bundle are checked in together because the deployed app has no production build step. The browser still validates and normalizes loaded data defensively.

## Runtime Composition

`js/app.js` is the composition root. It:

1. creates the logger, repository, state, renderer, and controllers;
2. restores versioned browser state;
3. loads and normalizes recipes;
4. prunes state that refers to recipes no longer present;
5. recomputes grocery totals from current recipe data;
6. attaches event handlers and browser API adapters;
7. renders the initial views and schedules persistence.

Keep orchestration here, but move reusable rules into the appropriate model, controller, or renderer. A feature should not require unrelated modules to know its internal details.

## Module Boundaries

### Recipe Loading and Schema

- `recipe_repository.js` is the loading boundary used by the app.
- `recipes.js` fetches the generated bundle and applies the per-load data cache key.
- `recipe_schema.js` repairs text, normalizes optional fields and tags, validates source links, de-duplicates IDs defensively, and returns warnings.
- `recipe_collections.js` owns the controlled collection catalog and display order.

Build-time rules belong in `scripts/build-recipes.mjs`; runtime defensive handling belongs in `recipe_schema.js`. Keep those contracts aligned and cover both malformed input and valid source data.

### Domain Models and Pure Helpers

Modules such as these should remain independent of the DOM:

- `grocery_model.js` — selections, multipliers, grocery aggregation, checks, manual items, and recipe sources;
- `meal_plan_model.js` — weekly plan normalization and plan-to-grocery behavior;
- `recipe_filter.js`, `recipe_discovery.js`, and `recipe_sort.js` — search, filtering, result state, and ranking;
- `normalization.js`, `normalization_rules.js`, `units.js`, and `grouping.js` — canonical ingredients, quantities, unit conversion, formatting, and store sections;
- `recipe_multiplier.js`, `cooking_model.js`, and formatting/export helpers — focused domain transformations.

Pass values in and return values out. Avoid reading controls, storage, location, or other ambient browser state from a model.

### Controllers and Browser Adapters

Controllers translate browser events or APIs into state changes and rendering requests:

- recipe discovery and source navigation;
- meal-plan panel and mobile-view behavior;
- Cooking Mode controls and Screen Wake Lock;
- collapsible controls and status messages;
- clipboard, downloads, backups, persistence scheduling, and service-worker registration.

Controllers accept `document`, `window`, `navigator`, storage, timers, loggers, or callbacks where practical. This makes failure behavior testable without replacing global objects.

### Rendering

`render.js` creates the renderer facade consumed by `app.js`. Focused renderers own recipes, recipe actions, groceries, meal plans, and Cooking Mode.

Rendering follows these rules:

- renderers receive state and callbacks rather than importing the application singleton;
- interactive elements retain accessible names, relationships, and state attributes;
- state-only changes should synchronize the smallest useful DOM region;
- recipes may render in batches, but filtered or opened recipes must become available on demand;
- renderers do not persist state or own browser navigation policy.

DOM construction helpers live in `dom.js` so element creation, children, disclosure state, and inert behavior stay consistent.

## State Ownership

The composition root owns one application state object with four broad areas:

| Area | Purpose |
| --- | --- |
| `recipes` | Normalized recipe records loaded from the bundle. |
| `recipeSearchTexts` | Cached searchable text derived from recipes. |
| `runtime` | Recipe selections, favorites, multipliers, grocery totals, checks, and manual items. |
| `mealPlan` and `ui` | Weekly schedule plus search, filters, sorting, visibility, layout, and preference state. |

Grocery totals are derived state. Restore selections, multipliers, and manual items, then recompute totals against current recipes instead of trusting totals saved by an older version.

### Persistence

`storage.js` is the only durable-state contract. It provides:

- defensive reads and writes when storage is missing, blocked, or malformed;
- an explicit storage version and migrations;
- normalization of restored runtime and UI values;
- a separately versioned portable backup format;
- rejection of future or incompatible backup schemas.

`app_state_persistence.js` schedules and flushes writes. Controllers should request a save through the application boundary rather than write their own storage keys.

When the stored shape changes:

1. increment the storage version;
2. add a migration from every supported older shape;
3. keep restores safe for missing and malformed values;
4. decide whether the backup schema also changes;
5. test migration, round-trip, and incompatibility behavior.

## Offline and Update Model

`offline_controller.js` registers `sw.js` relative to the application directory. That gives the worker the same directory scope, including subdirectory deployments.

The service worker keeps separate versioned caches for:

- the static shell: HTML, manifest, icon, CSS, and the imported module graph;
- the latest successful, validated `data/recipes.json` response.

Requests are network-first. Successful shell responses and validated recipe responses refresh the cache; network failure falls back to the cached shell or recipe data. Navigation falls back to cached `index.html`.

A new worker waits instead of taking over an active page. The offline controller shows an update action, sends `SKIP_WAITING` after the user chooses Refresh, and reloads after `controllerchange`. Asset versions in `index.html` and `sw.js` must stay synchronized for this lifecycle to be predictable.

Offline availability is not guaranteed before the first successful online load. Cache storage is also browser-managed and can be evicted.

## Discovery and Rendering Sequence

Search, collection, tag, selected-only, and favorites-only rules are applied to recipe data rather than to text scraped from rendered cards. Sorting then ranks the matching recipe indexes. The recipe renderer makes the required batch visible, and the discovery controller synchronizes result counts and empty states.

This order keeps filtering correct even when only part of the recipe list has been rendered.

## Extension Guidelines

When adding a feature:

1. identify its source of truth and derived state;
2. put pure rules in a model or helper;
3. place DOM and browser APIs behind a controller or adapter;
4. expose focused render operations instead of a full-page rebuild;
5. add persistence only through the versioned storage boundary;
6. add unit coverage for rules and browser coverage for the critical journey;
7. update cache assets and deployment documentation when loading changes.

For another recipe source, implement the repository boundary and keep downstream code working with normalized recipes. For another persisted feature, define its migration and backup behavior before wiring controls.

## Debugging

The app exposes `window.recipeBookDebug` only when the URL contains `?debug=1`. Browser smoke tests use this opt-in state view. Do not put secrets or private-only data in debug output; deployed recipe data is public regardless.

Use the global error handlers and scoped logger for actionable diagnostics. Expected optional-API failures should degrade gracefully; unexpected errors should remain visible in development and fail browser verification.
