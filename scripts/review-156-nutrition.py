"""Temporary PR #157 review helper; remove before handoff."""
import copy
import json
import math
import pathlib

ROOT = pathlib.Path.cwd()
FOODS = {str(f['fdcId']): f for f in json.loads((ROOT / 'docs/review-156-fooddata.tmp.json').read_text())['foods']}
KEYS = ['calories', 'protein', 'carbohydrates', 'fat', 'fiber', 'saturatedFat', 'sodium']
IDS = ['berbere-turkey-lentil-braise', 'chermoula-chickpea-cauliflower-farro', 'citrus-mojo-pork-with-black-bean-quinoa', 'ginger-sesame-chicken-soba', 'zaatar-pistachio-salmon-with-lemon-dill-barley']
RECIPES = {i: json.loads((ROOT / f'data/recipes/{i}.json').read_text()) for i in IDS}
PROFILES = {}


def usda(key: str, fdc: int, note: str = '', overrides: dict[str, float] | None = None) -> None:
    """Register USDA composition with explicit estimation overrides.

    Parameters
    ----------
    key : str
        Local ingredient-profile identifier.
    fdc : int
        FoodData Central SR Legacy identifier.
    note : str
        Limits on how the reference represents the ingredient.
    overrides : dict of str to float, optional
        Nutrient assumptions per 100 g, documented in the note.
    """
    entry = FOODS[str(fdc)]
    data = copy.deepcopy(entry['nutrients'])
    if overrides:
        data.update(overrides)
    missing = [k for k in KEYS if k not in data]
    if missing:
        raise ValueError(f'{key} missing {missing}')
    PROFILES[key] = {'description': entry['description'], 'source': f'https://fdc.nal.usda.gov/food-details/{fdc}/nutrients', 'note': note, 'per100g': {k: data[k] for k in KEYS}}


def label(key: str, grams: float, values: list[float], source: str, note: str) -> None:
    """Register a label serving as a per-100-g planning profile.

    Parameters
    ----------
    key : str
        Local product-profile identifier.
    grams : float
        Label serving weight in grams.
    values : list of float
        Nutrients in KEYS order for that label serving.
    source : str
        Direct label or manufacturer source.
    note : str
        Product identity and approximation limitations.
    """
    assert len(values) == len(KEYS)
    PROFILES[key] = {'description': key, 'source': source, 'note': note, 'per100g': {k: round(v / grams * 100, 6) for k, v in zip(KEYS, values)}}


simple = {'salmon':175167,'turkey':172850,'pork':168312,'quinoa':168874,'lentils':172421,'blackBeans':173735,'chickpeas':173757,'edamame':168411,'tahini':170189,'broccoli':170379,'tomatoes':170457,'cabbage':169975,'spinach':168462,'carrots':170393,'bokChoy':170390,'kale':168421,'cauliflower':169986,'bellPepper':170108,'onion':170000,'scallions':170005,'pineapple':169124,'avocado':171705,'pomegranate':169134,'orangeJuice':169098,'lemonJuice':167747,'limeJuice':168156,'lemonZest':167749,'oliveOil':171413,'canolaOil':172336,'sesameOil':171016,'pistachios':170185,'almonds':170158,'pepitas':170557,'sesameSeeds':170151,'maple':169661,'redWineVinegar':172240,'riceVinegar':172237,'salt':173468,'cornstarch':169698,'garlic':169230,'ginger':169231,'parsley':170416,'cilantro':169997,'dill':172233,'coriander':170922,'cumin':170923,'blackPepper':170931,'cayenne':170932,'cinnamon':171320,'garlicPowder':171325,'oregano':171328,'paprika':171329,'turmeric':172231}
for name, fdc in simple.items():
    usda(name, fdc)
PROFILES['salmon']['note'] = 'Raw farmed Atlantic salmon; wild species and other brands change energy and fat substantially.'
PROFILES['pork']['note'] = 'Raw tenderloin, lean and separable fat; use raw edible trimmed weight, not cooked weight.'
PROFILES['turkey']['note'] = 'Raw 93% lean turkey; brand-dependent composition.'
for name in ['lentils', 'blackBeans', 'chickpeas']:
    PROFILES[name]['note'] = 'Cooked-without-salt proxy for no-salt-added canned legumes; use 500 g drained edible contents per two cans. Can size is not drained weight. Natural sodium/solids vary.'
