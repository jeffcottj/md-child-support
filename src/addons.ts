/**
 * This file gathers tiny math helpers that deal with "add-on" expenses such as
 * childcare and medical costs.  Each helper is written in plain language so an
 * advocate or litigant can trace how the numbers move without needing to know
 * programming terminology.
 */
import type { AddOns, DirectPay } from "./schema";

/**
 * Adds together every extra monthly expense that the parents reported.
 *
 * Think of this like pulling numbers from five boxes (childcare, health
 * insurance, extraordinary medical, cash medical, additional expenses) and
 * piling them into one stack.  The function quietly treats any missing box as
 * zero so we do not accidentally break the calculation.
 */
export function totalAddOns(a: AddOns): number {
  return (
    (a.childcare ?? 0) +
    (a.healthInsurance ?? 0) +
    (a.extraordinaryMedical ?? 0) +
    (a.cashMedicalIVD ?? 0) +
    (a.additionalExpenses ?? 0)
  );
}

/**
 * Splits a shared bill between the parents based on Parent 1's share of the
 * income.
 *
 * Imagine sliding the total bill onto a see-saw that is already marked with
 * the parents' income percentages.  Parent 1 takes their marked percentage and
 * Parent 2 receives whatever remains so that every dollar is accounted for.
 */
export function splitByShare(total: number, p1Share: number) {
  const p1 = total * p1Share;
  const p2 = total - p1;
  return { p1, p2 };
}

/**
 * Totals the amounts a parent already pays directly to third parties (for
 * example to a daycare or insurer).
 *
 * This mirrors filling out Worksheet A/B line 7: we scoop each of the direct
 * payments into a single figure so that we can subtract it from that parent's
 * obligation later.
 */
export function directPayTotalForParent(dp: DirectPay["parent1"]): number {
  return (
    (dp.childcare ?? 0) +
    (dp.healthInsurance ?? 0) +
    (dp.extraordinaryMedical ?? 0) +
    (dp.cashMedicalIVD ?? 0) +
    (dp.additionalExpenses ?? 0)
  );
}

/**
 * Produces a friendly warning when the direct-pay totals do not add up to the
 * declared add-on total.
 *
 * The message acts as a double-check for users: if the numbers differ by more
 * than a whisper (one penny), we return a sentence suggesting that the person
 * re-check the figures; otherwise we return nothing.
 */
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