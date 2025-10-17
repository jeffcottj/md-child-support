/**
 * Shared-custody helpers.  These functions translate the Maryland Worksheet B
 * instructions into plain, step-by-step math so we can reuse them in the main
 * calculator.
 */
import * as S from "./schema";
import * as Schedule from "./schedule";

/**
 * Multiplies the "basic" obligation by 1.5, matching the shared-custody rule
 * in the statute.  This bumps the base amount to acknowledge the cost of
 * maintaining two households.
 */
export function adjustedBasic(basic: number): number {
  return basic * 1.5;
}

/**
 * Converts Parent 1's number of overnights into simple percentages for each
 * parent.
 *
 * The court form uses percentages, but most people think in nights.  We clamp
 * the number between 0 and 365, then return Parent 1's slice and Parent 2's
 * slice of the year.
 */
export function overnightPercents(overnightsP1: number): [number, number] {
  const total = 365;
  const p1 = Math.max(0, Math.min(total, overnightsP1));
  const p2 = total - p1;
  return [p1 / total, p2 / total];
}

/**
 * Checks whether both parents meet the 25% (92 nights) shared-custody
 * threshold.
 *
 * Maryland only allows Worksheet B when each parent keeps the child for at
 * least a quarter of the year.  This function expresses that rule in code.
 */
export function meetsSharedThreshold(overnightsP1: number): boolean {
  const [p1, p2] = overnightPercents(overnightsP1);
  return p1 >= 0.25 && p2 >= 0.25;
}

/**
 * Handles the opening steps of Worksheet B before we dive into the long math.
 *
 * - Reuses the "basic" computation so we have incomes, shares, and the base
 *   support number.
 * - If the schedule tops out above the family's income, we mark the case as
 *   discretionary so a human can decide.
 * - If the shared threshold fails, we ask the caller to fall back to Worksheet
 *   A.
 * - Otherwise we return the adjusted basic amount and the overnight
 *   percentages that the later steps need.
 */
export function sharedStarter(
  inputs: S.CaseInputs,
  schedule: Schedule.Schedule,
  computeBasic: (i: S.CaseInputs, s: Schedule.Schedule) => {
    basicStatus: "ok" | "atOrBelowMinimum" | "aboveTop";
    basic: number | null;
    usedRowIncome: number | null;
    p1AAI: number;
    p2AAI: number;
    combinedAAI: number;
    p1Share: number;
    p2Share: number;
    path: string;
  }
) {
  if (inputs.custodyType !== "SHARED") {
    throw new Error('sharedStarter expects custodyType "SHARED"');
  }

  const base = computeBasic(inputs, schedule);

  // If above top, we can’t produce a mandatory amount yet (same as A)
  if (base.basicStatus === "aboveTop" || base.basic == null) {
    return {
      advisory: "aboveTopOfSchedule" as const,
      redirectToWorksheetA: false,
      basic: null,
      adjustedBasic: null,
      usedRowIncome: base.usedRowIncome,
      p1AAI: base.p1AAI, p2AAI: base.p2AAI,
      combinedAAI: base.combinedAAI, p1Share: base.p1Share, p2Share: base.p2Share,
      overnightsP1: inputs.overnightsParent1,
      overnightPctP1: null as number | null,
      overnightPctP2: null as number | null,
    };
  }

  // Check threshold
  const isShared = meetsSharedThreshold(inputs.overnightsParent1);
  if (!isShared) {
    // Less than 92 nights for either parent triggers a redirect to Worksheet A.
    // Caller should switch to Worksheet A path
    return {
      advisory: null,
      redirectToWorksheetA: true as const,
      basic: base.basic,
      adjustedBasic: null,
      usedRowIncome: base.usedRowIncome,
      p1AAI: base.p1AAI, p2AAI: base.p2AAI,
      combinedAAI: base.combinedAAI, p1Share: base.p1Share, p2Share: base.p2Share,
      overnightsP1: inputs.overnightsParent1,
      overnightPctP1: null as number | null,
      overnightPctP2: null as number | null,
    };
  }

  const adjBasic = adjustedBasic(base.basic);
  const [pctP1, pctP2] = overnightPercents(inputs.overnightsParent1);

  // Return the building blocks Worksheet B needs for the later steps.
  return {
    advisory: null,
    redirectToWorksheetA: false,
    basic: base.basic,
    adjustedBasic: adjBasic,
    usedRowIncome: base.usedRowIncome,
    p1AAI: base.p1AAI, p2AAI: base.p2AAI,
    combinedAAI: base.combinedAAI, p1Share: base.p1Share, p2Share: base.p2Share,
    overnightsP1: inputs.overnightsParent1,
    overnightPctP1: pctP1,
    overnightPctP2: pctP2,
  };
}