PROFILES['edamame']['note'] = 'Prepared frozen edamame proxy for 234 g frozen shelled edible beans; cook according to package. Yield varies.'
PROFILES['riceVinegar']['note'] = 'Distilled-vinegar composition proxy for a small amount of unseasoned rice vinegar; not seasoned sushi vinegar.'
usda('shiitakes', 169242, 'SR Legacy lacks saturated fat for raw shiitakes; model 0.1 g/100 g, a small explicit estimate.', {'saturatedFat':0.1})
usda('dates', 168191, 'SR Legacy lacks saturated fat here; assume 0 g for the 48 g batch amount; total fat is only 0.15 g/100 g.', {'saturatedFat':0})
usda('mustard', 172234, 'Prepared-mustard macro proxy for Dijon; override sodium to 240 mg per 10 g, matching the recipe ceiling of 120 mg per teaspoon.', {'sodium':2400})
usda('tamari', 174278, 'Regular-tamari macro proxy; override sodium to 700 mg per 16 g tablespoon, the recipe purchasing ceiling for reduced-sodium tamari.', {'sodium':4375})
usda('miso', 172442, 'Generic miso macro profile; override sodium to 650 mg per 17 g tablespoon, the recipe purchasing ceiling.', {'sodium':650/17*100})
usda('crushedTomatoes', 170501, 'Canned-crushed-tomato macro profile; no-salt-added version modeled with 15 mg sodium per 121 g, supported by the Hunt\'s no-salt-added label. Not the sodium of the regular USDA entry.', {'sodium':15/121*100})
PROFILES['crushedTomatoes']['labelSource'] = 'https://shop.lowesfoods.com/products/hunts-crushed-tomatoes-no-salt-added/12519'
label('tomatoPaste', 33, [35,1,7,0,2,0,25], 'https://www.directionsforme.org/product/32542', 'Manufacturer-label transcription: Hunt\'s No Salt Added Tomato Paste, 2 tablespoons/33 g. Recipe uses 32 g.')
label('barley', 48, [170,5,37,.5,5,0,0], 'https://www.directionsforme.org/product/38456', 'Manufacturer-label transcription: Quaker Quick Pearled Barley, 48 g dry. This replaces a higher-fiber regular-barley proxy; verify the purchased box.')
label('farro',45,[160,7,32,1,3,0,0],'https://rolandfoods.com/product/72140-pearled-italian-farro','Roland pearled-farro label, 45 g dry. Composition proxy for unseasoned quick-cooking pearled farro; not whole spelt and not a claim that this particular product cooks in 10 minutes.')
label('soba',90,[310,11,61,1,1,0,0],'https://hakubaku.com.au/product/soba/','Use the US/Canada no-salt soba label, 90 g dry. AU/EU formulations contain salt and do not have these sodium values.')
label('yogurt',170,[120,17,5,3.5,0,2.5,55],'https://usa.fage/products/yogurt/fage-total-2','FAGE Total 2% representative label, 170 g. Other Greek yogurt brands vary.')
label('chicken',112,[130,25,0,3,0,1,75],'https://www.perduefarms.com/en-US/perdue-harvestland-organic-boneless-skinless-chicken-breasts-pack/70622.html','Representative plain raw boneless skinless chicken breast label, 112 g. Not a claim that every plain chicken breast has these numbers; no injected solution.')
PROFILES['orangeZest'] = copy.deepcopy(PROFILES['lemonZest']); PROFILES['orangeZest']['note'] = '2 g lemon-peel composition used as a small orange-zest proxy.'
PROFILES['jalapeno'] = copy.deepcopy(PROFILES['bellPepper']); PROFILES['jalapeno']['note'] = '15 g sweet-red-pepper composition used as a small jalapeno proxy.'
PROFILES['berbere'] = copy.deepcopy(PROFILES['paprika']); PROFILES['berbere']['note'] = '7 g paprika composition used as a small salt-free berbere blend proxy; spice blend density/composition varies.'
PROFILES['gochugaru'] = copy.deepcopy(PROFILES['cayenne']); PROFILES['gochugaru']['note'] = 'Red-pepper powder composition used for 2 g mild gochugaru; this is a nutrient proxy, not a heat-level substitution.'
PROFILES['zaatar'] = {'description':'Salt-free zaatar estimate', 'source':'https://fdc.nal.usda.gov/download-datasets/', 'note':'Small blend proxy: 6 g toasted sesame, 3 g oregano and 3 g coriander per 12 g zaatar. Not a recipe for zaatar or a claim about a particular blend; actual sumac/herb/seed mix varies.', 'per100g': {k: .5*PROFILES['sesameSeeds']['per100g'][k]+.25*PROFILES['oregano']['per100g'][k]+.25*PROFILES['coriander']['per100g'][k] for k in KEYS}}

