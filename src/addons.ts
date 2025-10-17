// src/addons.ts
import type { AddOns, DirectPay } from "./schema";

/** Sum all add-on categories (monthly). Mirrors A-4a..A-4e / B-13a..B-13e. */
export function totalAddOns(a: AddOns): number {
  return (
    (a.childcare ?? 0) +
    (a.healthInsurance ?? 0) +
    (a.extraordinaryMedical ?? 0) +
    (a.cashMedicalIVD ?? 0) +
    (a.additionalExpenses ?? 0)
  );
}

/** Split a total by income shares (p1Share + p2Share = 1.0). */
export function splitByShare(total: number, p1Share: number) {
  const p1 = total * p1Share;
  const p2 = total - p1;
  return { p1, p2 };
}

/** Total direct-pay for one parent across the add-on categories. */
export function directPayTotalForParent(dp: DirectPay["parent1"]): number {
  return (
    (dp.childcare ?? 0) +
    (dp.healthInsurance ?? 0) +
    (dp.extraordinaryMedical ?? 0) +
    (dp.cashMedicalIVD ?? 0) +
    (dp.additionalExpenses ?? 0)
  );
}

/** Soft warning if direct-pay sums don’t match declared add-ons total (optional). */
export function directPayConsistencyWarning(
  addOnsTotal: number,
  p1: number,
  p2: number
): string | null {
  const sum = p1 + p2;
  const diff = Math.abs(sum - addOnsTotal);
  return diff > 1e-6
    ? `Note: direct-pay sum (${sum.toFixed(2)}) != add-ons total (${addOnsTotal.toFixed(2)}).`
    : null;
}