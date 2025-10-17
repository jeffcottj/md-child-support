/**
 * Core calculator logic for the Maryland child-support worksheets.  Every
 * function here mirrors a recognizable step on Worksheet A or Worksheet B and
 * is documented in plain language so attorneys, self-represented litigants, and
 * developers can all follow along.
 */
import * as S from "./schema";
import * as Schedule from "./schedule";
import { totalAddOns, splitByShare, directPayTotalForParent, directPayConsistencyWarning } from "./addons";
import { sharedStarter } from "./shared";

type Advisory = "aboveTopOfSchedule" | "redirectedToWorksheetA" | null;

/**
 * Shared structure returned by the Worksheet A helper that stops at line 6.
 */
type PrimaryTotalsResult = {
  path: "WorksheetA";
  advisory: null | "aboveTopOfSchedule";
  basic: number | null;
  usedRowIncome: number | null;
  p1AAI: number;
  p2AAI: number;
  combinedAAI: number;
  p1Share: number;
  p2Share: number;
  addOnsTotal: number;
  totalObligation: number | null;
  p1Obligation: number | null;
  p2Obligation: number | null;
};

/**
 * Full Worksheet A result including direct payments and recommended order.
 */
type PrimaryFinalResult = PrimaryTotalsResult & {
  line7_p1DirectPay: number | null;
  line7_p2DirectPay: number | null;
  line8_p1Recommended: number | null;
  line8_p2Recommended: number | null;
  line9_recommendedOrder: number | null;
  note: string | null;
};

/**
 * Calculates a parent's Adjusted Actual Income (AAI).
 *
 * Start with the parent's monthly income and subtract what the law allows:
 * existing support paid for other cases, alimony they pay, and any approved
 * multifamily allowance.  Then add back any alimony they receive in this case.
 * The result is the number shown on line 2 of the worksheets.
 */
export function adjustedActualIncome(
  p: S.ParentIncome,
  multifamilyAllowance = 0
): number {
  return (
    p.actualMonthly -
    p.preexistingSupportPaid -
    p.alimonyPaid +
    p.alimonyReceived -
    multifamilyAllowance
  );
}

/**
 * Computes the multifamily allowance for a parent who supports additional
 * children in their own household.
 *
 * We look up the basic support for one child using only that parent's income,
 * take 75% of it, and multiply by the number of in-home children.  That number
 * becomes an allowed deduction before we compute their AAI.
 */
export function multifamilyAllowance(
  schedule: Schedule.Schedule,
  parent: S.ParentIncome
): number {
  const count = parent.multifamilyChildrenInHome ?? 0;
  if (count <= 0) {
    return 0;
  }

  const lookup = Schedule.lookupBasicObligation(
    schedule,
    parent.actualMonthly,
    1
  );

  let baseAmount = lookup.amount ?? null;
  if (baseAmount == null) {
    const column = schedule.byChildren?.["1"];
    if (!column || column.length === 0) {
      throw new Error("Schedule missing one-child column for multifamily allowance.");
    }
    baseAmount = column[column.length - 1];
  }

  return 0.75 * baseAmount * count;
}

/**
 * Performs the shared setup for both worksheets.
 *
 * The function calculates each parent's AAI (including multifamily
 * adjustments), sums them, figures out the income percentages, and consults the
 * statewide schedule to find the basic support obligation.  The returned
 * object mirrors the first few lines of the official worksheets.
 */
