import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// Resolve everything from the measured checkout, even when this runner is invoked
// by absolute path from a separate review worktree.
const root = process.cwd();
const dist = path.join(root, 'dist');
const out = path.resolve(root, process.env.JOURNEY_PERFORMANCE_OUTPUT || 'test-results/performance-journeys');
const build = JSON.parse(await fs.readFile(path.join(dist, 'build-info.json'), 'utf8'));
const recipeBytes = await fs.readFile(path.join(dist, 'data/recipes.json'));
const {normalizeRecipeBook} = await import(pathToFileURL(path.join(root, 'js/recipe_schema.js')).href);
const normalized = normalizeRecipeBook(JSON.parse(recipeBytes.toString('utf8')));
const recipes = normalized.recipes;
assert.equal(normalized.warnings.length, 0, 'The actual authored catalog should normalize without warnings');
const require = createRequire(path.join(root, 'package.json'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const repeats = 3;
const viewports = [{label: 'desktop', width: 1440, height: 900}, {label: 'mobile', width: 390, height: 844}];
// Predeclared before the first browser run; these are lab regression limits.
const budgets = {
  median: {filterLatency: 200, planLatency: 200, cookingLatency: 200, themeLatency: 200, persistedReloadLatency: 1500},
  maximum: {filterLatency: 400, planLatency: 400, cookingLatency: 400, themeLatency: 400, persistedReloadLatency: 2500},
};
assert.ok(recipes.length >= 36, 'The realistic weekly-plan fixture needs at least 36 authored recipes');
assert.equal(new Set(recipes.map(recipe => recipe.id)).size, recipes.length);
const collection = recipes.flatMap(recipe => recipe.collections || []).find(id => {
  const count = recipes.filter(recipe => recipe.collections?.includes(id)).length;
  return count > 1 && count < recipes.length;
});
assert.ok(collection, 'The catalog must offer a collection that meaningfully filters recipes');
const filteredRecipes = recipes.filter(recipe => recipe.collections?.includes(collection));
const expectedFilterIds = filteredRecipes.slice(0, 24).map(recipe => recipe.id);
const planPools = [['breakfast'], ['main-dishes', 'sandwiches'], ['main-dishes'], ['sides-snacks'], ['salsas-sauces', 'desserts']]
  .map(collections => recipes.filter(recipe => recipe.collections?.some(id => collections.includes(id))));
assert.ok(planPools.every(pool => pool.length), 'The fixture needs breakfast, main, side and sauce/dessert collections');
const plan = Object.fromEntries(days.map((day, index) => {
  const used = new Set();
  const ids = planPools.map((pool, slot) => {
    const offset = slot === 0 ? index % Math.min(3, pool.length) : (index * 2 + slot) % pool.length;
    const recipe = [...pool.slice(offset), ...pool.slice(0, offset)].find(item => !used.has(item.id));
    assert.ok(recipe, `No distinct recipe available for ${day} fixture slot ${slot}`);
    used.add(recipe.id);
    return recipe.id;
  });
  return [day, ids];
}));
const titles = Object.fromEntries(recipes.map(recipe => [recipe.id, recipe.title]));
const expectedPlan = days.map(day => plan[day].map(id => titles[id]));
const cookingRecipe = recipes.find(recipe => recipe.id === plan.monday[0]);
assert.ok(cookingRecipe.instructions?.length);
const additionalRecipe = recipes.find(recipe => !plan.monday.includes(recipe.id));
const fixture = {
  storageVersion: 7, revision: 'supplemental-performance-fixture', data: {
    selectedRecipeIds: Object.fromEntries(recipes.slice(0, 8).map(recipe => [recipe.id, true])),
    favoriteRecipeIds: Object.fromEntries(recipes.slice(0, 2).map(recipe => [recipe.id, true])),
    recipeMultipliersById: {[recipes[0].id]: 2}, groceryCheckedByKey: {},
    manualGroceryItemsById: {towels: {id: 'towels', name: 'Paper towels'}, bags: {id: 'bags', name: 'Freezer bags'}},
    mealPlan: {days: plan}, ui: {filters: {}, activeView: 'recipes', mobileView: 'recipes', recipeSearch: '', recipeSort: 'default', theme: 'dark'},
  },
};
const report = {
  schemaVersion: 1, capturedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim()),
  build, browser: null, node: process.version, repeats, viewports, budgets,
  methodology: 'Unthrottled local production server; three fresh isolated contexts per desktop/mobile layout. Real authored catalog, synthetic 35-assignment week across seven days (five recipe/components per day), eight selected recipes and two manual items. Service workers remain enabled; timed actions begin only after activation, control and network idle. Action latency starts immediately before browser click/change dispatch and ends two animation frames after asserted rendered output. Persisted reload uses a new-document animation-frame readiness observer and navigation-relative performance.now(). These are lab event-to-render timings, not field INP or physical-device measurements.',
  fixtures: {recipeCount: recipes.length, recipeJsonSha256: sha256(recipeBytes), snapshotSha256: sha256(JSON.stringify(fixture)), collection, filteredCount: filteredRecipes.length, expectedFilterIds, plan, plannedAssignments: 35, uniquePlannedRecipes: new Set(Object.values(plan).flat()).size, selectedRecipes: 8, manualItems: 2, addedRecipeId: additionalRecipe.id},
  artifacts: [], samples: [], checks: [], messages: [], failures: [],
};
async function files(directory, prefix = '') {
  const found = [];
  for (const item of await fs.readdir(directory, {withFileTypes: true})) {
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) found.push(...await files(path.join(directory, item.name), `${name}/`));
    else if (item.isFile()) found.push(name);
  }
  return found.sort();
}
for (const name of await files(dist)) {
  const bytes = await fs.readFile(path.join(dist, name));
  report.artifacts.push({name, bytes: bytes.length, sha256: sha256(bytes)});
}
if (process.argv.includes('--validate-only')) {
  console.log(JSON.stringify({build, fixtures: report.fixtures, budgets, artifactCount: report.artifacts.length}, null, 2));
  process.exit(0);
}

