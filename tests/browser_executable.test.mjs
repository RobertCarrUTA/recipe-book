import assert from "node:assert/strict";

import {
  findBrowserExecutable,
  getBrowserExecutableCandidates,
} from "../scripts/browser-executable.mjs";
import { test } from "./test_helpers.mjs";

test("browser executable candidates prefer explicit env paths", () => {
  const playwright = {
    chromium: {
      executablePath: () => "/playwright/chromium",
    },
  };

  const candidates = getBrowserExecutableCandidates(playwright, {
    PLAYWRIGHT_CHROMIUM_EXECUTABLE: "/custom/chromium",
  });

  assert.equal(candidates[0], "/custom/chromium");
  assert.equal(candidates.at(-1), "/playwright/chromium");
});

test("findBrowserExecutable falls back to Playwright managed Chromium", async () => {
  const attempted = [];
  const executable = await findBrowserExecutable({
    access: async (candidate) => {
      attempted.push(candidate);
      if (candidate !== "/playwright/chromium") {
        throw new Error("missing");
      }
    },
    env: {},
    playwright: {
      chromium: {
        executablePath: () => "/playwright/chromium",
      },
    },
  });

  assert.equal(executable, "/playwright/chromium");
  assert.equal(attempted.at(-1), "/playwright/chromium");
});

test("findBrowserExecutable returns null when no candidates are accessible", async () => {
  const executable = await findBrowserExecutable({
    access: async () => {
      throw new Error("missing");
    },
    env: {},
    playwright: null,
  });

  assert.equal(executable, null);
});
