/*=============================================================================
NORMALIZATION OVERVIEW

These helpers are deliberately free of DOM and storage dependencies.
They normalize inconsistent recipe text into stable strings and canonical
ingredient labels used by structured grocery parsing and aggregation.

=============================================================================*/

/* ================================
NORMALIZATION HELPERS

Ingredient labels are still inconsistent across recipe sources. These helpers
exist to aggressively normalize input before aggregation.
  - Treat visually different but semantically identical inputs as equal
  - Preserve distinctions that affect shopping decisions
  - Avoid over-normalization that could merge distinct products
================================ */
function createCanonicalIngredient(base, display = base, extras = null) {
  return extras ? { base, display, ...extras } : { base, display };
}

function ruleMatches(raw, rule) {
  if (rule.match) return rule.match(raw);
  if (rule.pattern) return rule.pattern.test(raw);
  if (rule.includesAll) return rule.includesAll.every((term) => raw.includes(term));
  if (rule.includesAny) return rule.includesAny.some((term) => raw.includes(term));
  if (rule.includes) return raw.includes(rule.includes);
  return false;
}

function canonicalFromRule(rule) {
  return createCanonicalIngredient(rule.base, rule.display || rule.base, rule.extras);
}

function findCanonicalRule(raw, rules) {
  const rule = rules.find((candidate) => ruleMatches(raw, candidate));
  return rule ? canonicalFromRule(rule) : null;
}

const canonicalNoteTokens = [
  "divided",
  "for dredging",
  "for dusting",
  "plus more",
  "packed",
  "lightly packed",
  "sifted",
];

function extractNotesStrict(raw) {
  return canonicalNoteTokens.filter((note) => raw.includes(note));
}

const leadingIngredientRules = [
  {
    includesAny: ["dark or semi sweet chocolate", "dark or semi-sweet chocolate"],
    base: "chocolate",
    display: "Chocolate (dark OR semi-sweet)",
    extras: { notes: [] },
  },
  {
    includesAll: ["butter lettuce", "red leaf lettuce"],
    base: "butter lettuce or red leaf lettuce",
  },
  {
    includesAll: ["lard", "unsalted butter"],
    base: "lard or unsalted butter",
  },
];

const commodityIngredientRules = [
  { match: (raw) => raw.includes("all-purpose flour") || raw === "flour", base: "all-purpose flour" },
  { includes: "granulated sugar", base: "granulated sugar" },
  { includesAny: ["powdered sugar", "confectioners"], base: "powdered sugar" },
  { includes: "light brown sugar", base: "light brown sugar" },
  { includes: "dark brown sugar", base: "dark brown sugar" },
  { includes: "lemon zest", base: "lemon zest" },
  { includes: "lemon juice", base: "lemon juice" },
  { includes: "lemon", base: "lemon" },
  { includesAll: ["greek yogurt", "sour cream"], base: "greek yogurt or sour cream" },
  { includes: "greek yogurt", base: "greek yogurt" },
  { includes: "sweetened condensed milk", base: "sweetened condensed milk" },
  { includes: "evaporated milk", base: "evaporated milk" },
  { includes: "buttermilk", base: "buttermilk" },
  { includes: "coconut milk", base: "coconut milk" },
  { includes: "peanut butter", base: "peanut butter" },
  { includes: "almond butter", base: "almond butter" },
  { includes: "milk chocolate", base: "milk chocolate" },
  { includes: "unsalted butter", base: "unsalted butter" },
  { includes: "salted butter", base: "salted butter" },
  { includes: "butter", base: "butter" },
  { includes: "cream cheese", base: "cream cheese" },
  { includes: "whole milk", base: "whole milk" },
  { includes: "skim milk", base: "skim milk" },
  { includes: "2% milk", base: "2% milk" },
  { includes: "milk", base: "milk" },
  { pattern: /\begg\s+yolks?\b/, base: "egg yolk" },
  { pattern: /\begg\s+whites?\b/, base: "egg whites" },
  { pattern: /\beggs?\b/, base: "egg" },
  { includes: "sour cream", base: "sour cream" },
  { includes: "parmigiano reggiano", base: "parmigiano reggiano cheese" },
  { includesAny: ["parmesan", "parmigiano"], base: "parmesan cheese" },
  { includes: "heavy whipping cream", base: "heavy whipping cream" },
  { includes: "heavy cream", base: "heavy cream" },
  { includes: "cheddar", base: "cheddar cheese" },
  { includes: "flaky sea salt", base: "flaky sea salt" },
  { includes: "flaked sea salt", base: "flaked sea salt" },
  { includes: "flaky salt", base: "flaky salt" },
  { includes: "celery salt", base: "celery salt" },
  { includes: "sea salt", base: "sea salt" },
  { includes: "kosher salt", base: "kosher salt" },
  { includes: "salt", base: "salt" },
  { includes: "black pepper", base: "black pepper" },
  { pattern: /^(?:ground\s+)?pepper$/, base: "pepper" },
];

