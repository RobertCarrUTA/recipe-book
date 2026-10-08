import {useCallback, useEffect, useRef, useState, type TouchEvent} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, List, Sun} from 'lucide-react';
import {useApp} from '../store';
import {Dialog} from '../components/Dialog';
import {getRecipeHeaderMeta} from '../domain';
import {useWakeLock} from './useWakeLock';
import './kitchen.css';

export function Cooking() {
  const {state, setCooking, setUi, notify} = useApp();
  const [compact, setCompact] = useState(() => Boolean(window.matchMedia?.('(max-width: 767px)').matches));
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{x:number;y:number;time:number} | null>(null);
  const failedWakeLock = useCallback(() => {
    setUi({keepScreenAwake:false});
    notify('Your browser could not keep the screen awake. You can try again or adjust your device’s screen settings.');
  }, [setUi, notify]);
  const wakeLock = useWakeLock(state.ui.keepScreenAwake, failedWakeLock);
  const recipe = state.recipes.find(item => item.id === state.cooking?.recipeId);
  const steps = recipe?.instructions.length ? recipe.instructions : ['No instructions are available for this recipe yet.'];
  const step = Math.max(0, Math.min(state.cooking?.step || 0, steps.length - 1));
  const recipeId = recipe?.id;
  const active = Boolean(state.cooking && recipe);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)');
    if (!media) return;
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {setIngredientsOpen(false); setHeaderCollapsed(false);}, [recipeId, active]);
  useEffect(() => {if (stepRef.current) stepRef.current.scrollTop = 0;}, [step, recipeId]);
  const move = useCallback((offset: number, finish = false) => {
    if (!recipeId) return;
    if (finish && step === steps.length - 1) {setCooking(null); notify('Cooking finished. Enjoy your meal.'); return;}
    setCooking({recipeId, step:Math.max(0, Math.min(steps.length - 1, step + offset))});
  }, [recipeId, step, steps.length, setCooking, notify]);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);}
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, move]);
  function beginSwipe(event: TouchEvent) {
    if (event.touches.length !== 1) {touchStart.current = null; return;}
    const touch = event.touches[0]; touchStart.current = {x:touch.clientX,y:touch.clientY,time:Date.now()};
  }
  function endSwipe(event: TouchEvent) {
    const start = touchStart.current; touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0]; const x = touch.clientX - start.x; const y = touch.clientY - start.y;
    if (Date.now() - start.time > 900 || Math.abs(x) < 56 || Math.abs(x) < Math.abs(y) * 1.35) return;
    move(x < 0 ? 1 : -1);
  }
  if (!active || !recipe) return null;
  const ingredientsExpanded = !compact || ingredientsOpen;
  const progress = Math.round(((step + 1) / steps.length) * 100);
  return <Dialog open={active} onClose={() => setCooking(null)} title={recipe.title} className={`kitchen-cooking${headerCollapsed ? ' is-header-collapsed' : ''}`} footer={<>
    <div className="kitchen-awake"><label className="kitchen-toggle"><input type="checkbox" checked={state.ui.keepScreenAwake} disabled={!wakeLock.supported} onChange={event => setUi({keepScreenAwake:event.target.checked})}/><Sun size={17} aria-hidden="true"/>Keep screen awake</label><span>{!wakeLock.supported ? 'Unavailable in this browser' : wakeLock.active ? 'Screen will stay awake' : state.ui.keepScreenAwake ? 'Requesting…' : ''}</span></div>
    <div className="kitchen-cooking-navigation"><button className="button quiet" disabled={step === 0} onClick={() => move(-1)}><ArrowLeft size={19} aria-hidden="true"/>Previous</button><button className="button primary" onClick={() => move(1, true)} autoFocus>{step === steps.length - 1 ? <>Finish<Check size={20} aria-hidden="true"/></> : <>Next step<ArrowRight size={20} aria-hidden="true"/></>}</button></div>
  </>}>
    <div className="kitchen-cooking-topline"><p className="eyebrow">Cooking mode</p><button className="kitchen-text-button" aria-expanded={!headerCollapsed} aria-controls="kitchen-cooking-meta" onClick={() => setHeaderCollapsed(value => !value)}>{headerCollapsed ? 'Show details' : 'Hide details'}{headerCollapsed ? <ChevronDown size={17} aria-hidden="true"/> : <ChevronUp size={17} aria-hidden="true"/>}</button></div>
    <p id="kitchen-cooking-meta" className="kitchen-cooking-meta" hidden={headerCollapsed}>{getRecipeHeaderMeta(recipe).filter(item => !item.primary).map(item => item.text).join(' · ')}</p>
    <progress className="kitchen-cooking-progress" value={step + 1} max={steps.length} aria-label="Cooking progress" aria-valuetext={`Step ${step + 1} of ${steps.length}, ${progress}% complete`}/>
    <div className="kitchen-cooking-layout">
      <aside className="kitchen-cooking-ingredients"><h3><button type="button" disabled={!compact} aria-expanded={ingredientsExpanded} aria-controls="kitchen-cooking-ingredient-list" onClick={() => setIngredientsOpen(value => !value)}><List size={18} aria-hidden="true"/><span>Ingredients <small>{recipe.ingredients.length} items</small></span>{compact && <ChevronDown size={18} aria-hidden="true"/>}</button></h3><div id="kitchen-cooking-ingredient-list" hidden={!ingredientsExpanded}>{recipe.ingredients.length ? <ul>{recipe.ingredients.map((ingredient, index) => <li key={index}>{ingredient}</li>)}</ul> : <p>No ingredients are listed for this recipe.</p>}</div></aside>
      <div className="kitchen-cooking-step" ref={stepRef} onTouchStart={beginSwipe} onTouchEnd={endSwipe} onTouchCancel={() => {touchStart.current = null;}} aria-live="polite" aria-atomic="true"><p className="kitchen-step-count">Step {step + 1} <span>of {steps.length}</span></p><p className="kitchen-step-instruction">{steps[step]}</p></div>
    </div>
  </Dialog>;
}
