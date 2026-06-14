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

export function subtractRange(existingRange, subtractRangeValue) {
  const next = {
    min: (existingRange ? existingRange.min : 0) - subtractRangeValue.min,
    max: (existingRange ? existingRange.max : 0) - subtractRangeValue.max,
  };

  next.min = Math.max(0, next.min);
  next.max = Math.max(0, next.max);

  return next;
}

export function isEffectivelyZero(rangeValue) {
  return rangeValue.min <= 1e-12 && rangeValue.max <= 1e-12;
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

  const minRounded = roundForDisplay(min);
  const maxRounded = roundForDisplay(max);

  if (Math.abs(minRounded - maxRounded) < 1e-9) {
    return String(minRounded);
  }
  return `${minRounded}-${maxRounded}`;
}

export function formatScaledRange(rangeValue, divisor) {
  return formatRange({
    min: rangeValue.min / divisor,
    max: rangeValue.max / divisor,
  });
}

export function formatTotalsForKey(totals) {
  const parts = [];

  const unitLabels = {
    bag: ["bag", "bags"],
    block: ["block", "blocks"],
    bottle: ["bottle", "bottles"],
    bunch: ["bunch", "bunches"],
    can: ["can", "cans"],
    clove: ["clove", "cloves"],
    egg: ["egg", "eggs"],
    "egg white": ["egg white", "egg whites"],
    item: ["item", "items"],
    jar: ["jar", "jars"],
    leaf: ["leaf", "leaves"],
    package: ["package", "packages"],
    sheet: ["sheet", "sheets"],
    slice: ["slice", "slices"],
    sprig: ["sprig", "sprigs"],
    stalk: ["stalk", "stalks"],
    stick: ["stick", "sticks"],
    yolk: ["yolk", "yolks"],
  };

  function labelUnit(unit, valueText) {
    const labels = unitLabels[unit];
    if (!labels) return unit;

    const numeric = Number(valueText);
    if (Number.isFinite(numeric) && Math.abs(numeric - 1) < 1e-9) {
      return labels[0];
    }
    return labels[1];
  }

  function formatUnitRange(unit, rangeValue) {
    if (unit === "tsp") {
      if (rangeValue.min >= 48) return `${formatScaledRange(rangeValue, 48)} cups`;
      if (rangeValue.min >= 3) return `${formatScaledRange(rangeValue, 3)} tbsp`;
      return `${formatRange(rangeValue)} tsp`;
    }

    if (unit === "oz") {
      if (rangeValue.min >= 16) return `${formatScaledRange(rangeValue, 16)} lb`;
      return `${formatRange(rangeValue)} oz`;
    }

    if (unit === "g") {
      if (rangeValue.min >= 1000) return `${formatScaledRange(rangeValue, 1000)} kg`;
      return `${formatRange(rangeValue)} g`;
    }

    if (unit === "ml") {
      if (rangeValue.min >= 1000) return `${formatScaledRange(rangeValue, 1000)} L`;
      return `${formatRange(rangeValue)} ml`;
    }

    const rangeText = formatRange(rangeValue);
    if (unitLabels[unit]) return `${rangeText} ${labelUnit(unit, rangeText)}`;
    return `${rangeText} ${unit}`;
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
