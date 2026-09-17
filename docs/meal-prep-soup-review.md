# Meal-prep soup review

Issue: [#158](https://github.com/RobertCarrUTA/recipe-book/issues/158)  
Pull request: [#159](https://github.com/RobertCarrUTA/recipe-book/pull/159)  
Review date: September 16, 2026 (America/Chicago)

These are five original recipe-book adaptations of the researched soup concepts. The proposed tofu soup uses chicken instead. Every recipe makes six substantial portions and remains `not-tried` with `rating: null`: written development and review are not kitchen tasting or freezer-texture testing.

## Recipe decisions

| Recipe | Flavor and substance | Estimated total time |
| --- | --- | --- |
| Lemon-Rosemary Chicken, White Bean and Kale Soup | Browned chicken, three cans of white beans, crushed rosemary, cooked tomato paste, measured Parmesan, lemon and parsley. One bean can is mashed for body rather than adding cream. | 1 hour 15 minutes |
| Beef, Mushroom and Barley Soup | 95% lean ground beef, browned cremini, filtered porcini liquid, chewy pearl barley, thyme and a small miso-balsamic finish. Ground beef avoids relying on a short simmer to tenderize steak or stew meat. | 1 hour 45 minutes |
| Harissa Red Lentil, Sweet Potato and Chickpea Soup | 300 g dry split red lentils, two chickpea cans, vegetables, bloomed harissa/spices and lemon-tahini. The lentils start first so the sweet potato has less time to break down. | 1 hour 15 minutes |
| Roasted Tomatillo Chicken Pozole Verde | Roasted vegetables, toasted pepitas, cooked-down green puree, lean chicken and hominy. Lime is restrained because tomatillos already contribute acidity. | 1 hour 25 minutes |
| Thai Red Curry Chicken, Edamame and Vegetable Soup | Browned chicken and mushrooms, edamame, bloomed curry paste, one can of light coconut milk, lime and herbs. The broth quantity is kept focused rather than diluting the curry into a large watery batch. | 1 hour 10 minutes |

Times include preparation, cooking and the stated final rest. They are planning estimates, not kitchen-timed promises. Thermometer readings and tenderness checks take precedence over the clock. Portion by dividing the finished batch into six equal servings; no unmeasured finished-cup yield or optional side is included in that definition.

## Two post-PR reviews

### First review: flavor and texture

[Review submission](https://github.com/RobertCarrUTA/recipe-book/pull/159#pullrequestreview-5230237356), anchored to `f45114b9f6a513fb8a7a6735fc1ca377b1ef9d83`.

Reviewed all five recipes for browning, aromatic/paste cooking, broth-to-solid balance, finishing acid, protein texture and reheating. There was no sound reason to raise salt, cheese, coconut milk or oil across the recipes simply to claim a stronger flavor.

Two refinements were committed: give the red lentils an eight-minute head start before the sweet potato, and explicitly blend the pozole puree in two batches with measured seed, cilantro and broth quantities. The ingredient totals did not change.

### Second review: quantities, execution, health and shopping

[Review submission](https://github.com/RobertCarrUTA/recipe-book/pull/159#pullrequestreview-5230260379), anchored to `7f10e445d030305e6bd8f738a2b22cd02e548d7c`.

Reconciled ingredients, structured groceries and instruction steps after the first review. Final corrections give kale a three-minute head start before the chicken returns, repeat bean-can counts where used, specify chicken-cutlet thickness in the pozole step itself, distinguish the sweet potato's whole purchase weight from its peeled cooking weight, and allow realistic cooking time for the longer sequences. Recipe notes now describe cooking rather than the drafting process.

The same review exposed an actual grocery-normalization defect: no-salt-added canned foods were becoming the canonical item `salt`. Light coconut milk, 95% lean beef, fine sea salt and some herb distinctions were also lost. Specific existing normalization rules now run before those generic fallbacks. The fix covers the no-salt-added canned labels already in the catalog without changing existing recipe contents. A generic structured-grocery parser regression verifies identity, quantities, units and notes; ordinary salt, coconut milk and basil remain separate ordinary items.

## Split-quantity ledger

| Recipe | Reconciled quantities |
| --- | --- |
| Lemon chicken | Oil: 2 + 2 + 2 tsp = 2 tbsp. Salt: 1/4 + 1/4 + 1/4 tsp = 3/4 tsp. Pepper: 1/4 + 1/4 tsp = 1/2 tsp. Beans: one mashed can plus two whole cans, approximately 240 + 480 g drained. |
| Beef | Oil: 2 + 2 + 2 tsp = 2 tbsp. Salt: 1/4 + 1/4 tsp = 1/2 tsp. Liquid: 6 cups broth plus 2 cups filtered porcini liquid. The 1/2 cup taken out to dissolve miso is returned, not counted as extra broth. |
| Harissa | Salt: 1/4 + 1/4 tsp = 1/2 tsp. Lentils: 300 g dry. Chickpeas: both cans, approximately 480 g drained. The tahini-whisking liquid is taken from the pot. Buy about 1 1/4 lb whole sweet potato to supply the 1 lb peeled recipe amount. |
| Pozole | Broth: 1/2 + 1/2 cup for blending, plus 5 cups in the pot = 6 cups. Pepitas: 1/4 + 1/4 cup = 1/2 cup. Cilantro: 1/4 + 1/4 + 1/2 cup = 1 cup. |
| Thai curry | Oil: 1 + 1 + 2 + 2 tsp = 2 tbsp. Coconut milk: 120 + 280 mL = 400 mL. Scallions: 30 + 30 g = 60 g. Curry paste and soy sauce are each added once, with no separate salt. |

Prepared mixtures may be returned as a complete batch, but newly added ingredients have their quantities at point of use. Tap water for soaking/thinning/reheating is specified where needed and is not a grocery purchase. Can weights distinguish net package weight from approximate drained contents; small can-yield differences do not require discarding edible beans.

## Health and food-safety basis

The editorial health-conscious designation reflects vegetables, legumes, lean/unbrined proteins, measured fats and attention to packaged-ingredient sodium. It is not a low-sodium certification or a promise that one meal treats high blood pressure. Pearl barley is not described as a whole grain, rinsed hominy is not treated as sodium-free, and light coconut milk is not treated as saturated-fat-free.

Nutrition remains `null`. The original proposal's numerical estimates were not reused after changing proteins, portions, broth and other ingredients. A complete ingredient-by-ingredient calculation with final product labels would be needed before publishing numerical nutrition. No issue-specific nutrition fixture was added.

Each recipe includes prompt shallow-container cooling, refrigeration at 40 F (4 C) or below, a 3-4 day refrigerated limit, freezing later portions on prep day, refrigerator thawing and reheating to 165 F (74 C). Soup reheating includes a brief rolling boil rather than prolonged boiling of already cooked chicken. The three-month freezer target is a quality-planning guideline, not a tested texture guarantee. Allergens are called out, including soy in the chicken-and-edamame curry and possible fish/shellfish in packaged condiments.

Primary references checked during development:

- [USDA: leftovers and food safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety) for cooling, storage, thawing and reheating.
- [USDA: food-safety basics](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe) for poultry, ground-beef and leftover temperatures and room-temperature limits.
- [NHLBI: DASH eating plan](https://www.nhlbi.nih.gov/health/dash-eating-plan) and [heart-healthy food choices](https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-foods) for the overall ingredient-selection principles, not certification of these recipes.
- [Thai Kitchen: red curry paste](https://www.clubhouse.ca/en-ca/thai-kitchen/products/pastes-dips-and-sauces/red-curry-paste) illustrates why paste serving size, sodium and allergens must be checked on the actual package; markets and formulations differ.
- [Goya: white hominy](https://shop.goya.com/products/white-hominy) for the canned product's sodium-bearing ingredients and label context. No fixed sodium reduction from rinsing is assumed.
- [Rick Bayless: chicken in green pumpkin-seed sauce](https://www.rickbayless.com/recipe/chicken-in-easy-green-pumpkin-seed-sauce/) as a primary technique reference for toasted seeds, green puree, careful blending and cooking the puree before dilution; the soup instructions here are independently written.

## Repository verification

Ran the existing recipe build, normalization snapshot update, data-quality report, core verification and browser smoke suite. After the shopping-label correction: **232 tests passed; 128 recipes and 388 grocery keys verified with 0 data warnings; 22 browser checks passed.**

All 123 pre-existing recipe objects remain unchanged. The five new recipes alone gain the additional editorial membership. The existing normalization snapshot is updated for intentional catalog additions and label corrections. Temporary branch execution helpers are removed from the completed PR; there is no permanent soup-specific workflow, nutrition fixture or prose-matching test.