function isChocolateFamily(raw) {
  return [
    "chocolate chip",
    "chopped chocolate",
    "dark chocolate",
    "white chocolate",
    "semi-sweet chocolate",
    "semisweet chocolate",
  ].some((term) => raw.includes(term));
}

const ingredientRules = [
  { includesAll: ["granulated garlic", "garlic powder"], base: "granulated garlic or garlic powder" },
  { includes: "garlic powder", base: "garlic powder" },
  { includes: "onion powder", base: "onion powder" },
  { includes: "garlic", base: "garlic" },
  { includes: "yellow onion", base: "yellow onion" },
  { includes: "white onion", base: "white onion" },
  { includes: "roasted red peppers", base: "roasted red peppers" },
  { includes: "green bell pepper", base: "green bell pepper" },
  { includes: "red bell pepper", base: "red bell pepper" },
  { includes: "bell pepper", base: "bell pepper" },
  {
    includesAny: ["cabbage and carrot coleslaw mix", "coleslaw mix"],
    base: "plain shredded cabbage and carrot coleslaw mix",
  },
  { includes: "carrot", base: "carrot" },
  { includes: "celery seed", base: "celery seed" },
  { includes: "celery", base: "celery" },
  { includesAll: ["potato bun", "brioche bun"], base: "potato bun or brioche bun" },
  { includes: "potato bun", base: "potato bun" },
  { includes: "brioche bun", base: "brioche bun" },
  { includes: "mashed potatoes", base: "mashed potatoes" },
  { includes: "sweet potato", base: "sweet potato" },
  { includes: "yukon gold", base: "yukon gold potato", display: "Yukon gold potato" },
  { includes: "baby yellow", base: "baby yellow potato" },
  { includes: "potato", base: "potato" },
  {
    includesAll: ["chicken breast", "boneless skinless"],
    base: "boneless skinless chicken breast",
  },
  { includes: "chicken breast", base: "chicken breast" },
  { includes: "flank steak", base: "flank steak" },
  {
    includesAll: ["top sirloin steak", "strip steak", "flat iron steak"],
    base: "top sirloin steak, strip steak, or flat iron steak",
  },
  {
    includesAll: ["ribeye", "top sirloin", "skirt steak"],
    base: "boneless ribeye, top sirloin, or skirt steak",
  },
  { includes: "thick-cut ribeye steak", base: "thick-cut ribeye steak" },
  { includes: "ribeye", base: "ribeye steak" },
  { includes: "top sirloin", base: "top sirloin steak" },
  { includes: "new york strip", base: "new york strip steak", display: "New York strip steak" },
  { includes: "strip steak", base: "strip steak" },
  { includes: "flat iron steak", base: "flat iron steak" },
  { includes: "skirt steak", base: "skirt steak" },
  { includes: "80/20 ground beef", base: "80/20 ground beef" },
  { includes: "85/15 ground beef", base: "85/15 ground beef" },
  { includes: "lean ground beef", base: "lean ground beef" },
  { includes: "grass-fed ground beef", base: "grass-fed ground beef" },
  { includes: "ground beef", base: "ground beef" },
  { includes: "short rib", base: "beef short rib" },
  { includes: "beef tenderloin", base: "beef tenderloin" },
  { includes: "prime rib", base: "prime rib roast" },
  { includes: "crushed tomatoes", base: "crushed tomatoes" },
  { includes: "fire-roasted diced tomatoes", base: "fire-roasted diced tomatoes" },
  { includes: "diced tomatoes", base: "diced tomatoes" },
  { includes: "tomato sauce", base: "tomato sauce" },
  { includes: "tomato paste", base: "tomato paste" },
  { includes: "kidney beans", base: "kidney beans" },
  { includes: "pinto beans", base: "pinto beans" },
  { includes: "cream of chicken soup", base: "cream of chicken soup" },
  { includes: "puff pastry", base: "puff pastry dough" },
  { includesAll: ["vanilla bean paste", "extract"], base: "vanilla extract or paste" },
  { includes: "vanilla bean paste", base: "vanilla bean paste" },
  { includesAny: ["vanilla extract", "vanilla paste"], base: "vanilla extract or paste" },
  { includes: "egg yolk", base: "egg yolk" },
  { includes: "american cheese slice", base: "american cheese slice", display: "American cheese slice" },
  { includes: "american cheese", base: "american cheese", display: "American cheese" },
  { includes: "brown sugar", base: "brown sugar" },
  { includes: "maple syrup", base: "maple syrup" },
  { includes: "blueberries", base: "blueberries" },
  { includes: "raspberries", base: "raspberries" },
  { includes: "mixed berries", base: "mixed berries" },
  { includes: "berries", base: "berries" },
  { includes: "banana", base: "banana" },
  { includes: "walnut", base: "walnuts" },
  { includes: "pecan", base: "pecans" },
  { includes: "pistachio", base: "pistachios" },
  { includes: "nuts of choice", base: "nuts of choice" },
  { includesAny: ["pasta of choice", "pasta"], base: "pasta" },
  { includes: "low-sodium beef broth", base: "low-sodium beef broth" },
  { includes: "beef broth", base: "beef broth" },
  { includes: "low-sodium chicken broth", base: "low-sodium chicken broth" },
  { includes: "chicken broth", base: "chicken broth" },
  { includes: "cinnamon", base: "cinnamon" },
  { includes: "red pepper flakes", base: "red pepper flakes" },
  { includes: "peanut or vegetable oil", base: "peanut or vegetable oil" },
  { includes: "olive or avocado oil", base: "olive or avocado oil" },
  { includes: "pizza oil", base: "pizza oil or olive oil" },
  { includes: "oil of choice", base: "oil of choice" },
  { includes: "mayonnaise", base: "mayonnaise" },
  { includes: "yellow mustard seed", base: "yellow mustard seed" },
  { includes: "yellow mustard", base: "yellow mustard" },
  {
    includes: "louisiana-style cayenne hot sauce",
    base: "louisiana-style cayenne hot sauce",
    display: "Louisiana-style cayenne hot sauce",
  },
  {
    includes: "louisiana-style hot sauce",
    base: "louisiana-style hot sauce",
    display: "Louisiana-style hot sauce",
  },
  { includes: "hot sauce", base: "hot sauce" },
  { includes: "pizza sauce", base: "pizza sauce" },
  { includes: "cheese of choice", base: "cheese", display: "cheese" },
  { includes: "iceberg lettuce", base: "iceberg lettuce" },
  { includes: "red leaf lettuce", base: "red leaf lettuce" },
  { includes: "butter lettuce", base: "butter lettuce" },
  { includes: "lettuce", base: "lettuce" },
  { includes: "white chocolate", base: "white chocolate" },
  { includes: "dark chocolate", base: "dark chocolate" },
  { includes: "semisweet chocolate chips", base: "semisweet chocolate chips" },
  { includes: "semi-sweet chocolate chips", base: "semi-sweet chocolate chips" },
  { includes: "semi-sweet", base: "semi-sweet chocolate" },
  { includes: "semisweet", base: "semisweet chocolate" },
  { match: isChocolateFamily, base: "chocolate" },
  { includesAll: ["avocado oil", "coconut oil"], base: "avocado oil or coconut oil" },
  { includes: "avocado oil", base: "avocado oil" },
  { includesAll: ["olive oil", "extra-virgin"], base: "extra-virgin olive oil" },
  { includes: "olive oil", base: "olive oil" },
  { includes: "chipotle peppers in adobo", base: "chipotle peppers in adobo sauce" },
  { includes: "sun-dried tomatoes", base: "sun-dried tomatoes" },
  { includes: "broccoli", base: "broccoli" },
  { includes: "green onion", base: "green onion" },
  { includes: "onion", base: "onion" },
  { includes: "fresh ginger", base: "fresh ginger" },
  { includes: "ginger", base: "ginger" },
  { includes: "peach", base: "peach" },
  { includes: "graham cracker", base: "graham crackers" },
  { includes: "croissant", base: "croissants" },
  { includes: "refrigerated crescent rolls", base: "refrigerated crescent rolls" },
  { includes: "pineapple slices", base: "pineapple slices" },
  { includes: "maraschino cherries", base: "maraschino cherries" },
  { includes: "vanilla bean", base: "vanilla bean" },
  { includes: "basil pesto", base: "basil pesto" },
  { includes: "basil", base: "basil" },
  { includes: "sourdough discard", base: "sourdough discard" },
  { includes: "freeze-dried strawberries", base: "freeze-dried strawberries" },
  {
    includesAny: ["dill pickle chips", "hamburger dill pickle chips", "crinkle-cut dill pickles"],
    base: "dill pickle chips",
  },
  { includesAny: ["pickle chips", "pickles"], base: "pickles" },
  { includes: "bacon", base: "bacon" },
  { includes: "salami", base: "deli salami" },
  { includes: "pepperoni", base: "deli pepperoni" },
  { includes: "ice cream", base: "ice cream" },
  { includesAny: ["dried bay leaf", "dried bay leaves"], base: "dried bay leaf" },
  { includesAny: ["bay leaf", "bay leaves"], base: "bay leaf" },
  { includes: "italian parsley", base: "italian parsley" },
  { includes: "fresh parsley", base: "fresh parsley" },
  { includes: "parsley", base: "parsley" },
  { includes: "fresh rosemary", base: "fresh rosemary" },
  { match: (raw) => raw.includes("rosemary") && raw.includes("sprig"), base: "rosemary sprig" },
  { includes: "rosemary", base: "rosemary" },
  { includes: "fresh thyme", base: "fresh thyme" },
  { match: (raw) => raw.includes("thyme") && raw.includes("sprig"), base: "thyme sprig" },
  { includes: "thyme", base: "thyme" },
];

