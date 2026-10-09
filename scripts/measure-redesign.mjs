import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {findBrowserExecutable} from './browser-executable.mjs';

// Resolve runtime dependencies from the checkout being measured. This also lets
// a reviewer run this script by absolute path against another worktree's dist.
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const playwrightModule = await import(pathToFileURL(require.resolve('playwright')).href);
const playwright = playwrightModule.chromium ? playwrightModule : playwrightModule.default;
const {preview} = await import(pathToFileURL(require.resolve('vite')).href);
const out = path.resolve(root, process.env.PERFORMANCE_OUTPUT || 'test-results/performance');
const baseline = JSON.parse(await fs.readFile(path.join(root, 'tests/fixtures/performance-baseline.json'), 'utf8'));
const recipes = JSON.parse(await fs.readFile(path.join(root, 'dist/data/recipes.json'), 'utf8'));
const {buildRecipeSearchText, recipeSearchTextMatches} = await import(pathToFileURL(path.join(root, 'js/recipe_filter.js')).href);
const target = recipes.find(recipe => recipe.title === 'Dutch Oven Chicken Pot Pie');
assert.ok(target, 'The original baseline search/detail target must still exist');
// Match the historical harness's readiness definition. This query also matches
// authored notes in other recipes; expected IDs are computed before timing.
const productionSearchIds = recipes.filter(recipe => recipeSearchTextMatches(buildRecipeSearchText(recipe), target.title)).map(recipe => recipe.id).sort();
const repeats = 3;
const viewports = [{label: 'desktop', width: 1440, height: 900}, {label: 'mobile', width: 390, height: 844}];
const budgets = {
  production: {lcp: 800, cls: 0.05, searchLatency: 200, openLatency: 50, requestCount: 53, bodyBytes: 3704340, transferBytes: 3719040, jsBytes: 409600},
  large: {searchLatency: 200, groceryCheckLatency: 200},
  maximum: {productionCls: 0.1, largeSearchLatency: 400, largeGroceryCheckLatency: 400},
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Number(value.toFixed(3));
function letters(index) {let result = ''; for (let i = 0; i < 4; i++) {result = String.fromCharCode(97 + index % 26) + result; index = Math.floor(index / 26);} return result;}
const largeRecipes = Array.from({length: 1000}, (_, index) => ({
  id: `performance-recipe-${index + 1}`, title: `Performance Recipe ${letters(index)}`,
  description: 'Deterministic synthetic catalog for interaction measurement.',
  ingredients: [`1 benchmark ingredient ${letters(index)}`, '1 cup rice', '1 tsp salt'],
  groceryIngredients: [{item: `benchmark ingredient ${letters(index)}`, quantity: 1}, {item: 'rice', quantity: 1, unit: 'cup'}, {item: 'salt', quantity: 1, unit: 'tsp'}],
  instructions: ['Combine the fixture ingredients.', 'Complete the synthetic recipe.'],
  tags: {status: 'not-tried', difficulty: 'easy'}, servings: '2', totalTime: '20 minutes',
}));
const largeBody = JSON.stringify(largeRecipes);
const largeTarget = largeRecipes.at(-1);
const report = {
  schemaVersion: 1, capturedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim()),
  baselineCommit: baseline.commit, browser: null, budgets,
  methodology: 'Production dist served by loopback Vite preview with Accept-Encoding: identity; 3 fresh browser contexts for each desktop/mobile layout, dark theme, service workers blocked, no CPU/network throttling. Initial LCP and accumulated non-input CLS sampled after networkidle, visible recipes, and 500 ms (same baseline observation window). Resource Timing includes document plus all recorded resources. Search ends after matching rendered cards plus two animation frames. Detail reports both click-to-two-frames and dialog-ready-plus-two-frames. These are synthetic lab interaction latencies, not field INP. Large fixture uses intercepted local JSON and must not be used for transfer-byte comparisons.',
  fixtures: {productionRecipes: recipes.length, target: {id: target.id, title: target.title}, productionSearchIds, largeRecipes: largeRecipes.length, largeGroceryRows: 1002, largeJsonSha256: hash(largeBody), largeJsonBytes: Buffer.byteLength(largeBody)},
  bundles: [], production: [], large: [], comparisons: [], checks: [], messages: [], failures: [],
};
await fs.mkdir(out, {recursive: true});
for (const name of ['index.html', ...(await fs.readdir(path.join(root, 'dist/assets'))).map(name => `assets/${name}`)]) {
  const bytes = await fs.readFile(path.join(root, 'dist', name));
  report.bundles.push({name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: hash(bytes)});
}
let server;
let browser;
let baseURL;

