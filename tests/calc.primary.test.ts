import { describe, it, expect } from "vitest";
import * as S from "../src/schema";
import * as Schedule from "../src/schedule";
import { computePrimaryTotals } from "../src/calc";

describe("Worksheet A (primary) totals", () => {
  it("computes total obligation and splits by income share", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "PRIMARY",
      overnightsParent1: 365,
      parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns: { childcare: 120, healthInsurance: 30, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
    };

    const out = computePrimaryTotals(inputs, Schedule.demoSchedule);

    expect(out.path).toBe("WorksheetA");
    expect(out.advisory).toBeNull();
    expect(out.basic).toBe(300);            // demo table: 2 kids @ row income 2000
    expect(out.addOnsTotal).toBe(150);      // 120 + 30
    expect(out.totalObligation).toBe(450);  // 300 + 150

    // Shares: 900/1600 = 0.5625; 700/1600 = 0.4375
    expect(out.p1Share).toBeCloseTo(0.5625, 5);
    expect(out.p2Share).toBeCloseTo(0.4375, 5);
    expect(out.p1Obligation!).toBeCloseTo(253.125, 5);
    expect(out.p2Obligation!).toBeCloseTo(196.875, 5);
  });

  it("returns advisory when above top of demo schedule", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "PRIMARY",
      overnightsParent1: 365,
      parent1: { actualMonthly: 999999, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 1, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
    };

    const out = computePrimaryTotals(inputs, Schedule.demoSchedule);
    expect(out.advisory).toBe("aboveTopOfSchedule");
    expect(out.totalObligation).toBeNull();
    expect(out.p1Obligation).toBeNull();
    expect(out.p2Obligation).toBeNull();
  });
});