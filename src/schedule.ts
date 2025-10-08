// src/schedule.ts
import scheduleJson from "./schedule-data.json";

export type Schedule = {
  combinedMonthlyIncome: number[];
  byChildren: Record<string, number[]>;
  meta?: Record<string, unknown>;
};

export function validateSchedule(s: Schedule): void {
  const incomes = s.combinedMonthlyIncome;
  if (!Array.isArray(incomes) || incomes.length === 0) {
    throw new Error("Schedule has no income rows.");
  }
  for (let i = 1; i < incomes.length; i++) {
    if (!(incomes[i] > incomes[i - 1])) {
      throw new Error("combinedMonthlyIncome must be strictly ascending.");
    }
  }
  const expected = incomes.length;
  for (const [k, arr] of Object.entries(s.byChildren)) {
    if (!Array.isArray(arr) || arr.length !== expected) {
      throw new Error(
        `byChildren["${k}"] length ${Array.isArray(arr) ? arr.length : "N/A"} != incomes length ${expected}`
      );
    }
  }
}

function ceilingIndex(sortedAsc: number[], target: number): number {
  for (let i = 0; i < sortedAsc.length; i++) {
    if (target <= sortedAsc[i]) return i;
  }
  return -1; // target is above the top
}

export type LookupStatus = "ok" | "atOrBelowMinimum" | "aboveTop";

export type LookupResult = {
  status: LookupStatus;
  amount: number | null;
  usedRowIndex: number | null;
  usedRowIncome: number | null;
};

export function lookupBasicObligation(
  schedule: Schedule,
  combinedIncome: number,
  numChildren: number
): LookupResult {
  validateSchedule(schedule);

  const incomes = schedule.combinedMonthlyIncome;
  const idx = ceilingIndex(incomes, combinedIncome);
  if (idx === -1) {
    return {
      status: "aboveTop",
      amount: null,
      usedRowIndex: null,
      usedRowIncome: null,
    };
  }

  const childKey = String(numChildren);
  const col = schedule.byChildren[childKey];
  if (!col) {
    throw new Error(`Schedule has no column for ${numChildren} children.`);
  }

  const amount = col[idx];
  const status: LookupStatus =
    idx === 0 && combinedIncome <= incomes[0] ? "atOrBelowMinimum" : "ok";

  return {
    status,
    amount,
    usedRowIndex: idx,
    usedRowIncome: incomes[idx],
  };
}

// Export the demo schedule (typed) too
export const demoSchedule: Schedule = scheduleJson as Schedule;

// (Explicit re-export to avoid any tooling quirks)
export { ceilingIndex };