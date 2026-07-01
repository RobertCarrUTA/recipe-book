const tests = [];

export function test(name, run) {
  if (!String(name || "").trim()) {
    throw new Error("Test name is required.");
  }
  if (typeof run !== "function") {
    throw new Error(`Test "${name}" must register a function.`);
  }

  tests.push({ name, run });
}

export async function runRegisteredTests() {
  if (!tests.length) {
    throw new Error("No tests were registered.");
  }

  const duplicateNames = tests
    .map((item) => item.name)
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicateNames.length) {
    throw new Error(`Duplicate test names: ${Array.from(new Set(duplicateNames)).join(", ")}`);
  }

  const failures = [];

  for (const item of tests) {
    try {
      await item.run();
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failures.push({ error, name: item.name });
      console.error(`not ok - ${item.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failures.length) {
    throw new Error(`${failures.length} test${failures.length === 1 ? "" : "s"} failed.`);
  }

  console.log(`Passed ${tests.length} tests.`);
}