WEIGHTS = {
IDS[4]: {'barley':150,'salt':2.25,'lemonJuice':45,'dill':12,'broccoli':680,'tomatoes':340,'oliveOil':22.5,'blackPepper':1.15,'salmon':567,'zaatar':12,'lemonZest':4,'yogurt':170,'tahini':30,'garlic':4,'pistachios':24,'mustard':10},
IDS[0]: {'cabbage':454,'oliveOil':18,'salt':3.75,'blackPepper':.575,'turkey':567,'onion':225,'garlic':13,'ginger':12,'berbere':7,'paprika':6.8,'cumin':2.1,'cinnamon':.65,'tomatoPaste':32,'crushedTomatoes':794,'lentils':500,'spinach':227,'yogurt':228,'lemonJuice':30,'lemonZest':2,'cilantro':16,'redWineVinegar':10},
IDS[3]: {'chicken':680,'cornstarch':8,'canolaOil':22.5,'shiitakes':227,'carrots':340,'bokChoy':454,'soba':227,'edamame':234,'miso':17,'tamari':16,'riceVinegar':45,'maple':20,'ginger':24,'garlic':9,'limeJuice':30,'sesameOil':9,'gochugaru':2,'sesameSeeds':12,'scallions':24},
IDS[2]: {'pork':907,'oliveOil':27,'garlicPowder':6.2,'cumin':4.2,'oregano':2,'paprika':2.3,'salt':4.5,'blackPepper':1.725,'orangeJuice':120,'limeJuice':60,'garlic':9,'quinoa':255,'blackBeans':500,'cilantro':32,'pineapple':495,'bellPepper':300,'onion':120,'jalapeno':15,'avocado':300,'pepitas':60,'orangeZest':2},
IDS[1]: {'farro':150,'salt':3,'chickpeas':500,'cauliflower':907,'onion':225,'oliveOil':27,'cumin':4.2,'coriander':3.6,'paprika':2.3,'turmeric':1.5,'cayenne':.45,'kale':284,'lemonJuice':75,'tahini':60,'garlic':4,'parsley':15,'cilantro':15,'dates':48,'almonds':35,'pomegranate':175}}

salmon = RECIPES[IDS[4]]
salmon['notes'] = [n.replace('Allergens: Fish, milk, sesame, pistachios and barley gluten.', 'Allergens: Fish, milk, sesame, pistachios, mustard and barley gluten.') for n in salmon['notes']]
salmon['notes'].append('Salmon meal-prep quality: For your first trial, consider freezing the day-3 and day-4 fish portions promptly on prep day and thawing each overnight in the refrigerator before use. This is a flavor/texture preference, not an extension of the 3-4-day refrigerated safety window. Never try to improve an off-smelling fish portion with more seasoning.')
chicken = RECIPES[IDS[3]]
chicken['equipment'].append('Small saucepan for cooking edamame in parallel')
chicken['equipment'].append('Digital kitchen scale')
chicken['instructions'][0] = chicken['instructions'][0].replace('Start the roasted vegetables:', 'Start the oven, noodle water and roasted vegetables:').replace('Heat the oven to 425 F.', 'Heat the oven to 425 F. Put 10 cups unsalted water in the 6-quart noodle pot, cover and begin heating it on a separate burner while preparing the vegetables.')
chicken['instructions'][2] = chicken['instructions'][2].replace('in a saucepan', 'in the small saucepan, separate from the noodle pot')
chicken['instructions'][3] = chicken['instructions'][3].replace('Refill the saucepan with 10 cups unsalted water and bring to a boil.', 'Bring the 10 cups unsalted water already heating in the 6-quart noodle pot to a rolling boil; do not add another 10 cups.')
chicken['groceryIngredients'] = [dict(x, quantity=4/3, note='Toasted, unsalted; measure 12 g total.') if x['item']=='sesame seeds' else dict(x, quantity=24, unit='g', note='Thinly sliced.') if x['item']=='scallion' else x for x in chicken['groceryIngredients']]
chicken['ingredients'][-1] = 'Toppings: 1 tablespoon plus 1 teaspoon (12 g) toasted unsalted sesame seeds and 24 g thinly sliced scallions (about 1/4 cup)'
chicken['instructions'][-1] = 'Portion: Weigh the finished chicken-noodle mixture and distribute it evenly among four shallow containers. Pack 3 g toasted sesame seeds and 6 g sliced scallions per serving separately, using the measured totals of 12 g seeds and 24 g scallions. Add the toppings after reheating. Refrigerate promptly.'
chicken['notes'] = [n.replace('3.4 g sesame seeds', '3 g sesame seeds') for n in chicken['notes']]
chicken['notes'].append('Noodle selection: Hakubaku US/Canada no-salt soba is an example of the intended low-sodium type. The same brand\'s AU/EU versions contain salt. Check the actual package rather than relying on the brand name. Manufacturer reference: https://hakubaku.com.au/product/soba/.')
chicken['notes'][0] = chicken['notes'][0].replace('overlapping oven, skillet and noodle work.', 'overlapping oven, skillet and noodle work on three burners: heat noodle water from the start and cook edamame in its separate small saucepan.')
pork = RECIPES[IDS[2]]
pork['instructions'][-1] = pork['instructions'][-1].replace('Divide the finished salsa into six separate chilled cups.', 'Pack approximately 180 g finished pineapple-pepper salsa in each of six separate chilled cups; produce moisture makes the final yield approximate.')
turkey = RECIPES[IDS[0]]
turkey['notes'][1] = 'Heat control: Berbere varies enormously. For a hot blend, use 1 teaspoon salt-free berbere and 1 tablespoon plus 2 teaspoons sweet paprika in the spice-blooming step, instead of the base 1 tablespoon berbere and 1 tablespoon paprika. Other quantities stay unchanged. Do not use a salty stock cube to compensate for less chile heat.'

