import { describe, it, expect } from "vitest";
import * as S from "../src/schema";
import * as Schedule from "../src/schedule";
import { calculateCase } from "../src/calc";

const baseParent = {
  preexistingSupportPaid: 0,
  alimonyPaid: 0,
  alimonyReceived: 0,
  multifamilyChildrenInHome: 0,
};

describe("calculateCase end-to-end", () => {
  it("produces Worksheet A final amounts with direct-pay credits", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "PRIMARY",
      primaryCustodian: "P1",
      overnightsParent1: 365,
      parent1: { ...baseParent, actualMonthly: 900 },
      parent2: { ...baseParent, actualMonthly: 700 },
      addOns: {
        childcare: 120,
        healthInsurance: 30,
        extraordinaryMedical: 0,
        cashMedicalIVD: 0,
        additionalExpenses: 0,
      },
      directPay: {
        parent1: { childcare: 20, healthInsurance: 30, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
        parent2: { childcare: 10, healthInsurance: 10, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
      },
    };

    const out = calculateCase(inputs, Schedule.demoSchedule);
    expect(out.path).toBe("WorksheetA");
    // P2 is non-custodial → negative indicates P2 pays P1
    expect(out.recommendedOrderParent1PaysParent2).toBeCloseTo(-176.875, 3);
    expect(out.payor).toBe("P2");
    expect(out.notes).toContain("Note: direct-pay sum (70.00) != add-ons total (150.00).");
    expect(out.worksheet.line9_recommendedOrder).toBeCloseTo(176.875, 3);
    expect(out.worksheet.line8_p1Recommended).toBeCloseTo(203.125, 3);
    expect(out.worksheet.line8_p2Recommended).toBeCloseTo(176.875, 3);
  });

  it("computes Worksheet B totals including 92-109 adjustment and caps", () => {
    const sharedInputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "SHARED",
      primaryCustodian: "P1",
      overnightsParent1: 200,
      parent1: { ...baseParent, actualMonthly: 900 },
      parent2: { ...baseParent, actualMonthly: 700 },
      addOns: {
        childcare: 120,
        healthInsurance: 30,
        extraordinaryMedical: 0,
        cashMedicalIVD: 0,
        additionalExpenses: 0,
      },
      directPay: {
        parent1: { childcare: 40, healthInsurance: 10, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
        parent2: { childcare: 10, healthInsurance: 10, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
      },
    };

    const sharedOut = calculateCase(sharedInputs, Schedule.demoSchedule);
    expect(sharedOut.path).toBe("WorksheetB");
    expect(sharedOut.payor).toBe("P2");
    expect(sharedOut.recommendedOrderParent1PaysParent2).toBeLessThan(0);
    expect(Math.abs(sharedOut.recommendedOrderParent1PaysParent2)).toBeCloseTo(4.7003, 3);
    expect(sharedOut.notes).toContain("Note: direct-pay sum (70.00) != add-ons total (150.00).");
    expect(sharedOut.worksheet.line10_p1Adjustment).toBe(0);
    expect(sharedOut.worksheet.line15_p2Recommended).toBeGreaterThan(sharedOut.worksheet.line15_p1Recommended);

    const cappedInputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "SHARED",
      primaryCustodian: "P1",
      overnightsParent1: 110,
      parent1: { ...baseParent, actualMonthly: 1900 },
      parent2: { ...baseParent, actualMonthly: 100 },
      addOns: {
        childcare: 0,
        healthInsurance: 0,
        extraordinaryMedical: 0,
        cashMedicalIVD: 0,
        additionalExpenses: 0,
      },
      directPay: {
        parent1: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
        parent2: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
      },
    };

    const cappedOut = calculateCase(cappedInputs, Schedule.demoSchedule);
    expect(cappedOut.path).toBe("WorksheetB");
    expect(cappedOut.payor).toBe("P1");
    expect(cappedOut.recommendedOrderParent1PaysParent2).toBeGreaterThan(0);
    expect(cappedOut.recommendedOrderParent1PaysParent2).toBeCloseTo(285, 6);
    expect(cappedOut.worksheet.line16_cappedAmount).toBeCloseTo(285, 6);
    expect(cappedOut.notes.some((note) => note.includes("capped"))).toBe(true);
  });
});
