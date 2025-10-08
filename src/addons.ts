// src/addons.ts
import type { AddOns } from "./schema";

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