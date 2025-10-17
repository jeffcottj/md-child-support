import { describe, expect, it } from "vitest";
import { calculateCase } from "../src/calc";
import { demoSchedule } from "../src/schedule";
import type { CaseInputs } from "../src/schema";

describe("calculateCase - Worksheet B", () => {
  it("handles the shared custody sample case", () => {
    const inputs: CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "SHARED",
      primaryCustodian: "P1",
      overnightsParent1: 200,
      parent1: {
        actualMonthly: 900,
        preexistingSupportPaid: 0,
        alimonyPaid: 0,
        alimonyReceived: 0,
        multifamilyChildrenInHome: 0,
      },
      parent2: {
        actualMonthly: 700,
        preexistingSupportPaid: 0,
        alimonyPaid: 0,
        alimonyReceived: 0,
        multifamilyChildrenInHome: 0,
      },
      addOns: {
        childcare: 120,
        healthInsurance: 30,
        extraordinaryMedical: 0,
        cashMedicalIVD: 0,
        additionalExpenses: 0,
      },
      directPay: {
        parent1: {
          childcare: 120,
          healthInsurance: 0,
          extraordinaryMedical: 0,
          cashMedicalIVD: 0,
          additionalExpenses: 0,
        },
        parent2: {
          childcare: 0,
          healthInsurance: 30,
          extraordinaryMedical: 0,
          cashMedicalIVD: 0,
          additionalExpenses: 0,
        },
      },
    };

    const result = calculateCase(inputs, demoSchedule);
    expect(result.path).toBe("WorksheetB");
    expect(result.payor).toBe("P2");
    expect(result.recommendedOrderParent1PaysParent2).toBeCloseTo(-63.80522, 4);
    expect(result.worksheet.line5_adjustedBasic).toBeCloseTo(511.5, 4);
    expect(result.worksheet.line15_p2Recommended).toBeCloseTo(158.24486, 4);
  });
});
