# Agent Notes

This project is a static recipe book app with no build step. Keep changes small, verify locally, and preserve the lightweight architecture.

## Recipe Naming

- Keep recipe titles and recipe ids literal and modest. Do not add hype words like "ultimate", "best", "perfect", "phenomenal", "maximum flavor", "restaurant-style", or "from scratch" to titles or ids unless the user explicitly asks for that exact wording.
- Use ids as simple slugs of the dish name, such as `chicken-fried-steak`. Let the ingredients, instructions, and results carry the quality.

## Recipe Data

- Edit recipe source files in `data/recipes/*.json`, one recipe object per file.
- Keep each source filename matched to its recipe id, such as `data/recipes/chicken-fried-steak.json` for `"id": "chicken-fried-steak"`.
- Do not hand-edit `data/recipes.json`; it is the generated runtime bundle. Run `npm run build:recipes` after recipe source changes.

## Cache Busting

- When changing JavaScript or CSS, bump the asset version in `index.html` before finishing:

```bash
npm run set-asset-version -- YYYYMMDD-N
```

- Use the current date and increment `N` if multiple app/CSS changes happen on the same day.
- Recipe-only changes in `data/recipes/*.json` and the generated `data/recipes.json` do not require an asset-version bump. Recipe data is fetched with a per-load cache-busting query string in `js/recipes.js`.
- If `index.html`, `js/app.js`, any imported JS module, or `css/styles.css` changes, assume the asset version should be bumped.

## Verification

- Run the full local check after code or data changes:

```bash
npm run verify
```

- Run the browser smoke test after user-facing UI, rendering, or browser-loading changes:

```bash
npm run smoke:browser
```

On Windows PowerShell, use `npm.cmd` if needed.
