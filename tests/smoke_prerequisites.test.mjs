import assert from "node:assert/strict";

import {
  getSmokePrerequisiteFailure,
  resolveSmokePrerequisiteFailure,
  shouldAllowSmokeSkip,
} from "../scripts/smoke-prerequisites.mjs";
import { test } from "./test_helpers.mjs";

test("browser smoke prerequisites fail closed by default", () => {
  assert.equal(shouldAllowSmokeSkip({}), false);

  const failure = getSmokePrerequisiteFailure("Playwright is not available.", {});
  assert.equal(failure.shouldSkip, false);
  assert.match(failure.message, /^Browser smoke test cannot run: Playwright is not available\./);
  assert.match(failure.message, /RECIPE_BOOK_ALLOW_SMOKE_SKIP=1/);

  assert.throws(
    () => resolveSmokePrerequisiteFailure("Playwright is not available.", {}),
    /Browser smoke test cannot run: Playwright is not available\./
  );
});

test("browser smoke prerequisites only skip with the explicit opt-in flag", () => {
  assert.equal(shouldAllowSmokeSkip({ RECIPE_BOOK_ALLOW_SMOKE_SKIP: "true" }), false);

  assert.throws(
    () => resolveSmokePrerequisiteFailure("no Chrome or Edge executable was found.", {
      RECIPE_BOOK_ALLOW_SMOKE_SKIP: "true",
    }),
    /Browser smoke test cannot run: no Chrome or Edge executable was found\./
  );

  const failure = resolveSmokePrerequisiteFailure("no Chrome or Edge executable was found.", {
    RECIPE_BOOK_ALLOW_SMOKE_SKIP: "1",
  });
  assert.deepEqual(failure, {
    message: "Skipping browser smoke test: no Chrome or Edge executable was found.",
    shouldSkip: true,
  });
});
