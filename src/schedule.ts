/**
 * This file reads the official Maryland child-support schedule and provides
 * helper functions for looking up the correct dollar amount.  You can picture
 * it as a smart version of the table printed in the court forms: given a
 * combined income and a child count, it tells you which row applies.
 */
import scheduleJson from "./schedule-data.json";

/**
 * The shape of the schedule data loaded from JSON.  Every entry in the table
 * uses the same list of income levels, and each "byChildren" column holds the
 * obligation amounts for that number of children.
 */
export type Schedule = {
  combinedMonthlyIncome: number[];
  byChildren: Record<string, number[]>;
  meta?: Record<string, unknown>;
};

/**
 * Performs safety checks on the schedule so we do not read a broken table.
 *
 * The function makes sure the income ladder goes upward one step at a time and
 * that every children column has the same number of rows.  If anything looks
 * suspicious we stop immediately with a clear error message.
 */
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

/**
 * Finds the first income row that is at or above the requested combined income.
 *
 * In court terms this is the "next higher row" rule: when the family earns an
 * amount that falls between table rows we must jump up to the next available
 * row.  If we run off the top of the table we return -1 so the caller can flag
 * the case as discretionary.
 */
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

/**
 * Looks up the basic child-support obligation for a given income and child
 * count.
 *
 * The function first verifies the table, finds the right row using the "next
 * higher" rule, grabs the amount for the requested number of children, and
 * reports whether the amount came from the minimum row, a normal row, or above
 * the top of the chart.
 */
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

/**
 * Convenience export for the built-in sample schedule.  It lets the rest of
 * the program run without asking the user to load their own table first.
 */
export const demoSchedule: Schedule = scheduleJson as Schedule;

// (Explicit re-export to avoid any tooling quirks)
export { ceilingIndex };