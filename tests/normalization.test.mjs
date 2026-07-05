import assert from "node:assert/strict";

import {
  buildCanonicalIngredient,
  normalizeUnicodeFractions,
  normalizeUnit,
  normalizeWhitespace,
  parseNumberToken,
  parseQuantityRange,
  removeParentheticalsAndTrailingNotes,
  repairTextEncoding,
} from "../js/normalization.js";
import { test } from "./test_helpers.mjs";

test("normalizeWhitespace and normalizeUnicodeFractions make quantity text parseable", () => {
  assert.equal(normalizeWhitespace("  1\n\tcup   flour  "), "1 cup flour");
  assert.equal(normalizeUnicodeFractions("1\u00bd cups sugar"), "1 1/2 cups sugar");
  assert.equal(normalizeUnicodeFractions("\u00bd cup milk"), "1/2 cup milk");
  assert.equal(normalizeUnicodeFractions("\u00c2\u00be tsp salt"), "3/4 tsp salt");
  assert.equal(normalizeUnicodeFractions("1\u00c2\u00bd cups sugar"), "1 1/2 cups sugar");
});

test("parseNumberToken and parseQuantityRange handle common quantity shapes", () => {
  assert.equal(parseNumberToken("2.5"), 2.5);
  assert.equal(parseNumberToken("3/4"), 0.75);
  assert.equal(parseNumberToken("1/0"), null);
  assert.equal(parseNumberToken("about"), null);

  assert.deepEqual(parseQuantityRange("1 1/2"), { min: 1.5, max: 1.5 });
  assert.deepEqual(parseQuantityRange("1/2 - 3/4"), { min: 0.5, max: 0.75 });
  assert.deepEqual(parseQuantityRange("2 to 3"), { min: 2, max: 3 });
  assert.equal(parseQuantityRange("a little"), null);
});

test("normalizeUnit canonicalizes common units and keeps unknown shopping units", () => {
  assert.equal(normalizeUnit("Tablespoons"), "tbsp");
  assert.equal(normalizeUnit("PKGS"), "package");
  assert.equal(normalizeUnit("Egg whites"), "egg white");
  assert.equal(normalizeUnit("head"), "head");
  assert.equal(normalizeUnit(""), null);
});

test("removeParentheticalsAndTrailingNotes keeps primary package weights", () => {
  assert.equal(
    removeParentheticalsAndTrailingNotes("whole chicken (4-pound / 1.8 kg), thawed"),
    "whole chicken thawed 4 lb"
  );
  assert.equal(removeParentheticalsAndTrailingNotes("beans (drained), rinsed"), "beans rinsed");
});

test("buildCanonicalIngredient preserves distinctions that affect shopping", () => {
  assert.deepEqual(buildCanonicalIngredient("white chocolate chips"), {
    base: "white chocolate",
    display: "white chocolate",
  });
  assert.deepEqual(buildCanonicalIngredient("extra-virgin olive oil"), {
    base: "extra-virgin olive oil",
    display: "extra-virgin olive oil",
  });
  assert.deepEqual(buildCanonicalIngredient("fresh thyme sprigs"), {
    base: "fresh thyme",
    display: "fresh thyme",
  });
});

test("buildCanonicalIngredient keeps specific ordered rules ahead of generic fallbacks", () => {
  const cases = [
    ["red bell pepper", { base: "red bell pepper", display: "red bell pepper" }],
    ["bell pepper", { base: "bell pepper", display: "bell pepper" }],
    ["celery seed", { base: "celery seed", display: "celery seed" }],
    ["celery", { base: "celery", display: "celery" }],
    ["yellow mustard seed", { base: "yellow mustard seed", display: "yellow mustard seed" }],
    ["yellow mustard", { base: "yellow mustard", display: "yellow mustard" }],
    ["dried bay leaves", { base: "dried bay leaf", display: "dried bay leaf" }],
    ["bay leaves", { base: "bay leaf", display: "bay leaf" }],
    ["fresh rosemary sprigs", { base: "fresh rosemary", display: "fresh rosemary" }],
    ["rosemary sprigs", { base: "rosemary sprig", display: "rosemary sprig" }],
    ["potato bun and brioche bun", { base: "potato bun or brioche bun", display: "potato bun or brioche bun" }],
    ["potato bun", { base: "potato bun", display: "potato bun" }],
    ["semi-sweet chocolate chips", { base: "semi-sweet chocolate chips", display: "semi-sweet chocolate chips" }],
    ["chocolate chips", { base: "chocolate", display: "chocolate" }],
    ["lard or unsalted butter", { base: "lard or unsalted butter", display: "lard or unsalted butter" }],
    ["unsalted butter", { base: "unsalted butter", display: "unsalted butter", notes: [] }],
  ];

  cases.forEach(([input, expected]) => {
    assert.deepEqual(buildCanonicalIngredient(input), expected);
  });
});

test("buildCanonicalIngredient returns fresh mutable canonical objects", () => {
  const first = buildCanonicalIngredient("dark or semi-sweet chocolate");
  first.notes.push("changed by caller");

  assert.deepEqual(buildCanonicalIngredient("dark or semi-sweet chocolate"), {
    base: "chocolate",
    display: "Chocolate (dark OR semi-sweet)",
    notes: [],
  });
});

test("repairTextEncoding fixes common mojibake without touching non-strings", () => {
  assert.equal(
    repairTextEncoding("Bake at 350\u00c2\u00b0F until caf\u00c3\u00a9 brown"),
    "Bake at 350\u00b0F until caf\u00e9 brown"
  );
  assert.equal(repairTextEncoding(42), 42);
});