function monitor(page, run) {
  page.on('pageerror', error => report.failures.push({run, message: error.message}));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) {
      const text = message.text();
      report.messages.push({run, type: message.type(), instrumentation: /service worker.*block|Service Worker registration.*block/i.test(text), text});
    }
  });
  page.on('response', response => {
    const encoding = response.headers()['content-encoding'];
    if (encoding && encoding !== 'identity') report.failures.push({run, message: `Compressed response invalidates uncompressed comparison: ${new URL(response.url()).pathname} (${encoding})`});
    if (response.status() >= 400) report.failures.push({run, message: `HTTP ${response.status()}: ${new URL(response.url()).pathname}`});
  });
}
async function observe(page) {
  await page.addInitScript(() => {
    window.__redesignPerformance = {lcp: 0, cls: 0, longTasks: []};
    new PerformanceObserver(list => {for (const entry of list.getEntries()) window.__redesignPerformance.lcp = entry.startTime;}).observe({type: 'largest-contentful-paint', buffered: true});
    new PerformanceObserver(list => {for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__redesignPerformance.cls += entry.value;}).observe({type: 'layout-shift', buffered: true});
    new PerformanceObserver(list => {for (const entry of list.getEntries()) window.__redesignPerformance.longTasks.push({start: entry.startTime, duration: entry.duration});}).observe({type: 'longtask', buffered: true});
    localStorage.setItem('offline_recipebook_theme_v1', 'dark');
  });
}
async function initialMetrics(page) {
  await page.goto(baseURL, {waitUntil: 'networkidle'});
  await page.locator('article[data-recipe-id]').first().waitFor();
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map(entry => ({name: new URL(entry.name).pathname, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, duration: entry.duration, initiatorType: entry.initiatorType}));
    const nav = performance.getEntriesByType('navigation')[0];
    return {...window.__redesignPerformance, domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
      requestCount: resources.length + 1, transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, nav.transferSize),
      bodyBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, nav.encodedBodySize),
      jsBytes: resources.filter(entry => entry.name.endsWith('.js')).reduce((sum, entry) => sum + entry.encodedBodySize, 0), resources};
  });
}
async function search(page, recipe, expectedIds) {
  return page.evaluate(({title, expectedIds}) => new Promise((resolve, reject) => {
    const input = document.querySelector('input[type="search"]');
    if (!input) return reject(new Error('Search control was not found'));
    let complete = false;
    const timeout = setTimeout(() => {observer.disconnect(); reject(new Error('Search did not render the expected matching recipes'));}, 15000);
    const start = performance.now();
    const observer = new MutationObserver(() => {
      const cards = document.querySelectorAll('article[data-recipe-id]');
      if (complete || JSON.stringify([...cards].map(card => card.dataset.recipeId).sort()) !== JSON.stringify(expectedIds)) return;
      complete = true; observer.disconnect(); clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
    });
    observer.observe(document.querySelector('main'), {childList: true, subtree: true, attributes: true});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, title);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }), {title: recipe.title, expectedIds});
}
async function detail(page, recipe) {
  return page.evaluate(({id, title}) => new Promise((resolve, reject) => {
    const link = document.querySelector(`article[data-recipe-id="${id}"] h2 a`);
    if (!link) return reject(new Error('Target recipe link was not found'));
    const start = performance.now();
    link.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const openLatency = performance.now() - start;
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(item => item.textContent.includes(title));
      if (!dialog || !dialog.getClientRects().length) return reject(new Error('Recipe dialog was not visible within the baseline two-frame detail window'));
      resolve({openLatency, dialogReadyLatency: openLatency});
    }));
  }), {id: recipe.id, title: recipe.title});
}
async function grocery(page, viewport) {
  await page.getByRole('dialog').getByRole('button', {name: 'Close dialog', exact: true}).click();
  await page.getByRole('dialog').waitFor({state: 'hidden'});
  const start = await page.evaluate(() => performance.now());
  await page.getByRole('navigation', {name: viewport.label === 'desktop' ? 'Primary navigation' : 'Mobile navigation'}).getByRole('button', {name: /^Groceries/}).click();
  try {await page.waitForFunction(() => document.querySelectorAll('.grocery-check').length === 1002);}
  catch {
    const state = await page.evaluate(() => ({heading: document.querySelector('h1')?.textContent, rows: document.querySelectorAll('.grocery-check').length, savedSelections: Object.keys(JSON.parse(localStorage.getItem('offline_recipebook_state_snapshot') || '{}').data?.selectedRecipeIds || {}).length}));
    throw new Error(`Large grocery fixture did not render 1002 rows: ${JSON.stringify(state)}`);
  }
  const navigationLatency = await page.evaluate(start => performance.now() - start, start);
  const groceryRows = await page.locator('.grocery-check').count();
  await page.locator('.grocery-check').first().scrollIntoViewIfNeeded();
  const groceryCheckLatency = await page.evaluate(() => new Promise((resolve, reject) => {
    const checkbox = document.querySelector('.grocery-check');
    if (!checkbox || checkbox.checked) return reject(new Error('Expected an unchecked grocery fixture row'));
    let complete = false;
    const timeout = setTimeout(() => {observer.disconnect(); reject(new Error('Grocery check did not update the rendered row'));}, 15000);
    const start = performance.now();
    const observer = new MutationObserver(() => {
      if (complete || !checkbox.checked || !checkbox.closest('li').classList.contains('is-checked')) return;
      complete = true; observer.disconnect(); clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
    });
    observer.observe(document.querySelector('main'), {childList: true, subtree: true, attributes: true});
    checkbox.click();
  }));
  assert.equal(await page.locator('.grocery-check:checked').count(), 1, 'Exactly one grocery row must be checked');
  return {groceryRows, groceryNavigationLatency: navigationLatency, groceryCheckLatency};
}
async function run(kind, viewport, repeat) {
  const run = `${kind}-${viewport.label}-${repeat}`;
  const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, colorScheme: 'dark', serviceWorkers: 'block', extraHTTPHeaders: {'Accept-Encoding': 'identity'}});
  const page = await context.newPage();
  page.setDefaultTimeout(20000); monitor(page, run); await observe(page);
  try {
    if (kind === 'large') {
      await page.route('**/data/recipes.json?*', route => route.fulfill({status: 200, contentType: 'application/json', body: largeBody}));
      await page.addInitScript(ids => {
        localStorage.setItem('offline_recipebook_storage_version', '7');
        localStorage.setItem('offline_recipebook_state_snapshot', JSON.stringify({storageVersion: 7, revision: 'performance-fixture', data: {
          selectedRecipeIds: Object.fromEntries(ids.map(id => [id, true])), favoriteRecipeIds: {}, recipeMultipliersById: {},
          groceryCheckedByKey: {}, manualGroceryItemsById: {},
          mealPlan: {days: {monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []}},
          ui: {groupItems: false},
        }}));
      }, largeRecipes.map(recipe => recipe.id));
    }
    const initial = await initialMetrics(page);
    assert.ok(initial.lcp > 0, 'LCP observer did not produce a sample');
    const recipe = kind === 'large' ? largeTarget : target;
    const searchLatency = await search(page, recipe, kind === 'large' ? [largeTarget.id] : productionSearchIds);
    const opened = await detail(page, recipe);
    const shopping = kind === 'large' ? await grocery(page, viewport) : {};
    report[kind].push({label: viewport.label, repeat, viewport: {width: viewport.width, height: viewport.height}, ...initial, searchLatency, ...opened, ...shopping});
    console.log(`${run}: LCP ${initial.lcp.toFixed(1)} ms; search ${searchLatency.toFixed(1)} ms; detail ${opened.openLatency.toFixed(1)} ms${shopping.groceryCheckLatency ? `; check ${shopping.groceryCheckLatency.toFixed(1)} ms` : ''}`);
  } catch (error) {report.failures.push({run, message: error.message}); console.error(`${run}: ${error.message}`);}
  finally {await context.close();}
}
function summarize() {
  for (const viewport of viewports) {
    for (const kind of ['production', 'large']) {
      const samples = report[kind].filter(sample => sample.label === viewport.label);
      if (samples.length !== repeats) {report.failures.push({run: `${kind}-${viewport.label}`, message: `Expected ${repeats} complete samples, received ${samples.length}`}); continue;}
      for (const [metric, limit] of Object.entries(budgets[kind])) {
        const actual = median(samples.map(sample => sample[metric]));
        report.checks.push({kind, viewport: viewport.label, statistic: 'median', metric, actual: round(actual), limit, passed: actual <= limit});
      }
      const caps = kind === 'production' ? {cls: budgets.maximum.productionCls} : {searchLatency: budgets.maximum.largeSearchLatency, groceryCheckLatency: budgets.maximum.largeGroceryCheckLatency};
      for (const [metric, limit] of Object.entries(caps)) {
        const actual = Math.max(...samples.map(sample => sample[metric]));
        report.checks.push({kind, viewport: viewport.label, statistic: 'maximum', metric, actual: round(actual), limit, passed: actual <= limit});
      }
      if (kind === 'production') for (const metric of Object.keys(budgets.production)) {
        const before = median(baseline.performance.filter(sample => sample.label === viewport.label).map(sample => metric === 'jsBytes' ? sample.resources.filter(entry => entry.name.endsWith('.js')).reduce((sum, entry) => sum + entry.encodedBodySize, 0) : sample[metric]));
        const after = median(samples.map(sample => sample[metric]));
        report.comparisons.push({viewport: viewport.label, metric, baseline: round(before), redesign: round(after), delta: round(after - before), percent: before ? round(100 * (after - before) / before) : null});
      }
    }
  }
}
async function persist() {
  await fs.writeFile(path.join(out, 'redesign-report.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Production UI performance report', '', `Commit: \`${report.commit}\`; working tree dirty: ${report.workingTreeDirty}. Captured ${report.capturedAt}.`, '', report.methodology, '', '## Baseline comparison (medians)', '', '| Viewport | Metric | Baseline | Redesign | Delta |', '| --- | --- | ---: | ---: | ---: |', ...report.comparisons.map(row => `| ${row.viewport} | ${row.metric} | ${row.baseline} | ${row.redesign} | ${row.delta} |`), '', '## Predeclared budgets', '', '| Scenario | Viewport | Statistic | Metric | Actual | Limit | Result |', '| --- | --- | --- | --- | ---: | ---: | --- |', ...report.checks.map(row => `| ${row.kind} | ${row.viewport} | ${row.statistic} | ${row.metric} | ${row.actual} | ${row.limit} | ${row.passed ? 'PASS' : 'FAIL'} |`), '', '## Limitations', '', 'These are unthrottled loopback lab observations on a desktop CPU, including the mobile layout. They are not physical-device, field INP, or production-network measurements. The original baseline contains browser-injected zero-byte /adguard resources; full recorded request counts are retained for transparency. Response body bytes are uncompressed; per-asset gzip sizes are only potential deployment sizes. Large-fixture bytes use route interception and are excluded from bandwidth budgets. Raw samples, exact dist hashes, long tasks, browser messages, failures, and fixture hash are in redesign-report.json.', '', `Execution failures: ${report.failures.length}; failed budgets: ${report.checks.filter(check => !check.passed).length}.`, ...report.failures.map(failure => `- ${failure.run}: ${failure.message}`), ''];
  await fs.writeFile(path.join(out, 'README.md'), lines.join('\n'));
}
try {
  server = await preview({preview: {host: '127.0.0.1', port: 0, strictPort: true}});
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  baseURL = `http://127.0.0.1:${address.port}${server.config.base}`;
  const executablePath = await findBrowserExecutable({playwright});
  assert.ok(executablePath, 'A local Chromium executable is required');
  browser = await playwright.chromium.launch({executablePath, headless: true});
  report.browser = {version: browser.version(), executable: path.basename(executablePath), engine: 'Chromium', node: process.version};
  for (const kind of ['production', 'large']) for (const viewport of viewports) for (let repeat = 1; repeat <= repeats; repeat++) await run(kind, viewport, repeat);
  for (const bundle of report.bundles) {
    try {assert.equal(hash(await fs.readFile(path.join(root, 'dist', bundle.name))), bundle.sha256);}
    catch {report.failures.push({run: 'artifact-consistency', message: `${bundle.name} changed during measurement; rebuild and rerun against a stable dist`});}
  }
  summarize();
} catch (error) {report.failures.push({run: 'harness', message: error.message});}
finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  await persist();
}
console.log(`Report: ${path.join(out, 'redesign-report.json')}`);
if (report.failures.length || report.checks.some(check => !check.passed)) process.exitCode = 1;
