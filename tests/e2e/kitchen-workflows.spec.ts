import {test, expect, type Page} from '@playwright/test';
import {storageKeys, currentStorageVersion} from '../../js/storage.js';

const recipeId = 'dutch-oven-chicken-pot-pie';
const recipeTitle = 'Dutch Oven Chicken Pot Pie';

// Each Playwright test owns an isolated browser context. The fixture adds only
// personal state; recipes and ingredient quantities are the real published data.
const personalState = {
  [storageKeys.version]: String(currentStorageVersion),
  [storageKeys.selectedRecipes]: JSON.stringify({[recipeId]: true, 'dutch-baby-pancake': true}),
  [storageKeys.favoriteRecipes]: JSON.stringify({[recipeId]: true}),
  [storageKeys.recipeMultipliers]: JSON.stringify({[recipeId]: 2}),
  [storageKeys.manualGroceryItems]: JSON.stringify({'e2e-paper': {id: 'e2e-paper', name: 'Paper towels'}}),
  [storageKeys.mealPlan]: JSON.stringify({days: {monday: [recipeId], wednesday: [recipeId], friday: ['dutch-baby-pancake']}}),
  [storageKeys.groupToggle]: '1',
  [storageKeys.groceryControlsCollapsed]: '0',
  [storageKeys.hideCheckedGroceryItems]: '0',
  offline_recipebook_theme_v1: 'light',
};

async function openRecipe(page: Page) {
  await page.getByRole('searchbox', {name: 'Search recipes'}).fill(recipeTitle);
  const link = page.locator(`[data-recipe-id="${recipeId}"] h2 a`);
  await link.click();
  await expect(page.getByRole('dialog', {name: recipeTitle})).toBeVisible();
  return link;
}

