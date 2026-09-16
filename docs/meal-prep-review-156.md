# Meal-prep recipe review: issue 156

These five original recipes were developed for this collection and reviewed twice as written recipes. They have not been kitchen-tested, tasted, or assigned a score. Preparation times are practical estimates with the stated trimmed produce, thawed protein, quick-cooking grains, pan sizes and parallel workflow; they are not stopwatch results. Cooling to refrigerator temperature is not an additional counter-rest instruction.

## Complete-meal planning estimates

All sauces, cooking oil and listed base toppings are included. Values are rounded; they are not nutritional certifications or guaranteed sodium limits.

| Recipe | Base servings | Estimated total | kcal | Protein | Carbohydrate | Fat | Fiber | Saturated fat | Sodium |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Zaatar-Pistachio Salmon with Lemon-Dill Barley | 4 | 50 min | 680 | 46 g | 51 g | 35 g | 12 g | 7 g | 450 mg |
| Berbere Turkey-Lentil Braise | 4 | 55 min | 600 | 52 g | 62 g | 20 g | 21 g | 5 g | 575 mg |
| Ginger-Sesame Chicken and Soba | 4 | 55 min | 670 | 58 g | 69 g | 19 g | 10 g | 3 g | 600 mg |
| Citrus-Mojo Pork with Black-Bean Quinoa | 6 | 55 min | 710 | 51 g | 74 g | 26 g | 18 g | 5 g | 375 mg |
| Chermoula Chickpea-Cauliflower Farro Bowls | 5 | 55 min | 580 | 24 g | 85 g | 21 g | 21 g | 2.5 g | 350 mg |

The batches make **23 meals**, not 25. Six pork portions or five farro portions do not justify six or five refrigerator days. The recipes explicitly freeze excess portions on prep day and keep refrigerated components within 3-4 days.

## Calculation method and limits

The complete numerical inputs are in [the nutrition fixture](../tests/fixtures/meal_prep_156_nutrition.json). Each profile records nutrients per 100 g, its source and any explicit proxy. Each recipe lists full-batch edible grams, serving count, calculated values and rounded display values. The scoped tests recompute those sums and require a nutrition review when the displayed base ingredient list changes.

For each nutrient, sum `(ingredient grams / 100) * nutrient per 100 g`, then divide by base servings. Raw fish/meat weights are paired with raw profiles; grain weights are dry; legumes use approximately 500 g drained cooked contents for two 15-ounce cans. All measured cooking fat, sauce and toppings are counted even though some may remain on pans or bowls. Water has no meaningful energy contribution. Teaspoon oil is modeled as 4.5 g; tablespoon oil as 13.5 g. Fine salt is weighed, not assumed interchangeable with coarse kosher salt. Citrus juice is approximated at 1 g/mL and minor herb/spice spoon weights are disclosed in the fixture.

Energy comes from the source profiles rather than forcing a 4/4/9 result from rounded macros. Fiber, food-specific factors and label rounding can make those calculations differ. Display rounding is to 10 kcal, 1 g for protein/carbohydrate/fat/fiber, 0.5 g saturated fat and 25 mg sodium. Rounding does not remove source uncertainty. Cooking losses, brand changes, fish species and actual drained yields matter; portion alternatives have different nutrition. No micronutrient totals are asserted from incomplete records.

