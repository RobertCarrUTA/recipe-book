import {useId, useMemo, useState} from 'react';
import {ArrowRight, ChefHat, ClipboardList, ShoppingBasket, Trash2, X} from 'lucide-react';
import {useApp} from '../store';
import {ConfirmDialog} from '../components/Dialog';
import {applyMealPlanToGroceryList, clearMealPlan, getMealPlanSummary, getRecipeHeaderMeta, mealPlanDays} from '../domain';
import type {DayKey} from '../types';
import './kitchen.css';

export function Planner() {
  const {state, mutate, planAdd, planRemove, cook, notify, navigate, openRecipe} = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBuild, setConfirmBuild] = useState(false);
  const id = useId();
  const recipes = useMemo(() => new Map(state.recipes.map(recipe => [recipe.id, recipe])), [state.recipes]);
  const summary = getMealPlanSummary(state.mealPlan);
  const hasPlan = summary.plannedRecipeCount > 0;
  function buildList() {
    mutate(draft => applyMealPlanToGroceryList(draft.runtime, state.recipes, draft.mealPlan));
    notify('Grocery list built from your week. Repeated recipes include extra quantities.');
    navigate('grocery');
  }
  return <section className="kitchen-planner" aria-labelledby={`${id}-title`}>
    <header className="section-heading kitchen-page-heading"><div><p className="eyebrow">A little planning, easier dinners</p><h1 id={`${id}-title`} tabIndex={-1}>Your week in recipes</h1><p className="kitchen-intro" aria-live="polite">{hasPlan ? `${summary.plannedRecipeCount} ${summary.plannedRecipeCount === 1 ? 'meal' : 'meals'} across ${summary.dayCount} ${summary.dayCount === 1 ? 'day' : 'days'}` : 'Make room for the meals you want to cook.'}</p></div>
      <div className="kitchen-heading-actions"><button className="button quiet" disabled={!hasPlan} onClick={() => setConfirmClear(true)}><Trash2 size={17} aria-hidden="true"/>Clear plan</button><button className="button primary" disabled={!hasPlan || state.loadState !== 'ready'} onClick={() => Object.keys(state.runtime.selectedRecipeIds).length ? setConfirmBuild(true) : buildList()}><ShoppingBasket size={18} aria-hidden="true"/>Build grocery list</button></div>
    </header>
    <p className="kitchen-plan-help"><ClipboardList size={18} aria-hidden="true"/>Add any recipe to a day. Plan it on more than one day to include extra batches in your grocery list.</p>
    <div className="kitchen-week-grid">{mealPlanDays.map(day => {
      const key = day.key as DayKey;
      const planned = state.mealPlan.days[key] || [];
      return <section className="kitchen-plan-day" key={key} aria-labelledby={`${id}-${key}`}>
        <header><h2 id={`${id}-${key}`}>{day.label}</h2><span>{planned.length ? `${planned.length} ${planned.length === 1 ? 'meal' : 'meals'}` : 'Open'}</span></header>
        <ul className="kitchen-plan-items">{planned.length ? planned.map(recipeId => {
          const recipe = recipes.get(recipeId);
          return <li className="kitchen-plan-item" key={recipeId}><div>{recipe ? <button className="kitchen-plan-recipe" onClick={() => openRecipe(recipe.id)}>{recipe.title}</button> : <p className="kitchen-plan-recipe">Recipe no longer available</p>}{recipe && <p className="kitchen-plan-meta">{getRecipeHeaderMeta(recipe).filter(item => !item.primary).slice(0, 2).map(item => item.text).join(' · ')}</p>}</div><div className="kitchen-plan-item-actions">{recipe && <button className="button quiet" onClick={() => cook(recipe)} aria-label={`Cook ${recipe.title}`}><ChefHat size={16} aria-hidden="true"/>Cook</button>}<button className="icon-button" onClick={() => planRemove(key, recipeId)} aria-label={`Remove ${recipe?.title || 'unavailable recipe'} from ${day.label}`}><X size={18} aria-hidden="true"/></button></div></li>;
        }) : <li className="kitchen-day-empty">Nothing planned yet.</li>}</ul>
        <label className="kitchen-day-picker" htmlFor={`${id}-add-${key}`}><span>Add a recipe</span><select id={`${id}-add-${key}`} className="field" value="" disabled={state.loadState !== 'ready'} onChange={event => {if(event.target.value) planAdd(key, event.target.value);}}><option value="">Choose a recipe…</option>{state.recipes.map(recipe => <option key={recipe.id} value={recipe.id} disabled={planned.includes(recipe.id)}>{recipe.title}{planned.includes(recipe.id) ? ' — already planned' : ''}</option>)}</select></label>
      </section>;
    })}</div>
    {!hasPlan && <div className="kitchen-plan-browse"><p>You can also plan a meal from any recipe.</p><button className="button quiet" onClick={() => navigate('recipes')}>Find something to cook<ArrowRight size={17} aria-hidden="true"/></button></div>}
    <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} onConfirm={() => {mutate(draft => clearMealPlan(draft.mealPlan)); notify('Meal plan cleared. Your grocery list is unchanged.');}} title="Clear your meal plan?" description="This removes all recipes from the seven days. Your current grocery list and favorites stay saved." confirmLabel="Clear plan"/>
    <ConfirmDialog open={confirmBuild} onClose={() => setConfirmBuild(false)} onConfirm={buildList} title="Build groceries from this plan?" description="The recipes currently selected for groceries will be replaced with your planned meals. Quantities reflect how many days each recipe is planned. Your manually added items stay on the list." confirmLabel="Build grocery list"/>
  </section>;
}
