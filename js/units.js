/* ================================
UNIT CONVERSIONS
  - volume base: tsp
  - weight base: oz
================================ */
export function convertToBaseUnits(quantityRange, unitKey) {
  if (!quantityRange || !unitKey) return null;

  const volumeFactorsToTsp = {
    tsp: 1,
    tbsp: 3,
    cup: 48,
  };

  const weightFactorsToOz = {
    oz: 1,
    lb: 16,
  };

  const metricWeightFactorsToG = {
    g: 1,
    kg: 1000,
  };

  const metricVolumeFactorsToMl = {
    ml: 1,
    l: 1000,
  };

  if (Object.prototype.hasOwnProperty.call(volumeFactorsToTsp, unitKey)) {
    const factor = volumeFactorsToTsp[unitKey];
    return {
      baseUnit: "tsp",
      min: quantityRange.min * factor,
      max: quantityRange.max * factor,
    };
  }

  if (Object.prototype.hasOwnProperty.call(weightFactorsToOz, unitKey)) {
    const factor = weightFactorsToOz[unitKey];
    return {
      baseUnit: "oz",
      min: quantityRange.min * factor,
      max: quantityRange.max * factor,
    };
  }

  if (Object.prototype.hasOwnProperty.call(metricWeightFactorsToG, unitKey)) {
    const factor = metricWeightFactorsToG[unitKey];
    return {
      baseUnit: "g",
      min: quantityRange.min * factor,
      max: quantityRange.max * factor,
    };
  }

  if (Object.prototype.hasOwnProperty.call(metricVolumeFactorsToMl, unitKey)) {
    const factor = metricVolumeFactorsToMl[unitKey];
    return {
      baseUnit: "ml",
      min: quantityRange.min * factor,
      max: quantityRange.max * factor,
    };
  }

  return {
    baseUnit: unitKey,
    min: quantityRange.min,
    max: quantityRange.max,
  };
}

export function addRange(existingRange, addRangeValue) {
  return {
    min: (existingRange ? existingRange.min : 0) + addRangeValue.min,
    max: (existingRange ? existingRange.max : 0) + addRangeValue.max,
  };
}

/* ================================
DISPLAY FORMATTING
================================ */
export function formatRange(rangeValue) {
  const min = rangeValue.min;
  const max = rangeValue.max;

  function roundForDisplay(value) {
    return Math.round(value * 100) / 100;
  }

  function formatQuantity(value) {
    const rounded = roundForDisplay(value);
    const whole = Math.trunc(rounded);
    const fraction = rounded - whole;
    const commonFractions = [
      [1 / 8, "1/8"],
      [1 / 6, "1/6"],
      [1 / 4, "1/4"],
      [1 / 3, "1/3"],
      [1 / 2, "1/2"],
      [2 / 3, "2/3"],
      [3 / 4, "3/4"],
    ];
    const fractionMatch = commonFractions.find(([valuePart]) => Math.abs(fraction - valuePart) < 0.01);

    if (Math.abs(rounded - Math.round(rounded)) < 0.01) return String(Math.round(rounded));
    if (!fractionMatch) return String(rounded);
    if (whole === 0) return fractionMatch[1];
    return `${whole} ${fractionMatch[1]}`;
  }

  const minRounded = roundForDisplay(min);
  const maxRounded = roundForDisplay(max);

  if (Math.abs(minRounded - maxRounded) < 1e-9) {
    return formatQuantity(minRounded);
  }
  return `${formatQuantity(minRounded)}-${formatQuantity(maxRounded)}`;
}

export function formatScaledRange(rangeValue, divisor) {
  return formatRange({
    min: rangeValue.min / divisor,
    max: rangeValue.max / divisor,
  });
}

