import { escapeRegex } from "./normalization.js";

/* ================================
INGREDIENT GROUP MAP
================================ */
const ingredientGroups = {
  "9-inch unbaked pie crust": "Baking",
  "active dry or instant yeast": "Baking",
  "active dry yeast": "Baking",
  "almond extract": "Baking",
  "baking powder": "Baking",
  "baking soda": "Baking",
  "brown sugar": "Baking",
  chocolate: "Baking",
  "confectioners sugar": "Baking",
  "cocoa powder": "Baking",
  cornstarch: "Baking",
  croissants: "Baking",
  "dark chocolate": "Baking",
  flour: "Baking",
  "freeze-dried strawberries": "Baking",
  "graham crackers": "Baking",
  "granulated sugar": "Baking",
  "instant espresso powder": "Baking",
  "light or dark corn syrup": "Baking",
  "nuts of choice": "Baking",
  oats: "Baking",
  pecans: "Baking",
  pistachios: "Baking",
  "powdered sugar": "Baking",
  "pumpkin puree": "Baking",
  "puff pastry dough": "Baking",
  "red food coloring": "Baking",
  "refrigerated crescent rolls": "Baking",
  "rolled oats": "Baking",
  "semi-sweet chocolate": "Baking",
  "semi-sweet chocolate chips": "Baking",
  "semisweet chocolate": "Baking",
  "semisweet chocolate chips": "Baking",
  "sourdough discard": "Baking",
  sugar: "Baking",
  "sweetened shredded coconut": "Baking",
  "vanilla bean": "Baking",
  "vanilla bean paste": "Baking",
  "vanilla extract": "Baking",
  walnuts: "Baking",
  "white chocolate": "Baking",
  "yellow cornmeal": "Baking",
  butter: "Dairy",
  buttermilk: "Dairy",
  cheese: "Dairy",
  cream: "Dairy",
  "cream cheese": "Dairy",
  egg: "Dairy",
  "greek yogurt": "Dairy",
  "greek yogurt or sour cream": "Dairy",
  "heavy cream": "Dairy",
  "ice cream": "Dairy",
  milk: "Dairy",
  "milk chocolate": "Baking",
  parmesan: "Dairy",
  "parmigiano reggiano cheese": "Dairy",
  "salted butter": "Dairy",
  "unsalted butter": "Dairy",
  apple: "Fruit",
  apples: "Fruit",
  banana: "Fruit",
  berries: "Fruit",
  blueberries: "Fruit",
  lemon: "Fruit",
  "lemon juice": "Fruit",
  "lemon zest": "Fruit",
  "maraschino cherries": "Fruit",
  "mixed berries": "Fruit",
  peach: "Fruit",
  "pineapple slices": "Fruit",
  raspberries: "Fruit",
  basil: "Herbs",
  "bay leaf": "Herbs",
  "bay leaves": "Herbs",
  "dried bay leaf": "Herbs",
  "fresh parsley": "Herbs",
  "fresh rosemary": "Herbs",
  "fresh thyme": "Herbs",
  "italian parsley": "Herbs",
  parsley: "Herbs",
  rosemary: "Herbs",
  thyme: "Herbs",
  bacon: "Meat",
  beef: "Meat",
  chicken: "Meat",
  "deli pepperoni": "Meat",
  "deli salami": "Meat",
  "flank steak": "Meat",
  "prime rib roast": "Meat",
  steak: "Meat",
  "avocado oil": "Pantry",
  "avocado oil or coconut oil": "Pantry",
  beans: "Pantry",
  "beef broth": "Pantry",
  broth: "Pantry",
  "chicken broth": "Pantry",
  "coconut oil": "Pantry",
  "cream of chicken soup": "Pantry",
  "crushed tomatoes": "Pantry",
  "diced tomatoes": "Pantry",
  "fire-roasted diced tomatoes": "Pantry",
  honey: "Pantry",
  "jasmine rice": "Pantry",
  "kidney beans": "Pantry",
  "maple syrup": "Pantry",
  nutella: "Pantry",
  oil: "Pantry",
  "olive oil": "Pantry",
  "olive or avocado oil": "Pantry",
  "oil of choice": "Pantry",
  pasta: "Pantry",
  "peanut butter": "Pantry",
  "peanut or vegetable oil": "Pantry",
  "pinto beans": "Pantry",
  "pizza oil or olive oil": "Pantry",
  rice: "Pantry",
  "sesame oil": "Pantry",
  "sourdough tortillas": "Pantry",
  "tomato sauce": "Pantry",
  tomatoes: "Pantry",
  "vegetable oil": "Pantry",
  garlic: "Produce",
  ginger: "Produce",
  onion: "Produce",
  "adobo sauce": "Sauces, Marinades, & Condiments",
  "basil pesto": "Sauces, Marinades, & Condiments",
  "chipotle peppers in adobo sauce": "Sauces, Marinades, & Condiments",
  "dijon mustard": "Sauces, Marinades, & Condiments",
  "hot honey": "Sauces, Marinades, & Condiments",
  "low-sodium soy sauce": "Sauces, Marinades, & Condiments",
  mayonnaise: "Sauces, Marinades, & Condiments",
  "pickle brine": "Sauces, Marinades, & Condiments",
  pickles: "Sauces, Marinades, & Condiments",
  "pizza sauce": "Sauces, Marinades, & Condiments",
  "soy sauce": "Sauces, Marinades, & Condiments",
  "tomato paste": "Sauces, Marinades, & Condiments",
  "worcestershire sauce": "Sauces, Marinades, & Condiments",
  cayenne: "Spices",
  "chili powder": "Spices",
  cinnamon: "Spices",
  cumin: "Spices",
  "garlic powder": "Spices",
  "italian seasoning": "Spices",
  nutmeg: "Spices",
  "onion powder": "Spices",
  oregano: "Spices",
  paprika: "Spices",
  pepper: "Spices",
  "poppy seeds": "Spices",
  "pumpkin pie spice": "Spices",
  "red pepper flakes": "Spices",
  "sesame seeds": "Spices",
  salt: "Spices",
  "smoked paprika": "Spices",
  "baby carrots": "Vegetables",
  "baby yellow potatoes": "Vegetables",
  "baby spinach": "Vegetables",
  "bell pepper": "Vegetables",
  broccoli: "Vegetables",
  carrot: "Vegetables",
  carrots: "Vegetables",
  "chipotle pepper": "Vegetables",
  "chipotle peppers": "Vegetables",
  celery: "Vegetables",
  "fresh baby spinach": "Vegetables",
  "green bell pepper": "Vegetables",
  "green onion": "Vegetables",
  lettuce: "Vegetables",
  "mashed potatoes": "Vegetables",
  potato: "Vegetables",
  potatoes: "Vegetables",
  "red bell pepper": "Vegetables",
  "roasted red peppers": "Vegetables",
  spinach: "Vegetables",
  "sweet potato": "Vegetables",
  "dry white wine": "Wine",
  "bourbon whiskey": "Wine",
  "red wine": "Wine",
  "white wine": "Wine",
};

