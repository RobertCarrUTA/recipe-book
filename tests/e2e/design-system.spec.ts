import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const viewports = [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;
async function capture(page: Page, testInfo: TestInfo, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "No unintended page overflow",
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, `${name} automated accessibility`).toEqual([]);
  await testInfo.attach(name, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
}
async function navigation(page: Page, label: string) {
  const mobile = page.viewportSize()!.width <= 640;
  await page
    .getByRole("navigation", {
      name: mobile ? "Mobile navigation" : "Primary navigation",
    })
    .getByRole("button", { name: label, exact: true })
    .click();
}
for (const [width, height] of viewports)
  for (const theme of ["light", "dark"] as const) {
    test(`${width}x${height} ${theme}: complete screen and accessibility matrix`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height });
      await page.addInitScript(
        (value) => localStorage.setItem("offline_recipebook_theme_v1", value),
        theme,
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("./");
      await expect(page.locator(".recipe-card").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(
        page.getByRole("combobox", { name: "Sort", exact: true }),
      ).toBeVisible();
      await capture(page, testInfo, "browse");
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, testInfo, "filters");
      await page.keyboard.press("Escape");
      await page
        .getByRole("searchbox", { name: "Search recipes" })
        .fill("chicken fried steak");
      await page
        .getByRole("link", { name: "Chicken Fried Steak", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, testInfo, "recipe");
      await page
        .getByRole("button", { name: "Add to groceries", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Add to plan", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Start cooking", exact: true })
        .click();
      await expect(
        page.getByRole("progressbar", { name: "Cooking progress" }),
      ).toBeVisible();
      await capture(page, testInfo, "cooking");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "View grocery list", exact: false })
        .click();
      await expect(
        page.getByRole("heading", { name: "Your grocery list" }),
      ).toBeVisible();
      const options = page.getByRole("button", {
        name: "List options",
        exact: false,
      });
      if ((await options.getAttribute("aria-expanded")) === "true")
        await options.click();
      await capture(page, testInfo, "groceries");
      await options.click();
      await page
        .getByRole("button", { name: "Delete all", exact: true })
        .click();
      await capture(page, testInfo, "confirmation");
      await page.keyboard.press("Escape");
      await navigation(page, width <= 640 ? "Plan" : "Weekly plan");
      await capture(page, testInfo, "planner");
      await navigation(page, width <= 640 ? "Settings" : "Settings & data");
      await capture(page, testInfo, "settings");
      expect(errors).toEqual([]);
      await testInfo.attach("environment", {
        body: JSON.stringify({
          width,
          height,
          theme,
          browser: page.context().browser()?.version(),
          url: page.url(),
        }),
        contentType: "application/json",
      });
    });
  }

test("System follows live OS changes; explicit choices persist and override OS", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./?view=settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("combobox", { name: "Color theme" })
    .selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue(
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("combobox", { name: "Color theme" })
    .selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme changes preserve cooking progress, selection and dialog state", async ({
  page,
  context,
}) => {
  await page.goto("./chicken-fried-steak");
  await page
    .getByRole("button", { name: "Add to groceries", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "Cooking progress" }),
  ).toHaveAttribute("value", "2");
  const settings = await context.newPage();
  await settings.goto("./?view=settings");
  await settings
    .getByRole("combobox", { name: "Color theme" })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("progressbar", { name: "Cooking progress" }),
  ).toHaveAttribute("value", "2");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Remove from groceries", exact: true }),
  ).toBeVisible();
});

test("320px reflow, intermediate width and keyboard dialogs remain usable", async ({
  page,
}) => {
  await page.goto("./");
  for (const width of [320, 640, 641, 850, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("combobox", { name: "Sort", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  const opener = page.getByRole("button", { name: /^Filters/ });
  await opener.focus();
  await page.keyboard.press("Enter");
  for (let index = 0; index < 35; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});
