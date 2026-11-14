import type { Unit } from "../types.js";

/** Convert mass/volume to a base unit for math; pieces stay as pieces. */
const MASS_TO_MG: Record<string, number> = {
  mg: 1,
  g: 1000,
  kg: 1_000_000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
};

export function isMass(unit: Unit): boolean {
  return unit === "mg" || unit === "g" || unit === "kg";
}

export function isVolume(unit: Unit): boolean {
  return unit === "ml" || unit === "l";
}

export function scaleAmount(amount: number, factor: number): number {
  return amount * factor;
}

/**
 * Pick a readable unit for display after scaling (e.g. 1500g → 1.5kg).
 * g / mg: ceil fractional amounts to the next whole number.
 * kg / L / ml: keep decimals (no whole-number rounding).
 */
export function normalizeDisplay(amount: number, unit: Unit): { amount: number; unit: Unit } {
  if (unit === "pieces" || unit === "portions") {
    return { amount: roundNice(amount), unit };
  }

  if (isMass(unit)) {
    const mg = amount * MASS_TO_MG[unit];
    if (mg >= 1_000_000) {
      return { amount: keepDecimals(mg / 1_000_000), unit: "kg" };
    }
    if (mg >= 1000) {
      return { amount: ceilWhole(mg / 1000), unit: "g" };
    }
    return { amount: ceilWhole(mg), unit: "mg" };
  }

  if (isVolume(unit)) {
    const ml = amount * VOLUME_TO_ML[unit];
    if (ml >= 1000) {
      return { amount: keepDecimals(ml / 1000), unit: "l" };
    }
    return { amount: keepDecimals(ml), unit: "ml" };
  }

  return { amount: roundNice(amount), unit };
}

/** Round fractional g/mg up to the next integer (1.2 → 2). */
function ceilWhole(n: number): number {
  if (!Number.isFinite(n)) return n;
  // Tame float noise so 2.0000000001 stays 2
  const cleaned = Math.round(n * 1e9) / 1e9;
  if (Number.isInteger(cleaned)) return cleaned;
  return Math.ceil(cleaned);
}

/** Keep readable decimals for kg / L / ml — do not force whole numbers. */
function keepDecimals(n: number): number {
  if (!Number.isFinite(n)) return n;
  if (Number.isInteger(n)) return n;
  // Cap display noise without integer-rounding
  return Math.round(n * 1000) / 1000;
}

function roundNice(n: number): number {
  if (Number.isInteger(n)) return n;
  if (Math.abs(n) >= 100) return Math.round(n * 10) / 10;
  if (Math.abs(n) >= 10) return Math.round(n * 100) / 100;
  return Math.round(n * 1000) / 1000;
}
