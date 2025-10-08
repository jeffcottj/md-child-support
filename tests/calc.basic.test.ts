import { describe, it, expect } from "vitest";
import * as S from "../src/schema";
import * as Schedule from "../src/schedule";
import { computeBasic } from "../src/calc";

describe("computeBasic (AAI → shares → basic lookup)", () => {
  it("handles between-rows by selecting next-higher row", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "PRIMARY",
      overnightsParent1: 365,
      parent1: { actualMonthly: 900, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 700, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
    };

    const out = computeBasic(inputs, Schedule.demoSchedule);
    expect(out.basicStatus).toBe("ok");
    expect(out.basic).toBe(300);         // demo table: 2 kids @ row income 2000
    expect(out.usedRowIncome).toBe(2000);
    expect(out.p1AAI + out.p2AAI).toBe(1600);
  });

  it("flags aboveTop as discretionary (no basic)", () => {
    const inputs: S.CaseInputs = {
      numChildrenThisCase: 2,
      custodyType: "PRIMARY",
      overnightsParent1: 365,
      parent1: { actualMonthly: 999999, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      parent2: { actualMonthly: 1, preexistingSupportPaid: 0, alimonyPaid: 0, alimonyReceived: 0, multifamilyChildrenInHome: 0 },
      addOns: { childcare: 0, healthInsurance: 0, extraordinaryMedical: 0, cashMedicalIVD: 0, additionalExpenses: 0 },
    };

    const out = computeBasic(inputs, Schedule.demoSchedule);
    expect(out.basicStatus).toBe("aboveTop");
    expect(out.basic).toBeNull();
  });
});