import { describe, expect, it } from "vitest";
import { demoSchedule } from "../src/schedule";
import { multifamilyAllowance } from "../src/multifamily";

describe("multifamilyAllowance", () => {
  it("returns 75% of the one-child amount per extra child", () => {
    const allowance = multifamilyAllowance(demoSchedule, {
      actualMonthly: 6000,
      preexistingSupportPaid: 0,
      alimonyPaid: 0,
      alimonyReceived: 0,
      multifamilyChildrenInHome: 2,
    });
    expect(allowance).toBeCloseTo(1531.5, 4);
  });

  it("returns zero when no extra children exist", () => {
    const allowance = multifamilyAllowance(demoSchedule, {
      actualMonthly: 6000,
      preexistingSupportPaid: 0,
      alimonyPaid: 0,
      alimonyReceived: 0,
      multifamilyChildrenInHome: 0,
    });
    expect(allowance).toBe(0);
  });
});
