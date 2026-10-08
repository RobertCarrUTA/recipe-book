export type View = 'recipes' | 'plan' | 'grocery' | 'settings';
export type Theme = 'light' | 'dark' | 'system';
export type FilterKey = 'collection' | 'status' | 'rating' | 'difficulty' | 'equipment';
export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export interface Recipe {
  id: string; title: string; collections: string[]; ingredients: string[]; instructions: string[];
  author?: string; description?: string; category?: string; prepTime?: string; cookTime?: string;
  additionalTime?: string; totalTime?: string; servings?: string; yield?: string; link?: string | null;
  tags: {status?: string; rating?: string; difficulty?: string; equipment?: string[]};
  equipment?: string[]; notes?: string[]; personalNotes?: string[]; nutrition?: Record<string, string>;
  rating?: {value?: string | number; count?: number};
  groceryIngredients?: Array<{item: string; quantity?: number | {min:number;max:number}; unit?: string; note?: string}>;
}
export interface MealPlan {days: Record<DayKey, string[]>}
export interface Source {recipeId: string; recipeIndex: number; title: string; multiplier: number; notes: string[]; totals: Record<string, {min:number;max:number}>}
export interface Runtime {
  favoriteRecipeIds: Record<string, boolean>; selectedRecipeIds: Record<string, boolean>;
  recipeMultipliersById: Record<string, number>; groceryCheckedByKey: Record<string, boolean>;
  manualGroceryItemsById: Record<string, {id: string; name: string; note?: string}>;
  displayNamesByKey: Record<string, string>;
  grocery: {totalsByKey: Record<string, Record<string, {min:number;max:number}>>; notesByKey: Record<string, string[]>; sourcesByKey: Record<string, Source[]>};
}
export interface UiState {
  filters: Partial<Record<FilterKey,string[]>>; recipeSearch: string; recipeSort: string;
  collapsedGroceryGroups: Record<string,boolean>; grocerySearchSuffix: string; mobileView: string;
  groupItems: boolean; hideCheckedGroceryItems: boolean; keepScreenAwake: boolean;
  recipeControlsCollapsed: boolean; groceryControlsCollapsed: boolean; skipClearGroceryConfirmation: boolean;
  showFavoriteRecipesOnly: boolean; showSelectedRecipesOnly: boolean; activeView?: View; theme?: Theme;
}
export interface DurableState {runtime: Runtime; mealPlan: MealPlan; ui: UiState}
export interface AppState extends DurableState {
  recipes: Recipe[]; loadState: 'loading'|'ready'|'error'; loadError: string;
  view: View; recipeId: string | null; cooking: {recipeId:string; step:number} | null;
  message: string; persistenceError: string; offline: boolean;
}
