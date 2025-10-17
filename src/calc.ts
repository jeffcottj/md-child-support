// src/calc.ts
import * as S from "./schema";
import * as Schedule from "./schedule";
import { totalAddOns, splitByShare, directPayTotalForParent, directPayConsistencyWarning } from "./addons";

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

/**
 * Primary (Worksheet A) slice:
 * - Requires a valid "basic" (not aboveTop).
 * - totalObligation = basic + addOnsTotal
 * - each parent's obligation = totalObligation × income share
 *
 * NOTE: We are NOT subtracting "direct pay" yet (that’s a later step).
 */
export function computePrimaryTotals(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
) {
  if (inputs.custodyType !== "PRIMARY") {
    throw new Error('computePrimaryTotals expects custodyType "PRIMARY"');
  }

  // Reuse Step 5 results
  const base = computeBasic(inputs, schedule);

  if (base.basicStatus === "aboveTop" || base.basic == null) {
    // We can't produce a mandatory amount; return advisory info only.
    return {
      path: "WorksheetA" as const,
      advisory: "aboveTopOfSchedule",
      basic: null,
      usedRowIncome: null,
      p1AAI: base.p1AAI,
      p2AAI: base.p2AAI,
      combinedAAI: base.combinedAAI,
      p1Share: base.p1Share,
      p2Share: base.p2Share,
      addOnsTotal: totalAddOns(inputs.addOns),
      totalObligation: null,
      p1Obligation: null,
      p2Obligation: null,
    };
  }

  const addOnsTotal = totalAddOns(inputs.addOns);
  const totalObligation = base.basic + addOnsTotal;

  // Allocate each parent's share of the total obligation
  const { p1, p2 } = splitByShare(totalObligation, base.p1Share);

  return {
    path: "WorksheetA" as const,
    advisory: null as null | "aboveTopOfSchedule",
    basic: base.basic,                     // Worksheet A line 4
    usedRowIncome: base.usedRowIncome,
    p1AAI: base.p1AAI,                     // line 2 (parent 1)
    p2AAI: base.p2AAI,                     // line 2 (parent 2)
    combinedAAI: base.combinedAAI,         // sum line 2
    p1Share: base.p1Share,                 // line 3 (parent 1 %)
    p2Share: base.p2Share,                 // line 3 (parent 2 %)
    addOnsTotal,                           // A-4a..A-4e summed
    totalObligation,                       // Worksheet A line 5 = basic + add-ons
    p1Obligation: p1,                      // Worksheet A line 6 (parent 1)
    p2Obligation: p2,                      // Worksheet A line 6 (parent 2)
  };
}

/**
 * Worksheet A lines 7–9:
 * - line 7 (direct pay per parent)
 * - line 8 (recommended amount per parent) = line 6 - line 7 (min 0)
 * - line 9 (recommended order) = non-custodial parent's line 8
 */
export function computePrimaryFinal(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
) {
  if (inputs.custodyType !== "PRIMARY") {
    throw new Error('computePrimaryFinal expects custodyType "PRIMARY"');
  }

  // Build on Step 6 results (line 2,3,4,5,6 already computed)
  const t = computePrimaryTotals(inputs, schedule);

  if (t.advisory === "aboveTopOfSchedule") {
    // Still discretionary; pass through with advisory
    return {
      ...t,
      line7_p1DirectPay: null as number | null,
      line7_p2DirectPay: null as number | null,
      line8_p1Recommended: null as number | null,
      line8_p2Recommended: null as number | null,
      line9_recommendedOrder: null as number | null,
      note: "Above top of schedule; court discretion.",
    };
  }

  // Line 7: direct pay per parent
  const p1Direct = directPayTotalForParent(inputs.directPay.parent1);
  const p2Direct = directPayTotalForParent(inputs.directPay.parent2);

  // Optional soft warning if the direct-pay sum differs widely from addOnsTotal
  const note = directPayConsistencyWarning(t.addOnsTotal!, p1Direct, p2Direct);

  // Line 8: recommended per parent (never below zero)
  const p1Rec = Math.max(0, (t.p1Obligation ?? 0) - p1Direct);
  const p2Rec = Math.max(0, (t.p2Obligation ?? 0) - p2Direct);

  // Line 9: bring down the non-custodial parent's amount
  const nonCustodialPays =
    inputs.primaryCustodian === "P1" ? p2Rec : p1Rec;

  return {
    ...t,
    line7_p1DirectPay: p1Direct,
    line7_p2DirectPay: p2Direct,
    line8_p1Recommended: p1Rec,
    line8_p2Recommended: p2Rec,
    line9_recommendedOrder: nonCustodialPays,
    note,
  };
}