// src/calc.ts
import * as S from "./schema";
import * as Schedule from "./schedule";

/**
 * Helper: compute Adjusted Actual Income (AAI) for one parent.
 * AAI = actualMonthly - preexistingSupportPaid - alimonyPaid + alimonyReceived
 * (Multifamily allowance is handled later when we wire add-ons/allowances.)
 */
export function adjustedActualIncome(p: S.ParentIncome): number {
  return (
    p.actualMonthly -
    p.preexistingSupportPaid -
    p.alimonyPaid +
    p.alimonyReceived
  );
}

/**
 * The minimal "compute" step:
 * - Validates inputs (optionally, see note)
 * - Computes AAI per parent and combined
 * - Computes each parent's income share
 * - Looks up the "basic obligation" from the schedule
 *
 * For now we return a partial worksheet bag with a few line items
 * so you can verify the numbers by eye.
 */
export function computeBasic(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
) {
  // (Optional) enforce a parse if you want runtime validation here:
  // const v = (S.CaseInputs as any).parse ? (S.CaseInputs as any).parse(inputs) : inputs;
  const v = inputs;

  const p1AAI = adjustedActualIncome(v.parent1);
  const p2AAI = adjustedActualIncome(v.parent2);
  const combinedAAI = p1AAI + p2AAI;

  // Avoid divide-by-zero; if both AAIs are 0, split 50/50
  const p1Share = combinedAAI === 0 ? 0.5 : p1AAI / combinedAAI;
  const p2Share = 1 - p1Share;

  const basicRes = Schedule.lookupBasicObligation(
    schedule,
    combinedAAI,
    v.numChildrenThisCase
  );

  // We only return the slice we have so far.
  return {
    // what your UI/tests care about right now:
    path: v.custodyType === "SHARED" ? "WorksheetB" : "WorksheetA",
    basicStatus: basicRes.status,
    basic: basicRes.amount, // null only if "aboveTop"
    usedRowIncome: basicRes.usedRowIncome,

    // intermediate values (these will later map to line numbers)
    p1AAI,
    p2AAI,
    combinedAAI,
    p1Share,
    p2Share,
  };
}