export function formatTotalsForKey(totals, options = {}) {
  const parts = [];

  const unitLabels = {
    bag: ["bag", "bags"],
    block: ["block", "blocks"],
    bottle: ["bottle", "bottles"],
    bunch: ["bunch", "bunches"],
    can: ["can", "cans"],
    clove: ["clove", "cloves"],
    cup: ["cup", "cups"],
    egg: ["egg", "eggs"],
    "egg white": ["egg white", "egg whites"],
    g: ["g", "g"],
    item: ["item", "items"],
    jar: ["jar", "jars"],
    kg: ["kg", "kg"],
    leaf: ["leaf", "leaves"],
    lb: ["lb", "lb"],
    ml: ["ml", "ml"],
    oz: ["oz", "oz"],
    package: ["package", "packages"],
    sheet: ["sheet", "sheets"],
    slice: ["slice", "slices"],
    sprig: ["sprig", "sprigs"],
    stalk: ["stalk", "stalks"],
    stick: ["stick", "sticks"],
    tbsp: ["tbsp", "tbsp"],
    tsp: ["tsp", "tsp"],
    yolk: ["yolk", "yolks"],
  };

  const countLabelsByKey = {
    "9-inch unbaked pie crust": ["pie crust", "pie crusts"],
    banana: ["banana", "bananas"],
    "bone-in beef short rib": ["short rib", "short ribs"],
    carrot: ["carrot", "carrots"],
    "chicken breast": ["chicken breast", "chicken breasts"],
    croissants: ["croissant", "croissants"],
    "green bell pepper": ["green bell pepper", "green bell peppers"],
    "green onion": ["green onion", "green onions"],
    lemon: ["lemon", "lemons"],
    "maraschino cherries": ["cherry", "cherries"],
    onion: ["onion", "onions"],
    peach: ["peach", "peaches"],
    potato: ["potato", "potatoes"],
    "sourdough tortillas": ["tortilla", "tortillas"],
    "sweet potato": ["sweet potato", "sweet potatoes"],
    "yellow onion": ["yellow onion", "yellow onions"],
  };

  function labelsForUnit(unit) {
    if (unit !== "item") return unitLabels[unit];
    const key = String(options.canonicalKey || options.displayName || "").toLowerCase();
    return countLabelsByKey[key] || unitLabels.item;
  }

  function labelUnit(unit, rangeValue) {
    const labels = labelsForUnit(unit);
    if (!labels) return unit;

    if (
      Math.abs(rangeValue.min - rangeValue.max) < 1e-9 &&
      rangeValue.min > 0 &&
      rangeValue.min <= 1
    ) {
      return labels[0];
    }
    return labels[1];
  }

  function formatUnitAmount(unit, rangeValue) {
    return `${formatRange(rangeValue)} ${labelUnit(unit, rangeValue)}`;
  }

  function formatUnitRange(unit, rangeValue) {
    if (unit === "tsp") {
      if (rangeValue.min >= 12) return formatUnitAmount("cup", { min: rangeValue.min / 48, max: rangeValue.max / 48 });
      if (rangeValue.min >= 3) return formatUnitAmount("tbsp", { min: rangeValue.min / 3, max: rangeValue.max / 3 });
      return formatUnitAmount("tsp", rangeValue);
    }

    if (unit === "oz") {
      if (rangeValue.min >= 16) return formatUnitAmount("lb", { min: rangeValue.min / 16, max: rangeValue.max / 16 });
      return formatUnitAmount("oz", rangeValue);
    }

    if (unit === "g") {
      if (rangeValue.min >= 1000) return formatUnitAmount("kg", { min: rangeValue.min / 1000, max: rangeValue.max / 1000 });
      return formatUnitAmount("g", rangeValue);
    }

    if (unit === "ml") {
      if (rangeValue.min >= 1000) return `${formatRange({ min: rangeValue.min / 1000, max: rangeValue.max / 1000 })} L`;
      return formatUnitAmount("ml", rangeValue);
    }

    if (labelsForUnit(unit)) return formatUnitAmount(unit, rangeValue);
    return `${formatRange(rangeValue)} ${unit}`;
  }

  const unitSortOrder = [
    "tsp",
    "oz",
    "g",
    "ml",
    "cup",
    "tbsp",
    "lb",
    "kg",
    "l",
    "item",
  ];

  function sortUnits(a, b) {
    const aIndex = unitSortOrder.indexOf(a);
    const bIndex = unitSortOrder.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? unitSortOrder.length : aIndex) - (bIndex === -1 ? unitSortOrder.length : bIndex);
    }
    return a.localeCompare(b);
  }

  Object.keys(totals)
    .sort(sortUnits)
    .forEach((baseUnit) => {
      const rangeValue = totals[baseUnit];
      parts.push(formatUnitRange(baseUnit, rangeValue));
    });

  return parts.join(" + ");
}
