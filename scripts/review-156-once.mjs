// Temporary review evidence collector. No recipe or runtime files are changed in this phase.
import assert from "node:assert/strict";
import childProcess from "node:child_process";

const branch = childProcess.execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
assert.equal(branch, "recipes/156-heart-conscious-meal-prep");
childProcess.execFileSync("python3", ["-c", String.raw`
import csv
import io
import json
import pathlib
import re
import urllib.request
import zipfile

url = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
with urllib.request.urlopen(url, timeout=90) as response:
    archive_bytes = response.read(20000000)
archive = zipfile.ZipFile(io.BytesIO(archive_bytes))

def rows(filename: str) -> list[dict[str, str]]:
    """Read a named CSV from the USDA archive.

    Parameters
    ----------
    filename : str
        Basename of the requested CSV.

    Returns
    -------
    list of dict
        Decoded rows with the original field names.
    """
    candidates = [name for name in archive.namelist() if pathlib.PurePosixPath(name).name == filename]
    if len(candidates) != 1:
        raise ValueError(f"Expected one {filename}, found {candidates}")
    text = archive.read(candidates[0]).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))

terms = re.compile(r"salmon|turkey, ground|chicken, broilers or fryers, breast|pork, fresh, loin, tenderloin|barley|spelt|wheat, durum|quinoa|lentils|chickpeas|garbanzo|beans, black|edamame|soybeans, green|noodles, japanese, soba|broccoli|tomatoes|cabbage|spinach|mushrooms, shiitake|carrots|pak-choi|bok choy|kale|cauliflower|peppers, sweet, red|onions|pineapple|avocados|pomegranates|dates, medjool|pistachio|almonds|pumpkin and squash seed|sesame|tahini|miso|tamari|mustard|vinegar|maple|olive|canola|lemon|lime|orange juice|dill|parsley|coriander|cilantro|garlic|ginger|cumin|paprika|cinnamon|turmeric|oregano|pepper, black|pepper, red|salt, table|cornstarch|scallion|yogurt, greek", re.I)
foods = {row["fdc_id"]: {"fdcId": int(row["fdc_id"]), "description": row["description"], "nutrients": {}} for row in rows("food.csv") if terms.search(row["description"])}
wanted = {"1008": "calories", "1003": "protein", "1004": "fat", "1005": "carbohydrates", "1079": "fiber", "1258": "saturatedFat", "1093": "sodium", "1092": "potassium"}
for row in rows("food_nutrient.csv"):
    if row["fdc_id"] in foods and row["nutrient_id"] in wanted and row["amount"]:
        foods[row["fdc_id"]]["nutrients"][wanted[row["nutrient_id"]]] = float(row["amount"])
output = {"source": url, "basis": "USDA SR Legacy, per 100 g edible portion; energy kcal, sodium/potassium mg, other selected nutrients g", "foods": list(foods.values())}
pathlib.Path("docs/review-156-fooddata.tmp.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
print(f"Collected {len(foods)} candidate USDA records for manual selection; no nutrition claims written to recipes yet.")
`], { stdio: "inherit" });