const {chromium} = await import(pathToFileURL(require.resolve('playwright')).href);
const {startBuildServer} = await import(pathToFileURL(path.join(root, 'scripts/serve-build.mjs')).href);
const {findBrowserExecutable} = await import(pathToFileURL(path.join(root, 'scripts/browser-executable.mjs')).href);
await fs.mkdir(out, {recursive: true});
let browser, server;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Number(value.toFixed(3));

async function measure(control, kind, expected) {
  await control.waitFor({state: 'visible'});
  return control.evaluate((element, {kind, expected}) => new Promise((resolve, reject) => {
    const visible = node => Boolean(node?.getClientRects().length);
    const planMatches = () => JSON.stringify([...document.querySelectorAll('.kitchen-plan-day')].map(day => [...day.querySelectorAll('.kitchen-plan-recipe')].map(item => item.textContent.trim()))) === JSON.stringify(expected.plan);
    const beforeColor = getComputedStyle(document.body).backgroundColor;
    function complete() {
      if (kind === 'filter') return JSON.stringify([...document.querySelectorAll('article[data-recipe-id]')].map(card => card.dataset.recipeId)) === JSON.stringify(expected.ids) && document.querySelector('.section-heading [role="status"]')?.textContent.trim() === `${expected.count} recipes`;
      if (kind === 'plan') return visible(document.querySelector('.kitchen-planner')) && planMatches();
      if (kind === 'cooking') {
        const dialog = document.querySelector('[role="dialog"].kitchen-cooking');
        return visible(dialog) && dialog.querySelector('.kitchen-step-instruction')?.textContent.trim() === expected.instruction && dialog.querySelector('progress')?.value === 1;
      }
      return document.documentElement.dataset.theme === expected.theme && document.documentElement.style.colorScheme === expected.theme && element.value === expected.theme && getComputedStyle(document.body).backgroundColor !== beforeColor;
    }
    if (kind !== 'theme' && complete()) return reject(new Error(`Precondition already satisfied for ${kind}`));
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(`${kind} did not render expected output`)); }, 15000);
    let finishing = false;
    const observer = new MutationObserver(check);
    function check() {
      if (finishing || !complete()) return;
      finishing = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(timeout); observer.disconnect();
        if (!complete()) return reject(new Error(`${kind} output changed during settling`));
        resolve(performance.now() - start);
      }));
    }
    observer.observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
    const start = performance.now();
    if (element instanceof HTMLSelectElement) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, kind === 'filter' ? expected.collection : expected.theme);
      element.dispatchEvent(new Event('change', {bubbles: true}));
    } else element.click();
    check();
  }), {kind, expected});
}