fixture = {'basis': 'Planning estimates for complete base meals, not laboratory analyses or guaranteed nutrient ceilings.', 'units': {k: ('kcal' if k=='calories' else 'mg' if k=='sodium' else 'g') for k in KEYS}, 'profiles': PROFILES, 'recipes': {}}
for rid, recipe in RECIPES.items():
    servings = int(recipe['servings'])
    raw = {k: sum(PROFILES[p]['per100g'][k]*g/100 for p,g in WEIGHTS[rid].items()) / servings for k in KEYS}
    increments = {'calories':10,'protein':1,'carbohydrates':1,'fat':1,'fiber':1,'saturatedFat':.5,'sodium':25}
    rounded = {k: math.floor(raw[k]/increments[k]+.5)*increments[k] for k in KEYS}
    recipe['nutrition'] = {'Calories':f"About {rounded['calories']} kcal",'Protein':f"About {rounded['protein']} g",'Carbohydrates':f"About {rounded['carbohydrates']} g",'Fat':f"About {rounded['fat']} g",'Fiber':f"About {rounded['fiber']} g",'Saturated fat':f"About {rounded['saturatedFat']:g} g",'Sodium':f"About {rounded['sodium']} mg"}
    recipe['notes'].append('Nutrition: Approximate per base serving, including the listed sauce, oil and toppings. Calculated using raw meat/fish weights, dry grain weights and about 500 g drained legumes per two cans, with USDA SR Legacy and representative product labels. Brands, cooking losses, drained yields and portion changes alter the result. The repository nutrition audit documents ingredient weights and explicit proxies; these estimates are not a medical certification or a kitchen test.')
    recipe['notes'].append('Water for reheating is a serving-time addition, separate from the cooking water in the ingredient list. Its measured 1 tablespoon per reheated portion adds no meaningful nutrients and is not a grocery purchase.')
    recipe = {k: recipe[k] for k in sorted(recipe)}
    RECIPES[rid] = recipe
    (ROOT/f'data/recipes/{rid}.json').write_text(json.dumps(recipe, indent=2, ensure_ascii=True)+'\n')
    fixture['recipes'][rid] = {'servings':servings,'batchGrams':WEIGHTS[rid],'unroundedPerServing':{k:round(v,6) for k,v in raw.items()},'roundedPerServing':rounded,'ingredients':recipe['ingredients']}
    print(recipe['title'], rounded)
(ROOT/'tests/fixtures/meal_prep_156_nutrition.json').write_text(json.dumps(fixture,indent=2,ensure_ascii=True)+'\n')
grouping = (ROOT/'js/grouping.js').read_text()
assert '"red wine vinegar":' not in grouping
grouping = grouping.replace('const ingredientGroups = {','const ingredientGroups = {\n  "red wine vinegar": "Sauces, Marinades, & Condiments",',1)
(ROOT/'js/grouping.js').write_text(grouping)
