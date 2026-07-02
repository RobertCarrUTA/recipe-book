import fs from "node:fs/promises";

export function getBrowserExecutableCandidates(playwright = null, env = process.env) {
  const candidates = [
    env && env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];

  if (playwright && playwright.chromium && typeof playwright.chromium.executablePath === "function") {
    candidates.push(playwright.chromium.executablePath());
  }

  return candidates
    .map((candidate) => String(candidate || "").trim())
    .filter(Boolean);
}

export async function findBrowserExecutable({
  access = fs.access,
  env = process.env,
  playwright = null,
} = {}) {
  for (const candidate of getBrowserExecutableCandidates(playwright, env)) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      // Try the next browser candidate.
    }
  }

  return null;
}
