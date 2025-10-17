import { describe, expect, it } from "vitest";
import { demoSchedule, lookupBasicObligation } from "../src/schedule";

describe("lookupBasicObligation", () => {
  it("uses the next higher income row", () => {
    const res = lookupBasicObligation(demoSchedule, 1234, 2);
    expect(res.status).toBe("ok");
    expect(res.usedRowIncome).toBe(1250);
    expect(res.amount).toBe(79);
  });

  it("flags income above the table", () => {
    const res = lookupBasicObligation(demoSchedule, 40000, 2);
    expect(res.status).toBe("aboveTop");
    expect(res.amount).toBeNull();
  });
});
