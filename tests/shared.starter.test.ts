import { describe, it, expect } from "vitest";
import * as S from "../src/schema";
import * as Schedule from "../src/schedule";
import { computeBasic } from "../src/calc";
import { sharedStarter, adjustedBasic, meetsSharedThreshold } from "../src/shared";

describe("Worksheet B starter", () => {
  it("computes adjusted basic = 1.5 × basic and overnight % when threshold met", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "SHARED",
      primaryCustodian: "P1",        // irrelevant for B but required by schema
      overnightsParent1: 200,        // 200/365 ≈ 54.8% (meets 25% on both sides)
      parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns:  { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
      directPay: { parent1: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 },
                   parent2: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 }, },
    };

    const out = sharedStarter(inputs, Schedule.demoSchedule, computeBasic);
    expect(out.redirectToWorksheetA).toBe(false);
    expect(out.basic).toBe(300);               // demo table: 2 kids @ 2000 row via next-higher
    expect(out.adjustedBasic).toBe(adjustedBasic(300)); // 450
    expect(out.overnightPctP1!).toBeGreaterThan(0.5);
    expect(out.overnightPctP2!).toBeLessThan(0.5);
  });

  it("redirects to Worksheet A if either parent <25% (e.g., 80 nights)", () => {
    expect(meetsSharedThreshold(80)).toBe(false);
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "SHARED",
      primaryCustodian: "P1",
      overnightsParent1: 80, // < 92 → not shared
      parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns:  { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
      directPay: { parent1: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 },
                   parent2: { childcare:0, healthInsurance:0, extraordinaryMedical:0, cashMedicalIVD:0, additionalExpenses:0 }, },
    };

    const out = sharedStarter(inputs, Schedule.demoSchedule, computeBasic);
    expect(out.redirectToWorksheetA).toBe(true);
    expect(out.adjustedBasic).toBeNull();
  });
});