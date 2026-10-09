// Minimal compatibility fixture of the guard in js/storage.js at baseline 3117d47.
// The original save/clear APIs check this origin-wide marker on every operation.
// Keep this fixture at version 6; using the current module would hide regressions.
export function saveLegacyV6Selection(storage, recipeId) {
  const rawVersion = Number(storage.getItem("offline_recipebook_storage_version"));
  const version = Number.isInteger(rawVersion) && rawVersion > 0 ? rawVersion : 1;
  if (version > 6) return false;
  storage.setItem("offline_recipebook_storage_version", "6");
  storage.setItem("offline_recipebook_selected_recipes_v1", JSON.stringify({ [recipeId]: true }));
  return true;
}
