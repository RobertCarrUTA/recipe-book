# Recipe Schema

Recipe sources are authored as individual JSON objects in `data/recipes/`. The browser loads the generated array in `data/recipes.json` and normalizes every record before use.

## Source and Generated Files

For a recipe with ID `vegetable-soup`, the authoritative file is:

```text
data/recipes/vegetable-soup.json
```

The source filename must equal `<id>.json`. IDs use lowercase letters and numbers separated by single hyphens.

Keep IDs and titles literal and modest. Let the ingredients, method, notes, and result communicate quality; follow the full [recipe naming rules](../CONTRIBUTING.md#naming).

Do not edit `data/recipes.json` directly. Rebuild it after every source change:

```bash
npm run build:recipes
```

The build enforces a recipe object, a simple slug ID, filename agreement, unique IDs, and at least one known, non-duplicate collection. Runtime normalization remains defensive, but its fallbacks are not a substitute for complete source data.

## Complete Example

Use this as a shape reference and remove optional fields that do not apply:

```json
{
  "id": "vegetable-soup",
  "collections": ["main-dishes", "soups-stews"],
  "title": "Vegetable Soup",
  "author": "Robert Carr",
  "description": "A broth-based soup with potatoes, carrots, and green beans.",
  "prepTime": "20 minutes",
  "cookTime": "45 minutes",
  "totalTime": "1 hour 5 minutes",
  "servings": "6",
  "rating": {
    "value": 4.8,
    "count": 12
  },
  "tags": {
    "status": "tried",
    "rating": "great",
    "difficulty": "easy",
    "equipment": ["dutch-oven", "stovetop"]
  },
  "equipment": ["Dutch oven", "Chef's knife", "Cutting board"],
  "ingredients": [
    "2 tablespoons olive oil",
    "2 to 3 carrots, sliced",
    "4 cups vegetable broth"
  ],
  "groceryIngredients": [
    { "item": "olive oil", "quantity": 2, "unit": "tbsp" },
    { "item": "carrot", "quantity": { "min": 2, "max": 3 }, "unit": "item" },
    { "item": "vegetable broth", "quantity": 4, "unit": "cup" }
  ],
  "instructions": [
    "Heat the oil in a Dutch oven over medium heat.",
    "Add the vegetables and cook until they begin to soften.",
    "Add the broth and simmer until the vegetables are tender."
  ],
  "notes": ["Cool leftovers before refrigerating."],
  "personalNotes": [],
  "nutrition": {},
  "link": null
}
```

Keep `ingredients` readable for cooking and `groceryIngredients` structured for shopping math. The grocery list is built from the structured entries; display ingredient text is not parsed as a fallback.

## Top-Level Fields

Treat `id`, `collections`, `title`, `ingredients`, `groceryIngredients`, and `instructions` as the minimum authored recipe. Add `author` and `link` whenever attribution applies. The remaining metadata is optional, but consistent times, servings, equipment, and tags improve discovery and display.

| Field | Shape | Contract |
| --- | --- | --- |
| `id` | string | Stable unique slug; must match the filename. |
| `collections` | string[] | One or more controlled collection IDs with no duplicates. |
| `title` | string | Literal recipe name. |
| `author` | string | Recipe author or project author attribution. |
| `description` | string | Short summary; avoid repeating the full method. |
| `category` | string | Optional source category or descriptive category. |
| `prepTime` | string | Human-readable preparation duration. |
| `cookTime` | string | Human-readable cooking duration. |
| `additionalTime` | string | Optional rest, chill, proof, or other elapsed time. |
| `totalTime` | string | Human-readable total; used by fastest sorting when parseable. |
| `servings` | string | Serving count or description. |
| `yield` | string | Optional output when it differs from servings. |
| `rating` | object | Optional external numeric/text value and review count; see below. |
| `tags` | object | App-owned status, qualitative rating, difficulty, and equipment facets. |
| `equipment` | string[] | Human-readable equipment shown and searched with the recipe. |
| `ingredients` | string[] | Ordered display lines for recipe and Cooking Mode. |
| `groceryIngredients` | object[] | Structured shopping records used for all grocery totals. |
| `instructions` | string[] | Ordered cooking steps; keep each step actionable. |
| `notes` | string[] | General recipe notes. |
| `personalNotes` | string[] | Project-authored observations or adjustments. |
| `nutrition` | object | Optional label-to-text record such as calories or protein. |
| `link` | string or null | Original `http` or `https` source URL when applicable. |

Unknown fields are not a safe extension point: runtime normalization may discard them. Some existing source files contain a legacy `source` field, but the runtime recipe schema does not preserve it. Do not use `source` for attribution or new behavior; use `author` and `link` until a dedicated provenance contract is introduced.

## Collections

The controlled catalog is defined in `js/recipe_collections.js`. Current IDs are:

```text
breakfast        main-dishes      pizza             sandwiches
burgers          steak            soups-stews       sides-snacks
salsas-sauces    baking           cookies           desserts
drinks
```

Collections may overlap. A steak sandwich can belong to `main-dishes`, `sandwiches`, and `steak`; a cookie can belong to `baking`, `cookies`, and `desserts`. Use `baking` for baked recipes and oven projects rather than automatically assigning it to every dessert.

Adding a collection changes JavaScript as well as recipe data: update the catalog, assign recipes, bump the asset version, rebuild the bundle, and run the full verification gate.

## Tags and Ratings

`tags` contains controlled app facets:

| Tag | Allowed values |
| --- | --- |
| `status` | `tried`, `not-tried` |
| `rating` | `great`, `good`, `okay` |
| `difficulty` | `easy`, `medium`, `hard` |
| `equipment` | Array of equipment facets; values normalize to lowercase slugs. |

`status` defaults to `not-tried` at runtime. Invalid qualitative ratings and difficulties are omitted during normalization, so source values must use the listed spellings.

Top-level `rating` is different from `tags.rating`:

```json
{
  "rating": { "value": 4.8, "count": 120 },
  "tags": { "rating": "great" }
}
```

- `rating.value` and `rating.count` describe an external or numeric rating displayed with the recipe and used for sorting.
- `tags.rating` is the project's qualitative filter value.

Use top-level `equipment` for readable detail. Use `tags.equipment` for broad, stable discovery facets such as `dutch-oven`, `instant-pot`, `air-fryer`, or `pizza-steel`.

## Structured Grocery Ingredients

Every entry should use `item` as the canonical shopping label:

```json
{
  "item": "crushed tomatoes",
  "quantity": 1,
  "unit": "can",
  "note": "28 oz can"
}
```

### Grocery Fields

| Field | Shape | Meaning |
| --- | --- | --- |
| `item` | string | Required specific shopping identity used for normalization and aggregation. |
| `quantity` | number, string, or range | Amount used in grocery math. |
| `unit` | string | Unit normalized before aggregation. |
| `display` | string | Optional shopper-facing label override; does not replace `item` identity. |
| `note` | string | One concise shopping note. |
| `notes` | string[] | Multiple notes; use instead of, not together with, `note`. |
| `optional` | boolean | Marks an ingredient optional. |
| `marker` | string | Non-quantity marker when an exact amount is unavailable. |
| `original` | string | Optional original source wording retained for detail. |

The parser accepts compatibility aliases such as `name`, `amount`, and `units`, but new source data should use the canonical field names in the table.

### Quantities

Use a number for an exact amount:

```json
{ "item": "garlic", "quantity": 3, "unit": "clove" }
```

Use `{ "min": ..., "max": ... }` for a range:

```json
{ "item": "lime", "quantity": { "min": 2, "max": 3 }, "unit": "item" }
```

Strings can express parser-supported fractions or ranges, but numeric values and numeric range objects are easier to validate and scale. Keep both range endpoints finite, non-negative, and ordered from minimum to maximum.

Omit `quantity` only when the source genuinely gives no useful shopping amount. Add a short `marker` or `note` when it explains what to buy.

### Units

Preferred normalized units include:

```text
tsp  tbsp  cup  oz  lb  g  kg  ml  l
bag  block bottle bunch can clove egg egg white jar leaf
package sheet slice sprig stalk stick yolk item
```

Use `item` for a count that has no more specific unit. Put package size in `note`, not in `unit`: use `"unit": "can", "note": "15 oz can"` rather than `"unit": "15-ounce can"`.

Unknown units remain separate totals and cannot combine with known compatible units. Review every unknown-unit report entry to decide whether it needs an alias, a standard count unit, or a note.

### Shopping Identity

Preserve distinctions that affect what someone buys:

- `fire-roasted diced tomatoes` is not generic `diced tomatoes`;
- `chipotle peppers in adobo sauce` is not generic peppers;
- `boneless skinless chicken breast` is more useful than chicken;
- prepared mashed potatoes should not collapse into raw potatoes.

Avoid preparation-only noise in `item` when it does not change the product. Put useful size, preparation, substitution, or optional information in a note.

## Attribution and Content Rights

Set `author` accurately and include `link` for an external source whenever available. Project-authored adaptations should not imply that third-party text or media is relicensed by this repository.

Before adding external material:

1. confirm the project has the right to store and share it;
2. write instructions and notes in your own original wording when required;
3. preserve the author and direct source URL;
4. do not add external photos or other assets without permission;
5. follow the terms in [LICENSE.md](../LICENSE.md).

## Validation and Quality Workflow

After a recipe change:

```bash
npm run build:recipes
npm run report:data-quality
npm run verify
```

The data report covers schema warnings, structured grocery coverage, source links, metadata, parse failures, unknown units, amountless entries, grouping, and near-duplicate labels. It is advisory, so a successful exit does not mean every warning should be ignored.

When an intentional label or unit change alters the normalization catalog, run:

```bash
npm run update:normalization-snapshot
```

Review that diff for unintended canonical-label or unit changes, then run `npm run verify` again. The complete review sequence is in [Contributing](../CONTRIBUTING.md#normalization-snapshot).
