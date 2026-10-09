// Wire-data validation is deliberately separate from the tolerant UI normalizer:
// malformed recognized fields must never replace a last-known-good collection.
export function validRecipeCollection(data) {
  const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const text = (value) => typeof value === 'string' && Boolean(value.trim());
  const optional = (value, validate) => value == null || validate(value);
  const strings = (value) => Array.isArray(value) && value.every(text);
  const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const stringFields = (value, fields) => fields.every((field) => optional(value[field], (entry) => typeof entry === 'string'));
  const quantity = (value) => {
    if (value == null || value === '') return true;
    if (number(value)) return true;
    if (object(value)) return number(value.min) && number(value.max) && value.max >= value.min;
    if (typeof value !== 'string') return false;
    const fractions = {'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4','⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅚':'5/6','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
    let normalized = value;
    for (const [symbol, replacement] of Object.entries(fractions)) normalized = normalized.replaceAll(symbol, ` ${replacement}`);
    normalized = normalized.trim().replace(/\s+/g, ' ').replace(/-\s*to\s+/gi, '-');
    const scalar = (entry) => {
      if (/^\d+(?:\.\d+)?$/.test(entry)) return Number(entry);
      const match = entry.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      return match && Number(match[3]) > 0 ? Number(match[1] || 0) + Number(match[2]) / Number(match[3]) : NaN;
    };
    const parts = normalized.split(/\s*(?:-|to)\s*/i);
    const values = parts.map(scalar);
    return values.length >= 1 && values.length <= 2 && values.every(number) && (values.length === 1 || values[1] >= values[0]);
  };
  const grocery = (entry) => object(entry)
    && ['item','name','canonical','display'].some((key) => text(entry[key]))
    && stringFields(entry, ['item','name','canonical','display','unit','units','note','marker','original','text'])
    && quantity(entry.quantity) && quantity(entry.amount)
    && optional(entry.notes, strings) && optional(entry.optional, (value) => typeof value === 'boolean');
  const ids = new Set();
  return Array.isArray(data) && data.length > 0 && data.every((recipe) => {
    if (!object(recipe) || !text(recipe.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id) || ids.has(recipe.id) || !text(recipe.title)) return false;
    if (!['ingredients','instructions'].every((field) => strings(recipe[field]) && recipe[field].length > 0)) return false;
    if (!Array.isArray(recipe.groceryIngredients) || !recipe.groceryIngredients.length || !recipe.groceryIngredients.every(grocery)) return false;
    if (!stringFields(recipe, ['author','description','category','prepTime','cookTime','additionalTime','totalTime','servings','yield','link'])) return false;
    if (!['collections','equipment','notes','personalNotes'].every((field) => optional(recipe[field], strings))) return false;
    if (!optional(recipe.link, (link) => { if (!link.trim()) return true; try {return ['http:','https:'].includes(new URL(link).protocol);} catch {return false;} })) return false;
    if (!optional(recipe.nutrition, (value) => object(value) && Object.values(value).every((entry) => optional(entry, (part) => typeof part === 'string')))) return false;
    if (!optional(recipe.rating, (value) => object(value) && optional(value.value, (rating) => rating === '' || number(rating) && rating <= 5) && optional(value.count, (count) => count === '' || number(count) && Number.isSafeInteger(count)))) return false;
    if (!optional(recipe.tags, (tags) => object(tags)
      && optional(tags.status, (value) => value === '' || ['tried','not-tried'].includes(value))
      && optional(tags.rating, (value) => value === '' || ['great','good','okay'].includes(value))
      && optional(tags.difficulty, (value) => value === '' || ['easy','medium','hard'].includes(value))
      && optional(tags.equipment, strings))) return false;
    ids.add(recipe.id); return true;
  });
}
