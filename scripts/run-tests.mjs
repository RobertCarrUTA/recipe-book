import "../tests/formatting.test.mjs";
import "../tests/grocery_model.test.mjs";
import "../tests/ingredient_parser.test.mjs";
import "../tests/recipe_filter.test.mjs";
import "../tests/recipe_schema.test.mjs";
import "../tests/storage.test.mjs";

import { runRegisteredTests } from "../tests/test_helpers.mjs";

await runRegisteredTests();
