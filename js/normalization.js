/*=============================================================================
NORMALIZATION OVERVIEW

These helpers are deliberately free of DOM and storage dependencies.
They normalize inconsistent recipe text into stable strings and canonical
ingredient labels used by structured grocery parsing and aggregation.

=============================================================================*/

// ===== Commodity helpers (single source of truth) =====
function extractCommodityBaseStrict(raw) {
  const name = raw.toLowerCase();

  if (name.includes("all-purpose flour") || name === "flour") return "all-purpose flour";
  if (name.includes("granulated sugar")) return "granulated sugar";
  if (name.includes("powdered sugar") || name.includes("confectioners")) return "powdered sugar";
  if (name.includes("light brown sugar")) return "light brown sugar";
  if (name.includes("dark brown sugar")) return "dark brown sugar";

  if (name.includes("lemon zest")) return "lemon zest";
  if (name.includes("lemon juice")) return "lemon juice";
  if (name.includes("lemon")) return "lemon";

  if (name.includes("greek yogurt") && name.includes("sour cream")) return "greek yogurt or sour cream";
  if (name.includes("greek yogurt")) return "greek yogurt";

  if (name.includes("sweetened condensed milk")) return "sweetened condensed milk";
  if (name.includes("evaporated milk")) return "evaporated milk";
  if (name.includes("buttermilk")) return "buttermilk";
  if (name.includes("coconut milk")) return "coconut milk";

  if (name.includes("peanut butter")) return "peanut butter";
  if (name.includes("almond butter")) return "almond butter";

  if (name.includes("milk chocolate")) return "milk chocolate";

  if (name.includes("unsalted butter")) return "unsalted butter";
  if (name.includes("salted butter")) return "salted butter";
  if (name.includes("butter")) return "butter";

  if (name.includes("cream cheese")) return "cream cheese";

  if (name.includes("whole milk")) return "whole milk";
  if (name.includes("skim milk")) return "skim milk";
  if (name.includes("2% milk")) return "2% milk";
  if (name.includes("milk")) return "milk";

  if (/\begg\s+yolks?\b/.test(name)) return "egg yolk";
  if (/\begg\s+whites?\b/.test(name)) return "egg whites";
  if (/\beggs?\b/.test(name)) return "egg";

  if (name.includes("sour cream")) return "sour cream";

  if (name.includes("parmigiano reggiano")) return "parmigiano reggiano cheese";
  if (name.includes("parmesan") || name.includes("parmigiano")) return "parmesan cheese";

  if (name.includes("heavy whipping cream")) return "heavy whipping cream";
  if (name.includes("heavy cream")) return "heavy cream";

  if (name.includes("cheddar")) return "cheddar cheese";

  if (name.includes("flaky sea salt")) return "flaky sea salt";
  if (name.includes("flaked sea salt")) return "flaked sea salt";
  if (name.includes("flaky salt")) return "flaky salt";
  if (name.includes("sea salt")) return "sea salt";
  if (name.includes("kosher salt")) return "kosher salt";
  if (name.includes("salt")) return "salt";
  if (name.includes("black pepper")) return "black pepper";
  if (/^(?:ground\s+)?pepper$/.test(name)) return "pepper";

  return null;
}

function extractNotesStrict(raw) {
  const notes = [];
  ["divided", "for dredging", "for dusting", "plus more", "packed", "lightly packed", "sifted"].forEach((k) => {
    if (raw.includes(k)) notes.push(k);
  });
  return notes;
}

