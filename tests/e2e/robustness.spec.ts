import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a failed catalog shows an accessible error and can be retried", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/data/recipes.json?*", (route) =>
    ++attempts === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue(),
  );
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Your recipes couldn’t load" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".recipe-card").first()).toBeVisible();
  expect(attempts).toBe(2);
});

test("legacy recipe hashes and browser forward navigation retain a readable detail", async ({
  page,
}) => {
  await page.goto("./#recipe=chicken-fried-steak");
  await expect(
    page.getByRole("dialog", { name: "Chicken Fried Steak" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("link", { name: "Chicken Fried Steak", exact: true })
    .click();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "Chicken Fried Steak" }),
  ).toBeVisible();
});

test("authored hostile strings stay inert and long content reflows at 320px", async ({
  page,
}) => {
  const title = "A recipe with a long title for a small kitchen screen";
  const text =
    '<img src=x onerror="window.recipeInjection=true"> ' +
    "A carefully written long recipe note. ".repeat(50);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("**/data/recipes.json?*", (route) =>
    route.fulfill({
      json: [
        {
          id: "long-recipe",
          title,
          description: text,
          ingredients: [text],
          instructions: [text],
          groceryIngredients: [],
          collections: [],
          tags: {},
          link: "javascript:window.recipeInjection=true",
        },
      ],
    }),
  );
  await page.goto("./");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: /Original source/ })).toHaveCount(
    0,
  );
  await expect(page.locator("img")).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.hasOwn(window, "recipeInjection")),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const close = page.getByRole("button", { name: "Close dialog", exact: true });
  await expect(close).toBeInViewport();
  await page.getByRole("button", { name: "Start cooking" }).click();
  await expect(
    page.getByRole("button", { name: "Finish", exact: true }),
  ).toBeInViewport();
  await expect(page.locator(".kitchen-cooking-step")).toHaveAttribute(
    "tabindex",
    "0",
  );
});

test("saved collapsed recipe controls can be reopened and cleared", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("searchbox", { name: "Search recipes" }).fill("beans");
  await page.getByRole("button", { name: "Hide search & filters" }).click();
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Show search & filters" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search recipes" }),
  ).toHaveValue("beans");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".recipe-card").first()).toBeVisible();
});

test("dark empty results, reduced motion and unsupported wake lock remain usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("offline_recipebook_theme_v1", "dark");
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("./");
  await page
    .getByRole("searchbox", { name: "Search recipes" })
    .fill("no-match-for-this-query");
  await expect(
    page.getByRole("heading", { name: "No recipes found" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Show all recipes" }).click();
  await page.getByRole("button", { name: /^Filters/ }).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
  await page.goto("./?view=settings");
  await expect(
    page.getByRole("checkbox", { name: "Keep the screen awake" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/does not support keeping the screen awake/),
  ).toBeVisible();
});
