import "../tests/formatting.test.mjs";
import "../tests/grouping.test.mjs";
import "../tests/grocery_model.test.mjs";
import "../tests/ingredient_parser.test.mjs";
import "../tests/meal_plan_model.test.mjs";
import "../tests/recipe_data_quality.test.mjs";
import "../tests/recipe_filter.test.mjs";
import "../tests/recipe_quality_report.test.mjs";
import "../tests/recipes.test.mjs";
import "../tests/recipe_schema.test.mjs";
import "../tests/storage.test.mjs";

import { runRegisteredTests } from "../tests/test_helpers.mjs";

await runRegisteredTests();