for (const viewport of [{name: 'desktop', width: 1440, height: 900}, {name: 'mobile', width: 390, height: 844}]) {
  test.describe(`${viewport.name} kitchen journeys`, () => {
    test.use({viewport: {width: viewport.width, height: viewport.height}, hasTouch: viewport.name === 'mobile'});

    test.beforeEach(async ({context, page}) => {
      await context.addInitScript(values => {
        if (sessionStorage.getItem('kitchen-e2e-seeded')) return;
        Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
        sessionStorage.setItem('kitchen-e2e-seeded', '1');
      }, personalState);
      await page.goto('./');
      await expect(page.locator('.recipe-card').first()).toBeVisible();
    });

    test('sorting and combined discovery remain available at this viewport', async ({page}) => {
      const sort = page.getByRole('combobox', {name: 'Sort', exact: true});
      await expect(sort).toBeVisible();
      await sort.selectOption('fastest');
      await page.getByRole('button', {name: /^Filters/}).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('checkbox', {name: 'In my grocery list'}).check();
      await dialog.getByRole('button', {name: /^Show \d+ recipes$/}).click();
      await expect(page.locator('.recipe-card')).toHaveCount(2);
      await page.reload();
      await expect(sort).toHaveValue('fastest');
      await expect(page.locator('.recipe-card')).toHaveCount(2);
      await page.getByRole('button', {name: /Clear all filters/}).click();
      await page.getByRole('searchbox', {name: 'Search recipes'}).fill('zzzz-no-recipe');
      await expect(page.getByRole('heading', {name: 'No recipes found'})).toBeVisible();
      await page.getByRole('button', {name: 'Show all recipes'}).click();
      await expect(page.locator('.recipe-card').first()).toBeVisible();
    });

    test('detail grocery action navigates once and stays on the list', async ({page}) => {
      await openRecipe(page);
      await page.getByRole('dialog').getByRole('button', {name: 'View grocery list'}).click();
      await expect(page.getByRole('heading', {name: 'Your grocery list'})).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL(/\?view=grocery$/);
      // A queued popstate used to undo this navigation after the dialog closed.
      await page.waitForTimeout(250);
      await expect(page.getByRole('heading', {name: 'Your grocery list'})).toBeVisible();
    });

    test('quantity Escape reverts its draft without dismissing the recipe', async ({page}) => {
      await openRecipe(page);
      const quantity = page.getByRole('spinbutton', {name: 'Grocery quantity multiplier'});
      await expect(quantity).toHaveValue('2');
      await quantity.fill('3');
      await quantity.press('Escape');
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(quantity).toHaveValue('2');
      await quantity.fill('100');
      await quantity.press('Enter');
      await expect(quantity).toHaveValue('12');
      await quantity.fill('0.01');
      await quantity.press('Enter');
      await expect(quantity).toHaveValue('0.25');
      await quantity.fill('0');
      await quantity.press('Tab');
      await expect(quantity).toHaveValue('0.25');
      await page.reload();
      await expect(quantity).toHaveValue('0.25');
      await expect(page.locator('.ingredient-list')).toContainText('1 tablespoon olive oil');
    });

    test('recipe print excludes the underlying collection and retains the method', async ({page}) => {
      await openRecipe(page);
      await page.emulateMedia({media: 'print'});
      await expect(page.locator('.recipe-grid')).toBeHidden();
      await expect(page.getByRole('dialog', {name: recipeTitle})).toBeVisible();
      await expect(page.locator('.method-list')).toContainText('Preheat oven to 350°F');
      expect(await page.locator('.dialog-body').evaluate(element => getComputedStyle(element).overflowY)).toBe('visible');
    });

    test('grocery sources expose quantities and return to the same list control', async ({page}) => {
      await page.goto('./?view=grocery');
      const oil = page.locator('.kitchen-grocery-row').filter({has: page.getByRole('checkbox', {name: /^Check olive oil,/})});
      await expect(oil).toContainText('2 tbsp');
      await oil.locator('summary').click();
      const source = oil.getByRole('button', {name: recipeTitle, exact: true});
      await expect(source).toBeVisible();
      await source.click();
      await expect(page.getByRole('dialog', {name: recipeTitle})).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', {name: 'Your grocery list'})).toBeVisible();
      await expect(source).toBeFocused();
    });

    test('fifth and last grocery items remain reachable by pointer; hide and clear preserve semantics', async ({page}) => {
      await page.goto('./?view=grocery');
      const checks = page.locator('.grocery-check');
      await checks.nth(4).check();
      await expect(checks.nth(4)).toBeChecked();
      await checks.last().check();
      await expect(checks.last()).toBeChecked();
      await page.getByRole('checkbox', {name: 'Hide checked'}).check();
      // click(), rather than check(), accommodates the checked row disappearing.
      while (await checks.count()) {
        const count = await checks.count();
        await checks.first().click();
        await expect(checks).toHaveCount(count - 1);
      }
      await expect(page.getByRole('heading', {name: 'Everything is checked'})).toBeVisible();
      await page.getByRole('button', {name: 'Show checked items'}).click();
      await page.getByRole('button', {name: 'Clear checked', exact: true}).click();
      await expect(page.locator('.grocery-check:checked')).toHaveCount(0);
      await expect(page.getByRole('checkbox', {name: 'Check Paper towels'})).toHaveCount(0);
      await expect(page.getByRole('checkbox', {name: /^Check olive oil,/})).toBeVisible();
    });

    test('grouping, manual items, search suffix and list options work together', async ({page}) => {
      await page.goto('./?view=grocery');
      const group = page.locator('.kitchen-group-toggle').first();
      await group.click();
      await expect(group).toHaveAttribute('aria-expanded', 'false');
      await group.click();
      await page.getByRole('checkbox', {name: 'Group by section'}).uncheck();
      await expect(page.locator('.kitchen-group-toggle')).toHaveCount(0);
      await page.getByRole('textbox', {name: 'Add grocery item'}).fill('Tea & coffee');
      await page.getByRole('button', {name: 'Add', exact: true}).click();
      await expect(page.getByRole('checkbox', {name: 'Check Tea & coffee'})).toBeVisible();
      await page.getByRole('textbox', {name: /Search suffix/}).fill('my store');
      await expect(page.locator('.kitchen-item-actions a').first()).toHaveAttribute('href', /my\+store|my%20store/);
      await page.getByRole('button', {name: 'Remove Tea & coffee', exact: true}).click();
      await expect(page.getByRole('checkbox', {name: 'Check Tea & coffee'})).toHaveCount(0);
      await page.getByRole('button', {name: 'List options'}).click();
      await expect(page.getByRole('button', {name: 'Copy list', exact: true})).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('button', {name: 'List options'})).toHaveAttribute('aria-expanded', 'false');
    });

    test('canceling delete restores focus; confirmed delete shows a fresh list', async ({page}) => {
      await page.goto('./?view=grocery');
      const opener = page.getByRole('button', {name: 'Delete all', exact: true});
      await opener.click();
      const dialog = page.getByRole('dialog', {name: 'Delete your grocery list?'});
      await expect(dialog.getByRole('button', {name: 'Cancel', exact: true})).toBeFocused();
      await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
      await expect(opener).toBeFocused();
      await opener.click();
      await dialog.getByRole('button', {name: 'Delete all', exact: true}).click();
      await expect(page.getByRole('heading', {name: 'A fresh list'})).toBeVisible();
      await page.goto('./?view=plan');
      await expect(page.locator('.kitchen-plan-item')).toHaveCount(3);
    });

    test('building groceries from repeated planned meals preserves manual extras', async ({page}) => {
      await page.goto('./?view=plan');
      await page.getByRole('combobox').nth(1).selectOption('chicken-fried-steak');
      await page.getByRole('button', {name: 'Build grocery list', exact: true}).click();
      await page.getByRole('dialog').getByRole('button', {name: 'Build grocery list', exact: true}).click();
      await expect(page.getByRole('heading', {name: 'Your grocery list'})).toBeVisible();
      await expect(page.getByRole('checkbox', {name: 'Check Paper towels'})).toBeVisible();
      await expect(page.getByRole('checkbox', {name: /^Check olive oil, 2 tbsp$/})).toBeVisible();
      const oil = page.locator('.kitchen-grocery-row').filter({has: page.getByRole('checkbox', {name: /^Check olive oil,/})});
      await oil.locator('summary').click();
      await oil.getByRole('button', {name: recipeTitle, exact: true}).click();
      await expect(page.getByRole('spinbutton', {name: 'Grocery quantity multiplier'})).toHaveValue('2');
    });

    test('planner recipe, cooking, remove and clear actions keep the week consistent', async ({page}) => {
      await page.goto('./?view=plan');
      const source = page.locator('.kitchen-plan-recipe').first();
      await source.click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', {name: 'Your week in recipes'})).toBeVisible();
      await expect(source).toBeFocused();
      await page.locator('.kitchen-plan-item').first().getByRole('button', {name: `Cook ${recipeTitle}`, exact: true}).click();
      await expect(page.locator('.kitchen-cooking')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('.kitchen-plan-item').first().getByRole('button', {name: /Remove/}).click();
      await expect(page.locator('.kitchen-plan-item')).toHaveCount(2);
      await page.getByRole('button', {name: 'Clear plan', exact: true}).click();
      await page.getByRole('dialog').getByRole('button', {name: 'Clear plan', exact: true}).click();
      await expect(page.locator('.kitchen-plan-item')).toHaveCount(0);
      await expect(page.getByRole('button', {name: 'Build grocery list', exact: true})).toBeDisabled();
    });

    test('nested cooking traps focus, advances by arrows and returns through both openers', async ({page}) => {
      const recipeLink = await openRecipe(page);
      const detail = page.getByRole('dialog', {name: recipeTitle});
      const cook = detail.getByRole('button', {name: 'Start cooking'});
      await cook.click();
      await expect(page.locator('.kitchen-cooking')).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.kitchen-step-count')).toContainText('Step 2');
      await page.locator('.kitchen-cooking').getByRole('button', {name: 'Hide details'}).click();
      await expect(page.locator('#kitchen-cooking-meta')).toBeHidden();
      for (let index = 0; index < 30; index++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.kitchen-cooking')))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.kitchen-cooking')).toHaveCount(0);
      await expect(cook).toBeFocused();
      await detail.getByRole('button', {name: 'Close dialog'}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(recipeLink).toBeFocused();
    });

    if (viewport.name === 'mobile') test('cooking swipe, ingredients and finish are usable on a small screen', async ({page}) => {
      await openRecipe(page);
      await page.getByRole('button', {name: 'Start cooking'}).click();
      const step = page.locator('.kitchen-cooking-step');
      await step.dispatchEvent('touchstart', {touches: [{identifier: 0, clientX: 300, clientY: 400}], changedTouches: [{identifier: 0, clientX: 300, clientY: 400}]});
      await step.dispatchEvent('touchend', {touches: [], changedTouches: [{identifier: 0, clientX: 80, clientY: 405}]});
      await expect(page.locator('.kitchen-step-count')).toContainText('Step 2');
      await page.locator('.kitchen-cooking-ingredients button').click();
      await expect(page.locator('#kitchen-cooking-ingredient-list')).toBeVisible();
      await page.locator('.kitchen-cooking-ingredients li').last().scrollIntoViewIfNeeded();
      await expect(page.locator('.kitchen-cooking-ingredients li').last()).toBeVisible();
      await expect(page.locator('.kitchen-cooking-navigation')).toBeInViewport();
      for (let index = 0; index < 9; index++) await page.keyboard.press('ArrowRight');
      await page.locator('.kitchen-cooking').getByRole('button', {name: 'Finish', exact: true}).click();
      await expect(page.locator('.kitchen-cooking')).toHaveCount(0);
      await expect(page.getByRole('dialog', {name: recipeTitle})).toBeVisible();
    });
  });
}
