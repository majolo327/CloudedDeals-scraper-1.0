/**
 * Category-aware weight normalization for cannabis products.
 *
 * The same numeric value means completely different things depending on category:
 *  - 0.5 for a vape   = half gram cart (valid)
 *  - 0.5 for flower    = probably wrong, might be 5g
 *  - 5   for a vape    = definitely wrong, should be 0.5g
 *  - 5   for flower    = 5 grams, totally valid
 *  - 100 for an edible = 100mg THC (valid)
 */

export interface CategoryWeightConfig {
  unit: string;
  commonWeights: number[];
  minValid: number;
  maxValid: number;
}

export const VALID_WEIGHTS_BY_CATEGORY: Record<string, CategoryWeightConfig> = {
  flower: {
    unit: 'g',
    commonWeights: [1, 2, 3.5, 7, 14, 28],
    minValid: 0.5,
    maxValid: 28,
  },
  vape: {
    unit: 'g',
    commonWeights: [0.3, 0.35, 0.5, 0.85, 1],
    minValid: 0.3,
    maxValid: 2,
  },
  concentrate: {
    unit: 'g',
    commonWeights: [0.5, 1, 2, 3.5],
    minValid: 0.25,
    maxValid: 7,
  },
  preroll: {
    unit: 'g',
    commonWeights: [0.5, 0.7, 1, 1.5, 3.5],
    minValid: 0.3,
    maxValid: 7,
  },
  edible: {
    unit: 'mg',
    commonWeights: [10, 25, 50, 100, 200, 300, 400, 500, 1000],
    minValid: 5,
    maxValid: 1000,
  },
  tincture: {
    unit: 'mg',
    commonWeights: [100, 250, 500, 750, 1000],
    minValid: 50,
    maxValid: 5000,
  },
  topical: {
    unit: 'mg',
    commonWeights: [100, 200, 500, 1000],
    minValid: 25,
    maxValid: 5000,
  },
};

export interface NormalizedWeight {
  value: number;
  unit: string;
  display: string;
  isValid: boolean;
  wasCorrected: boolean;
}

/**
 * Normalize a weight value given its product category.
 *
 * Handles:
 * - Decimal point errors: .35g flower → 3.5g, 5g vape → 0.5g
 * - Unit mismatches: edibles in "g" that should be "mg"
 * - Out-of-range validation
 */
export function normalizeWeight(
  rawWeight: string | number | null | undefined,
  category: string
): NormalizedWeight | null {
  if (rawWeight == null || rawWeight === '') return null;

  const raw = String(rawWeight).trim();
  if (!raw) return null;

  const catLower = category.toLowerCase();
  const config = VALID_WEIGHTS_BY_CATEGORY[catLower]
    || VALID_WEIGHTS_BY_CATEGORY['flower'];

  // Extract numeric value and unit
  let value: number | null = null;
  let unit: string = config.unit;

  // Detect unit from string
  if (/mg/i.test(raw)) {
    unit = 'mg';
  } else if (/oz/i.test(raw)) {
    unit = 'oz';
  } else if (/g/i.test(raw)) {
    unit = 'g';
  }

  // Extract number
  const numMatch = raw.match(/(\d*\.?\d+)/);
  if (numMatch) {
    value = parseFloat(numMatch[1]);
  }

  if (value === null || isNaN(value) || value <= 0) return null;

  // Convert oz to g
  if (unit === 'oz') {
    value = value * 28;
    unit = 'g';
  }

  let wasCorrected = false;

  // Category-aware correction
  if (unit === 'g') {
    if (value < config.minValid) {
      // Value too small — try *10 (e.g. .35 flower → 3.5)
      const corrected = value * 10;
      if (
        config.commonWeights.includes(corrected) ||
        (corrected >= config.minValid && corrected <= config.maxValid)
      ) {
        value = corrected;
        wasCorrected = true;
      }
    } else if (value > config.maxValid) {
      // Value too large — try /10 (e.g. 5 vape → 0.5)
      const corrected = value / 10;
      if (
        config.commonWeights.includes(corrected) ||
        (corrected >= config.minValid && corrected <= config.maxValid)
      ) {
        value = corrected;
        wasCorrected = true;
      }
    }
  }

  // Edibles/tinctures/topicals: if "g" but value looks like mg
  if (['edible', 'tincture', 'topical'].includes(catLower) && unit === 'g' && value >= 5) {
    unit = 'mg';
    wasCorrected = true;
  }

  const isValid = value >= config.minValid && value <= config.maxValid;

  // Format display: "0.5g", "3.5g", "1g", "100mg"
  const displayValue = value % 1 === 0 ? value.toString() : parseFloat(value.toFixed(2)).toString();
  const display = `${displayValue}${unit}`;

  return { value, unit, display, isValid, wasCorrected };
}

/**
 * Safe weight display for deal cards.
 * Uses the existing weight string but validates it against the category.
 * Returns corrected display if the weight looks wrong for the category.
 */
export function normalizeWeightForDisplay(
  weight: string | undefined | null,
  category: string
): string {
  if (!weight) return '';

  const normalized = normalizeWeight(weight, category);
  if (!normalized) return weight;

  // If the normalized weight was corrected, use the corrected version
  if (normalized.wasCorrected) return normalized.display;

  // If valid, return as-is (preserves original formatting)
  if (normalized.isValid) return weight;

  // Invalid but not correctable — still show what we have
  return weight;
}
