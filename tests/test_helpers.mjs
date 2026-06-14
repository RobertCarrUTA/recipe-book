const tests = [];

export function test(name, run) {
  tests.push({ name, run });
}

export async function runRegisteredTests() {
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