const unicodeFractionMap = {
  "\u00bc": "1/4",
  "\u00bd": "1/2",
  "\u00be": "3/4",
  "\u00c2\u00bc": "1/4",
  "\u00c2\u00bd": "1/2",
  "\u00c2\u00be": "3/4",
  "\u2150": "1/7",
  "\u2151": "1/9",
  "\u2152": "1/10",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u2155": "1/5",
  "\u2156": "2/5",
  "\u2157": "3/5",
  "\u2158": "4/5",
  "\u2159": "1/6",
  "\u215a": "5/6",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8",
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};
const unicodeFractionSymbols = Object.keys(unicodeFractionMap).sort((a, b) => b.length - a.length);

const unitAliases = new Map([
  ["tsp", "tsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["tbsp", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["oz", "oz"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["lb", "lb"],
  ["lbs", "lb"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["l", "l"],
  ["liter", "l"],
  ["liters", "l"],
  ["bag", "bag"],
  ["bags", "bag"],
  ["block", "block"],
  ["blocks", "block"],
  ["bottle", "bottle"],
  ["bottles", "bottle"],
  ["bunch", "bunch"],
  ["bunches", "bunch"],
  ["can", "can"],
  ["cans", "can"],
  ["clove", "clove"],
  ["cloves", "clove"],
  ["egg", "egg"],
  ["eggs", "egg"],
  ["egg white", "egg white"],
  ["egg whites", "egg white"],
  ["jar", "jar"],
  ["jars", "jar"],
  ["leaf", "leaf"],
  ["leaves", "leaf"],
  ["package", "package"],
  ["packages", "package"],
  ["pkg", "package"],
  ["pkgs", "package"],
  ["sheet", "sheet"],
  ["sheets", "sheet"],
  ["slice", "slice"],
  ["slices", "slice"],
  ["sprig", "sprig"],
  ["sprigs", "sprig"],
  ["stalk", "stalk"],
  ["stalks", "stalk"],
  ["stick", "stick"],
  ["sticks", "stick"],
  ["yolk", "yolk"],
  ["yolks", "yolk"],
]);

export function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnicodeFractions(text) {
  let result = String(text || "");
  unicodeFractionSymbols.forEach((symbol) => {
    result = result.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1 ${unicodeFractionMap[symbol]}`);
    result = result.replace(new RegExp(symbol, "g"), unicodeFractionMap[symbol]);
  });
  return result;
}

export function parseNumberToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const parts = trimmed.split("/");
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (!denominator) return null;
    return numerator / denominator;
  }

  return null;
}

export function parseQuantityRange(quantityText) {
  const cleaned = normalizeWhitespace(normalizeUnicodeFractions(quantityText || "").replace(/-\s*to\s+/gi, "-"));
  if (!cleaned) return null;

  const rangeMatch = cleaned.match(/^(.+?)(?:\s*(?:-|to)\s*)(.+)$/i);
  if (rangeMatch) {
    const left = parseQuantityRange(rangeMatch[1]);
    const right = parseQuantityRange(rangeMatch[2]);
    if (!left || !right) return null;
    return { min: left.min, max: right.max };
  }

  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const frac = parseNumberToken(mixedMatch[2]);
    if (frac === null) return null;
    const value = whole + frac;
    return { min: value, max: value };
  }

  const value = parseNumberToken(cleaned);
  if (value === null) return null;
  return { min: value, max: value };
}

export function normalizeUnit(unitRaw) {
  const unit = (unitRaw || "").toLowerCase().trim();

  if (!unit) return null;
  return unitAliases.get(unit) || unit;
}

export function removeParentheticalsAndTrailingNotes(nameText) {
  let name = String(nameText || "");

  // Preserve primary imperial weight inside parentheses, e.g. "(4-pound / 1.8 kg)"
  const weightMatch = name.match(/\(([^)]*?)(\d+(?:\.\d+)?)[\s-]*(pound|pounds|lb|lbs)[^)]*\)/i);
  let preservedWeight = "";
  if (weightMatch) {
    preservedWeight = ` ${weightMatch[2]} lb`;
  }

  name = name.replace(/\([^)]*\)/g, " ");

  // Remove slash-weight fragments like "/ 1.8 kg" or "/1.8kg"
  name = name.replace(/\/\s*\d+(?:\.\d+)?\s*(kg|g)\b/gi, " ");

  // Do NOT truncate at commas; commas often separate important words
  name = name.replace(/,/g, " ");

  return normalizeWhitespace(name + preservedWeight);
}

export function buildCanonicalIngredient(nameLower) {
  const raw = normalizeWhitespace(removeParentheticalsAndTrailingNotes(nameLower)).toLowerCase();
  if (!raw) return null;

  const leadingRule = findCanonicalRule(raw, leadingIngredientRules);
  if (leadingRule) return leadingRule;

  const commodity = findCanonicalRule(raw, commodityIngredientRules);
  if (commodity) {
    return {
      ...commodity,
      notes: extractNotesStrict(raw),
    };
  }

  return findCanonicalRule(raw, ingredientRules) || createCanonicalIngredient(raw);
}

export function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function repairTextEncoding(value) {
  if (typeof value !== "string") return value;

  const replacements = {
    "Â°F": "\u00b0F",
    "Â°C": "\u00b0C",
    "Â¼": "1/4",
    "Â½": "1/2",
    "Â¾": "3/4",
    "â€“": "-",
    "â€”": "-",
    "â€˜": "'",
    "â€™": "'",
    "â€œ": "\"",
    "â€": "\"",
    "Ã©": "\u00e9",
    "Ã¨": "\u00e8",
    "Ã¡": "\u00e1",
    "Ã¢": "\u00e2",
    "Ã±": "\u00f1",
    "Ã¼": "\u00fc",
    "Ã§": "\u00e7",
  };

  return Object.keys(replacements).reduce(
    (text, token) => text.replace(new RegExp(escapeRegex(token), "g"), replacements[token]),
    value
  );
}
