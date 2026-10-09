import { useRef, type TouchEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  ShoppingBasket,
  Settings as SettingsIcon,
  WifiOff,
  Leaf,
} from "lucide-react";
import { useApp } from "./store";
import { useTheme } from "./theme";
import type { Theme } from "./types";
import { Recipes } from "./features/Recipes";
import { RecipeDetail } from "./features/RecipeDetail";
import { Groceries } from "./features/Groceries";
import { Planner } from "./features/Planner";
import { Cooking } from "./features/Cooking";
import { Settings } from "./features/Settings";

const views = [
  { id: "recipes", label: "Recipes", short: "Recipes", icon: BookOpen },
  { id: "plan", label: "Weekly plan", short: "Plan", icon: CalendarDays },
  {
    id: "grocery",
    label: "Groceries",
    short: "Groceries",
    icon: ShoppingBasket,
  },
  {
    id: "settings",
    label: "Settings & data",
    short: "Settings",
    icon: SettingsIcon,
  },
] as const;
export function App() {
  const { state, navigate, setUi, notify, loadRecipes } = useApp();
  const { theme, setTheme } = useTheme();
  const touch = useRef<{ x: number; y: number; time: number } | null>(null);
  const selectedCount = Object.keys(state.runtime.selectedRecipeIds).length;
  function changeTheme(next: Theme) {
    const saved = setTheme(next);
    setUi({ theme: next });
    if (!saved)
      notify(
        "Theme changed for this visit. Your browser could not save the preference.",
      );
  }
  function onTouchStart(event: TouchEvent) {
    if (
      (event.target as Element).closest(
        'button,a,input,select,textarea,summary,[role="dialog"],.collection-tabs',
      )
    )
      return;
    const first = event.touches[0];
    touch.current = { x: first.clientX, y: first.clientY, time: Date.now() };
  }
  function onTouchEnd(event: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (
      !start ||
      Date.now() - start.time > 650 ||
      window.innerWidth > 640 ||
      state.recipeId ||
      state.cooking
    )
      return;
    const end = event.changedTouches[0];
    const dx = end.clientX - start.x,
      dy = end.clientY - start.y;
    if (Math.abs(dx) < 85 || Math.abs(dy) > 50) return;
    const index = views.findIndex((item) => item.id === state.view);
    const next = views[index + (dx < 0 ? 1 : -1)];
    if (next) navigate(next.id);
  }
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "mobile-nav" : "primary-nav"}
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
    >
      {views.map(({ id, label, short, icon: Icon }) => (
        <button
          key={id}
          aria-current={state.view === id ? "page" : undefined}
          onClick={() => navigate(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{mobile ? short : label}</span>
          {!mobile && id === "recipes" && (
            <span className="nav-count">{state.recipes.length || ""}</span>
          )}
          {!mobile && id === "grocery" && selectedCount > 0 && (
            <span className="nav-count">{selectedCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
  return (
    <div
      onClickCapture={(event) => {
        // WebKit does not focus pointer-clicked buttons by default. Capture a
        // consistent opener before dialogs move focus, including React portals.
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        const control = event.target.closest<HTMLElement>(
          "button:not(:disabled),a[href],summary",
        );
        control?.focus({ preventScroll: true });
      }}
    >
      <a className="skip-link" href="#mainContent">
        Skip to main content
      </a>
      <aside className="app-rail">
        <a
          className="brand"
          href="#mainContent"
          onClick={(event) => {
            event.preventDefault();
            navigate("recipes");
          }}
        >
          Recipe
          <br />
          Book<small>ROBERT'S KITCHEN</small>
        </a>
        {nav()}
        <div className="rail-bottom">
          <p>Made for your everyday cooking.</p>
          <label className="theme-control">
            <span>Appearance</span>
            <select
              aria-label="Appearance"
              value={theme}
              onChange={(event) => changeTheme(event.target.value as Theme)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </div>
      </aside>
      <main
        id="mainContent"
        className="app-main"
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <header className="topline">
          <span>
            YOUR KITCHEN /{" "}
            {views.find((view) => view.id === state.view)?.short.toUpperCase()}
          </span>
          <a
            className="mobile-brand"
            href="#mainContent"
            onClick={(event) => {
              event.preventDefault();
              navigate("recipes");
            }}
          >
            Recipe Book
          </a>
          <span>
            {state.offline ? (
              <>
                <WifiOff size={14} aria-hidden="true" />
                Offline
              </>
            ) : (
              <>
                <Leaf size={14} aria-hidden="true" />
                At home in your kitchen
              </>
            )}
          </span>
        </header>
        {state.persistenceError && (
          <div className="status-banner error" role="alert">
            <span>{state.persistenceError}</span>
            <button
              className="text-button"
              onClick={() => navigate("settings")}
            >
              Back up your data
            </button>
          </div>
        )}
        {state.view === "settings" ? (
          <Settings theme={theme} onThemeChange={changeTheme} />
        ) : state.loadState === "loading" ? (
          <div className="loading-state" role="status">
            <BookOpen size={34} aria-hidden="true" />
            <h1 tabIndex={-1}>Opening your recipe book</h1>
            <p>Getting your collection ready.</p>
          </div>
        ) : state.loadState === "error" ? (
          <div className="empty-state" role="alert">
            <BookOpen size={34} aria-hidden="true" />
            <h1 tabIndex={-1}>Your recipes couldn’t load</h1>
            <p>
              {state.offline
                ? "Reconnect once to download the collection. An uncached first visit needs a connection."
                : state.loadError}
            </p>
            <button
              className="button primary"
              onClick={() => void loadRecipes()}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {state.view === "recipes" && <Recipes />}
            {state.view === "grocery" && <Groceries />}
            {state.view === "plan" && <Planner />}
          </>
        )}
      </main>
      {nav(true)}
      <RecipeDetail />
      <Cooking />
      <div
        className="toast"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.message}
      </div>
    </div>
  );
}
