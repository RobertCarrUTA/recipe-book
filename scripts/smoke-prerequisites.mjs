const allowSmokeSkipEnvKey = "RECIPE_BOOK_ALLOW_SMOKE_SKIP";

function normalizeReason(reason) {
  return String(reason || "a required browser smoke test prerequisite is missing.").trim();
}

export function shouldAllowSmokeSkip(env = process.env) {
  return env && env[allowSmokeSkipEnvKey] === "1";
}

export function getSmokePrerequisiteFailure(reason, env = process.env) {
  const normalizedReason = normalizeReason(reason);

  if (shouldAllowSmokeSkip(env)) {
    return {
      message: `Skipping browser smoke test: ${normalizedReason}`,
      shouldSkip: true,
    };
  }

  return {
    message: [
      `Browser smoke test cannot run: ${normalizedReason}`,
      "Install Playwright and Chrome/Edge, set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a Chromium-based browser,",
      `or set ${allowSmokeSkipEnvKey}=1 only when browser smoke testing is intentionally unavailable.`,
    ].join("\n"),
    shouldSkip: false,
  };
}

export function resolveSmokePrerequisiteFailure(reason, env = process.env) {
  const failure = getSmokePrerequisiteFailure(reason, env);

  if (!failure.shouldSkip) {
    throw new Error(failure.message);
  }

  return failure;
}
