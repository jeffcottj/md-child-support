/**
 * Multifamily allowance helpers. These functions look up the 75%-of-one-child
 * deduction Maryland allows when a parent supports additional children in their
 * household.
 */
import type { ParentIncome } from "./schema";
import type { Schedule } from "./schedule";
import { lookupBasicObligation } from "./schedule";

/**
 * Computes the allowed deduction for the given parent based on the statewide
 * schedule.
 *
 * Steps:
 * 1.  Look up the basic obligation for one child using the parent's own income.
 * 2.  Take 75% of that amount.
 * 3.  Multiply by the number of children in the parent's household who are not
 *     part of this case.
 */
export function multifamilyAllowance(
  schedule: Schedule,
  parent: ParentIncome
): number {
  const count = parent.multifamilyChildrenInHome ?? 0;
  if (count <= 0) {
    return 0;
  }

  const lookup = lookupBasicObligation(
    schedule,
    parent.actualMonthly,
    1
  );

  let baseAmount = lookup.amount ?? null;
  if (baseAmount == null) {
    const column = schedule.byChildren?.["1"];
    if (!column || column.length === 0) {
      throw new Error("Schedule missing one-child column for multifamily allowance.");
    }
    baseAmount = column[column.length - 1];
  }

  return 0.75 * baseAmount * count;
}