const groceryGroupSortOrder = [
  "Manual Items",
  "Produce",
  "Vegetables",
  "Fruit",
  "Meat",
  "Dairy",
  "Baking",
  "Pantry",
  "Sauces, Marinades, & Condiments",
  "Spices",
  "Herbs",
  "Wine",
  "Other",
];

/* ================================
GROUPING HELPERS
  - Avoid substring collisions (e.g., 'unsalted' contains 'salt')
  - Prefer longer keys first and match whole words only
================================ */

const ingredientGroupKeysByLength = Object.keys(ingredientGroups)
  .slice()
  .sort((a, b) => b.length - a.length);

export function determineGroupForKey(canonicalKey) {
  const keyText = String(canonicalKey || "").toLowerCase();

  for (const groupKey of ingredientGroupKeysByLength) {
    if (keyText.startsWith(groupKey)) {
      return ingredientGroups[groupKey];
    }
    const pattern = new RegExp("\\b" + escapeRegex(groupKey) + "\\b");
    if (pattern.test(keyText)) {
      return ingredientGroups[groupKey];
    }
  }
  return "Other";
}

export function sortGroceryGroups(groups) {
  return groups.slice().sort((a, b) => {
    if (a === "Other" && b !== "Other") return 1;
    if (b === "Other" && a !== "Other") return -1;

    const aIndex = groceryGroupSortOrder.indexOf(a);
    const bIndex = groceryGroupSortOrder.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? groceryGroupSortOrder.length : aIndex) -
        (bIndex === -1 ? groceryGroupSortOrder.length : bIndex);
    }

    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}