/* ================================
NORMALIZATION HELPERS

Ingredient labels are still inconsistent across recipe sources. These helpers
exist to aggressively normalize input before aggregation.
  - Treat visually different but semantically identical inputs as equal
  - Preserve distinctions that affect shopping decisions
  - Avoid over-normalization that could merge distinct products
================================ */
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

  if (unit === "tsp" || unit === "teaspoon" || unit === "teaspoons") return "tsp";
  if (unit === "tbsp" || unit === "tablespoon" || unit === "tablespoons") return "tbsp";
  if (unit === "cup" || unit === "cups") return "cup";
  if (unit === "oz" || unit === "ounce" || unit === "ounces") return "oz";
  if (unit === "lb" || unit === "lbs" || unit === "pound" || unit === "pounds") return "lb";
  if (unit === "g" || unit === "gram" || unit === "grams") return "g";
  if (unit === "kg" || unit === "kilogram" || unit === "kilograms") return "kg";
  if (unit === "ml" || unit === "milliliter" || unit === "milliliters") return "ml";
  if (unit === "l" || unit === "liter" || unit === "liters") return "l";

  if (unit === "bag" || unit === "bags") return "bag";
  if (unit === "block" || unit === "blocks") return "block";
  if (unit === "bottle" || unit === "bottles") return "bottle";
  if (unit === "bunch" || unit === "bunches") return "bunch";
  if (unit === "can" || unit === "cans") return "can";
  if (unit === "clove" || unit === "cloves") return "clove";
  if (unit === "egg" || unit === "eggs") return "egg";
  if (unit === "egg white" || unit === "egg whites") return "egg white";
  if (unit === "jar" || unit === "jars") return "jar";
  if (unit === "leaf" || unit === "leaves") return "leaf";
  if (unit === "package" || unit === "packages" || unit === "pkg" || unit === "pkgs") return "package";
  if (unit === "sheet" || unit === "sheets") return "sheet";
  if (unit === "slice" || unit === "slices") return "slice";
  if (unit === "sprig" || unit === "sprigs") return "sprig";
  if (unit === "stalk" || unit === "stalks") return "stalk";
  if (unit === "stick" || unit === "sticks") return "stick";
  if (unit === "yolk" || unit === "yolks") return "yolk";

  return unit;
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

  if (raw.includes("dark or semi sweet chocolate") || raw.includes("dark or semi-sweet chocolate")) {
    return {
      base: "chocolate",
      display: "Chocolate (dark OR semi-sweet)",
      notes: [],
    };
  }

  if (raw.includes("butter lettuce") && raw.includes("red leaf lettuce")) {
    return { base: "butter lettuce or red leaf lettuce", display: "butter lettuce or red leaf lettuce" };
  }

  if (raw.includes("lard") && raw.includes("unsalted butter")) {
    return { base: "lard or unsalted butter", display: "lard or unsalted butter" };
  }

  const commodity = extractCommodityBaseStrict(raw);
  const notes = extractNotesStrict(raw);

  if (commodity) {
    return {
      base: commodity, // ONLY key used for aggregation
      display: commodity, // UI label
      notes: notes,
    };
  }

  if (raw.includes("granulated garlic") && raw.includes("garlic powder")) {
    return { base: "granulated garlic or garlic powder", display: "granulated garlic or garlic powder" };
  }

  if (raw.includes("garlic powder")) {
    return { base: "garlic powder", display: "garlic powder" };
  }

  if (raw.includes("onion powder")) {
    return { base: "onion powder", display: "onion powder" };
  }

  if (raw.includes("garlic")) {
    return { base: "garlic", display: "garlic" };
  }

  if (raw.includes("yellow onion")) {
    return { base: "yellow onion", display: "yellow onion" };
  }

  if (raw.includes("white onion")) {
    return { base: "white onion", display: "white onion" };
  }

  if (raw.includes("roasted red peppers")) {
    return { base: "roasted red peppers", display: "roasted red peppers" };
  }

  if (raw.includes("green bell pepper")) {
    return { base: "green bell pepper", display: "green bell pepper" };
  }

  if (raw.includes("red bell pepper")) {
    return { base: "red bell pepper", display: "red bell pepper" };
  }

  if (raw.includes("bell pepper")) {
    return { base: "bell pepper", display: "bell pepper" };
  }

  if (raw.includes("cabbage and carrot coleslaw mix") || raw.includes("coleslaw mix")) {
    return { base: "plain shredded cabbage and carrot coleslaw mix", display: "plain shredded cabbage and carrot coleslaw mix" };
  }

  if (raw.includes("carrot")) {
    return { base: "carrot", display: "carrot" };
  }

  if (raw.includes("celery seed")) {
    return { base: "celery seed", display: "celery seed" };
  }

  if (raw.includes("celery")) {
    return { base: "celery", display: "celery" };
  }

  if (raw.includes("potato bun") && raw.includes("brioche bun")) {
    return { base: "potato bun or brioche bun", display: "potato bun or brioche bun" };
  }

  if (raw.includes("potato bun")) {
    return { base: "potato bun", display: "potato bun" };
  }

  if (raw.includes("brioche bun")) {
    return { base: "brioche bun", display: "brioche bun" };
  }

  if (raw.includes("potato")) {
    if (raw.includes("mashed potatoes")) return { base: "mashed potatoes", display: "mashed potatoes" };
    if (raw.includes("sweet potato")) return { base: "sweet potato", display: "sweet potato" };
    if (raw.includes("yukon gold")) return { base: "yukon gold potato", display: "Yukon gold potato" };
    if (raw.includes("baby yellow")) return { base: "baby yellow potato", display: "baby yellow potato" };
    return { base: "potato", display: "potato" };
  }

  if (raw.includes("chicken breast")) {
    if (raw.includes("boneless skinless")) {
      return { base: "boneless skinless chicken breast", display: "boneless skinless chicken breast" };
    }
    return { base: "chicken breast", display: "chicken breast" };
  }

  if (raw.includes("flank steak")) {
    return { base: "flank steak", display: "flank steak" };
  }

  if (raw.includes("top sirloin steak") && raw.includes("strip steak") && raw.includes("flat iron steak")) {
    return { base: "top sirloin steak, strip steak, or flat iron steak", display: "top sirloin steak, strip steak, or flat iron steak" };
  }

  if (raw.includes("ribeye") && raw.includes("top sirloin") && raw.includes("skirt steak")) {
    return { base: "boneless ribeye, top sirloin, or skirt steak", display: "boneless ribeye, top sirloin, or skirt steak" };
  }

  if (raw.includes("thick-cut ribeye steak")) {
    return { base: "thick-cut ribeye steak", display: "thick-cut ribeye steak" };
  }

  if (raw.includes("ribeye")) {
    return { base: "ribeye steak", display: "ribeye steak" };
  }

  if (raw.includes("top sirloin")) {
    return { base: "top sirloin steak", display: "top sirloin steak" };
  }

  if (raw.includes("new york strip")) {
    return { base: "new york strip steak", display: "New York strip steak" };
  }

  if (raw.includes("strip steak")) {
    return { base: "strip steak", display: "strip steak" };
  }

  if (raw.includes("flat iron steak")) {
    return { base: "flat iron steak", display: "flat iron steak" };
  }

  if (raw.includes("skirt steak")) {
    return { base: "skirt steak", display: "skirt steak" };
  }

  if (raw.includes("80/20 ground beef")) {
    return { base: "80/20 ground beef", display: "80/20 ground beef" };
  }

  if (raw.includes("85/15 ground beef")) {
    return { base: "85/15 ground beef", display: "85/15 ground beef" };
  }

  if (raw.includes("lean ground beef")) {
    return { base: "lean ground beef", display: "lean ground beef" };
  }

  if (raw.includes("grass-fed ground beef")) {
    return { base: "grass-fed ground beef", display: "grass-fed ground beef" };
  }

  if (raw.includes("ground beef")) {
    return { base: "ground beef", display: "ground beef" };
  }

  if (raw.includes("short rib")) {
    return { base: "beef short rib", display: "beef short rib" };
  }

  if (raw.includes("beef tenderloin")) {
    return { base: "beef tenderloin", display: "beef tenderloin" };
  }

  if (raw.includes("prime rib")) {
    return { base: "prime rib roast", display: "prime rib roast" };
  }

  if (raw.includes("crushed tomatoes")) {
    return { base: "crushed tomatoes", display: "crushed tomatoes" };
  }

  if (raw.includes("fire-roasted diced tomatoes")) {
    return { base: "fire-roasted diced tomatoes", display: "fire-roasted diced tomatoes" };
  }

  if (raw.includes("diced tomatoes")) {
    return { base: "diced tomatoes", display: "diced tomatoes" };
  }

  if (raw.includes("tomato sauce")) {
    return { base: "tomato sauce", display: "tomato sauce" };
  }

  if (raw.includes("tomato paste")) {
    return { base: "tomato paste", display: "tomato paste" };
  }

  if (raw.includes("kidney beans")) {
    return { base: "kidney beans", display: "kidney beans" };
  }

  if (raw.includes("pinto beans")) {
    return { base: "pinto beans", display: "pinto beans" };
  }

  if (raw.includes("cream of chicken soup")) {
    return { base: "cream of chicken soup", display: "cream of chicken soup" };
  }

  if (raw.includes("puff pastry")) {
    return { base: "puff pastry dough", display: "puff pastry dough" };
  }

  if (raw.includes("vanilla bean paste") && raw.includes("extract")) {
    return { base: "vanilla extract or paste", display: "vanilla extract or paste" };
  }

  if (raw.includes("vanilla bean paste")) {
    return { base: "vanilla bean paste", display: "vanilla bean paste" };
  }

  if (raw.includes("vanilla extract") || raw.includes("vanilla paste")) {
    return { base: "vanilla extract or paste", display: "vanilla extract or paste" };
  }

  if (raw.includes("egg yolk")) {
    return { base: "egg yolk", display: "egg yolk" };
  }

  if (raw.includes("american cheese slice")) {
    return { base: "american cheese slice", display: "American cheese slice" };
  }

  if (raw.includes("american cheese")) {
    return { base: "american cheese", display: "American cheese" };
  }

  if (raw.includes("brown sugar")) {
    if (raw.includes("light or dark")) return { base: "brown sugar", display: "brown sugar" };
    return { base: "brown sugar", display: "brown sugar" };
  }

  if (raw.includes("maple syrup")) {
    return { base: "maple syrup", display: "maple syrup" };
  }

  if (raw.includes("blueberries")) {
    return { base: "blueberries", display: "blueberries" };
  }

  if (raw.includes("raspberries")) {
    return { base: "raspberries", display: "raspberries" };
  }

  if (raw.includes("mixed berries")) {
    return { base: "mixed berries", display: "mixed berries" };
  }

  if (raw.includes("berries")) {
    return { base: "berries", display: "berries" };
  }

  if (raw.includes("banana")) {
    return { base: "banana", display: "banana" };
  }

  if (raw.includes("walnut")) {
    return { base: "walnuts", display: "walnuts" };
  }

  if (raw.includes("pecan")) {
    return { base: "pecans", display: "pecans" };
  }

  if (raw.includes("pistachio")) {
    return { base: "pistachios", display: "pistachios" };
  }

  if (raw.includes("nuts of choice")) {
    return { base: "nuts of choice", display: "nuts of choice" };
  }

  if (raw.includes("pasta of choice") || raw.includes("pasta")) {
    return { base: "pasta", display: "pasta" };
  }

  if (raw.includes("low-sodium beef broth")) {
    return { base: "low-sodium beef broth", display: "low-sodium beef broth" };
  }

  if (raw.includes("beef broth")) {
    return { base: "beef broth", display: "beef broth" };
  }

  if (raw.includes("low-sodium chicken broth")) {
    return { base: "low-sodium chicken broth", display: "low-sodium chicken broth" };
  }

  if (raw.includes("chicken broth")) {
    return { base: "chicken broth", display: "chicken broth" };
  }

  if (raw.includes("cinnamon")) {
    return { base: "cinnamon", display: "cinnamon" };
  }

  if (raw.includes("red pepper flakes")) {
    return { base: "red pepper flakes", display: "red pepper flakes" };
  }

  if (raw.includes("peanut or vegetable oil")) {
    return { base: "peanut or vegetable oil", display: "peanut or vegetable oil" };
  }

  if (raw.includes("olive or avocado oil")) {
    return { base: "olive or avocado oil", display: "olive or avocado oil" };
  }

  if (raw.includes("pizza oil")) {
    return { base: "pizza oil or olive oil", display: "pizza oil or olive oil" };
  }

  if (raw.includes("oil of choice")) {
    return { base: "oil of choice", display: "oil of choice" };
  }

  if (raw.includes("mayonnaise")) {
    return { base: "mayonnaise", display: "mayonnaise" };
  }

  if (raw.includes("yellow mustard seed")) {
    return { base: "yellow mustard seed", display: "yellow mustard seed" };
  }

  if (raw.includes("yellow mustard")) {
    return { base: "yellow mustard", display: "yellow mustard" };
  }

  if (raw.includes("louisiana-style cayenne hot sauce")) {
    return { base: "louisiana-style cayenne hot sauce", display: "Louisiana-style cayenne hot sauce" };
  }

  if (raw.includes("louisiana-style hot sauce")) {
    return { base: "louisiana-style hot sauce", display: "Louisiana-style hot sauce" };
  }

  if (raw.includes("hot sauce")) {
    return { base: "hot sauce", display: "hot sauce" };
  }

  if (raw.includes("pizza sauce")) {
    return { base: "pizza sauce", display: "pizza sauce" };
  }

  if (raw.includes("cheese of choice")) {
    return { base: "cheese", display: "cheese" };
  }

  if (raw.includes("iceberg lettuce")) {
    return { base: "iceberg lettuce", display: "iceberg lettuce" };
  }

  if (raw.includes("red leaf lettuce")) {
    return { base: "red leaf lettuce", display: "red leaf lettuce" };
  }

  if (raw.includes("butter lettuce")) {
    return { base: "butter lettuce", display: "butter lettuce" };
  }

  if (raw.includes("lettuce")) {
    return { base: "lettuce", display: "lettuce" };
  }

  if (raw.includes("chocolate chip") || raw.includes("chopped chocolate") || raw.includes("dark chocolate") || raw.includes("white chocolate") || raw.includes("semi-sweet chocolate") || raw.includes("semisweet chocolate")) {
    if (raw.includes("white chocolate")) return { base: "white chocolate", display: "white chocolate" };
    if (raw.includes("dark chocolate")) return { base: "dark chocolate", display: "dark chocolate" };
    if (raw.includes("semisweet chocolate chips")) return { base: "semisweet chocolate chips", display: "semisweet chocolate chips" };
    if (raw.includes("semi-sweet chocolate chips")) return { base: "semi-sweet chocolate chips", display: "semi-sweet chocolate chips" };
    if (raw.includes("semi-sweet")) return { base: "semi-sweet chocolate", display: "semi-sweet chocolate" };
    if (raw.includes("semisweet")) return { base: "semisweet chocolate", display: "semisweet chocolate" };
    return { base: "chocolate", display: "chocolate" };
  }

  if (raw.includes("avocado oil") && raw.includes("coconut oil")) {
    return { base: "avocado oil or coconut oil", display: "avocado oil or coconut oil" };
  }

  if (raw.includes("avocado oil")) {
    return { base: "avocado oil", display: "avocado oil" };
  }

  if (raw.includes("olive oil")) {
    if (raw.includes("extra-virgin")) {
      return { base: "extra-virgin olive oil", display: "extra-virgin olive oil" };
    }
    return { base: "olive oil", display: "olive oil" };
  }

  if (raw.includes("chipotle peppers in adobo")) {
    return { base: "chipotle peppers in adobo sauce", display: "chipotle peppers in adobo sauce" };
  }

  if (raw.includes("sun-dried tomatoes")) {
    return { base: "sun-dried tomatoes", display: "sun-dried tomatoes" };
  }

  if (raw.includes("broccoli")) {
    return { base: "broccoli", display: "broccoli" };
  }

  if (raw.includes("green onion")) {
    return { base: "green onion", display: "green onion" };
  }

  if (raw.includes("onion")) {
    return { base: "onion", display: "onion" };
  }

  if (raw.includes("fresh ginger")) {
    return { base: "fresh ginger", display: "fresh ginger" };
  }

  if (raw.includes("ginger")) {
    return { base: "ginger", display: "ginger" };
  }

  if (raw.includes("peach")) {
    return { base: "peach", display: "peach" };
  }

  if (raw.includes("graham cracker")) {
    return { base: "graham crackers", display: "graham crackers" };
  }

  if (raw.includes("croissant")) {
    return { base: "croissants", display: "croissants" };
  }

  if (raw.includes("refrigerated crescent rolls")) {
    return { base: "refrigerated crescent rolls", display: "refrigerated crescent rolls" };
  }

  if (raw.includes("pineapple slices")) {
    return { base: "pineapple slices", display: "pineapple slices" };
  }

  if (raw.includes("maraschino cherries")) {
    return { base: "maraschino cherries", display: "maraschino cherries" };
  }

  if (raw.includes("vanilla bean")) {
    return { base: "vanilla bean", display: "vanilla bean" };
  }

  if (raw.includes("basil pesto")) {
    return { base: "basil pesto", display: "basil pesto" };
  }

  if (raw.includes("basil")) {
    return { base: "basil", display: "basil" };
  }

  if (raw.includes("sourdough discard")) {
    return { base: "sourdough discard", display: "sourdough discard" };
  }

  if (raw.includes("freeze-dried strawberries")) {
    return { base: "freeze-dried strawberries", display: "freeze-dried strawberries" };
  }

  if (raw.includes("dill pickle chips") || raw.includes("hamburger dill pickle chips") || raw.includes("crinkle-cut dill pickles")) {
    return { base: "dill pickle chips", display: "dill pickle chips" };
  }

  if (raw.includes("pickle chips") || raw.includes("pickles")) {
    return { base: "pickles", display: "pickles" };
  }

  if (raw.includes("bacon")) {
    return { base: "bacon", display: "bacon" };
  }

  if (raw.includes("salami")) {
    return { base: "deli salami", display: "deli salami" };
  }

  if (raw.includes("pepperoni")) {
    return { base: "deli pepperoni", display: "deli pepperoni" };
  }

  if (raw.includes("ice cream")) {
    return { base: "ice cream", display: "ice cream" };
  }

  if (raw.includes("dried bay leaf") || raw.includes("dried bay leaves")) {
    return { base: "dried bay leaf", display: "dried bay leaf" };
  }

  if (raw.includes("bay leaf") || raw.includes("bay leaves")) {
    return { base: "bay leaf", display: "bay leaf" };
  }

  if (raw.includes("italian parsley")) {
    return { base: "italian parsley", display: "italian parsley" };
  }

  if (raw.includes("fresh parsley")) {
    return { base: "fresh parsley", display: "fresh parsley" };
  }

  if (raw.includes("parsley")) {
    return { base: "parsley", display: "parsley" };
  }

  if (raw.includes("rosemary")) {
    if (raw.includes("fresh rosemary")) {
      return { base: "fresh rosemary", display: "fresh rosemary" };
    }
    if (raw.includes("sprig")) {
      return { base: "rosemary sprig", display: "rosemary sprig" };
    }
    return { base: "rosemary", display: "rosemary" };
  }

  if (raw.includes("thyme")) {
    if (raw.includes("fresh thyme")) {
      return { base: "fresh thyme", display: "fresh thyme" };
    }
    if (raw.includes("sprig")) {
      return { base: "thyme sprig", display: "thyme sprig" };
    }
    return { base: "thyme", display: "thyme" };
  }

  return { base: raw, display: raw };
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
