import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Plus,
  Settings2,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "../store";
import { ConfirmDialog } from "../components/Dialog";
import {
  addManualGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryState,
  createGroceryListText,
  createGrocerySearchUrl,
  formatCount,
  formatTotalsForKey,
  getDisplayNotes,
  getGroceryExportEntries,
  getGrocerySourceDetail,
  getSortedGrocerySources,
  isManualGroceryItemKey,
  removeManualGroceryItem,
  selectAllRecipes,
  setGroceryChecked,
  sortGroceryGroups,
} from "../domain";
import { writeTextToClipboard } from "../../js/clipboard.js";
import type { Runtime } from "../types";
import "./kitchen.css";

type GrocerySource = {
  id: string;
  title: string;
  multiplier?: number;
  notes: string[];
  totals?: Runtime["grocery"]["totalsByKey"][string];
};
type GroceryEntry = {
  canonicalKey: string;
  checked: boolean;
  group: string;
  notes: string[];
  sources: GrocerySource[];
  totals: Runtime["grocery"]["totalsByKey"][string] | null;
};

export function Groceries() {
  const { state, mutate, setUi, notify, navigate, openRecipe } = useApp();
  const { runtime, ui } = state;
  const [manual, setManual] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [copying, setCopying] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const entries = useMemo(
    () => getGroceryExportEntries(runtime) as GroceryEntry[],
    [runtime],
  );
  const checked = entries.filter((entry) => entry.checked).length;
  const selectedCount = Object.keys(runtime.selectedRecipeIds).length;
  const remaining = entries.length - checked;
  const grouped = useMemo<
    Array<{ name: string; entries: GroceryEntry[] }>
  >(() => {
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const name = ui.groupItems ? entry.group : "Shopping list";
      groups.set(name, [...(groups.get(name) || []), entry]);
    }
    return sortGroceryGroups([...groups.keys()]).map((name: string) => ({
      name,
      entries: (groups.get(name) || []).sort((a, b) =>
        a.canonicalKey.localeCompare(b.canonicalKey),
      ),
    }));
  }, [entries, ui.groupItems]);

  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!manual.trim()) return;
    mutate((draft) => {
      addManualGroceryItem(draft.runtime, manual);
    });
    setManual("");
    notify("Item added to your grocery list.");
  }
  function clearList() {
    mutate((draft) => {
      clearGroceryState(draft.runtime);
      if (skipConfirmation) draft.ui.skipClearGroceryConfirmation = true;
    });
    notify("Grocery list cleared. Your favorites and meal plan are unchanged.");
  }
  function requestClear() {
    if (ui.skipClearGroceryConfirmation) clearList();
    else {
      setSkipConfirmation(false);
      setConfirmClear(true);
    }
  }
  async function copyList() {
    setCopying(true);
    try {
      await writeTextToClipboard(createGroceryListText(runtime, ui));
      notify("Grocery list copied.");
    } catch {
      notify(
        "The list could not be copied. Check your browser clipboard permission and try again.",
      );
    } finally {
      setCopying(false);
    }
  }
  function checkItem(key: string, next: boolean) {
    const inputs = Array.from(
      listRef.current?.querySelectorAll<HTMLInputElement>(".grocery-check") ||
        [],
    );
    const inputIndex = inputs.findIndex((input) => input.dataset.key === key);
    const nextKey =
      inputs[inputIndex + 1]?.dataset.key ||
      inputs[inputIndex - 1]?.dataset.key;
    mutate((draft) => setGroceryChecked(draft.runtime, key, next));
    if (next && ui.hideCheckedGroceryItems)
      requestAnimationFrame(() => {
        const nextInput = Array.from(
          listRef.current?.querySelectorAll<HTMLInputElement>(
            ".grocery-check",
          ) || [],
        ).find((input) => input.dataset.key === nextKey);
        (nextInput || listRef.current)?.focus({ preventScroll: true });
      });
  }

  function renderRows(items: typeof entries, groupName: string) {
    const visible = ui.hideCheckedGroceryItems
      ? items.filter((entry) => !entry.checked)
      : items;
    if (!visible.length)
      return (
        <p className="kitchen-group-done">
          <Check size={17} aria-hidden="true" /> Everything in {groupName} is
          checked.
        </p>
      );
    return (
      <ul className="kitchen-grocery-rows">
        {visible.map((entry) => {
          const key = entry.canonicalKey;
          const name = runtime.displayNamesByKey[key] || key;
          const manualItem = isManualGroceryItemKey(key);
          const amount = entry.totals
            ? formatTotalsForKey(entry.totals, {
                canonicalKey: key,
                displayName: name,
              })
            : "";
          const notes = getDisplayNotes(entry.notes, entry.sources);
          const sources = getSortedGrocerySources(
            entry.sources,
          ) as GrocerySource[];
          const searchUrl = createGrocerySearchUrl(
            name,
            ui.grocerySearchSuffix,
          );
          return (
            <li
              key={key}
              className={`kitchen-grocery-row${entry.checked ? " is-checked" : ""}`}
            >
              <div className="kitchen-grocery-item">
                <label className="kitchen-grocery-label">
                  <input
                    className="grocery-check"
                    data-key={key}
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(event) => checkItem(key, event.target.checked)}
                    aria-label={`Check ${name}${amount ? `, ${amount}` : ""}`}
                  />
                  <span>
                    <span className="kitchen-item-name">{name}</span>
                    {amount && (
                      <span className="kitchen-item-amount">{amount}</span>
                    )}
                    {notes.length > 0 && (
                      <span className="kitchen-item-notes">
                        {notes.join(", ")}
                      </span>
                    )}
                  </span>
                </label>
                <div className="kitchen-item-actions">
                  <a
                    className="icon-button"
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    aria-label={`Search for ${name}${ui.grocerySearchSuffix ? ` ${ui.grocerySearchSuffix}` : ""} (opens in a new tab)`}
                    title={`Search for ${name}`}
                  >
                    <ExternalLink size={17} aria-hidden="true" />
                  </a>
                  {manualItem && (
                    <button
                      className="icon-button"
                      onClick={() => {
                        mutate((draft) =>
                          removeManualGroceryItem(draft.runtime, key),
                        );
                        notify(`${name} removed.`);
                      }}
                      aria-label={`Remove ${name}`}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {manualItem ? (
                <p className="kitchen-source-note">Added by you</p>
              ) : (
                sources.length > 0 && (
                  <details className="kitchen-sources">
                    <summary>
                      From {formatCount(sources.length, "recipe", "recipes")}{" "}
                      <ChevronDown size={14} aria-hidden="true" />
                    </summary>
                    <ul>
                      {sources.map((source) => {
                        const detail = getGrocerySourceDetail(source, {
                          canonicalKey: key,
                          displayName: name,
                        });
                        return (
                          <li key={source.id}>
                            <button
                              type="button"
                              className="kitchen-source-link"
                              onClick={() => openRecipe(source.id, true)}
                            >
                              {detail.title}
                            </button>
                            {detail.metaText && <span>{detail.metaText}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="kitchen-groceries" aria-labelledby={`${id}-title`}>
      <header className="section-heading kitchen-page-heading">
        <div>
          <p className="eyebrow">Ready for the store</p>
          <h1 id={`${id}-title`} tabIndex={-1}>
            Your grocery list
          </h1>
          <p className="kitchen-intro" aria-live="polite">
            {entries.length
              ? `${remaining} to pick up · ${checked} checked${selectedCount ? ` · from ${formatCount(selectedCount, "recipe", "recipes")}` : ""}`
              : "Add a recipe or jot down the extras you need."}
          </p>
        </div>
        <button
          className="button quiet"
          aria-expanded={!ui.groceryControlsCollapsed}
          aria-controls={`${id}-tools`}
          onClick={() =>
            setUi({ groceryControlsCollapsed: !ui.groceryControlsCollapsed })
          }
        >
          <Settings2 size={18} aria-hidden="true" /> List options{" "}
          {ui.groceryControlsCollapsed ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronUp size={16} aria-hidden="true" />
          )}
        </button>
      </header>
      <div className="kitchen-grocery-top">
        <form className="kitchen-add-item" onSubmit={addItem}>
          <label htmlFor={`${id}-manual`} className="kitchen-sr-only">
            Add grocery item
          </label>
          <input
            id={`${id}-manual`}
            className="field"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Add an item, like lemons or coffee"
            maxLength={80}
            autoComplete="off"
            enterKeyHint="done"
          />
          <button
            className="button primary"
            type="submit"
            disabled={!manual.trim()}
          >
            <Plus size={18} aria-hidden="true" />
            Add
          </button>
        </form>
        <div
          id={`${id}-tools`}
          className="kitchen-list-tools"
          hidden={ui.groceryControlsCollapsed}
        >
          <div className="kitchen-option-row">
            <label className="kitchen-toggle">
              <input
                type="checkbox"
                checked={ui.groupItems}
                onChange={(event) =>
                  setUi({ groupItems: event.target.checked })
                }
              />
              Group by section
            </label>
            <label className="kitchen-toggle">
              <input
                type="checkbox"
                checked={ui.hideCheckedGroceryItems}
                onChange={(event) =>
                  setUi({ hideCheckedGroceryItems: event.target.checked })
                }
                disabled={!entries.length}
              />
              Hide checked
            </label>
          </div>
          <div className="kitchen-list-actions">
            <button
              className="button quiet"
              disabled={!entries.length || copying}
              onClick={copyList}
            >
              <Copy size={16} aria-hidden="true" />
              {copying ? "Copying…" : "Copy list"}
            </button>
            <button
              className="button quiet"
              disabled={!checked}
              title="Remove checked manual items and reset checks on recipe ingredients"
              onClick={() => {
                mutate((draft) => clearCheckedGroceryItems(draft.runtime));
                notify(
                  "Checked manual items removed. Recipe ingredients are unchecked.",
                );
              }}
            >
              Clear checked
            </button>
            <button
              className="button quiet"
              disabled={state.loadState !== "ready"}
              onClick={() => {
                mutate((draft) =>
                  selectAllRecipes(draft.runtime, state.recipes),
                );
                notify("All recipes added to your grocery list.");
              }}
            >
              Add all recipes
            </button>
            <button
              className="button danger"
              disabled={!entries.length}
              onClick={requestClear}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete all
            </button>
          </div>
          <div className="kitchen-list-secondary">
            <label htmlFor={`${id}-suffix`}>
              Search suffix<span>Added when you search for an item.</span>
              <input
                id={`${id}-suffix`}
                className="field"
                value={ui.grocerySearchSuffix}
                onChange={(event) =>
                  setUi({ grocerySearchSuffix: event.target.value })
                }
                maxLength={80}
                placeholder="For example, your store name"
              />
            </label>
            <button
              className="kitchen-text-button"
              onClick={() => navigate("settings")}
            >
              Import or export a backup
            </button>
          </div>
        </div>
        {entries.length > 0 && (
          <div className="kitchen-shopping-progress">
            <progress
              value={checked}
              max={entries.length}
              aria-label="Grocery progress"
              aria-valuetext={`${checked} of ${entries.length} items checked`}
            />
            <span>
              {checked} / {entries.length}
            </span>
          </div>
        )}
      </div>
      <div
        className="kitchen-grocery-list"
        ref={listRef}
        tabIndex={-1}
        aria-label="Grocery items"
      >
        {!entries.length ? (
          <div className="empty-state kitchen-empty">
            <ShoppingBasket size={34} aria-hidden="true" />
            <h2>A fresh list</h2>
            <p>
              Add ingredients from your recipes, build a list from your plan, or
              add an item above.
            </p>
            <button
              className="button primary"
              onClick={() => navigate("recipes")}
            >
              Browse recipes
            </button>
          </div>
        ) : ui.hideCheckedGroceryItems && !remaining ? (
          <div className="empty-state kitchen-empty">
            <Check size={34} aria-hidden="true" />
            <h2>Everything is checked</h2>
            <p>
              Your shopping is done. Show checked items to review your list.
            </p>
            <button
              className="button quiet"
              onClick={() => setUi({ hideCheckedGroceryItems: false })}
            >
              Show checked items
            </button>
          </div>
        ) : (
          grouped.map((group, index) => {
            const collapsed =
              ui.groupItems && Boolean(ui.collapsedGroceryGroups[group.name]);
            const groupId = `${id}-group-${index}`;
            return (
              <section
                className="kitchen-grocery-group"
                key={group.name}
                aria-label={group.name}
              >
                {ui.groupItems && (
                  <h2>
                    <button
                      className="kitchen-group-toggle"
                      aria-expanded={!collapsed}
                      aria-controls={groupId}
                      onClick={() =>
                        setUi({
                          collapsedGroceryGroups: {
                            ...ui.collapsedGroceryGroups,
                            [group.name]: !collapsed,
                          },
                        })
                      }
                    >
                      <span>{group.name}</span>
                      <span className="kitchen-group-count">
                        {group.entries.filter((entry) => entry.checked).length}{" "}
                        / {group.entries.length}
                      </span>
                      <ChevronDown size={19} aria-hidden="true" />
                    </button>
                  </h2>
                )}
                <div id={groupId} hidden={collapsed}>
                  {renderRows(group.entries, group.name)}
                </div>
              </section>
            );
          })
        )}
      </div>
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearList}
        title="Delete your grocery list?"
        description="This removes all grocery items and clears recipe selections and quantities for this list. Your favorites and meal plan stay saved."
        confirmLabel="Delete all"
      >
        <label className="kitchen-toggle">
          <input
            type="checkbox"
            checked={skipConfirmation}
            onChange={(event) => setSkipConfirmation(event.target.checked)}
          />
          Don’t ask again
        </label>
      </ConfirmDialog>
    </section>
  );
}