export function computeBasic(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
) {
  // (Optional) enforce a parse if you want runtime validation here:
  // const v = (S.CaseInputs as any).parse ? (S.CaseInputs as any).parse(inputs) : inputs;
  const v = inputs;

  const p1AAI = adjustedActualIncome(
    v.parent1,
    multifamilyAllowance(schedule, v.parent1)
  );
  const p2AAI = adjustedActualIncome(
    v.parent2,
    multifamilyAllowance(schedule, v.parent2)
  );
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
 * Works through Worksheet A up to line 6.
 *
 * Once we have the basic obligation we add the reported add-ons, then divide
 * the total by the parents' income percentages.  If the schedule says we are
 * above the published table we stop and mark the result as discretionary.
 */
export function computePrimaryTotals(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
): PrimaryTotalsResult {
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
 * Completes Worksheet A by applying direct payments and naming the payor.
 *
 * The function subtracts each parent's direct payments (line 7) from their
 * share (line 6), never dropping below zero, and then selects the amount owed
 * by the non-custodial parent (line 9).  We also keep an optional note if the
 * direct payments do not match the declared add-ons.
 */
export function computePrimaryFinal(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
): PrimaryFinalResult {
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

/**
 * Calculates the Worksheet B 92–109 overnight adjustment for one parent.
 *
 * The law gradually reduces the theoretical obligation when a parent keeps the
 * child between 92 and 109 nights.  Below 92 nights the parent pays the full
 * theoretical amount; at 110 nights or more there is no reduction because the
 * case would not have been redirected to Worksheet A.
 */
function overnightAdjustmentAmount(theoretical: number, overnights: number): number {
  if (overnights >= 110) return 0;
  if (overnights < 92) return theoretical;
  const diff = 110 - overnights;
  if (diff <= 0) return 0;
  return theoretical * (diff / 18);
}

/**
 * Chooses which parent should be treated as the primary custodian when a
 * shared case gets redirected to Worksheet A.
 *
 * We simply compare the number of nights: the parent with more nights becomes
 * the primary custodian.  On a perfect tie we default to Parent 1 to avoid
 * uncertainty.
 */
function determinePrimaryCustodianFromOvernights(overnightsP1: number): "P1" | "P2" {
  const p1Pct = overnightsP1 / 365;
  if (p1Pct > 0.5) return "P1";
  if (p1Pct < 0.5) return "P2";
  return "P1";
}

/**
 * Possible outcomes when running the shared-custody calculator.  It keeps the
 * branching logic easy to read: advisory when above the schedule, redirected
 * when Worksheet A should be used, or computed when we have a full answer.
 */
type SharedFinalResult =
  | {
      kind: "advisory";
      advisory: "aboveTopOfSchedule";
      worksheet: Record<string, number>;
    }
  | {
      kind: "redirected";
      primaryCustodian: "P1" | "P2";
      primaryResult: ReturnType<typeof computePrimaryFinal>;
      note: string;
    }
  | {
      kind: "computed";
      advisory: null;
      payor: "P1" | "P2" | null;
      recommended: number;
      note: string | null;
      worksheet: Record<string, number>;
      capApplied: null | { before: number; after: number; primary: number | null };
    };

/**
 * Carries Worksheet B from start to finish, including caps and redirects.
 *
 * Depending on the situation this function may:
 * - announce that the case is above the schedule,
 * - redirect to Worksheet A when the shared threshold fails, or
 * - produce the full Worksheet B results, including the statutory cap that
 *   prevents shared support from exceeding the primary amount.
 */
export function computeSharedFinal(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
): SharedFinalResult {
  if (inputs.custodyType !== "SHARED") {
    throw new Error('computeSharedFinal expects custodyType "SHARED"');
  }

  const starter = sharedStarter(inputs, schedule, computeBasic);

  if (starter.advisory === "aboveTopOfSchedule") {
    // The combined income exceeds the published table, so we report that the
    // amount is discretionary and include the preliminary worksheet numbers for
    // transparency.
    return {
      kind: "advisory",
      advisory: "aboveTopOfSchedule",
      worksheet: {
        line2_p1AAI: starter.p1AAI,
        line2_p2AAI: starter.p2AAI,
        line3_p1Share: starter.p1Share,
        line3_p2Share: starter.p2Share,
      },
    };
  }

  if (starter.redirectToWorksheetA) {
    // One parent dipped below the 25% overnight threshold.  Maryland requires
    // us to fall back to Worksheet A, so we pick the parent with more nights as
    // the primary custodian and reuse the Worksheet A calculator.
    const primaryCustodian = determinePrimaryCustodianFromOvernights(
      starter.overnightsP1
    );
    const primaryInputs: S.CaseInputs = {
      ...inputs,
      custodyType: "PRIMARY",
      primaryCustodian,
    };
    const primaryResult = computePrimaryFinal(primaryInputs, schedule);
    const note = `Shared custody threshold not met; redirected to Worksheet A using ${primaryCustodian} as primary custodian.`;
    return {
      kind: "redirected",
      primaryCustodian,
      primaryResult,
      note,
    };
  }

  const adjustedBasic = starter.adjustedBasic ?? 0;
  const p1Share = starter.p1Share;
  const p2Share = starter.p2Share;
  const pctP1 = starter.overnightPctP1 ?? 0;
  const pctP2 = starter.overnightPctP2 ?? 0;

  // Lines 8–9: each parent owes their share of the adjusted basic for the time
  // the child is with the other parent.
  const line8_p1 = adjustedBasic * p1Share;
  const line8_p2 = adjustedBasic * p2Share;

  const line9_p1 = line8_p1 * pctP2;
  const line9_p2 = line8_p2 * pctP1;

  const p1Overnights = starter.overnightsP1;
  const p2Overnights = 365 - p1Overnights;

  // Lines 10–11: apply the 92–109 overnight adjustment and ensure the values
  // never become negative.
  const line10_p1 = overnightAdjustmentAmount(line9_p1, p1Overnights);
  const line10_p2 = overnightAdjustmentAmount(line9_p2, p2Overnights);

  const line11_p1 = Math.max(0, line9_p1 - line10_p1);
  const line11_p2 = Math.max(0, line9_p2 - line10_p2);

  // Line 13: divide the add-ons by income share.
  const addOnsTotal = totalAddOns(inputs.addOns);
  const addOnShares = splitByShare(addOnsTotal, p1Share);

  const line14_p1 = line11_p1 + addOnShares.p1;
  const line14_p2 = line11_p2 + addOnShares.p2;

  // Line 15: subtract direct payments that the parents already make.
  const p1Direct = directPayTotalForParent(inputs.directPay.parent1);
  const p2Direct = directPayTotalForParent(inputs.directPay.parent2);

  const note = directPayConsistencyWarning(addOnsTotal, p1Direct, p2Direct);

  const line15_p1 = Math.max(0, line14_p1 - p1Direct);
  const line15_p2 = Math.max(0, line14_p2 - p2Direct);

  const diff = line15_p1 - line15_p2;
  let payor: "P1" | "P2" | null = null;
  let recommended = 0;
  if (Math.abs(diff) > 1e-6) {
    // A positive difference means Parent 1 owes Parent 2; negative means the
    // opposite.  We record the payor and the absolute amount owed.
    if (diff > 0) {
      payor = "P1";
      recommended = diff;
    } else {
      payor = "P2";
      recommended = -diff;
    }
  }

  const beforeCap = recommended;
  let capApplied: null | { before: number; after: number; primary: number | null } = null;
  if (payor) {
    // Maryland caps Worksheet B at the comparable Worksheet A amount.  We rerun
    // the primary calculator with the non-payor as the primary custodian and
    // trim the shared result if needed.
    const primaryCustodian = payor === "P1" ? "P2" : "P1";
    const primaryInputs: S.CaseInputs = {
      ...inputs,
      custodyType: "PRIMARY",
      primaryCustodian,
    };
    const primaryResult = computePrimaryFinal(primaryInputs, schedule);
    const primaryAmount = primaryResult.line9_recommendedOrder ?? null;
    if (typeof primaryAmount === "number") {
      const capped = Math.min(recommended, primaryAmount);
      capApplied = { before: beforeCap, after: capped, primary: primaryAmount };
      recommended = capped;
    }
  }

  const worksheet: Record<string, number> = {
    line2_p1AAI: starter.p1AAI,
    line2_p2AAI: starter.p2AAI,
    line3_p1Share: p1Share,
    line3_p2Share: p2Share,
    line4_basic: starter.basic ?? 0,
    line5_adjustedBasic: adjustedBasic,
    line6_overnightsP1: p1Overnights,
    line6_overnightsP2: p2Overnights,
    line7_pctP1: pctP1,
    line7_pctP2: pctP2,
    line8_p1ShareAdjustedBasic: line8_p1,
    line8_p2ShareAdjustedBasic: line8_p2,
    line9_p1Theoretical: line9_p1,
    line9_p2Theoretical: line9_p2,
    line10_p1Adjustment: line10_p1,
    line10_p2Adjustment: line10_p2,
    line11_p1AfterAdjustment: line11_p1,
    line11_p2AfterAdjustment: line11_p2,
    line13_totalAddOns: addOnsTotal,
    line13_p1Share: addOnShares.p1,
    line13_p2Share: addOnShares.p2,
    line14_p1Total: line14_p1,
    line14_p2Total: line14_p2,
    line15_p1DirectPay: p1Direct,
    line15_p2DirectPay: p2Direct,
    line15_p1Recommended: line15_p1,
    line15_p2Recommended: line15_p2,
    line16_beforeCap: payor ? beforeCap : 0,
  };

  return {
    kind: "computed",
    advisory: null,
    note,
    payor,
    recommended,
    capApplied,
    worksheet,
  };
}

/**
 * User-friendly wrapper that accepts case inputs and returns the final order.
 *
 * This is the primary function external callers will use.  It decides which
 * worksheet to run, collects a tidy "worksheet" bag of numbers for display, and
 * records any notes or advisories for the user.
 */
export function calculateCase(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule
): S.CaseOutputs {
  const notes: string[] = [];

  if (inputs.custodyType === "PRIMARY") {
    // Run Worksheet A to completion and collect the intermediate values.
    const result = computePrimaryFinal(inputs, schedule);
    if (result.note) notes.push(result.note);
    const payor = result.advisory === "aboveTopOfSchedule"
      ? null
      : inputs.primaryCustodian === "P1" ? "P2" : "P1";
    const amount = result.line9_recommendedOrder ?? 0;
    const oriented = payor === "P1" ? amount : payor === "P2" ? -amount : 0;
    const worksheet: Record<string, number> = {};
    const assign = (key: string, value: number | null | undefined) => {
      if (typeof value === "number") {
        worksheet[key] = value;
      }
    };
    assign("line2_p1AAI", result.p1AAI);
    assign("line2_p2AAI", result.p2AAI);
    assign("line3_p1Share", result.p1Share);
    assign("line3_p2Share", result.p2Share);
    assign("line4_basic", result.basic ?? null);
    assign("line5_totalObligation", result.totalObligation ?? null);
    assign("line6_p1Obligation", result.p1Obligation ?? null);
    assign("line6_p2Obligation", result.p2Obligation ?? null);
    assign("line7_p1DirectPay", result.line7_p1DirectPay ?? null);
    assign("line7_p2DirectPay", result.line7_p2DirectPay ?? null);
    assign("line8_p1Recommended", result.line8_p1Recommended ?? null);
    assign("line8_p2Recommended", result.line8_p2Recommended ?? null);
    assign("line9_recommendedOrder", result.line9_recommendedOrder ?? null);

    return {
      recommendedOrderParent1PaysParent2: oriented,
      payor,
      path: "WorksheetA",
      worksheet,
      notes,
      advisory: result.advisory,
    };
  }

  const sharedResult = computeSharedFinal(inputs, schedule);

  if (sharedResult.kind === "redirected") {
    // Shared inputs did not meet the threshold, so fall back to Worksheet A and
    // explain the redirect in the notes.
    notes.push(sharedResult.note);
    const primary = sharedResult.primaryResult;
    if (primary.note) notes.push(primary.note);
    const payor = primary.advisory === "aboveTopOfSchedule"
      ? null
      : sharedResult.primaryCustodian === "P1" ? "P2" : "P1";
    const amount = primary.line9_recommendedOrder ?? 0;
    const oriented = payor === "P1" ? amount : payor === "P2" ? -amount : 0;
    const worksheet: Record<string, number> = {};
    const assign = (key: string, value: number | null | undefined) => {
      if (typeof value === "number") worksheet[key] = value;
    };
    assign("line2_p1AAI", primary.p1AAI);
    assign("line2_p2AAI", primary.p2AAI);
    assign("line3_p1Share", primary.p1Share);
    assign("line3_p2Share", primary.p2Share);
    assign("line4_basic", primary.basic ?? null);
    assign("line5_totalObligation", primary.totalObligation ?? null);
    assign("line6_p1Obligation", primary.p1Obligation ?? null);
    assign("line6_p2Obligation", primary.p2Obligation ?? null);
    assign("line7_p1DirectPay", primary.line7_p1DirectPay ?? null);
    assign("line7_p2DirectPay", primary.line7_p2DirectPay ?? null);
    assign("line8_p1Recommended", primary.line8_p1Recommended ?? null);
    assign("line8_p2Recommended", primary.line8_p2Recommended ?? null);
    assign("line9_recommendedOrder", primary.line9_recommendedOrder ?? null);

    return {
      recommendedOrderParent1PaysParent2: oriented,
      payor,
      path: "WorksheetA",
      worksheet,
      notes,
      advisory: "redirectedToWorksheetA",
    };
  }

  if (sharedResult.kind === "advisory") {
    // Income exceeded the table; return an advisory-only result.
    return {
      recommendedOrderParent1PaysParent2: 0,
      payor: null,
      path: "WorksheetB",
      worksheet: sharedResult.worksheet,
      notes,
      advisory: sharedResult.advisory,
    };
  }

  const shared = sharedResult;
  if (shared.note) notes.push(shared.note);
  if (shared.capApplied && shared.capApplied.primary != null && Math.abs(shared.capApplied.before - shared.capApplied.after) > 1e-6) {
    notes.push(
      `Shared result capped at ${shared.capApplied.primary?.toFixed(2)} (primary custody equivalent).`
    );
    shared.worksheet.line16_cappedAmount = shared.capApplied.after;
  }

  // Positive values mean Parent 1 pays Parent 2; negative values reverse it.
  const oriented = shared.payor === "P1"
    ? shared.recommended
    : shared.payor === "P2"
      ? -shared.recommended
      : 0;

  return {
    recommendedOrderParent1PaysParent2: oriented,
    payor: shared.payor,
    path: "WorksheetB",
    worksheet: shared.worksheet,
    notes,
    advisory: shared.advisory,
  };
}