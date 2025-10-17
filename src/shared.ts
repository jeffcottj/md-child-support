// src/shared.ts
import * as S from "./schema";
import * as Schedule from "./schedule";

/** 1.5x “Adjusted Basic” per Maryland’s shared-custody rule. */
export function adjustedBasic(basic: number): number {
  return basic * 1.5;
}

/** Return [p1Pct, p2Pct] given p1 overnights (0..365). */
export function overnightPercents(overnightsP1: number): [number, number] {
  const total = 365;
  const p1 = Math.max(0, Math.min(total, overnightsP1));
  const p2 = total - p1;
  return [p1 / total, p2 / total];
}

/** True iff BOTH parents have ≥25% (i.e., ≥92 nights). */
export function meetsSharedThreshold(overnightsP1: number): boolean {
  const [p1, p2] = overnightPercents(overnightsP1);
  return p1 >= 0.25 && p2 >= 0.25;
}

/**
 * First slice of Worksheet B:
 * - compute AAI & shares (reuse computeBasic)
 * - check shared threshold (≥25% each). If not, signal “use Worksheet A”.
 * - compute Adjusted Basic = 1.5 × Basic
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