async function run(viewport, repeat) {
  const run = `${viewport.label}-${repeat}`;
  const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, colorScheme: 'dark', serviceWorkers: 'allow', reducedMotion: 'reduce'});
  const page = await context.newPage();
  let observing = true;
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => { if (observing) report.failures.push({run, message: error.message}); });
  page.on('console', message => { if (observing && ['warning', 'error'].includes(message.type())) report.messages.push({run, type: message.type(), text: message.text()}); });
  page.on('requestfailed', request => { if (observing) report.failures.push({run, message: `${new URL(request.url()).pathname}: ${request.failure()?.errorText}`}); });
  page.on('response', response => { if (observing && response.status() >= 400) report.failures.push({run, message: `HTTP ${response.status()}: ${new URL(response.url()).pathname}`}); });
  try {
    await page.addInitScript(({fixture, titles, days}) => {
      const key = 'offline_recipebook_state_snapshot';
      if (!localStorage.getItem('supplemental_performance_seeded')) {
        localStorage.setItem(key, JSON.stringify(fixture));
        localStorage.setItem('offline_recipebook_storage_version', '7');
        localStorage.setItem('offline_recipebook_theme_v1', 'dark');
        localStorage.setItem('supplemental_performance_seeded', '1');
      }
      // Only reloads of the plan route count; this runs before any app script.
      if (new URL(location.href).searchParams.get('view') !== 'plan') return;
      const saved = JSON.parse(localStorage.getItem(key)).data;
      const expected = days.map(day => saved.mealPlan.days[day].map(id => titles[id]));
      let frames = 0;
      function ready() {
        const actual = [...document.querySelectorAll('.kitchen-plan-day')].map(day => [...day.querySelectorAll('.kitchen-plan-recipe')].map(item => item.textContent.trim()));
        return actual.length === 7 && JSON.stringify(actual) === JSON.stringify(expected) && document.documentElement.dataset.theme === 'light';
      }
      function tick() {
        if (ready()) frames++; else frames = 0;
        if (frames === 3) { window.__supplementalPersistedReady = {latency: performance.now(), assignments: expected.flat().length, theme: document.documentElement.dataset.theme}; return; }
        if (performance.now() < 15000) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, {fixture, titles, days});
    await page.goto(server.url, {waitUntil: 'networkidle'});
    await page.locator('article[data-recipe-id]').first().waitFor();
    await page.waitForFunction(async () => {const registration = await navigator.serviceWorker.getRegistration(); return Boolean(navigator.serviceWorker.controller && registration?.active?.state === 'activated');});
    await page.waitForLoadState('networkidle');
    assert.equal((await page.locator('.toast').textContent())?.trim(), '', 'No unexpected startup status should compete with timing');
    const filterLatency = await measure(page.getByRole('combobox', {name: 'Collection', exact: true}), 'filter', {collection, ids: expectedFilterIds, count: filteredRecipes.length});
    const nav = page.getByRole('navigation', {name: viewport.label === 'desktop' ? 'Primary navigation' : 'Mobile navigation'});
    const planLatency = await measure(nav.getByRole('button', {name: viewport.label === 'desktop' ? 'Weekly plan' : 'Plan', exact: true}), 'plan', {plan: expectedPlan});
    const cookingLatency = await measure(page.getByRole('button', {name: `Cook ${cookingRecipe.title}`, exact: true}).first(), 'cooking', {instruction: cookingRecipe.instructions[0]});
    await page.getByRole('dialog').getByRole('button', {name: 'Close dialog', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    await nav.getByRole('button', {name: viewport.label === 'desktop' ? 'Settings & data' : 'Settings', exact: true}).click();
    const themeLatency = await measure(page.getByRole('combobox', {name: 'Color theme', exact: true}), 'theme', {theme: 'light'});
    await nav.getByRole('button', {name: viewport.label === 'desktop' ? 'Weekly plan' : 'Plan', exact: true}).click();
    await page.locator('.kitchen-plan-day').first().getByRole('combobox').selectOption(additionalRecipe.id);
    await page.waitForFunction(({id, collection}) => {
      const data = JSON.parse(localStorage.getItem('offline_recipebook_state_snapshot')).data;
      return data.mealPlan.days.monday.includes(id) && data.ui.activeView === 'plan' && data.ui.theme === 'light' && data.ui.filters.collection?.[0] === collection;
    }, {id: additionalRecipe.id, collection});
    const before = await page.evaluate(() => localStorage.getItem('offline_recipebook_state_snapshot'));
    const savedData = JSON.parse(before).data;
    assert.equal(Object.values(savedData.mealPlan.days).flat().length, 36);
    assert.deepEqual(savedData.selectedRecipeIds, fixture.data.selectedRecipeIds);
    assert.deepEqual(savedData.manualGroceryItemsById, fixture.data.manualGroceryItemsById);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => Boolean(window.__supplementalPersistedReady));
    const reopened = await page.evaluate(() => window.__supplementalPersistedReady);
    const after = await page.evaluate(() => localStorage.getItem('offline_recipebook_state_snapshot'));
    assert.equal(after, before, 'Reload must retain the exact saved snapshot');
    assert.equal(reopened.assignments, 36);
    assert.equal(reopened.theme, 'light');
    report.samples.push({viewport: viewport.label, repeat, filterLatency, planLatency, cookingLatency, themeLatency, persistedReloadLatency: reopened.latency, persistedSnapshotSha256: sha256(before), reopenedAssignments: reopened.assignments});
    console.log(`${run}: filter ${filterLatency.toFixed(1)}, plan ${planLatency.toFixed(1)}, cook ${cookingLatency.toFixed(1)}, theme ${themeLatency.toFixed(1)}, reload ${reopened.latency.toFixed(1)} ms`);
  } catch (error) { report.failures.push({run, message: error.message}); console.error(`${run}: ${error.message}`); }
  finally { observing = false; await context.close(); }
}

try {
  server = await startBuildServer({directory: dist, base: build.base});
  browser = await chromium.launch({headless: true, executablePath: await findBrowserExecutable({playwright: {chromium}})});
  report.browser = browser.version();
  for (const viewport of viewports) for (let repeat = 1; repeat <= repeats; repeat++) await run(viewport, repeat);
  for (const viewport of viewports) {
    const samples = report.samples.filter(sample => sample.viewport === viewport.label);
    if (samples.length !== repeats) { report.failures.push({run: viewport.label, message: `Expected ${repeats} samples, got ${samples.length}`}); continue; }
    for (const [statistic, limits] of Object.entries(budgets)) for (const [metric, limit] of Object.entries(limits)) {
      const values = samples.map(sample => sample[metric]);
      const actual = statistic === 'median' ? median(values) : Math.max(...values);
      report.checks.push({viewport: viewport.label, statistic, metric, actual: round(actual), limit, passed: actual <= limit});
    }
  }
  for (const artifact of report.artifacts) assert.equal(sha256(await fs.readFile(path.join(dist, artifact.name))), artifact.sha256, `Build changed during measurement: ${artifact.name}`);
} catch (error) { report.failures.push({run: 'harness', message: error.message}); }
finally {
  await browser?.close();
  await server?.close();
  await fs.writeFile(path.join(out, 'journeys-report.json'), JSON.stringify(report, null, 2));
  const lines = ['# Supplemental production journey measurements', '', `Commit: \`${report.commit}\`; dirty: ${report.workingTreeDirty}; build source: \`${build.sourceCommit}\`; release: \`${build.release}\`.`, '', report.methodology, '', '| Layout | Statistic | Metric | Actual ms | Limit ms | Result |', '| --- | --- | --- | ---: | ---: | --- |', ...report.checks.map(item => `| ${item.viewport} | ${item.statistic} | ${item.metric} | ${item.actual} | ${item.limit} | ${item.passed ? 'PASS' : 'FAIL'} |`), '', `Complete samples: ${report.samples.length}/6. Execution failures: ${report.failures.length}. Failed budgets: ${report.checks.filter(item => !item.passed).length}.`, ...report.failures.map(item => `- ${item.run}: ${item.message}`), '', 'Raw samples, fixture IDs, browser/version, build metadata and all artifact hashes are in journeys-report.json. Three repetitions cannot establish reliable tail latency; mobile is viewport emulation on the desktop CPU. No field INP, physical-device or hosted-network result is claimed.', ''];
  await fs.writeFile(path.join(out, 'README.md'), lines.join('\n'));
}
if (report.failures.length || report.checks.some(item => !item.passed)) process.exitCode = 1;