The baseline data are [USDA FoodData Central SR Legacy, final 2018 release](https://fdc.nal.usda.gov/download-datasets/), not a claim of a new 2026 nutrient survey. Specific FoodData Central IDs are preserved in every USDA profile. No-salt-added canned legumes use unsalted cooked proxies. Small spice blends, orange zest, jalapeno and unseasoned rice vinegar have clearly marked composition proxies; these are calculation assumptions, not recipe substitutions. Missing trace saturated-fat values for mushrooms/dates are explicitly handled rather than presented as measured values.

Representative labels reviewed on September 15, 2026:

- [FAGE Total 2%](https://usa.fage/products/yogurt/fage-total-2) for Greek yogurt and [Perdue Harvestland plain chicken breast](https://www.perduefarms.com/en-US/perdue-harvestland-organic-boneless-skinless-chicken-breasts-pack/70622.html) for raw chicken.
- [Hakubaku](https://hakubaku.com.au/product/soba/): the **US/Canada no-salt** product, not the salt-containing AU/EU formulations. A shared brand name does not establish identical nutrition.
- [Roland pearled farro](https://rolandfoods.com/product/72140-pearled-italian-farro): composition proxy for quick-cooking pearled farro, not proof this product cooks in 10 minutes. Quick barley uses the [Quaker package-label transcription](https://www.directionsforme.org/product/38456), not the higher-fiber regular-barley entry.
- [Hunt's no-salt-added tomato paste label](https://www.directionsforme.org/product/32542) and [crushed-tomato label](https://shop.lowesfoods.com/products/hunts-crushed-tomatoes-no-salt-added/12519). The crushed-tomato model retains the USDA macro profile but explicitly changes sodium to the no-salt-added label basis.

Miso/tamari/Dijon sodium is modeled at the recipe's purchasing ceilings (650 mg per tablespoon miso, 700 mg per tablespoon reduced-sodium tamari, 120 mg per teaspoon Dijon), not silently set to zero. Their macro profiles are disclosed generic proxies. Salmon uses raw farmed Atlantic composition, so its 7 g saturated-fat estimate must not be hidden by calling every component low-fat. The editorial label assesses the whole meal and does not certify a saturated-fat or sodium threshold.

## Review 1: flavor and texture

Salmon received a thin measured Dijon binder and additional zest to carry the zaatar; no extra salt was added. Turkey's tomato paste cooks before the ground spices, followed by brief blooming and a measured vinegar finish. The chicken meal finishes in a 6-quart pot rather than an overloaded searing skillet, with lime and sesame oil off heat. Pork salsa onion softens in its measured lime juice, orange zest seasons the meat, and the sliced pork is sauced in a wide bowl. The kale is briefly steamed with measured water instead of depending on farro that may already have cooled. Cold sauces and crunchy toppings remain separate.

## Review 2: accuracy and practical execution

Nutrition was recalculated after replacing tofu and making flavor changes. Chicken noodle water heats from the start while edamame cooks in a separate small saucepan; this avoids two sequential water-heating cycles. Sesame/scallion amounts now portion exactly to 3 g and 6 g per meal. Mustard is included in the salmon allergen note. The initial 180 g salsa portion was corrected in the third review to approximately 163 g per serving, based on about 976 g for six servings. The hot-berbere variation supplies the actual total paprika measurement instead of requiring addition while cooking. An explicit grocery-group rule keeps red wine vinegar out of the Wine category without changing red wine's grouping.

Ingredient introductions, split oil/salt, sauce yields, raw/cooked weights, safe endpoints, time dependencies and shopping entries were manually reviewed. Targeted tests guard known regressions but do not claim to mechanically prove that every culinary instruction is correct. All five remain `not-tried` with `rating: null`.

## Eating-pattern and food-safety basis

[NIH DASH](https://www.nhlbi.nih.gov/health/dash-eating-plan) informs the use of produce, legumes, lean proteins/fish and measured fats/salt. No individual recipe promises lower blood pressure, fat loss or muscle gain. The smaller/larger portions are options, not personalized calorie prescriptions. Quick pearled barley/farro and wheat-buckwheat soba are not automatically whole grains.

[USDA food-safety guidance](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe) supports prompt shallow-container cooling, refrigeration at 40 F or below, a 3-4-day leftover window and reheating to 165 F. Initial poultry cooking reaches 165 F; pork reaches 145 F plus at least a 3-minute rest. [FDA seafood guidance](https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-fresh-and-frozen-seafood-safely) supports mild-smelling fresh fish, safe thawing and cooking fish to 145 F. Lemon and herbs are flavor choices, not a way to salvage spoiled fish. Properly chilled cooked salmon can be served cold; reheating safely may produce a firmer texture.
