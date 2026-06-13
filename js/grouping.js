/* ================================
INGREDIENT GROUP MAP
================================ */
const ingredientGroups = {
  "brown sugar": "Baking",
  "confectioners sugar": "Baking",
  cornstarch: "Baking",
  flour: "Baking",
  "granulated sugar": "Baking",
  oats: "Baking",
  "powdered sugar": "Baking",
  "puff pastry dough": "Baking",
  "rolled oats": "Baking",
  "semi-sweet chocolate": "Baking",
  "semi-sweet chocolate chips": "Baking",
  "semisweet chocolate": "Baking",
  "semisweet chocolate chips": "Baking",
  sugar: "Baking",
  "vanilla extract": "Baking",
  butter: "Dairy",
  buttermilk: "Dairy",
  cheese: "Dairy",
  cream: "Dairy",
  "cream cheese": "Dairy",
  egg: "Dairy",
  "greek yogurt": "Dairy",
  "greek yogurt or sour cream": "Dairy",
  "heavy cream": "Dairy",
  milk: "Dairy",
  "milk chocolate": "Baking",
  parmesan: "Dairy",
  "parmigiano reggiano cheese": "Dairy",
  "salted butter": "Dairy",
  "unsalted butter": "Dairy",
  apple: "Fruit",
  apples: "Fruit",
  lemon: "Fruit",
  "lemon juice": "Fruit",
  "lemon zest": "Fruit",
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
  beans: "Pantry",
  "beef broth": "Pantry",
  broth: "Pantry",
  "chicken broth": "Pantry",
  "cream of chicken soup": "Pantry",
  "crushed tomatoes": "Pantry",
  "diced tomatoes": "Pantry",
  "fire-roasted diced tomatoes": "Pantry",
  "kidney beans": "Pantry",
  "olive oil": "Pantry",
  "pinto beans": "Pantry",
  tomatoes: "Pantry",
  garlic: "Produce",
  onion: "Produce",
  "adobo sauce": "Sauces, Marinades, & Condiments",
  "basil pesto": "Sauces, Marinades, & Condiments",
  "chipotle peppers in adobo sauce": "Sauces, Marinades, & Condiments",
  "tomato paste": "Sauces, Marinades, & Condiments",
  "worcestershire sauce": "Sauces, Marinades, & Condiments",
  cayenne: "Spices",
  "chili powder": "Spices",
  cinnamon: "Spices",
  cumin: "Spices",
  "garlic powder": "Spices",
  nutmeg: "Spices",
  "onion powder": "Spices",
  oregano: "Spices",
  paprika: "Spices",
  pepper: "Spices",
  "red pepper flakes": "Spices",
  salt: "Spices",
  "smoked paprika": "Spices",
  "baby carrots": "Vegetables",
  "baby yellow potatoes": "Vegetables",
  "bell pepper": "Vegetables",
  carrot: "Vegetables",
  carrots: "Vegetables",
  "chipotle pepper": "Vegetables",
  "chipotle peppers": "Vegetables",
  "green bell pepper": "Vegetables",
  potato: "Vegetables",
  potatoes: "Vegetables",
  "red bell pepper": "Vegetables",
  "roasted red peppers": "Vegetables",
  "sweet potato": "Vegetables",
  "red wine": "Wine",
};

/* ================================
GROUPING HELPERS
  - Avoid substring collisions (e.g., 'unsalted' contains 'salt')
  - Prefer longer keys first and match whole words only
================================ */

const ingredientGroupKeysByLength = Object.keys(ingredientGroups)
  .slice()
  .sort((a, b) => b.length - a.length);

function determineGroupForKey(canonicalKey) {
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
