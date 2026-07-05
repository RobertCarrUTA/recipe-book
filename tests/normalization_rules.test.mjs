import assert from "node:assert/strict";

import {
  canonicalNoteTokens,
  commodityIngredientRules,
  ingredientRules,
  leadingIngredientRules,
  unitAliasEntries,
} from "../js/normalization_rules.js";
import { test } from "./test_helpers.mjs";

const matcherKeys = ["includes", "includesAll", "includesAny", "match", "pattern"];

function assertLowercaseTrimmed(value, context) {
  assert.equal(value, value.trim(), `${context} should be trimmed`);
  assert.equal(value, value.toLowerCase(), `${context} should be lowercase`);
}

function assertRuleList(name, rules) {
  assert.ok(Object.isFrozen(rules), `${name} should be frozen`);
  assert.ok(rules.length > 0, `${name} should not be empty`);

  rules.forEach((rule, index) => {
    const context = `${name}[${index}]`;
    assert.ok(Object.isFrozen(rule), `${context} should be frozen`);
    assert.equal(typeof rule.base, "string", `${context}.base should be a string`);
    assert.ok(rule.base.trim(), `${context}.base should not be empty`);
    assertLowercaseTrimmed(rule.base, `${context}.base`);

    if (rule.display !== undefined) {
      assert.equal(typeof rule.display, "string", `${context}.display should be a string`);
      assert.ok(rule.display.trim(), `${context}.display should not be empty`);
      assert.equal(rule.display, rule.display.trim(), `${context}.display should be trimmed`);
    }

    const activeMatchers = matcherKeys.filter((key) => rule[key] !== undefined);
    assert.equal(activeMatchers.length, 1, `${context} should define exactly one matcher`);

    if (rule.includes !== undefined) {
      assert.equal(typeof rule.includes, "string", `${context}.includes should be a string`);
      assertLowercaseTrimmed(rule.includes, `${context}.includes`);
    }

    ["includesAll", "includesAny"].forEach((key) => {
      if (rule[key] === undefined) return;
      assert.ok(Object.isFrozen(rule[key]), `${context}.${key} should be frozen`);
      assert.ok(rule[key].length > 0, `${context}.${key} should not be empty`);
      rule[key].forEach((term, termIndex) => {
        assert.equal(typeof term, "string", `${context}.${key}[${termIndex}] should be a string`);
        assertLowercaseTrimmed(term, `${context}.${key}[${termIndex}]`);
      });
    });

    if (rule.match !== undefined) {
      assert.equal(typeof rule.match, "function", `${context}.match should be a function`);
    }

    if (rule.pattern !== undefined) {
      assert.ok(rule.pattern instanceof RegExp, `${context}.pattern should be a RegExp`);
      assert.ok(!/[gy]/.test(rule.pattern.flags), `${context}.pattern should not be stateful`);
    }

    if (rule.extras !== undefined) {
      assert.ok(Object.isFrozen(rule.extras), `${context}.extras should be frozen`);
      Object.entries(rule.extras).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          assert.ok(Object.isFrozen(value), `${context}.extras.${key} should be frozen`);
        }
      });
    }
  });
}

test("normalization rule lists have valid immutable rule contracts", () => {
  assertRuleList("leadingIngredientRules", leadingIngredientRules);
  assertRuleList("commodityIngredientRules", commodityIngredientRules);
  assertRuleList("ingredientRules", ingredientRules);
});

test("canonical note tokens and unit aliases have valid immutable contracts", () => {
  assert.ok(Object.isFrozen(canonicalNoteTokens), "canonicalNoteTokens should be frozen");
  canonicalNoteTokens.forEach((note, index) => {
    assert.equal(typeof note, "string", `canonicalNoteTokens[${index}] should be a string`);
    assertLowercaseTrimmed(note, `canonicalNoteTokens[${index}]`);
  });

  assert.ok(Object.isFrozen(unitAliasEntries), "unitAliasEntries should be frozen");
  const seenAliases = new Set();
  unitAliasEntries.forEach(([alias, canonical], index) => {
    assert.equal(typeof alias, "string", `unitAliasEntries[${index}][0] should be a string`);
    assert.equal(typeof canonical, "string", `unitAliasEntries[${index}][1] should be a string`);
    assertLowercaseTrimmed(alias, `unitAliasEntries[${index}][0]`);
    assertLowercaseTrimmed(canonical, `unitAliasEntries[${index}][1]`);
    assert.ok(!seenAliases.has(alias), `${alias} should only be declared once`);
    seenAliases.add(alias);
  });
});
